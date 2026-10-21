import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runInit } from '../src/init.js';
import { appendMissingLines, readManifest, render, sha, writeLocalSettings } from '../src/install.js';
import { OPTIONS } from '../src/options.js';
import { compareVersions } from '../src/version.js';

function project() {
    const cwd = mkdtempSync(join(tmpdir(), 'brigade-'));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.0.0' }));
    return cwd;
}

const RULES = '.claude/rules/brigade.md';
const OPTIONS_PATH = '.claude/rules/brigade-options.md';
const statuses = (result) => Object.fromEntries(result.report.map(({ path, status }) => [path, status]));

test('installs the web kit on a fresh project with the detected answers', async () => {
    const cwd = project();
    const result = await runInit({ cwd, yes: true });

    assert.equal(result.stack, 'web');
    assert.equal(result.answers.defaultBranch, 'main');
    assert.equal(result.answers.packageManager, 'pnpm');
    assert.ok(result.report.every(({ status }) => status === 'created'));

    const rules = readFileSync(join(cwd, RULES), 'utf8');
    assert.match(rules, /brigade-options\.md/);
    assert.match(readFileSync(join(cwd, OPTIONS_PATH), 'utf8'), /Default branch: `main`/);
    assert.doesNotMatch(rules, /__[A-Z_]+__/);
    assert.ok(!existsSync(join(cwd, 'CLAUDE.md')));
    assert.ok(existsSync(join(cwd, '.claude/brigade.json')));
});

test('installs the skills and the context folder, decisions.md and architecture.md are written once', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    for (const file of [
        'skills/audit/SKILL.md', 'skills/feature/SKILL.md', 'skills/session-start/SKILL.md',
        'context/architecture.md', 'context/decisions.md', 'context/local-template.md', 'context/audits/_template.md',
        'context/features/_template.md'
    ]) assert.ok(existsSync(join(cwd, '.claude', file)), file);
    assert.match(readFileSync(join(cwd, '.claude/context/local-template.md'), 'utf8'), /features\/<branch>\.md/);

    const decisions = join(cwd, '.claude/context/decisions.md');
    writeFileSync(decisions, '- use pnpm\n');
    const result = await runInit({ cwd, yes: true });
    assert.equal(statuses(result)['.claude/context/decisions.md'], 'kept');
    assert.equal(readFileSync(decisions, 'utf8'), '- use pnpm\n');
    assert.ok(!existsSync(`${decisions}.proposed`));
    assert.equal(JSON.parse(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8')).files['.claude/context/decisions.md'], undefined);

    const architecture = join(cwd, '.claude/context/architecture.md');
    writeFileSync(architecture, '# mine\n');
    const again = await runInit({ cwd, yes: true });
    assert.equal(statuses(again)['.claude/context/architecture.md'], 'kept');
    assert.equal(readFileSync(architecture, 'utf8'), '# mine\n');
    assert.ok(!existsSync(`${architecture}.proposed`));
    assert.equal(JSON.parse(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8')).files['.claude/context/architecture.md'], undefined);
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
        validate: async (message, detected, pick) => {
            asked.push(message);
            return detected || pick();
        },
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

test('an error while planning leaves the project untouched', async () => {
    const cwd = project();
    const stackDir = mkdtempSync(join(tmpdir(), 'brigade-kit-'));
    writeFileSync(join(stackDir, 'a.md'), 'a\n');
    symlinkSync(join(stackDir, 'missing'), join(stackDir, 'z.md'));

    await assert.rejects(runInit({ cwd, yes: true, stackDir }));
    assert.ok(!existsSync(join(cwd, 'a.md')));
    assert.ok(!existsSync(join(cwd, '.claude/brigade.json')));
});

test('a corrupted manifest is an error, a missing one is a first install', async () => {
    const cwd = project();
    assert.equal(readManifest(cwd), null);

    mkdirSync(join(cwd, '.claude'));
    for (const bad of ['{ broken', '[]', 'null', '']) {
        writeFileSync(join(cwd, '.claude/brigade.json'), bad);
        assert.throws(() => readManifest(cwd), /corrupted/);
        await assert.rejects(runInit({ cwd, yes: true }), /corrupted/);
    }
    assert.ok(!existsSync(join(cwd, RULES)));
    assert.equal(readFileSync(join(cwd, '.claude/brigade.json'), 'utf8'), '');
});

test('a stale .proposed is removed once the target matches the kit', async () => {
    const cwd = project();
    const stackDir = mkdtempSync(join(tmpdir(), 'brigade-kit-'));
    writeFileSync(join(stackDir, 'rule.md'), 'v1\n');
    await runInit({ cwd, yes: true, stackDir });

    writeFileSync(join(cwd, 'rule.md'), 'mine\n');
    await runInit({ cwd, yes: true, stackDir });
    assert.ok(existsSync(join(cwd, 'rule.md.proposed')));

    writeFileSync(join(cwd, 'rule.md'), 'v1\n');
    const result = await runInit({ cwd, yes: true, stackDir });
    assert.equal(statuses(result)['rule.md'], 'unchanged');
    assert.ok(!existsSync(join(cwd, 'rule.md.proposed')));
});

test('a file that differs from the kit only by line endings is unchanged', async () => {
    const cwd = project();
    const stackDir = mkdtempSync(join(tmpdir(), 'brigade-kit-'));
    writeFileSync(join(stackDir, 'rule.md'), 'a\nb\n');
    await runInit({ cwd, yes: true, stackDir });

    writeFileSync(join(cwd, 'rule.md'), 'a\r\nb\r\n');
    const result = await runInit({ cwd, yes: true, stackDir });
    assert.equal(statuses(result)['rule.md'], 'unchanged');
    assert.ok(!existsSync(join(cwd, 'rule.md.proposed')));
});

test('CRLF ignore files are read and extended with CRLF', () => {
    const cwd = project();
    writeFileSync(join(cwd, '.gitignore'), 'node_modules\r\nCLAUDE.local.md\r\n');
    const result = appendMissingLines(cwd);

    assert.deepEqual(result.find(({ path }) => path === '.gitignore').added, ['.claude/settings.local.json']);
    assert.equal(readFileSync(join(cwd, '.gitignore'), 'utf8'), 'node_modules\r\nCLAUDE.local.md\r\n\r\n## Claude\r\n.claude/settings.local.json\r\n');
    assert.ok(appendMissingLines(cwd).every(({ status }) => status === 'unchanged'));
});

const MANIFEST_FILE = '.claude/brigade.json';
const readAnswers = (cwd) => JSON.parse(readFileSync(join(cwd, MANIFEST_FILE), 'utf8'));
const dropKey = (cwd, key) => {
    const manifest = readAnswers(cwd);
    delete manifest.answers[key];
    writeFileSync(join(cwd, MANIFEST_FILE), JSON.stringify(manifest));
};

test('updating with a full manifest asks nothing but keep or update and keeps the answers', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    const before = readAnswers(cwd).answers;

    const { prompter, asked } = asking('update');
    const result = await runInit({ cwd, version: '2.0.0', interactive: true, prompter });
    assert.deepEqual(asked, ['A newer version is available']);
    assert.deepEqual(result.asked, []);
    assert.deepEqual(readAnswers(cwd).answers, before);
});

test('updating asks only the group that is missing from the manifest', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    dropKey(cwd, 'docsLanguage');

    const { prompter, asked } = asking('update');
    const result = await runInit({ cwd, version: '2.0.0', interactive: true, prompter });
    assert.deepEqual(asked, [
        'A newer version is available',
        'Language of the code, comments and commit messages (shared by the team)',
        'Language of the documentation (shared by the team)'
    ]);
    assert.deepEqual(result.asked, [['codeLanguage', 'docsLanguage']]);
    assert.ok(readAnswers(cwd).answers.docsLanguage);
});

test('without a terminal a missing option takes its default and is reported', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    dropKey(cwd, 'packageManager');

    const result = await runInit({ cwd, yes: true, version: '2.0.0' });
    assert.deepEqual(result.asked, [['packageManager']]);
    assert.equal(readAnswers(cwd).answers.packageManager, 'pnpm');
});

test('a downgrade keeps the keys the older version does not know', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '2.0.0' });
    const manifest = readAnswers(cwd);
    manifest.answers.futureOption = 'x';
    writeFileSync(join(cwd, MANIFEST_FILE), JSON.stringify(manifest));

    await runInit({ cwd, yes: true, version: '1.0.0' });
    assert.equal(readAnswers(cwd).answers.futureOption, 'x');
});

test('an update keeps edited files as .proposed, updates untouched ones and leaves decisions.md and architecture.md alone', async () => {
    const cwd = project();
    const stackDir = mkdtempSync(join(tmpdir(), 'brigade-kit-'));
    writeFileSync(join(stackDir, 'a.md'), 'a1\n');
    writeFileSync(join(stackDir, 'b.md'), 'b1\n');
    mkdirSync(join(stackDir, '.claude/context'), { recursive: true });
    writeFileSync(join(stackDir, '.claude/context/decisions.md'), 'seed\n');
    writeFileSync(join(stackDir, '.claude/context/architecture.md'), 'arch\n');
    await runInit({ cwd, yes: true, stackDir, version: '1.0.0' });

    writeFileSync(join(cwd, 'a.md'), 'edited\n');
    writeFileSync(join(cwd, '.claude/context/decisions.md'), '- mine\n');
    writeFileSync(join(cwd, '.claude/context/architecture.md'), '# mine\n');
    writeFileSync(join(stackDir, 'a.md'), 'a2\n');
    writeFileSync(join(stackDir, 'b.md'), 'b2\n');
    writeFileSync(join(stackDir, '.claude/context/decisions.md'), 'seed2\n');
    writeFileSync(join(stackDir, '.claude/context/architecture.md'), 'arch2\n');
    dropKey(cwd, 'docsLanguage');

    const result = await runInit({ cwd, stackDir, version: '2.0.0', interactive: true, prompter: asking('update').prompter });
    assert.equal(statuses(result)['a.md'], 'proposed');
    assert.equal(statuses(result)['b.md'], 'updated');
    assert.equal(readFileSync(join(cwd, 'a.md'), 'utf8'), 'edited\n');
    assert.equal(readFileSync(join(cwd, 'b.md'), 'utf8'), 'b2\n');
    assert.equal(readFileSync(join(cwd, '.claude/context/decisions.md'), 'utf8'), '- mine\n');
    assert.ok(!existsSync(join(cwd, '.claude/context/decisions.md.proposed')));
    assert.equal(readFileSync(join(cwd, '.claude/context/architecture.md'), 'utf8'), '# mine\n');
    assert.ok(!existsSync(join(cwd, '.claude/context/architecture.md.proposed')));
});

test('the same version still asks every question again', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    const { prompter, asked } = asking('update');
    await runInit({ cwd, version: '1.0.0', interactive: true, prompter });
    assert.ok(asked.includes('Reference branch of the work'));
    assert.ok(asked.includes('Language of the documentation (shared by the team)'));
    assert.ok(asked.includes('And for you? This stays on your machine'));
});

test('a first install asks every question', async () => {
    const cwd = project();
    const { prompter, asked } = asking('update');
    const result = await runInit({ cwd, version: '1.0.0', interactive: true, prompter });
    assert.ok(asked.includes('Default branch of the repository'));
    assert.ok(asked.includes('Language of the documentation (shared by the team)'));
    assert.ok(asked.includes('And for you? This stays on your machine'));
    assert.deepEqual(result.asked, []);
});

test('OPTIONS declares exactly the answers a fresh install stores', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    assert.deepEqual(OPTIONS.flatMap(({ keys }) => keys).sort(), Object.keys(readAnswers(cwd).answers).sort());
});

const warnings = () => {
    const { prompter } = asking('update');
    const seen = [];
    prompter.warn = (message) => seen.push(message);
    return { prompter, seen };
};
const lostManifest = (message) => /brigade\.json is missing/.test(message);

test('a missing manifest with kit files already there warns and still installs', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    execFileSync('rm', [join(cwd, MANIFEST_FILE)]);

    const { prompter, seen } = warnings();
    const result = await runInit({ cwd, interactive: true, prompter });
    assert.equal(seen.filter(lostManifest).length, 1);
    assert.ok(result.report.every(({ status }) => status !== 'proposed'));
    assert.ok(existsSync(join(cwd, MANIFEST_FILE)));
});

test('no lost-manifest warning on a true first install', async () => {
    const cwd = project();
    const { prompter, seen } = warnings();
    await runInit({ cwd, interactive: true, prompter });
    assert.ok(!seen.some(lostManifest));
});

test('no lost-manifest warning when the manifest exists', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });

    const { prompter, seen } = warnings();
    await runInit({ cwd, interactive: true, prompter });
    assert.ok(!seen.some(lostManifest));
});

test('the options file follows the answers, is overwritten when edited and is not in the manifest', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    const rules = readFileSync(join(cwd, RULES), 'utf8');
    assert.equal(readManifest(cwd).files[OPTIONS_PATH], undefined);

    writeFileSync(join(cwd, OPTIONS_PATH), 'mine\n');
    const again = await runInit({ cwd, yes: true });
    assert.equal(statuses(again)[OPTIONS_PATH], 'updated');
    assert.match(readFileSync(join(cwd, OPTIONS_PATH), 'utf8'), /Package manager: `pnpm`/);
    assert.ok(!existsSync(join(cwd, `${OPTIONS_PATH}.proposed`)));
    assert.equal(statuses(await runInit({ cwd, yes: true }))[OPTIONS_PATH], 'unchanged');

    // An answer changes: only the options file follows, the kit file stays untouched.
    const manifest = readManifest(cwd);
    manifest.answers.packageManager = 'yarn';
    writeFileSync(join(cwd, '.claude/brigade.json'), JSON.stringify(manifest));
    const changed = await runInit({ cwd, yes: true });
    assert.equal(statuses(changed)[OPTIONS_PATH], 'updated');
    assert.equal(statuses(changed)[RULES], 'unchanged');
    assert.match(readFileSync(join(cwd, OPTIONS_PATH), 'utf8'), /Package manager: `yarn`/);
    assert.equal(readFileSync(join(cwd, RULES), 'utf8'), rules);
});

test('a kit update of brigade.md is applied without a proposal when the answers are unchanged', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true, version: '1.0.0' });
    // Simulate an install of an older kit: the old text is what the manifest knows.
    const old = readFileSync(join(cwd, RULES), 'utf8').replace('Keep changes small and focused.', 'Keep changes small.');
    writeFileSync(join(cwd, RULES), old);
    const manifest = readManifest(cwd);
    manifest.files[RULES] = sha(old);
    writeFileSync(join(cwd, '.claude/brigade.json'), JSON.stringify(manifest));

    const result = await runInit({ cwd, yes: true, version: '1.0.1' });
    assert.equal(statuses(result)[RULES], 'updated');
    assert.equal(statuses(result)[OPTIONS_PATH], 'unchanged');
    assert.match(readFileSync(join(cwd, RULES), 'utf8'), /Keep changes small and focused\./);
    assert.ok(!existsSync(join(cwd, `${RULES}.proposed`)));
});

// Migration from the old brigade.md, rendered with the answers inline.
const OLD_ANSWERS = { defaultBranch: 'main', baseBranch: 'develop', packageManager: 'pnpm', commitFormat: 'Conventional Commits.', replyLanguage: 'French', codeLanguage: 'English', docsLanguage: 'English' };
const oldRules = (extra = '') => render(readFileSync(new URL('./fixtures/old-brigade.md', import.meta.url), 'utf8'), OLD_ANSWERS) + extra;

async function oldInstall({ edit = '', manifest = true } = {}) {
    const cwd = project();
    const text = oldRules();
    mkdirSync(join(cwd, '.claude/rules'), { recursive: true });
    writeFileSync(join(cwd, RULES), text + edit);
    if (manifest) writeFileSync(join(cwd, MANIFEST_FILE), JSON.stringify({ version: '1.0.0', stack: 'web', answers: OLD_ANSWERS, files: { [RULES]: sha(text) } }));
    const result = await runInit({ cwd, yes: true });
    return { cwd, result };
}

test('an unedited old brigade.md is updated and the options file is created', async () => {
    const { cwd, result } = await oldInstall();
    assert.equal(statuses(result)[RULES], 'updated');
    assert.ok(!existsSync(join(cwd, `${RULES}.proposed`)));
    assert.match(readFileSync(join(cwd, RULES), 'utf8'), /brigade-options\.md/);
    assert.equal(statuses(result)[OPTIONS_PATH], 'created');
});

test('an edited old brigade.md is kept, proposed with a migration note', async () => {
    const { cwd, result } = await oldInstall({ edit: '\n- my own rule\n' });
    assert.equal(statuses(result)[RULES], 'proposed');
    assert.match(result.report.find(({ path }) => path === RULES).note, /brigade-options\.md/);
    assert.match(readFileSync(join(cwd, RULES), 'utf8'), /my own rule/);
    assert.match(readFileSync(join(cwd, `${RULES}.proposed`), 'utf8'), /brigade-options\.md/);
    assert.equal(statuses(result)[OPTIONS_PATH], 'created');
});

test('an old brigade.md with a lost manifest is proposed with the note', async () => {
    const { cwd, result } = await oldInstall({ manifest: false });
    assert.equal(statuses(result)[RULES], 'proposed');
    assert.ok(result.report.find(({ path }) => path === RULES).note);
    assert.ok(existsSync(join(cwd, OPTIONS_PATH)));
});

test('a proposed brigade.md that already mentions the options file gets no note', async () => {
    const cwd = project();
    await runInit({ cwd, yes: true });
    writeFileSync(join(cwd, RULES), 'mine, see brigade-options.md\n');
    const result = await runInit({ cwd, yes: true });
    assert.equal(statuses(result)[RULES], 'proposed');
    assert.equal(result.report.find(({ path }) => path === RULES).note, undefined);
});
