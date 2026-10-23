import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

test('the plain summary lists the files, the recap and the next step', () => {
    const { code, out } = brigade(['init', '--yes']);
    assert.equal(code, 0);
    assert.match(out, /^Brigade installed \(stack: web\)\./);
    assert.match(out, /^added +\.claude\/rules\/brigade\.md$/m);
    assert.match(out, /^lines added +\.gitignore \(.*CLAUDE\.local\.md\)$/m);
    assert.match(out, new RegExp(`^Brigade {10}${VERSION}$`, 'm'));
    assert.match(out, /^Replies for you {2}project default$/m);
    assert.match(out, /Commit \.claude\/ including \.claude\/brigade\.json/);
    assert.doesNotMatch(out, /New options/);
});

test('the plain summary shows a kept file and its proposal', () => {
    const first = brigade(['init', '--yes']);
    writeFileSync(join(first.cwd, '.claude/rules/brigade.md'), 'mine\n');
    const file = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    manifest.files['.claude/rules/brigade.md'] = 'an older kit version';
    writeFileSync(file, JSON.stringify(manifest));
    const { code, out, cwd } = brigade(['init', '--yes'], first.cwd);
    assert.equal(code, 0);
    assert.match(out, /^yours kept, proposal written +\.claude\/rules\/brigade\.md\.proposed$/m);
    assert.match(out, /^already up to date +\.claude\/settings\.json$/m);
    assert.equal(readFileSync(join(cwd, '.claude/rules/brigade.md'), 'utf8'), 'mine\n');
});

test('the plain summary names the options added by an update', () => {
    const first = brigade(['init', '--yes']);
    const file = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    manifest.version = '0.0.1';
    delete manifest.answers.docsLanguage;
    writeFileSync(file, JSON.stringify(manifest));
    const { code, out } = brigade(['init', '--yes'], first.cwd);
    assert.equal(code, 0);
    assert.match(out, /^New options, default used: .*docsLanguage: English$/m);
});

test('--dry-run lists what would be written and writes nothing', () => {
    const { code, out, cwd } = brigade(['init', '--dry-run']);
    assert.equal(code, 0);
    assert.match(out, /^Brigade dry run \(stack: web\)\. Nothing was written\./);
    assert.match(out, /^would be added +\.claude\/rules\/brigade\.md$/m);
    assert.match(out, /Run without --dry-run to apply\./);
    assert.ok(!existsSync(join(cwd, '.claude')));
});

test('--help documents --dry-run', () => {
    assert.match(brigade(['--help']).out, /--dry-run/);
});

test('the plain summary reports a file removed from the kit', () => {
    const first = brigade(['init', '--yes']);
    const file = join(first.cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(join(first.cwd, 'old.md'), 'old\n');
    manifest.files['old.md'] = createHash('sha256').update('old\n').digest('hex');
    writeFileSync(file, JSON.stringify(manifest));
    const { out } = brigade(['init', '--yes'], first.cwd);
    assert.match(out, /^removed, no longer in the kit +old\.md$/m);
    assert.ok(!existsSync(join(first.cwd, 'old.md')));
});
