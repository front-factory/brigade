import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const LAUNCHER = fileURLToPath(new URL('../templates/web/.claude/hooks/run-node.sh', import.meta.url));
const WINDOWS = process.platform === 'win32';

// Git Bash (MSYS) takes a Windows PATH (`;` separated) and turns it into a POSIX one; its path arguments and the
// directories read by the launcher must be POSIX (`/c/Users/...`).
const posix = (path) => (WINDOWS ? path.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`).replaceAll('\\', '/') : path);
const PATH_SEPARATOR = WINDOWS ? ';' : ':';

// The shell to run and the directories holding the basic tools (ls, sort, basename, cat) the launcher needs.
function findShell() {
    if (!WINDOWS) {
        return {
            shell: 'sh',
            systemPath: '/usr/bin:/bin'
        };
    }

    const candidates = (process.env.PATH ?? '').split(';').map((dir) => join(dir, 'sh.exe'));

    candidates.push('C:\\Program Files\\Git\\bin\\sh.exe');
    const shell = candidates.find((candidate) => existsSync(candidate)) ?? 'sh';
    const gitRoot = dirname(dirname(shell));

    return {
        shell,
        systemPath: [
            join(gitRoot, 'usr', 'bin'),
            join(gitRoot, 'bin')
        ].join(';')
    };
}

const { shell: SHELL, systemPath: SYSTEM_PATH } = findShell();

const tmp = () => mkdtempSync(join(tmpdir(), 'brigade-run-node-'));

// A fake node that prints its own label, its arguments and its stdin.
function fakeNode(dir, label) {
    mkdirSync(dir, {
        recursive: true
    });

    writeFileSync(join(dir, 'node'), `#!/bin/sh\necho "${label} $* $(cat)"\n`);
    chmodSync(join(dir, 'node'), 0o755);
}

// Runs the launcher with a controlled environment: an empty home and no system location unless given.
function launch(env = {}, input = '') {
    const home = tmp();

    return spawnSync(SHELL, [
        posix(LAUNCHER),
        'script.mjs',
        'arg'
    ], {
        input,
        encoding: 'utf8',
        env: {
            ...(WINDOWS && {
                SystemRoot: process.env.SystemRoot
            }),
            PATH: SYSTEM_PATH,
            HOME: home,
            BRIGADE_SYSTEM_DIRS: '',
            ...env
        }
    });
}

test('the launcher uses the node of the PATH and forwards the arguments and stdin', () => {
    const bin = tmp();

    fakeNode(bin, 'path');

    const result = launch({
        PATH: `${bin}${PATH_SEPARATOR}${SYSTEM_PATH}`
    }, '{"a":1}');

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'path script.mjs arg {"a":1}');
});

test('the launcher falls back to the latest nvm version when node is not on the PATH', () => {
    const home = tmp();

    fakeNode(join(home, '.nvm/versions/node/v9.0.0/bin'), 'v9');
    fakeNode(join(home, '.nvm/versions/node/v18.2.0/bin'), 'v18');

    const result = launch({
        HOME: home
    }, 'in');

    assert.equal(result.stdout.trim(), 'v18 script.mjs arg in');
});

test('the launcher falls back to volta, then to the system locations', () => {
    const home = tmp();

    fakeNode(join(home, '.volta/bin'), 'volta');
    assert.equal(launch({
        HOME: home
    }).stdout.trim(), 'volta script.mjs arg');

    const system = tmp();

    fakeNode(system, 'system');
    assert.equal(launch({
        BRIGADE_SYSTEM_DIRS: `/nowhere:${posix(system)}`
    }).stdout.trim(), 'system script.mjs arg');
});

test('the launcher exits 0 with one line on stderr and a systemMessage on stdout when node is nowhere', () => {
    const result = launch();

    assert.equal(result.status, 0);
    assert.match(result.stderr, /^Brigade: node was not found, the hook script\.mjs was skipped/);
    assert.equal(result.stderr.trim().split('\n').length, 1);

    const { systemMessage } = JSON.parse(result.stdout);

    assert.match(systemMessage, /node was not found.*git guard.*disabled/);
});

test('the launcher picks the highest major, not the highest minor, with a home path without extra dots', () => {
    const home = tmp();

    fakeNode(join(home, '.nvm/versions/node/v18.20.4/bin'), 'v18');
    fakeNode(join(home, '.nvm/versions/node/v22.11.0/bin'), 'v22');
    fakeNode(join(home, '.nvm/versions/node/v24.2.0/bin'), 'v24');

    assert.equal(launch({
        HOME: home
    }).stdout.trim(), 'v24 script.mjs arg');
});

test('the launcher picks the highest nvm version numerically, whatever dots the home path has', () => {
    const home = join(tmp(), 'first.last');

    fakeNode(join(home, '.nvm/versions/node/v18.20.4/bin'), 'v18');
    fakeNode(join(home, '.nvm/versions/node/v22.11.0/bin'), 'v22');
    fakeNode(join(home, '.nvm/versions/node/v24.2.0/bin'), 'v24');

    assert.equal(launch({
        HOME: home
    }).stdout.trim(), 'v24 script.mjs arg');
});

test('the launcher lets the minor version decide between two nvm versions of the same major', () => {
    const home = tmp();

    fakeNode(join(home, '.nvm/versions/node/v22.9.0/bin'), 'v22.9');
    fakeNode(join(home, '.nvm/versions/node/v22.11.0/bin'), 'v22.11');

    assert.equal(launch({
        HOME: home
    }).stdout.trim(), 'v22.11 script.mjs arg');
});
