import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';

const BIN = fileURLToPath(new URL('../bin/brigade.js', import.meta.url));

function brigade(args, cwd = mkdtempSync(join(tmpdir(), 'brigade-cli-'))) {
    const result = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', stdin: 'ignore' });
    return { code: result.status, out: result.stdout, err: result.stderr, cwd };
}

test('--help and -h print the usage and exit 0, also after init', () => {
    for (const args of [['--help'], ['-h'], [], ['init', '--help'], ['init', '-h']]) {
        const { code, out, cwd } = brigade(args);
        assert.equal(code, 0, args.join(' '));
        assert.match(out, /Usage: brigade init/);
        assert.ok(!existsSync(join(cwd, '.claude')));
    }
});

test('--version prints the package version', () => {
    const { code, out } = brigade(['--version']);
    assert.equal(code, 0);
    assert.equal(out.trim(), VERSION);
    assert.equal(brigade(['-v']).out.trim(), VERSION);
});

test('an unknown command is reported as such and exits 1', () => {
    const { code, err } = brigade(['frobnicate']);
    assert.equal(code, 1);
    assert.match(err, /Unknown command: frobnicate/);
});

test('--stack without a value gives a clear message', () => {
    for (const args of [['init', '--stack'], ['init', '--stack', '--yes']]) {
        const { code, err, cwd } = brigade(args);
        assert.equal(code, 1);
        assert.match(err, /--stack needs a value/);
        assert.ok(!existsSync(join(cwd, '.claude')));
    }
});

test('an unknown stack and an unknown option are rejected', () => {
    assert.match(brigade(['init', '--stack', 'nope']).err, /Unknown stack: nope/);
    assert.match(brigade(['init', '--stack=nope']).err, /Unknown stack: nope/);
    assert.match(brigade(['init', '--nope']).err, /Unknown option: --nope/);
});

test('init --yes installs the kit', () => {
    const { code, cwd } = brigade(['init', '--yes']);
    assert.equal(code, 0);
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
    assert.ok(existsSync(join(cwd, '.claude/rules/brigade-options.md')));
});

test('a corrupted manifest stops init with a clear error and writes nothing', () => {
    const first = brigade(['init', '--yes']);
    writeFileSync(join(first.cwd, '.claude/brigade.json'), '{ broken');
    const again = brigade(['init', '--yes'], first.cwd);
    assert.equal(again.code, 1);
    assert.match(again.err, /brigade\.json is corrupted/);
});
