#!/usr/bin/env node
// SessionStart hook: injects the Brigade version, the team decisions, the branch and its sync, the feature file of the
// branch and the stale feature files, as `hookSpecificOutput.additionalContext`. It never fails the session: any error
// leaves out what it could not read, and it exits 0.
import { execFileSync } from 'node:child_process';
import {
    existsSync, readdirSync, readFileSync
} from 'node:fs';
import { join } from 'node:path';

const SHORT = 40;
const read = (file) => readFileSync(file, 'utf8');

const attempt = (fn) => {
    try {
        return fn();
    } catch {
        return null;
    }
};

const git = (root, ...args) => attempt(() => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: [
        'ignore',
        'pipe',
        'ignore'
    ]
}).trim());

// A feature file: the whole text when short, else its Goal and Steps sections.
const summary = (text) => {
    const lines = text.trimEnd().split('\n');

    if (lines.length <= SHORT) {
        return text.trim();
    }

    const keep = [];
    let on = true;

    for (const line of lines) {
        if (line.startsWith('## ')) {
            on = /^## (Goal|Steps)\b/.test(line);
        }

        if (on) {
            keep.push(line);
        }
    }

    return keep.join('\n').trim();
};

export function context(root) {
    const parts = [];
    const manifest = attempt(() => JSON.parse(read(join(root, '.claude', 'brigade.json'))));

    if (typeof manifest?.version === 'string' && manifest.version) {
        parts.push(`Brigade v${manifest.version} manages this project.`);
    }

    const decisions = attempt(() => read(join(root, '.claude', 'context', 'decisions.md')));

    // Comments and the title line are for humans: they are not injected.
    const kept = decisions?.replace(/<!--.*?-->/gs, '').replace(/^# .*$/m, '').replace(/\n{3,}/g, '\n\n').trim();

    if (kept?.replace(/^#.*$/gm, '').trim()) {
        parts.push(`Team decisions (.claude/context/decisions.md):\n${kept}`);
    }

    const branch = git(root, 'branch', '--show-current');

    if (branch) {
        const sync = git(root, 'rev-list', '--left-right', '--count', '@{u}...HEAD')?.split(/\s+/);

        parts.push(`Branch: ${branch} (${sync ? `behind ${sync[0]}, ahead ${sync[1]}` : 'no upstream'}).`);

        const rel = join('.claude', 'context', 'features', `${branch.replaceAll('/', '-')}.md`);
        const text = attempt(() => read(join(root, rel)));

        if (text) {
            parts.push(`Feature file ${rel}:\n${summary(text)}`);
        }
    }

    const dir = join(root, '.claude', 'context', 'features');
    const files = existsSync(dir) ? attempt(() => readdirSync(dir).filter((name) => name.endsWith('.md') && name !== '_template.md').sort()) : null;

    if (files?.length) {
        const refs = git(root, 'for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin');

        const known = new Set([
            branch,
            ...(refs ?? '').split('\n').flatMap((ref) => [
                ref,
                ref.replace(/^origin\//, '')
            ])
        ]);

        const stale = [];

        for (const name of refs === null ? [] : files) {
            const owner = attempt(() => /\(branch ([^)\s]+)\)/.exec(read(join(dir, name)).split('\n')[0])?.[1]);

            if (owner && !known.has(owner)) {
                stale.push(name);
            }
        }

        if (stale.length) {
            parts.push(`Stale feature files (branch gone, remove them) in .claude/context/features/: ${stale.join(', ')}`);
        }
    }

    return parts.join('\n\n');
}

try {
    const cwd = attempt(() => JSON.parse(readFileSync(0, 'utf8'))?.cwd);
    const text = context(process.env.CLAUDE_PROJECT_DIR || cwd || process.cwd());

    if (text) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'SessionStart',
                additionalContext: text
            }
        }));
    }
} catch {
    // Nothing to say rather than a failed session.
}
