import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import {
    apply, dropKitEntries, LEGACY_DIR, MANIFEST, readManifest, SETTINGS, stripSettings, VERSION
} from './install.js';
import {
    DEFAULT_STACK, kitFiles, STACKS, WRITE_ONCE
} from './kit.js';
import {
    OPTIONS_FILE, renderOptions, sha
} from './render.js';
import { lines } from './ui.js';

const readText = (file) => readFileSync(file, 'utf8');

// Reads only. Removes what is still exactly what Brigade wrote, keeps and reports what the developer changed.
export function planUninstall({ cwd, manifest }) {
    const kit = {};

    for (const { path, content } of kitFiles(manifest.stack ?? DEFAULT_STACK, manifest.answers)) {
        kit[path] = content;
    }

    const report = [];
    const writes = [];
    const removals = [];
    const abs = (path) => resolve(cwd, path);

    const decide = (path, status, content) => {
        report.push({
            path,
            status
        });

        if (status === 'deleted') {
            removals.push(abs(path));
        } else if (content) {
            writes.push({
                file: abs(path),
                content
            });
        }
    };

    // A file that exists inside the project, whatever the manifest says.
    const present = (path) => existsSync(abs(path)) && abs(path).startsWith(resolve(cwd) + sep);

    for (const path of Object.keys(manifest.files ?? {})) {
        if (WRITE_ONCE.has(path) || !present(path)) {
            continue;
        }

        const text = readText(abs(path));

        // A leftover proposal is the kit's, never the developer's.
        if (existsSync(`${abs(path)}.proposed`)) {
            decide(`${path}.proposed`, 'deleted');
        }

        if (sha(text) === manifest.files[path]) {
            decide(path, 'deleted');
        } else if (path === SETTINGS && kit[path]) {
            // The kit's entries are removed, the developer's stay; the file goes when nothing of theirs is left.
            try {
                const mine = JSON.parse(text);
                const rest = stripSettings(dropKitEntries(mine, JSON.parse(kit[path])), JSON.parse(kit[path]));

                if (Object.keys(rest).length === 0) {
                    decide(path, 'deleted');
                } else if (JSON.stringify(rest) === JSON.stringify(mine)) {
                    decide(path, 'left');
                } else {
                    decide(path, 'stripped', `${JSON.stringify(rest, null, 4)}\n`);
                }
            } catch {
                decide(path, 'left');
            }
        } else {
            decide(path, 'left');
        }
    }

    // Written once, then the team's own, and the generated options file: removed only while identical to the template.
    const templates = {
        [OPTIONS_FILE]: renderOptions(manifest.answers)
    };

    for (const path of WRITE_ONCE) {
        templates[path] = kit[path];
    }

    for (const path of Object.keys(templates)) {
        if (present(path)) {
            decide(path, sha(readText(abs(path))) === sha(templates[path] ?? '') ? 'deleted' : 'left');
        }
    }

    if (existsSync(abs(LEGACY_DIR))) {
        decide(`${LEGACY_DIR}/`, 'deleted');
    }

    // Last, so a failed run leaves the install described.
    decide(MANIFEST, 'deleted');

    return {
        report,
        writes,
        removals
    };
}

// `dryRun`: nothing is asked and nothing is removed. Without a terminal, `yes` is required.
export async function runUninstall({ cwd, p, yes, dryRun }) {
    const manifest = readManifest(cwd);

    if (!manifest) {
        throw new Error(`Brigade is not installed here (no ${MANIFEST}).`);
    }

    if (!manifest.answers || typeof manifest.answers !== 'object' || Array.isArray(manifest.answers)) {
        throw new Error(`${MANIFEST} has no "answers" object. Fix it or delete it, then remove the kit files by hand.`);
    }

    if (!Object.hasOwn(STACKS, manifest.stack ?? DEFAULT_STACK)) {
        throw new Error(`Unknown stack in ${MANIFEST}: ${manifest.stack}`);
    }

    if (!p.interactive && !yes && !dryRun) {
        throw new Error('uninstall needs --yes without a terminal');
    }

    p.banner(VERSION);

    const plan = planUninstall({
        cwd,
        manifest
    });

    if (dryRun) {
        return plan;
    }

    if (p.interactive) {
        p.say(`What this will do:\n${lines(plan.report, true)}`);

        if (!await p.confirm('Remove Brigade?')) {
            return {
                ...plan,
                aborted: true
            };
        }
    }

    apply(cwd, plan);

    return plan;
}
