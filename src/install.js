import {
    chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync
} from 'node:fs';
import {
    dirname, join, resolve, sep
} from 'node:path';
import { isGitRepo, readJson } from './detect.js';
import {
    detectStack, kitFiles, WRITE_ONCE
} from './kit.js';
import { gather } from './options.js';
import { item } from './prompt.js';
import {
    OPTIONS_FILE, renderOptions, sha
} from './render.js';
import { lines, QUIET } from './ui.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
export const MANIFEST = '.claude/brigade.json';
export const SETTINGS = '.claude/settings.json';
const LOCAL_SETTINGS = '.claude/settings.local.json';

// Folder of base copies left by Brigade 1.3.0, removed at every update.
export const LEGACY_DIR = '.claude/brigade-base';

// The status line of Brigade 1.x, gone from the kit: still recognized so an update drops it from a merged settings.json.
const LEGACY_STATUSLINE = '.claude/hooks/statusline.mjs';

// Lines Brigade appends to the project files when missing. Existing lines are never touched or duplicated.
const APPENDS = {
    '.gitignore': '.claude/settings.local.json\nCLAUDE.local.md',
    '.gitattributes': '.claude/hooks/* text eol=lf'
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = (value) => `${JSON.stringify(value, null, 4)}\n`;
const readText = (file) => readFileSync(file, 'utf8');

const collator = new Intl.Collator('en', {
    numeric: true
});

// Positive when `a` is newer than `b`. Build metadata is ignored; a pre-release is older than its release, and
// pre-release identifiers compare numerically when numeric.
export function compareVersions(a, b) {
    const x = a.split('+')[0].split(/-(.*)/s);
    const y = b.split('+')[0].split(/-(.*)/s);

    return collator.compare(x[0], y[0]) || Boolean(y[1]) - Boolean(x[1]) || collator.compare(x[1] ?? '', y[1] ?? '');
}

// A missing manifest means a first install. An unreadable one is an error: guessing would overwrite the install.
export function readManifest(cwd) {
    const file = join(cwd, MANIFEST);

    if (!existsSync(file)) {
        return null;
    }

    const manifest = readJson(file);

    if (!isObject(manifest)) {
        throw new Error(`${MANIFEST} is corrupted. Fix it or delete it to start over (Brigade will then treat this as a first install).`);
    }

    return manifest;
}

// The script a command finally runs: the last `.claude/hooks/<name>` path, so a wrapper like run-node.sh does not count.
const script = (command) => (typeof command === 'string' ? [
    ...command.matchAll(/\.claude\/hooks\/([\w.-]+)/g)
].at(-1)?.[1] : undefined);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isEmpty = (value) => (Array.isArray(value) || isObject(value)) && Object.keys(value).length === 0;

// The developer's settings without the entries that run a kit hook script, whatever their version: older kit commands
// are dropped too, so a merge does not keep both and an uninstall leaves nothing behind. The developer's own stay.
export function dropKitEntries(mine, kit) {
    const names = new Set([
        kit.statusLine?.command,
        LEGACY_STATUSLINE,
        ...Object.values(kit.hooks ?? {}).flat().flatMap((group) => group.hooks?.map((hook) => hook.command) ?? [])
    ].map(script));

    const owned = (command) => script(command) !== undefined && names.has(script(command));
    const rest = structuredClone(mine);

    if (owned(rest.statusLine?.command)) {
        delete rest.statusLine;
    }

    for (const event of Object.keys(isObject(rest.hooks) ? rest.hooks : {})) {
        const groups = rest.hooks[event];

        if (Array.isArray(groups)) {
            rest.hooks[event] = groups.filter((group) => {
                const before = group?.hooks?.length;

                if (Array.isArray(group?.hooks)) {
                    group.hooks = group.hooks.filter((hook) => !owned(hook?.command));
                }

                return !before || group.hooks.length > 0;
            });

            if (groups.length > 0 && rest.hooks[event].length === 0) {
                delete rest.hooks[event];
            }
        }
    }

    if (isEmpty(rest.hooks)) {
        delete rest.hooks;
    }

    return rest;
}

// Objects merge by key, arrays are a union (the developer's entries first, compared by value), the developer's scalars win.
export function mergeSettings(mine, kit) {
    if (Array.isArray(mine) && Array.isArray(kit)) {
        return mine.concat(kit.filter((entry) => !mine.some((own) => same(own, entry))));
    }

    if (!isObject(mine) || !isObject(kit)) {
        return mine;
    }

    const merged = structuredClone(mine);

    for (const key of Object.keys(kit)) {
        merged[key] = key in mine ? mergeSettings(mine[key], kit[key]) : kit[key];
    }

    return merged;
}

// The inverse of mergeSettings: array items and keys equal to the kit's are dropped, and so are the objects and
// arrays left empty.
export function stripSettings(mine, kit) {
    if (Array.isArray(mine) && Array.isArray(kit)) {
        return mine.filter((entry) => !kit.some((own) => same(own, entry)));
    }

    if (!isObject(mine) || !isObject(kit)) {
        return mine;
    }

    const rest = {};

    for (const key of Object.keys(mine)) {
        const left = key in kit ? stripSettings(mine[key], kit[key]) : mine[key];

        if (!(key in kit && (same(mine[key], kit[key]) || isEmpty(left)))) {
            rest[key] = left;
        }
    }

    return rest;
}

// The developer's settings plus the current kit entries: the kit's hook entries are replaced, then merged. The old kit
// defaults (mode, model) move to the new ones, since the merge keeps the developer's value and would leave them forever.
export function mergeKit(mine, kit) {
    const merged = mergeSettings(dropKitEntries(mine, kit), kit);

    if (merged.permissions?.defaultMode === 'acceptEdits' && kit.permissions?.defaultMode === 'plan') {
        merged.permissions.defaultMode = 'plan';
    }

    if (merged.model === 'opusplan' && kit.model === 'opus') {
        merged.model = 'opus';
    }

    return merged;
}

// Writes to a temp file next to the target, then renames it over: a reader never sees a half-written file, and a
// failed write leaves the target as it was. Without a `mode`, the target keeps its own.
export function writeAtomic(file, content, mode) {
    mkdirSync(dirname(file), {
        recursive: true
    });

    const temp = `${file}.${process.pid}.tmp`;

    try {
        writeFileSync(temp, content);

        if ((mode ??= existsSync(file) ? statSync(file).mode & 0o777 : undefined) !== undefined) {
            chmodSync(temp, mode);
        }

        renameSync(temp, file);
    } catch (error) {
        rmSync(temp, {
            force: true
        });

        throw error;
    }
}

// The only step that writes: the writes in order (the manifest is the last one), then the removals, then the
// directories they left empty, never going above the project.
export function apply(cwd, { writes, removals }) {
    const root = resolve(cwd);

    for (const { file, content, mode } of writes) {
        writeAtomic(file, content, mode);
    }

    for (const file of removals) {
        rmSync(file, {
            force: true,
            recursive: true
        });

        for (let dir = dirname(resolve(file)); dir.startsWith(root + sep) && existsSync(dir) && readdirSync(dir).length === 0; dir = dirname(dir)) {
            rmdirSync(dir);
        }
    }
}

// Reads only: what an install or update would write, as { report, writes, removals, warnings }. Never overwrites a file
// that differs from what Brigade last wrote: an edited file gets a `.proposed` when the kit changed it.
export function planInstall({ cwd, stack, answers, stored, personal = {} }) {
    const report = [];
    const writes = [];
    const removals = [];
    const warnings = [];
    const hashes = {};
    const files = kitFiles(stack, answers);
    const shipped = new Set(files.map(({ path }) => path));

    const put = (file, content, mode) => writes.push({
        file,
        content,
        mode
    });

    const add = (path, status, detail) => report.push({
        path,
        status,
        detail
    });

    for (const { path, content, mode } of files) {
        const target = join(cwd, path);
        const proposal = `${target}.proposed`;
        const wanted = sha(content);
        const recorded = stored?.files?.[path];

        const write = (file = target) => put(file, content, mode);
        const unpropose = () => existsSync(proposal) && removals.push(proposal);

        if (!existsSync(target)) {
            write();
            hashes[path] = wanted;
            add(path, 'created');

            continue;
        }

        const text = readText(target);
        const current = sha(text);

        if (WRITE_ONCE.has(path)) {
            if (recorded || current === wanted) {
                hashes[path] = recorded ?? wanted;
            }

            add(path, current === wanted ? 'unchanged' : 'kept');

            continue;
        }

        // Only when the kit's settings changed since the last install (or none is recorded). The kit's hash is
        // recorded, so the next run finds it unchanged and does not add back what the developer removed.
        const mine = path === SETTINGS && current !== wanted && recorded !== wanted && recorded !== current ? readJson(target) : null;
        const merged = isObject(mine) ? mergeKit(mine, JSON.parse(content)) : null;

        hashes[path] = wanted;

        if (current === wanted) {
            unpropose();
            hashes[path] = current;
            add(path, 'unchanged');
        } else if (recorded === current) {
            write();
            unpropose();
            add(path, 'updated');
        } else if (merged) {
            unpropose();

            if (same(merged, mine)) {
                add(path, 'kept');
            } else {
                put(target, json(merged), mode);
                add(path, 'merged');
            }
        } else if (recorded === wanted) {
            // The kit did not change this file since the last install: nothing new to propose.
            add(path, 'kept');
        } else {
            // Delivered once: the kit's hash is recorded, so the proposal is written again only when the kit
            // changes the file again.
            if (!(existsSync(proposal) && sha(readText(proposal)) === wanted)) {
                write(proposal);
            }

            add(path, 'proposed');
        }
    }

    // Recorded in the manifest but no longer in the kit: removed if untouched, kept and reported if edited.
    for (const path of Object.keys(stored?.files ?? {})) {
        const recorded = stored.files[path];
        const target = resolve(cwd, path);

        // Only files inside the project, whatever the manifest says.
        if (shipped.has(path) || WRITE_ONCE.has(path) || !target.startsWith(resolve(cwd) + sep) || !(existsSync(target) && statSync(target).isFile())) {
            continue;
        }

        if (sha(readText(target)) === recorded) {
            removals.push(target);
            add(path, 'removed');
        } else {
            hashes[path] = recorded;
            add(path, 'obsolete');
        }
    }

    if (existsSync(join(cwd, LEGACY_DIR))) {
        removals.push(join(cwd, LEGACY_DIR));
        add(`${LEGACY_DIR}/`, 'removed');
    }

    // The options file is generated from the answers, not recorded.
    const options = join(cwd, OPTIONS_FILE);
    const optionsText = renderOptions(answers);
    const optionsState = !existsSync(options) ? 'created' : (sha(readText(options)) === sha(optionsText) ? 'unchanged' : 'updated');

    if (optionsState !== 'unchanged') {
        put(options, optionsText);
    }

    add(OPTIONS_FILE, optionsState);

    for (const path of Object.keys(APPENDS)) {
        const file = join(cwd, path);
        const existing = existsSync(file) ? readText(file) : '';
        const known = new Set(existing.split(/\r?\n/).map((line) => line.trim().replace(/^\//, '')));
        const missing = APPENDS[path].split('\n').filter((line) => !known.has(line));

        if (missing.length > 0) {
            // Keep the file's own line endings.
            const eol = existing.includes('\r\n') ? '\r\n' : '\n';
            const gap = existing === '' ? '' : (existing.endsWith('\n') ? eol : eol + eol);

            put(file, `${existing}${gap}${missing.join(eol)}${eol}`);
            add(path, 'appended', missing.join(', '));
        }
    }

    // The personal reply language goes to the developer's own local settings. A broken file is left alone.
    if (personal.language) {
        const file = join(cwd, LOCAL_SETTINGS);
        const current = existsSync(file) ? readJson(file) : {};

        if (isObject(current)) {
            put(file, json({
                ...current,
                language: personal.language
            }));
        } else {
            warnings.push(`${LOCAL_SETTINGS} is not valid JSON: it was left untouched, so your own reply language was not saved. Fix it and rerun.`);
        }
    }

    // Plain code-unit order, so the manifest does not depend on the locale. Last, so a failed write leaves the
    // previous install described.
    put(join(cwd, MANIFEST), json({
        version: VERSION,
        stack,
        answers,
        files: Object.fromEntries(Object.keys(hashes).sort().map((path) => [
            path,
            hashes[path]
        ]))
    }));

    return {
        report,
        writes,
        removals,
        warnings
    };
}

// Asked whenever Brigade is already installed. Without a terminal the first choice, "update", is taken.
function chooseVersion(p, installed) {
    const same = installed === VERSION;
    const verb = compareVersions(VERSION, installed) > 0 ? 'Update' : 'Switch';

    p.say(`Brigade ${installed} is installed here, this is Brigade ${VERSION}.`);

    return p.choose(same ? 'What do you want to do?' : `${verb} to ${VERSION}?`, [
        item('update', same ? 'the questions are asked again, files only change if an answer does' : 'new kit files, your answers are kept and only new options are asked', same ? 'Change my options' : `${verb} to ${VERSION}`),
        item('keep', 'nothing is written', same ? 'Leave it as it is' : `Keep ${installed}`)
    ]);
}

// `dryRun`: nothing is asked and nothing is written, the result lists what a real run would do.
export async function runInit({ cwd, p, stack, dryRun }) {
    const name = stack ?? detectStack(cwd);
    const stored = readManifest(cwd);
    const installed = typeof stored?.version === 'string' ? stored.version : undefined;
    const repo = isGitRepo(cwd);

    const kept = {
        kept: installed
    };

    p.banner(VERSION);
    p.say(`Stack: ${name}${stack ? '' : ' (the only one available for now)'}.`);

    if (installed && await chooseVersion(p, installed) === 'keep') {
        return kept;
    }

    if (!repo) {
        p.warn('No git repository here. Brigade will not create one: run `git init` when you are ready. The branch names below are kept for then.');
    }

    if (!stored && kitFiles(name, {}).some(({ path }) => existsSync(join(cwd, path)))) {
        p.warn(`${MANIFEST} is missing but Brigade files already exist here. Nothing is overwritten: files identical to the kit are adopted and files that differ are kept, and get a .proposed only when the kit changed them. If the manifest exists in your team's repo, restore it from git first.`);
    }

    const { answers, personal, added } = await gather({
        cwd,
        p,
        stored: stored?.answers ?? {},
        full: !installed || installed === VERSION
    });

    const plan = planInstall({
        cwd,
        stack: name,
        answers,
        stored,
        personal
    });

    const result = {
        ...plan,
        stack: name,
        answers,
        personal,
        added,
        repo
    };

    // An update shows what it will change before writing anything.
    if (!dryRun && stored && p.interactive) {
        const changes = plan.report.filter(({ status }) => !QUIET.has(status));
        const others = plan.report.length - changes.length;

        p.say(`What this update will do:\n${lines(changes, true)}`);
        p.say(`${others} other file${others === 1 ? '' : 's'} already up to date or yours, left alone.`);

        if (changes.length > 0 && !await p.confirm('Apply these changes?')) {
            return kept;
        }
    }

    if (!dryRun) {
        apply(cwd, plan);
    }

    return result;
}
