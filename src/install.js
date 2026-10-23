import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { merge3 } from './merge.js';

export const MANIFEST = '.claude/brigade.json';
export const OPTIONS_FILE = '.claude/rules/brigade-options.md';
// The kit content as last installed, one file per managed kit file: the common ancestor of the three-way merge.
export const BASE_DIR = '.claude/brigade-base';

// Lines Brigade appends to the project files when missing. Existing lines are never touched or duplicated.
const APPENDS = {
    '.gitignore': ['.claude/settings.local.json', 'CLAUDE.local.md'],
    '.gitattributes': ['.claude/hooks/* text eol=lf']
};

const RULES_PATH = '.claude/rules/brigade.md';
const SETTINGS_PATH = '.claude/settings.json';
const MIGRATION_NOTE = "The kit's brigade.md no longer holds your options: they moved to .claude/rules/brigade-options.md. Merge brigade.md.proposed into your file, or delete your file's edits and re-run to take the new one.";

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

// `json`: the values go inside JSON strings, so quotes, backslashes and control characters are escaped.
export function render(content, answers, json = false) {
    const values = {
        DEFAULT_BRANCH: answers.defaultBranch,
        BASE_BRANCH: answers.baseBranch,
        PACKAGE_MANAGER: answers.packageManager,
        COMMIT_FORMAT: answers.commitFormat,
        REPLY_LANGUAGE: answers.replyLanguage,
        CODE_LANGUAGE: answers.codeLanguage,
        DOCS_LANGUAGE: answers.docsLanguage
    };
    const escape = (value) => (json ? JSON.stringify(String(value)).slice(1, -1) : value);
    return content.replace(/__([A-Z_]+)__/g, (match, key) => (values[key] === undefined ? match : escape(values[key])));
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

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const isSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The developer's settings plus what the kit adds. Objects merge by key, arrays are a union (the developer's entries
// first, the kit's missing ones after, compared by value), any other value stays the developer's.
// `base` is the kit as last installed: what it had and the kit dropped is removed, if the developer did not change it.
export function mergeSettings(mine, kit, base) {
    if (Array.isArray(mine) && Array.isArray(kit)) {
        const dropped = Array.isArray(base) ? base.filter((item) => !kit.some((other) => isSame(item, other))) : [];
        const kept = mine.filter((item) => !dropped.some((old) => isSame(item, old)));
        const known = new Set(kept.map((item) => JSON.stringify(item)));
        return [...kept, ...kit.filter((item) => !known.has(JSON.stringify(item)))];
    }
    if (isObject(mine) && isObject(kit)) {
        const merged = { ...mine };
        if (isObject(base)) {
            for (const [key, old] of Object.entries(base)) {
                if (!(key in kit) && key in mine && isSame(mine[key], old)) delete merged[key];
            }
        }
        for (const [key, value] of Object.entries(kit)) merged[key] = key in mine ? mergeSettings(mine[key], value, isObject(base) ? base[key] : undefined) : value;
        return merged;
    }
    return mine;
}

// The merged file content, or null when either side is not a JSON object (the caller falls back to a proposal).
// A base that is not a JSON object counts as no base.
function mergedSettings(current, kit, base) {
    try {
        const mine = JSON.parse(current);
        const theirs = JSON.parse(kit);
        if (!isObject(mine) || !isObject(theirs)) return null;
        let old;
        try {
            old = base === null ? undefined : JSON.parse(base);
        } catch {
            old = undefined;
        }
        return { merged: mergeSettings(mine, theirs, old), mine };
    } catch {
        return null;
    }
}

// The path of the base copy of a kit file, relative to the base folder. The leading `.claude/` is dropped so that no
// `.claude` folder exists inside the base folder: Claude Code could load the skills, agents, rules or settings of a
// nested one as duplicates. Kit files all start with `.claude/`, so two of them never share a base path; one that does
// not keeps its full path, which cannot collide with the stripped ones either.
export function baseRelative(path) {
    return path.startsWith('.claude/') ? path.slice('.claude/'.length) : path;
}

// Where the base copy of a kit file lives, or null when the path would leave the base folder.
function basePath(cwd, path) {
    const root = resolve(cwd, BASE_DIR);
    const file = resolve(root, baseRelative(path));
    return file.startsWith(root + sep) ? file : null;
}

// The base of a file, or null when there is none or it cannot be read: both mean "no base", never an error.
function readBase(cwd, path) {
    const file = basePath(cwd, path);
    try {
        return file && statSync(file).isFile() ? readFileSync(file, 'utf8') : null;
    } catch {
        return null;
    }
}

// Walks up from a removed file and drops the directories it left empty, never going above the project.
function pruneEmptyDirs(cwd, file) {
    const root = resolve(cwd);
    for (let dir = dirname(resolve(file)); dir.startsWith(root + sep); dir = dirname(dir)) {
        if (!existsSync(dir) || readdirSync(dir).length > 0) return;
        rmdirSync(dir);
    }
}

// Never overwrites a file that differs from what Brigade last wrote: an edited file gets the kit's changes merged in
// (three-way, from the base copy of the last kit version), or a `.proposed` next to it when that is not possible.
// Everything is planned first (reads only), then written, so an error while planning leaves the project untouched.
export function planFiles({ cwd, stackDir, answers, previous }) {
    const report = [];
    const kit = new Set();
    const hashes = {};
    const writes = [];
    const removals = [];

    for (const source of listFiles(stackDir)) {
        const path = relative(stackDir, source).split('\\').join('/');
        kit.add(path);
        const target = join(cwd, path);
        const content = render(readFileSync(source, 'utf8'), answers, path.endsWith('.json'));
        const mode = statSync(source).mode & 0o777;
        const wanted = sha(content);
        const proposed = `${target}.proposed`;
        const write = (file) => writes.push({ file, content, mode });
        const recorded = previous?.files?.[path];
        // Write-once files are the team's own: they have no base.
        const base = WRITE_ONCE.has(path) ? null : readBase(cwd, path);
        const baseFile = WRITE_ONCE.has(path) ? null : basePath(cwd, path);
        // The base always becomes the kit content just installed or known to be the last one.
        const storeBase = () => {
            if (baseFile && base !== content) writes.push({ file: baseFile, content, mode: 0o644 });
        };

        if (!existsSync(target)) {
            write(target);
            storeBase();
            hashes[path] = wanted;
            report.push({ path, status: 'created' });
            continue;
        }

        const text = readFileSync(target, 'utf8');
        const current = sha(text);
        const settings = path === SETTINGS_PATH && current !== wanted ? mergedSettings(text, content, base) : null;
        if (WRITE_ONCE.has(path)) {
            report.push({ path, status: current === wanted ? 'unchanged' : 'kept' });
            continue;
        }
        if (current === wanted) {
            // The target caught up with the kit: an old proposal is stale.
            if (existsSync(proposed)) removals.push(proposed);
            storeBase();
            hashes[path] = current;
            report.push({ path, status: 'unchanged' });
        } else if (recorded === current) {
            write(target);
            storeBase();
            if (existsSync(proposed)) removals.push(proposed);
            hashes[path] = wanted;
            report.push({ path, status: 'updated' });
        } else if (settings) {
            // The developer's entries stay, the kit's new ones are added. The recorded hash stays the kit's, so the
            // next update merges again instead of taking the file for an untouched one.
            const { merged, mine } = settings;
            if (recorded) hashes[path] = recorded;
            storeBase();
            if (existsSync(proposed)) removals.push(proposed);
            if (isSame(merged, mine)) {
                report.push({ path, status: 'kept' });
            } else {
                writes.push({ file: target, content: `${JSON.stringify(merged, null, 4)}\n`, mode });
                report.push({ path, status: 'merged' });
            }
        } else if (recorded === wanted) {
            // The kit did not change this file since the last install: nothing new to propose. A proposal left by an
            // earlier version stays, it is the developer's file now. Kit unchanged also means `wanted` is the base.
            if (base === null) storeBase();
            hashes[path] = wanted;
            report.push({ path, status: 'kept' });
        } else {
            const merge = base !== null && path !== SETTINGS_PATH ? merge3(base, text, content) : null;
            if (merge && merge.conflicts === 0) {
                // The developer's edits and the kit's changes both apply. The kit's hash is recorded, as for any
                // file the kit changed, and the base moves to this kit version.
                storeBase();
                if (existsSync(proposed)) removals.push(proposed);
                hashes[path] = wanted;
                if (sha(merge.text) === current) {
                    report.push({ path, status: 'kept' });
                } else {
                    writes.push({ file: target, content: merge.text, mode: statSync(target).mode & 0o777 });
                    report.push({ path, status: 'merged' });
                }
            } else if (merge) {
                // The developer's file is never touched. The proposal is delivered once: the kit version is now seen,
                // so its hash is recorded and it becomes the base. The next run finds the kit unchanged (`kept`) and
                // leaves the `.proposed` alone as a reminder; a later kit change merges against this version.
                const same = existsSync(proposed) && readFileSync(proposed, 'utf8') === merge.text;
                if (!same) writes.push({ file: proposed, content: merge.text, mode });
                storeBase();
                hashes[path] = wanted;
                report.push({ path, status: 'conflict' });
            } else {
                // No usable base (installs made before the base copies, or a missing or unreadable one): the whole
                // kit file is proposed, once: `wanted` is recorded and stored as the base. If the developer merges the
                // proposal, it is exactly the right ancestor; if they keep their file, later kit changes are merged
                // against `wanted` and what they differ on shows up as a conflict, never as a silent overwrite.
                const same = existsSync(proposed) && sha(readFileSync(proposed, 'utf8')) === wanted;
                if (!same) write(proposed);
                storeBase();
                hashes[path] = wanted;
                const entry = { path, status: 'proposed' };
                if (path === RULES_PATH && !text.includes('brigade-options.md')) entry.note = MIGRATION_NOTE;
                report.push(entry);
            }
        }
    }

    // Recorded in the manifest but no longer in the kit: removed if untouched, kept and reported if edited.
    // The base copy goes either way: nothing merges against it anymore.
    for (const [path, recorded] of Object.entries(previous?.files ?? {})) {
        if (kit.has(path) || WRITE_ONCE.has(path)) continue;
        const baseFile = basePath(cwd, path);
        if (baseFile && existsSync(baseFile) && statSync(baseFile).isFile()) removals.push(baseFile);
        const target = resolve(cwd, path);
        // Only files inside the project, whatever the manifest says.
        if (!target.startsWith(resolve(cwd) + sep) || !existsSync(target) || !statSync(target).isFile()) continue;

        if (sha(readFileSync(target, 'utf8')) === recorded) {
            removals.push(target);
            report.push({ path, status: 'removed' });
        } else {
            hashes[path] = recorded;
            report.push({ path, status: 'obsolete' });
        }
    }

    return { report, hashes, writes, removals };
}

// The only step that writes. Directories left empty by a removal are cleaned.
export function applyPlan(cwd, { writes, removals }) {
    for (const { file, content, mode } of writes) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content, { mode });
        chmodSync(file, mode);
    }
    for (const file of removals) {
        rmSync(file, { force: true });
        pruneEmptyDirs(cwd, file);
    }
}

export function installFiles(options) {
    const plan = planFiles(options);
    applyPlan(options.cwd, plan);
    return { report: plan.report, hashes: plan.hashes };
}

// The project's answers in plain English. Not a kit file: generated from the answers at every install, always overwritten.
export function renderOptions(answers) {
    return `# Brigade options

<!-- Generated by Brigade from .claude/brigade.json. Do not edit: changes are overwritten at the next install or update. -->

Options of this project, referred to by \`.claude/rules/brigade.md\`.

- Default branch: \`${answers.defaultBranch}\`.
- Reference branch of the work: \`${answers.baseBranch}\`.
- Package manager: \`${answers.packageManager}\`.
- Commit format: ${answers.commitFormat}
- Code, comments and commit messages language: ${answers.codeLanguage}.
- Documentation language: ${answers.docsLanguage}.
- Reply language, project default: ${answers.replyLanguage}.
`;
}

export function writeOptionsFile({ cwd, answers, dryRun = false }) {
    const file = join(cwd, OPTIONS_FILE);
    const content = renderOptions(answers);
    const exists = existsSync(file);
    if (exists && sha(readFileSync(file, 'utf8')) === sha(content)) return { path: OPTIONS_FILE, status: 'unchanged' };

    if (!dryRun) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
    }
    return { path: OPTIONS_FILE, status: exists ? 'updated' : 'created' };
}

const normalize = (line) => line.trim().replace(/^\//, '');

// `dryRun`: the missing lines are reported but nothing is written.
export function appendMissingLines(cwd, dryRun = false) {
    return Object.entries(APPENDS).map(([path, lines]) => {
        const file = join(cwd, path);
        const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
        const known = new Set(existing.split(/\r?\n/).map(normalize));
        const missing = lines.filter((line) => !known.has(normalize(line)));

        if (missing.length === 0) return { path, status: 'unchanged' };

        // Keep the file's own line endings.
        if (!dryRun) {
            const eol = existing.includes('\r\n') ? '\r\n' : '\n';
            const separator = existing === '' || existing.endsWith('\n') ? '' : eol;
            const gap = existing === '' ? '' : eol;
            writeFileSync(file, `${existing}${separator}${gap}${missing.join(eol)}${eol}`);
        }
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
