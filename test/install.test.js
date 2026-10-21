import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runInit } from '../src/init.js';
import { writeLocalSettings } from '../src/install.js';
import { compareVersions } from '../src/version.js';

function project() {
    const cwd = mkdtempSync(join(tmpdir(), 'brigade-'));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.0.0' }));
    return cwd;
}

const RULES = '.claude/rules/brigade.md';
const statuses = (result) => Object.fromEntries(result.report.map(({ path, status }) => [path, status]));

test('installs the web kit on a fresh project with the detected answers', async () => {
    const cwd = project();
    const result = await runInit({ cwd, yes: true });

    assert.equal(result.stack, 'web');
    assert.equal(result.answers.defaultBranch, 'main');
    assert.equal(result.answers.packageManager, 'pnpm');
    assert.ok(result.report.every(({ status }) => status === 'created'));

    const rules = readFileSync(join(cwd, RULES), 'utf8');
    assert.match(rules, /Default branch: `main`/);
    assert.doesNotMatch(rules, /__[A-Z_]+__/);
    assert.ok(!existsSync(join(cwd, 'CLAUDE.md')));
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
});

test('a second run changes nothing', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    const again = await runInit({ cwd, yes: true });

    assert.ok(again.report.every(({ status }) => status === 'unchanged'));
    assert.ok(again.ignored.every(({ status }) => status === 'unchanged'));
});

test('a modified file is kept and gets a .proposed only when it differs', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    writeFileSync(join(cwd, RULES), 'mine\n');

    const result = await runInit({ cwd, yes: true });
    assert.equal(statuses(result)[RULES], 'proposed');
    assert.equal(readFileSync(join(cwd, RULES), 'utf8'), 'mine\n');
    assert.ok(existsSync(join(cwd, `${RULES}.proposed`)));
});

test('an existing file identical to the kit produces no .proposed', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    const kit = readFileSync(join(cwd, RULES), 'utf8');
    execFileSync('rm', [join(cwd, '.claude/brigade.json'), join(cwd, RULES)]);
    writeFileSync(join(cwd, RULES), kit);

    const result = await runInit({ cwd, yes: true });
    assert.equal(statuses(result)[RULES], 'unchanged');
    assert.ok(!existsSync(join(cwd, `${RULES}.proposed`)));
});

test('a file Brigade wrote and nobody touched is updated in place', async () => {
    const cwd = project();
    const stackDir = mkdtempSync(join(tmpdir(), 'brigade-kit-'));
    writeFileSync(join(stackDir, 'rule.md'), 'v1\n');
    await runInit({ cwd, yes: true, stackDir });

    writeFileSync(join(stackDir, 'rule.md'), 'v2\n');
    const updated = await runInit({ cwd, yes: true, stackDir });
    assert.equal(statuses(updated)['rule.md'], 'updated');
    assert.equal(readFileSync(join(cwd, 'rule.md'), 'utf8'), 'v2\n');

    writeFileSync(join(cwd, 'rule.md'), 'edited by the dev\n');
    writeFileSync(join(stackDir, 'rule.md'), 'v3\n');
    const proposed = await runInit({ cwd, yes: true, stackDir });
    assert.equal(statuses(proposed)['rule.md'], 'proposed');
    assert.equal(readFileSync(join(cwd, 'rule.md'), 'utf8'), 'edited by the dev\n');
});

test('.gitignore and .gitattributes only get the lines they miss', async () => {
    const cwd = project();
    writeFileSync(join(cwd, '.gitignore'), 'node_modules\n/CLAUDE.local.md');
    writeFileSync(join(cwd, '.gitattributes'), '* text=auto eol=lf\n');

    const result = await runInit({ cwd, yes: true });
    const ignore = readFileSync(join(cwd, '.gitignore'), 'utf8');
    const lines = ignore.split('\n');

    assert.deepEqual(result.ignored.find(({ path }) => path === '.gitignore').added, ['.claude/settings.local.json']);
    assert.equal(lines.filter((line) => line.includes('CLAUDE.local.md')).length, 1);
    assert.match(ignore, /^node_modules\n\/CLAUDE\.local\.md\n/);
    assert.match(readFileSync(join(cwd, '.gitattributes'), 'utf8'), /\.claude\/hooks\/\* text eol=lf/);
});

test('the project reply language is shared, the personal one stays local', async () => {
    const cwd = project();
    const result = await runInit({ cwd, yes: true });

    const shared = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
    assert.equal(shared.language, result.answers.replyLanguage);
    assert.equal(result.local, null);
    assert.ok(!existsSync(join(cwd, '.claude/settings.local.json')));
    assert.equal(JSON.parse(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8')).personal, undefined);
});

test('a personal choice merges into settings.local.json and spares a broken file', () => {
    const cwd = project();
    mkdirSync(join(cwd, '.claude'));
    writeFileSync(join(cwd, '.claude/settings.local.json'), JSON.stringify({ effortLevel: 'high' }));

    assert.equal(writeLocalSettings(cwd, { language: 'French' }).status, 'written');
    assert.deepEqual(JSON.parse(readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8')), { effortLevel: 'high', language: 'French' });

    writeFileSync(join(cwd, '.claude/settings.local.json'), '{ broken');
    assert.equal(writeLocalSettings(cwd, { language: 'French' }).status, 'skipped');
    assert.equal(readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8'), '{ broken');
});

const asking = (answer) => {
    const asked = [];
    const noop = () => {};
    const prompter = {
        intro: noop, info: noop, warn: noop, note: noop, outro: noop, close: noop,
        text: async (_, fallback = '') => fallback,
        validate: async (_, detected, pick) => detected || pick(),
        choose: async (message, options) => {
            asked.push(message);
            return /version|older|do you want/.test(message) ? answer : options[0].value;
        }
    };
    return { prompter, asked };
};

test('versions are compared numerically', () => {
    assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
    assert.ok(compareVersions('1.0.0', '1.0.1') < 0);
    assert.equal(compareVersions('2.0', '2.0.0'), 0);
});

test('the installed version is recorded', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    assert.equal(JSON.parse(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8')).version, '1.0.0');
});

test('the same version still offers to run the setup again or to leave it', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    const manifest = readFileSync(join(cwd, '.claude/brigade.json'), 'utf8');

    const left = asking('keep');
    const kept = await runInit({ cwd, version: '1.0.0', interactive: true, prompter: left.prompter });
    assert.equal(kept.kept, '1.0.0');
    assert.deepEqual(left.asked, ['What do you want to do?']);
    assert.equal(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8'), manifest);

    const again = asking('update');
    const rerun = await runInit({ cwd, version: '1.0.0', interactive: true, prompter: again.prompter });
    assert.equal(rerun.kept, undefined);
    assert.ok(again.asked.length > 1);
});

test('keeping the installed version writes nothing', async () => {
    const cwd = project();
    const stackDir = mkdtempSync(join(tmpdir(), 'brigade-kit-'));
    writeFileSync(join(stackDir, 'rule.md'), 'v1\n');
    await runInit({ cwd, yes: true, stackDir, version: '1.0.0' });
    const manifest = readFileSync(join(cwd, '.claude/brigade.json'), 'utf8');

    writeFileSync(join(stackDir, 'rule.md'), 'v2\n');
    const result = await runInit({ cwd, stackDir, version: '2.0.0', interactive: true, prompter: asking('keep').prompter });
    assert.equal(result.kept, '1.0.0');
    assert.equal(readFileSync(join(cwd, 'rule.md'), 'utf8'), 'v1\n');
    assert.equal(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8'), manifest);
});

test('updating replays the kit and records the new version', async () => {
    const cwd = project();
    const stackDir = mkdtempSync(join(tmpdir(), 'brigade-kit-'));
    writeFileSync(join(stackDir, 'rule.md'), 'v1\n');
    await runInit({ cwd, yes: true, stackDir, version: '1.0.0' });

    writeFileSync(join(stackDir, 'rule.md'), 'v2\n');
    const result = await runInit({ cwd, stackDir, version: '2.0.0', interactive: true, prompter: asking('update').prompter });
    assert.equal(statuses(result)['rule.md'], 'updated');
    assert.equal(JSON.parse(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8')).version, '2.0.0');
});

test('without a terminal an older install is updated, as before', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    const result = await runInit({ cwd, yes: true, version: '2.0.0' });
    assert.equal(result.kept, undefined);
    assert.equal(JSON.parse(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8')).version, '2.0.0');
});
