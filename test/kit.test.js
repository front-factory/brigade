import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCommand, renderOptions } from '../src/render.js';
import {
    brigade, editManifest, install, MANIFEST, project, read, readJson, SETTINGS, sha, tmp, write, writeJson
} from './contract/helpers.js';

const HOOK = fileURLToPath(new URL('../templates/web/.claude/hooks/session-start.mjs', import.meta.url));
const OPTIONS = '.claude/rules/brigade-options.md';
const AUDIT = '.claude/skills/audit/SKILL.md';

const withPackage = (pkg, lock = 'package-lock.json') => {
    const cwd = project();

    writeJson(cwd, 'package.json', pkg);
    write(cwd, lock, '');

    return cwd;
};

const checksLine = (cwd) => read(cwd, OPTIONS).split('\n').find((line) => line.startsWith('- Checks'));

test('checks are detected from the test and lint scripts, and rendered for the package manager', () => {
    const both = install(withPackage({
        scripts: {
            test: 'node --test',
            lint: 'eslint .'
        }
    }));

    assert.equal(checksLine(both), '- Checks at the end of each task (project default): `npm test`, `npm run lint`.');
    assert.deepEqual(readJson(both, MANIFEST).answers.checks, [
        'test',
        'lint'
    ]);

    const bun = install(withPackage({
        scripts: {
            test: 'bun test',
            lint: 'x'
        }
    }, 'bun.lock'));

    assert.match(checksLine(bun), /`bun run test`, `bun run lint`/);
    assert.equal(checksLine(install(project())), '- Checks at the end of each task (project default): none.');

    const placeholder = install(withPackage({
        scripts: {
            test: 'echo "Error: no test specified" && exit 1'
        }
    }));

    assert.match(checksLine(placeholder), /: none\.$/);
    assert.equal(checkCommand('pnpm', 'test'), 'pnpm test');
    assert.match(renderOptions({
        packageManager: 'yarn',
        checks: [
            'lint'
        ]
    }), /`yarn run lint`\./);
});

test('updating a v1 install detects checks, keeps audits and drops the status line', () => {
    const cwd = install(withPackage({
        scripts: {
            test: 'x'
        }
    }));

    const statusline = '// old status line\n';
    const settings = readJson(cwd, SETTINGS);

    settings.statusLine = {
        type: 'command',
        command: 'sh "$CLAUDE_PROJECT_DIR/.claude/hooks/run-node.sh" "$CLAUDE_PROJECT_DIR/.claude/hooks/statusline.mjs"'
    };

    writeJson(cwd, SETTINGS, settings);
    write(cwd, '.claude/hooks/statusline.mjs', statusline);

    editManifest(cwd, (manifest) => {
        manifest.version = '1.0.0';
        delete manifest.answers.checks;
        delete manifest.answers.audits;
        manifest.files['.claude/hooks/statusline.mjs'] = sha(statusline);
        manifest.files[SETTINGS] = sha(read(cwd, SETTINGS));
    });

    const result = brigade(cwd, [
        'init',
        '--yes'
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readJson(cwd, MANIFEST).answers.checks, [
        'test'
    ]);

    assert.equal(readJson(cwd, MANIFEST).answers.audits, true);
    assert.equal(existsSync(join(cwd, '.claude/hooks/statusline.mjs')), false);
    assert.equal(readJson(cwd, SETTINGS).statusLine, undefined);
    assert.ok(existsSync(join(cwd, AUDIT)));
});

test('audits off leaves the audit skill and template out, and removes untouched copies', () => {
    const cwd = install(project());

    assert.ok(existsSync(join(cwd, AUDIT)));
    editManifest(cwd, (manifest) => {
        manifest.answers.audits = false;
    });

    assert.equal(brigade(cwd, [
        'init',
        '--yes'
    ]).status, 0);

    assert.equal(readJson(cwd, MANIFEST).answers.audits, false);
    assert.equal(existsSync(join(cwd, AUDIT)), false);
    assert.equal(existsSync(join(cwd, '.claude/context/audits/_template.md')), false);
});

test('settings: schema, readable .env.example, explicit env denies, dependency installs ask', () => {
    const cwd = install(project());
    const settings = readJson(cwd, SETTINGS);
    const { allow, ask, deny } = settings.permissions;

    assert.equal(settings.$schema, 'https://json.schemastore.org/claude-code-settings.json');
    assert.ok(deny.includes('Read(./.env)') && deny.includes('Edit(./**/.env.production)') && deny.includes('Edit(./**/*.key)'));
    assert.equal(deny.some((rule) => rule.includes('.env.example') || rule.includes('.env*')), false);
    assert.ok(ask.includes('Bash(npm install *)') && ask.includes('Bash(npm i *)') && ask.includes('Bash(npm add:*)') && ask.includes('Bash(npx:*)'));
    assert.ok(allow.includes('Bash(npm ci)') && !allow.includes('Bash(npm install)'));
    assert.equal(settings.statusLine, undefined);
});

const runHook = (cwd, env = {}) => {
    const result = spawnSync(process.execPath, [
        HOOK
    ], {
        cwd,
        input: JSON.stringify({
            cwd
        }),
        encoding: 'utf8',
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: cwd,
            ...env
        }
    });

    assert.equal(result.status, 0);

    return result.stdout ? JSON.parse(result.stdout).hookSpecificOutput.additionalContext : '';
};

test('session start hook injects version, decisions, branch, feature file and stale files', () => {
    const cwd = install(project());

    write(cwd, '.claude/context/decisions.md', '# Team decisions\n\n<!-- secret\ncomment -->\n\n- Use tabs.\n');
    spawnSync('git', [
        'checkout',
        '-q',
        '-b',
        'feat/login'
    ], {
        cwd
    });

    write(cwd, '.claude/context/features/feat-login.md', '# Feature: login (branch feat/login)\n\n## Goal\n\nLet users in.\n');
    write(cwd, '.claude/context/features/old.md', '# Feature: old (branch fix/gone)\n');

    const text = runHook(cwd);

    assert.match(text, /^Brigade v\d+\.\d+\.\d+\S* manages this project\./);
    assert.match(text, /Use tabs\./);
    assert.match(text, /Branch: feat\/login \(no upstream\)\./);
    assert.match(text, /Feature file \.claude\/context\/features\/feat-login\.md:[\s\S]*Let users in\./);
    assert.doesNotMatch(text, /secret|# Team decisions/);
    assert.match(text, /Stale feature files \(branch gone, remove them\) in \.claude\/context\/features\/: old\.md$/);
});

test('session start hook skips comment-only decisions and never fails outside a git repo', () => {
    const cwd = tmp();

    write(cwd, '.claude/context/decisions.md', '# Team decisions\n\n<!-- nothing yet -->\n');

    assert.equal(runHook(cwd), '');
    assert.doesNotMatch(runHook(install(project({
        git: false
    }))), /Branch:/);
});
