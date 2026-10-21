import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export const MANIFEST = '.claude/brigade.json';

// Lines Brigade appends to the project files when missing. Existing lines are never touched or duplicated.
const APPENDS = {
    '.gitignore': ['.claude/settings.local.json', 'CLAUDE.local.md'],
    '.gitattributes': ['.claude/hooks/* text eol=lf']
};

// Written once, then the team's own: never updated, never proposed over.
const WRITE_ONCE = new Set(['.claude/context/decisions.md']);

const sha = (content) => createHash('sha256').update(content).digest('hex');

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(abs);
        return entry.name === '.DS_Store' ? [] : [abs];
    });
}

export function render(content, answers) {
    const values = {
        DEFAULT_BRANCH: answers.defaultBranch,
        BASE_BRANCH: answers.baseBranch,
        PACKAGE_MANAGER: answers.packageManager,
        COMMIT_FORMAT: answers.commitFormat,
        REPLY_LANGUAGE: answers.replyLanguage,
        CODE_LANGUAGE: answers.codeLanguage,
        DOCS_LANGUAGE: answers.docsLanguage
    };
    return content.replace(/__([A-Z_]+)__/g, (match, key) => values[key] ?? match);
}

export function readManifest(cwd) {
    try {
        return JSON.parse(readFileSync(join(cwd, MANIFEST), 'utf8'));
    } catch {
        return null;
    }
}

// Never overwrites a file that differs from what Brigade last wrote: that one gets a `.proposed` next to it.
export function installFiles({ cwd, stackDir, answers, previous }) {
    const report = [];
    const hashes = {};

    for (const source of listFiles(stackDir)) {
        const path = relative(stackDir, source).split('\\').join('/');
        const target = join(cwd, path);
        const content = render(readFileSync(source, 'utf8'), answers);
        const mode = statSync(source).mode & 0o777;

        const write = (file) => {
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, content, { mode });
            chmodSync(file, mode);
        };

        if (!existsSync(target)) {
            write(target);
            hashes[path] = sha(content);
            report.push({ path, status: 'created' });
            continue;
        }

        const current = sha(readFileSync(target, 'utf8'));
        if (WRITE_ONCE.has(path)) {
            report.push({ path, status: current === sha(content) ? 'unchanged' : 'kept' });
            continue;
        }
        if (current === sha(content)) {
            hashes[path] = current;
            report.push({ path, status: 'unchanged' });
        } else if (previous?.files?.[path] === current) {
            write(target);
            hashes[path] = sha(content);
            report.push({ path, status: 'updated' });
        } else {
            const proposed = `${target}.proposed`;
            const same = existsSync(proposed) && sha(readFileSync(proposed, 'utf8')) === sha(content);
            if (!same) write(proposed);
            if (previous?.files?.[path]) hashes[path] = previous.files[path];
            report.push({ path, status: 'proposed' });
        }
    }

    return { report, hashes };
}

const normalize = (line) => line.trim().replace(/^\//, '');

export function appendMissingLines(cwd) {
    return Object.entries(APPENDS).map(([path, lines]) => {
        const file = join(cwd, path);
        const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
        const known = new Set(existing.split('\n').map(normalize));
        const missing = lines.filter((line) => !known.has(normalize(line)));

        if (missing.length === 0) return { path, status: 'unchanged' };

        const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
        const heading = existing === '' ? '' : '\n';
        writeFileSync(file, `${existing}${separator}${heading}## Claude\n${missing.join('\n')}\n`);
        return { path, status: 'updated', added: missing };
    });
}

export function writeManifest({ cwd, version, stack, answers, hashes }) {
    const file = join(cwd, MANIFEST);
    mkdirSync(dirname(file), { recursive: true });
    const files = Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(file, `${JSON.stringify({ version, stack, answers, files }, null, 4)}\n`);
}

// Personal answers go to the developer's own local settings, never to the shared files. A broken file is left alone.
export function writeLocalSettings(cwd, patch) {
    const file = join(cwd, '.claude', 'settings.local.json');
    let current = {};
    if (existsSync(file)) {
        try {
            current = JSON.parse(readFileSync(file, 'utf8'));
        } catch {
            return { status: 'skipped' };
        }
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ ...current, ...patch }, null, 4)}\n`);
    return { status: 'written' };
}
