import {
    existsSync, readFileSync, statSync
} from 'node:fs';
import {
    join, resolve, sep
} from 'node:path';
import {
    applyPlan, dropKitEntries, LEGACY_BASE_DIR, MANIFEST, OPTIONS_FILE, readManifest, render, renderOptions, SETTINGS_PATH, sha, stripSettings, WRITE_ONCE
} from './install.js';
import { createPrompter } from './prompt.js';
import { DEFAULT_STACK, STACKS } from './stacks.js';
import { VERSION } from './version.js';
import { UNINSTALL_PREVIEW_WORDS } from './words.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// What is left of an edited settings file once the kit's entries are gone: a removal, a write, or kept as it is.
function planSettings({ target, text, kitText }) {
    try {
        const mine = JSON.parse(text);
        const kit = JSON.parse(kitText);

        if (!isObject(mine) || !isObject(kit)) {
            return {
                status: 'kept'
            };
        }

        const rest = stripSettings(dropKitEntries(mine, kit), kit);

        if (Object.keys(rest).length === 0) {
            return {
                status: 'removed'
            };
        }

        if (JSON.stringify(rest) === JSON.stringify(mine)) {
            return {
                status: 'kept'
            };
        }

        return {
            status: 'stripped',
            write: {
                file: target,
                content: `${JSON.stringify(rest, null, 4)}\n`
            }
        };
    } catch {
        return {
            status: 'kept'
        };
    }
}

// Reads only. Removes what is still exactly what Brigade wrote, keeps and reports what the developer changed.
export function planUninstall({ cwd, stackDir, manifest }) {
    const report = [];
    const writes = [];
    const removals = [];
    const root = resolve(cwd) + sep;

    // A file of the kit: removed when untouched, kept when edited. A leftover proposal is the kit's, never the developer's.
    const plan = (path, status) => {
        report.push({
            path,
            status
        });

        if (status === 'removed') {
            removals.push(resolve(cwd, path));
        }
    };

    for (const [
        path,
        recorded
    ] of Object.entries(manifest.files ?? {})) {
        const target = resolve(cwd, path);

        // Only files inside the project, whatever the manifest says.
        if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
            continue;
        }

        const proposed = `${target}.proposed`;

        if (existsSync(proposed)) {
            removals.push(proposed);
            report.push({
                path: `${path}.proposed`,
                status: 'removed'
            });
        }

        const text = readFileSync(target, 'utf8');

        if (sha(text) === recorded) {
            plan(path, 'removed');
            continue;
        }

        const source = join(stackDir, path);

        if (path === SETTINGS_PATH && existsSync(source)) {
            const kitText = render(readFileSync(source, 'utf8'), manifest.answers, true);

            const { status, write } = planSettings({
                target,
                text,
                kitText
            });

            if (write) {
                writes.push(write);
            }

            plan(path, status);
            continue;
        }

        plan(path, 'kept');
    }

    // Written once, then the team's own: removed only while still identical to the template.
    const owned = (path, content) => {
        const target = resolve(cwd, path);

        if (!existsSync(target) || !statSync(target).isFile()) {
            return;
        }

        plan(path, sha(readFileSync(target, 'utf8')) === sha(content) ? 'removed' : 'kept');
    };

    for (const path of WRITE_ONCE) {
        const source = join(stackDir, path);

        if (existsSync(source)) {
            owned(path, render(readFileSync(source, 'utf8'), manifest.answers));
        }
    }

    owned(OPTIONS_FILE, renderOptions(manifest.answers));

    const legacy = join(cwd, LEGACY_BASE_DIR);

    if (existsSync(legacy) && statSync(legacy).isDirectory()) {
        removals.push(legacy);
        report.push({
            path: `${LEGACY_BASE_DIR}/`,
            status: 'removed'
        });
    }

    // Last, so a failed run leaves the install described.
    removals.push(join(cwd, MANIFEST));
    report.push({
        path: MANIFEST,
        status: 'removed'
    });

    return {
        report,
        writes,
        removals
    };
}

// `dryRun`: nothing is asked and nothing is written. Without a terminal, `yes` is required.
export async function runUninstall({ cwd, yes = false, dryRun = false, version = VERSION, interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !yes && !dryRun, prompter }) {
    const manifest = readManifest(cwd);

    if (!manifest) {
        throw new Error(`Brigade is not installed here (no ${MANIFEST}).`);
    }

    if (!manifest.answers || typeof manifest.answers !== 'object' || Array.isArray(manifest.answers)) {
        throw new Error(`${MANIFEST} has no "answers" object. Fix it or delete it, then remove the kit files by hand.`);
    }

    if (!interactive && !yes && !dryRun) {
        throw new Error('uninstall needs --yes without a terminal');
    }

    const stackDir = STACKS[manifest.stack ?? DEFAULT_STACK]?.dir;

    if (!stackDir) {
        throw new Error(`Unknown stack in ${MANIFEST}: ${manifest.stack}`);
    }

    prompter ??= createPrompter({
        interactive: Boolean(interactive)
    });

    prompter.banner(version);

    const plan = planUninstall({
        cwd,
        stackDir,
        manifest
    });

    const result = {
        dryRun,
        report: plan.report,
        prompter
    };

    if (dryRun) {
        return result;
    }

    if (interactive) {
        prompter.info('What this will do:');
        prompter.files(plan.report.map(({ path, status }) => ({
            done: status !== 'kept',
            label: path,
            detail: UNINSTALL_PREVIEW_WORDS[status]
        })));

        if (!await prompter.confirm('Remove Brigade?')) {
            return {
                ...result,
                aborted: true
            };
        }
    }

    applyPlan(cwd, plan);

    return result;
}
