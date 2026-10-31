import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
    dirname, join, relative
} from 'node:path';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import '../git-env.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BIN = join(ROOT, 'bin', 'brigade.js');
export const GUARD = join(ROOT, 'templates', 'web', '.claude', 'hooks', 'git-guard.mjs');
export const KIT = join(ROOT, 'templates', 'web');
export const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

export const MANIFEST = '.claude/brigade.json';
export const SETTINGS = '.claude/settings.json';

const dirs = [];

after(() => {
    for (const dir of dirs) {
        rmSync(dir, {
            recursive: true,
            force: true
        });
    }
});

export function tmp(prefix = 'brigade-contract-') {
    const dir = mkdtempSync(join(tmpdir(), prefix));

    dirs.push(dir);

    return dir;
}

// A git repository with package.json and package-lock.json (npm detected, branch main).
export function project({ git = true } = {}) {
    const cwd = tmp();

    if (git) {
        execFileSync('git', [
            'init',
            '-q',
            '-b',
            'main'
        ], {
            cwd
        });
    }

    writeFileSync(join(cwd, 'package.json'), '{}\n');
    writeFileSync(join(cwd, 'package-lock.json'), '{}\n');

    return cwd;
}

// Runs the CLI without a terminal (stdin is not a TTY).
export function brigade(cwd, args = []) {
    const result = spawnSync(process.execPath, [
        BIN,
        ...args
    ], {
        cwd,
        encoding: 'utf8',
        input: '',
        env: {
            ...process.env,
            CI: '1',
            NO_COLOR: '1'
        }
    });

    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr
    };
}

export function install(cwd = project()) {
    const result = brigade(cwd, [
        'init',
        '--yes'
    ]);

    if (result.status !== 0) {
        throw new Error(`install failed: ${result.stderr}`);
    }

    return cwd;
}

export const sha = (content) => createHash('sha256').update(content).digest('hex');
export const read = (cwd, path) => readFileSync(join(cwd, path), 'utf8');
export const write = (cwd, path, content) => {
    mkdirSync(dirname(join(cwd, path)), {
        recursive: true
    });

    writeFileSync(join(cwd, path), content);
};
export const readJson = (cwd, path) => JSON.parse(read(cwd, path));
export const writeJson = (cwd, path, value) => write(cwd, path, `${JSON.stringify(value, null, 4)}\n`);

// Edits the manifest the way an older install would look.
export function editManifest(cwd, change) {
    const manifest = readJson(cwd, MANIFEST);

    change(manifest);
    writeJson(cwd, MANIFEST, manifest);
}

// Every file under dir (relative path -> content), .git excluded.
export function snapshot(dir) {
    const files = {};

    const walk = (current) => {
        for (const entry of readdirSync(current, {
            withFileTypes: true
        })) {
            const path = join(current, entry.name);

            if (entry.name === '.git') {
                continue;
            }

            if (entry.isDirectory()) {
                walk(path);
            } else {
                files[relative(dir, path)] = readFileSync(path, 'utf8');
            }
        }
    };

    walk(dir);

    return files;
}

// Relative paths of every file shipped by the kit under templates/web.
export function kitFiles() {
    return Object.keys(snapshot(KIT)).map((path) => path.split('\\').join('/'));
}

// Runs the guard hook with a JSON payload on stdin; returns the permissionDecision or null (no output).
export function guard({ command, agent, cwd, project: root = cwd, env = {}, raw }) {
    const result = spawnSync(process.execPath, [
        GUARD
    ], {
        cwd,
        encoding: 'utf8',
        input: raw ?? JSON.stringify({
            tool_input: {
                command
            },
            ...agent ? {
                agent_type: agent
            } : {},
            cwd
        }),
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: root,
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '',
            ...env
        }
    });

    if (result.stdout.trim() === '') {
        return null;
    }

    return JSON.parse(result.stdout).hookSpecificOutput.permissionDecision;
}

// A git repository on `branch` with a brigade.json (defaultBranch main, baseBranch develop).
export function guardProject(branch = 'feat/x', { manifest = true } = {}) {
    const cwd = tmp('brigade-guard-');

    execFileSync('git', [
        'init',
        '-q',
        '-b',
        branch
    ], {
        cwd
    });

    if (manifest) {
        writeJson(cwd, MANIFEST, {
            version: VERSION,
            stack: 'web',
            answers: {
                defaultBranch: 'main',
                baseBranch: 'develop'
            },
            files: {}
        });
    }

    return cwd;
}
