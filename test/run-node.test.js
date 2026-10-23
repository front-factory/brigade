import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const LAUNCHER = fileURLToPath(new URL('../templates/web/.claude/hooks/run-node.sh', import.meta.url));
const SYSTEM_PATH = '/usr/bin:/bin';

const tmp = () => mkdtempSync(join(tmpdir(), 'brigade-run-node-'));

// A fake node that prints its own label, its arguments and its stdin.
function fakeNode(dir, label) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'node'), `#!/bin/sh\necho "${label} $* $(cat)"\n`);
    chmodSync(join(dir, 'node'), 0o755);
}

// Runs the launcher with a controlled environment: an empty home and no system location unless given.
function launch(env = {}, input = '') {
    const home = tmp();
    return spawnSync('sh', [LAUNCHER, 'script.mjs', 'arg'], {
        input,
        encoding: 'utf8',
        env: { PATH: SYSTEM_PATH, HOME: home, BRIGADE_SYSTEM_DIRS: '', ...env }
    });
}

test('the launcher uses the node of the PATH and forwards the arguments and stdin', () => {
    const bin = tmp();
    fakeNode(bin, 'path');
    const result = launch({ PATH: `${bin}:${SYSTEM_PATH}` }, '{"a":1}');
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'path script.mjs arg {"a":1}');
});

test('the launcher falls back to the latest nvm version when node is not on the PATH', () => {
    const home = tmp();
    fakeNode(join(home, '.nvm/versions/node/v9.0.0/bin'), 'v9');
    fakeNode(join(home, '.nvm/versions/node/v18.2.0/bin'), 'v18');
    const result = launch({ HOME: home }, 'in');
    assert.equal(result.stdout.trim(), 'v18 script.mjs arg in');
});

test('the launcher falls back to volta, then to the system locations', () => {
    const home = tmp();
    fakeNode(join(home, '.volta/bin'), 'volta');
    assert.equal(launch({ HOME: home }).stdout.trim(), 'volta script.mjs arg');

    const system = tmp();
    fakeNode(system, 'system');
    assert.equal(launch({ BRIGADE_SYSTEM_DIRS: `/nowhere:${system}` }).stdout.trim(), 'system script.mjs arg');
});

test('the launcher exits 0 with one line on stderr when node is nowhere', () => {
    const result = launch();
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Brigade: node was not found, the hook script\.mjs was skipped/);
    assert.equal(result.stderr.trim().split('\n').length, 1);
});
