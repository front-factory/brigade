import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import './git-env.js';
import { runInit } from '../src/init.js';
import { stripSettings } from '../src/install.js';
import { runUninstall } from '../src/uninstall.js';

function project() {
    const cwd = mkdtempSync(join(tmpdir(), 'brigade-'));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.0.0' }));
    return cwd;
}

const RULES = '.claude/rules/brigade.md';
const SETTINGS = '.claude/settings.json';
const statuses = (result) => Object.fromEntries(result.report.map(({ path, status }) => [path, status]));

async function installed() {
    const cwd = project();
    await runInit({ cwd, yes: true });
    return cwd;
}

test('a fresh install is removed whole, .claude/ included, and the project files stay', async () => {
    const cwd = await installed();
    writeFileSync(join(cwd, 'CLAUDE.md'), 'mine\n');
    const ignore = readFileSync(join(cwd, '.gitignore'), 'utf8');

    const result = await runUninstall({ cwd, yes: true });

    assert.ok(result.report.every(({ status }) => status === 'removed'));
    assert.ok(!existsSync(join(cwd, '.claude')));
    assert.equal(readFileSync(join(cwd, 'CLAUDE.md'), 'utf8'), 'mine\n');
    assert.equal(readFileSync(join(cwd, '.gitignore'), 'utf8'), ignore);
});

test('an edited kit file is kept, its proposal is removed', async () => {
    const cwd = await installed();
    writeFileSync(join(cwd, RULES), 'mine\n');
    writeFileSync(join(cwd, `${RULES}.proposed`), 'kit\n');

    const result = await runUninstall({ cwd, yes: true });

    assert.equal(statuses(result)[RULES], 'kept');
    assert.equal(readFileSync(join(cwd, RULES), 'utf8'), 'mine\n');
    assert.ok(!existsSync(join(cwd, `${RULES}.proposed`)));
    assert.ok(!existsSync(join(cwd, '.claude/brigade.json')));
});

test('settings.json keeps the developer entries and loses the kit ones', async () => {
    const cwd = await installed();
    const file = join(cwd, SETTINGS);
    const settings = JSON.parse(readFileSync(file, 'utf8'));
    settings.permissions.allow.push('Bash(make:*)');
    settings.custom = true;
    writeFileSync(file, JSON.stringify(settings, null, 4));

    const result = await runUninstall({ cwd, yes: true });

    assert.equal(statuses(result)[SETTINGS], 'stripped');
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { permissions: { allow: ['Bash(make:*)'] }, custom: true });
});

test('a settings.json holding only kit entries is removed, an unparseable one is kept', async () => {
    const cwd = await installed();
    const file = join(cwd, SETTINGS);
    writeFileSync(file, readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    assert.equal(statuses(await runUninstall({ cwd, yes: true, dryRun: true }))[SETTINGS], 'removed');

    writeFileSync(file, '{ broken');
    const result = await runUninstall({ cwd, yes: true });
    assert.equal(statuses(result)[SETTINGS], 'kept');
    assert.equal(readFileSync(file, 'utf8'), '{ broken');
});

test('team content is kept: edited decisions.md, feature files', async () => {
    const cwd = await installed();
    writeFileSync(join(cwd, '.claude/context/decisions.md'), '- use pnpm\n');
    mkdirSync(join(cwd, '.claude/context/features'), { recursive: true });
    writeFileSync(join(cwd, '.claude/context/features/feat-x.md'), '# x\n');

    const result = await runUninstall({ cwd, yes: true });

    assert.equal(statuses(result)['.claude/context/decisions.md'], 'kept');
    assert.equal(statuses(result)['.claude/context/architecture.md'], 'removed');
    assert.equal(readFileSync(join(cwd, '.claude/context/decisions.md'), 'utf8'), '- use pnpm\n');
    assert.ok(existsSync(join(cwd, '.claude/context/features/feat-x.md')));
    assert.ok(!existsSync(join(cwd, '.claude/rules')));
});

test('the legacy base folder goes, a path outside the project is ignored', async () => {
    const cwd = await installed();
    mkdirSync(join(cwd, '.claude/brigade-base'), { recursive: true });
    writeFileSync(join(cwd, '.claude/brigade-base/old.md'), 'old\n');
    const outside = join(cwd, '..', 'brigade-outside.txt');
    writeFileSync(outside, 'keep me\n');
    const file = join(cwd, '.claude/brigade.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    manifest.files['../brigade-outside.txt'] = 'x';
    writeFileSync(file, JSON.stringify(manifest));

    await runUninstall({ cwd, yes: true });

    assert.ok(!existsSync(join(cwd, '.claude')));
    assert.equal(readFileSync(outside, 'utf8'), 'keep me\n');
    rmSync(outside);
});

test('without a manifest it throws, without --yes and without a terminal too', async () => {
    const cwd = project();
    await assert.rejects(runUninstall({ cwd, yes: true }), /Brigade is not installed here/);
    await runInit({ cwd, yes: true });
    await assert.rejects(runUninstall({ cwd, interactive: false }), /uninstall needs --yes without a terminal/);
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
});

test('--dry-run lists the plan and writes nothing', async () => {
    const cwd = await installed();
    writeFileSync(join(cwd, RULES), 'mine\n');
    const before = readFileSync(join(cwd, '.claude/brigade.json'), 'utf8');

    const result = await runUninstall({ cwd, dryRun: true });

    assert.equal(result.dryRun, true);
    assert.equal(statuses(result)[RULES], 'kept');
    assert.equal(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8'), before);
    assert.ok(existsSync(join(cwd, '.claude/hooks/git-guard.mjs')));
});

test('declining the confirmation writes nothing', async () => {
    const cwd = await installed();
    const prompter = { banner() {}, info() {}, files() {}, confirm: async () => false, interactive: true };
    const result = await runUninstall({ cwd, interactive: true, prompter });
    assert.equal(result.aborted, true);
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
});

test('stripSettings drops kit array items, equal keys and emptied objects', () => {
    const kit = { a: { list: [1, { x: 1 }], flag: true }, b: 'kit', c: [1] };
    assert.deepEqual(stripSettings({ a: { list: [0, 1, { x: 1 }], flag: true }, b: 'kit', c: [1] }, kit), { a: { list: [0] } });
    assert.deepEqual(stripSettings({ a: { list: [1], flag: true }, b: 'kit', c: [1] }, kit), {});
    assert.deepEqual(stripSettings({ b: 'mine', d: 1 }, kit), { b: 'mine', d: 1 });
});
