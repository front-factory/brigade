import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export const MANIFEST = '.claude/brigade.json';

// Lines Brigade appends to the project files when missing. Existing lines are never touched or duplicated.
const APPENDS = {
    '.gitignore': ['.claude/settings.local.json', 'CLAUDE.local.md'],
    '.gitattributes': ['.claude/hooks/* text eol=lf']
};

// Written once, then the team's own: never updated, never proposed over.
const WRITE_ONCE = new Set(['.claude/context/decisions.md', '.claude/context/architecture.md']);

// Line endings do not count: a CRLF checkout of a kit file is the same file.
export const sha = (content) => createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(abs);
        return entry.name === '.DS_Store' ? [] : [abs];
    });
}

// True when the project already holds at least one file of the kit.
export function hasKitFiles({ cwd, stackDir }) {
    return listFiles(stackDir).some((source) => existsSync(join(cwd, relative(stackDir, source))));
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

// A missing manifest means a first install. An unreadable one is an error: guessing would overwrite the install.
export function readManifest(cwd) {
    const file = join(cwd, MANIFEST);
    if (!existsSync(file)) return null;
    try {
        const manifest = JSON.parse(readFileSync(file, 'utf8'));
        if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) return manifest;
    } catch {
        // Reported below, same as a valid JSON of the wrong shape.
    }
    throw new Error(`${MANIFEST} is corrupted. Fix it or delete it to start over (Brigade will then treat this as a first install).`);
}

// Never overwrites a file that differs from what Brigade last wrote: that one gets a `.proposed` next to it.
// Everything is planned first (reads only), then written, so an error while planning leaves the project untouched.
export function installFiles({ cwd, stackDir, answers, previous }) {
    const report = [];
    const hashes = {};
    const writes = [];
    const removals = [];

    for (const source of listFiles(stackDir)) {
        const path = relative(stackDir, source).split('\\').join('/');
        const target = join(cwd, path);
        const content = render(readFileSync(source, 'utf8'), answers);
        const mode = statSync(source).mode & 0o777;
        const wanted = sha(content);
        const proposed = `${target}.proposed`;
        const write = (file) => writes.push({ file, content, mode });

        if (!existsSync(target)) {
            write(target);
            hashes[path] = wanted;
            report.push({ path, status: 'created' });
            continue;
        }

        const current = sha(readFileSync(target, 'utf8'));
        if (WRITE_ONCE.has(path)) {
            report.push({ path, status: current === wanted ? 'unchanged' : 'kept' });
            continue;
        }
        if (current === wanted) {
            // The target caught up with the kit: an old proposal is stale.
            if (existsSync(proposed)) removals.push(proposed);
            hashes[path] = current;
            report.push({ path, status: 'unchanged' });
        } else if (previous?.files?.[path] === current) {
            write(target);
            if (existsSync(proposed)) removals.push(proposed);
            hashes[path] = wanted;
            report.push({ path, status: 'updated' });
        } else {
            const same = existsSync(proposed) && sha(readFileSync(proposed, 'utf8')) === wanted;
            if (!same) write(proposed);
            if (previous?.files?.[path]) hashes[path] = previous.files[path];
            report.push({ path, status: 'proposed' });
        }
    }

    for (const { file, content, mode } of writes) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content, { mode });
        chmodSync(file, mode);
    }
    for (const file of removals) rmSync(file, { force: true });

    return { report, hashes };
}

const normalize = (line) => line.trim().replace(/^\//, '');

export function appendMissingLines(cwd) {
    return Object.entries(APPENDS).map(([path, lines]) => {
        const file = join(cwd, path);
        const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
        const known = new Set(existing.split(/\r?\n/).map(normalize));
        const missing = lines.filter((line) => !known.has(normalize(line)));

        if (missing.length === 0) return { path, status: 'unchanged' };

        // Keep the file's own line endings.
        const eol = existing.includes('\r\n') ? '\r\n' : '\n';
        const separator = existing === '' || existing.endsWith('\n') ? '' : eol;
        const heading = existing === '' ? '' : eol;
        writeFileSync(file, `${existing}${separator}${heading}## Claude${eol}${missing.join(eol)}${eol}`);
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
