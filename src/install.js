import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { commitFormatOf } from './conventions.js';

export const MANIFEST = '.claude/brigade.json';
export const OPTIONS_FILE = '.claude/rules/brigade-options.md';
// Folder of base copies left by Brigade 1.3.0, removed at every update.
export const LEGACY_BASE_DIR = '.claude/brigade-base';

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

// Angular states its own body rule (required except for `docs`); every other format leaves the body optional.
const bodyRule = ({ commitConvention }) => (commitConvention === 'angular' ? '' : ' Add a body when the "why" is not obvious.');

// `json`: the values go inside JSON strings, so quotes, backslashes and control characters are escaped.
export function render(content, answers, json = false) {
    const values = {
        DEFAULT_BRANCH: answers.defaultBranch,
        BASE_BRANCH: answers.baseBranch,
        PACKAGE_MANAGER: answers.packageManager,
        COMMIT_FORMAT: commitFormatOf(answers) + bodyRule(answers),
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
export function mergeSettings(mine, kit) {
    if (Array.isArray(mine) && Array.isArray(kit)) {
        const known = new Set(mine.map((item) => JSON.stringify(item)));
        return [...mine, ...kit.filter((item) => !known.has(JSON.stringify(item)))];
    }
    if (isObject(mine) && isObject(kit)) {
        const merged = { ...mine };
        for (const [key, value] of Object.entries(kit)) merged[key] = key in mine ? mergeSettings(mine[key], value) : value;
        return merged;
    }
    return mine;
}

// The merged file content, or null when either side is not a JSON object (the caller falls back to a proposal).
function mergedSettings(current, kit) {
    try {
        const mine = JSON.parse(current);
        const theirs = JSON.parse(kit);
        if (!isObject(mine) || !isObject(theirs)) return null;
        return { merged: mergeSettings(mine, theirs), mine };
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

// Never overwrites a file that differs from what Brigade last wrote: an edited file gets a `.proposed` next to it when
// the kit changed it. Everything is planned first (reads only), then written, so an error while planning leaves the
// project untouched.
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

        if (!existsSync(target)) {
            write(target);
            hashes[path] = wanted;
            report.push({ path, status: 'created' });
            continue;
        }

        const text = readFileSync(target, 'utf8');
        const current = sha(text);
        const settings = path === SETTINGS_PATH && current !== wanted ? mergedSettings(text, content) : null;
        if (WRITE_ONCE.has(path)) {
            report.push({ path, status: current === wanted ? 'unchanged' : 'kept' });
            continue;
        }
        if (current === wanted) {
            // The target caught up with the kit: an old proposal is stale.
            if (existsSync(proposed)) removals.push(proposed);
            hashes[path] = current;
            report.push({ path, status: 'unchanged' });
        } else if (recorded === current) {
            write(target);
            if (existsSync(proposed)) removals.push(proposed);
            hashes[path] = wanted;
            report.push({ path, status: 'updated' });
        } else if (settings) {
            // The developer's entries stay, the kit's new ones are added. The recorded hash stays the kit's, so the
            // next update merges again instead of taking the file for an untouched one.
            const { merged, mine } = settings;
            if (recorded) hashes[path] = recorded;
            if (existsSync(proposed)) removals.push(proposed);
            if (isSame(merged, mine)) {
                report.push({ path, status: 'kept' });
            } else {
                writes.push({ file: target, content: `${JSON.stringify(merged, null, 4)}\n`, mode });
                report.push({ path, status: 'merged' });
            }
        } else if (recorded === wanted) {
            // The kit did not change this file since the last install: nothing new to propose. A proposal left by an
            // earlier version stays, it is the developer's file now.
            hashes[path] = wanted;
            report.push({ path, status: 'kept' });
        } else {
            // The developer's file is never touched. The proposal is delivered once: the kit's hash is recorded, so the
            // next run finds the kit unchanged (`kept`) and leaves the `.proposed` alone as a reminder, even if it was
            // deleted. It is written again only when the kit changes the file again.
            const same = existsSync(proposed) && sha(readFileSync(proposed, 'utf8')) === wanted;
            if (!same) write(proposed);
            hashes[path] = wanted;
            const entry = { path, status: 'proposed' };
            if (path === RULES_PATH && !text.includes('brigade-options.md')) entry.note = MIGRATION_NOTE;
            report.push(entry);
        }
    }

    // Recorded in the manifest but no longer in the kit: removed if untouched, kept and reported if edited.
    for (const [path, recorded] of Object.entries(previous?.files ?? {})) {
        if (kit.has(path) || WRITE_ONCE.has(path)) continue;
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

    // The base copies of Brigade 1.3.0 are of no use anymore.
    const legacy = join(cwd, LEGACY_BASE_DIR);
    if (existsSync(legacy) && statSync(legacy).isDirectory()) {
        removals.push(legacy);
        report.push({ path: `${LEGACY_BASE_DIR}/`, status: 'removed' });
    }

    return { report, hashes, writes, removals };
}

// Writes to a temp file next to the target, then renames it over: a reader never sees a half-written file, and a failed
// write leaves the target as it was. Without a `mode`, the target keeps its own.
export function writeAtomic(file, content, mode) {
    mkdirSync(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    mode ??= existsSync(file) ? statSync(file).mode & 0o777 : undefined;
    try {
        writeFileSync(temp, content);
        if (mode !== undefined) chmodSync(temp, mode);
        renameSync(temp, file);
    } catch (error) {
        rmSync(temp, { force: true });
        throw error;
    }
}

// The only step that writes. Directories left empty by a removal are cleaned.
export function applyPlan(cwd, { writes, removals }) {
    for (const { file, content, mode } of writes) writeAtomic(file, content, mode);
    for (const file of removals) {
        rmSync(file, { force: true, recursive: true });
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
- Commit format: ${commitFormatOf(answers)}
- Code, comments and commit messages language: ${answers.codeLanguage}.
- Documentation language: ${answers.docsLanguage}.
- Reply language, project default: ${answers.replyLanguage}.
`;
}

// Reads only: the report entry and the write (none when the file is already right).
function planOptionsFile({ cwd, answers }) {
    const file = join(cwd, OPTIONS_FILE);
    const content = renderOptions(answers);
    const exists = existsSync(file);
    if (exists && sha(readFileSync(file, 'utf8')) === sha(content)) return { entry: { path: OPTIONS_FILE, status: 'unchanged' }, writes: [] };
    return { entry: { path: OPTIONS_FILE, status: exists ? 'updated' : 'created' }, writes: [{ file, content }] };
}

const normalize = (line) => line.trim().replace(/^\//, '');

// Reads only: the missing lines are reported and turned into writes.
function planAppends(cwd) {
    const ignored = [];
    const writes = [];
    for (const [path, lines] of Object.entries(APPENDS)) {
        const file = join(cwd, path);
        const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
        const known = new Set(existing.split(/\r?\n/).map(normalize));
        const missing = lines.filter((line) => !known.has(normalize(line)));

        if (missing.length === 0) {
            ignored.push({ path, status: 'unchanged' });
            continue;
        }

        // Keep the file's own line endings.
        const eol = existing.includes('\r\n') ? '\r\n' : '\n';
        const separator = existing === '' || existing.endsWith('\n') ? '' : eol;
        const gap = existing === '' ? '' : eol;
        writes.push({ file, content: `${existing}${separator}${gap}${missing.join(eol)}${eol}` });
        ignored.push({ path, status: 'updated', added: missing });
    }
    return { ignored, writes };
}

export function appendMissingLines(cwd) {
    const { ignored, writes } = planAppends(cwd);
    applyPlan(cwd, { writes, removals: [] });
    return ignored;
}

// The rest of the install, planned after the kit files: the options file, the ignore lines and the manifest. The
// manifest comes last, so a failed write leaves the previous install described.
export function planExtras({ cwd, version, stack, answers, hashes }) {
    const options = planOptionsFile({ cwd, answers });
    const { ignored, writes } = planAppends(cwd);
    const files = Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
    const manifest = { file: join(cwd, MANIFEST), content: `${JSON.stringify({ version, stack, answers, files }, null, 4)}\n` };
    return { report: [options.entry], ignored, writes: [...options.writes, ...writes, manifest] };
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
    writeAtomic(file, `${JSON.stringify({ ...current, ...patch }, null, 4)}\n`);
    return { status: 'written' };
}
