import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
    mkdirSync, mkdtempSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const STATUSLINE = fileURLToPath(new URL('../templates/web/.claude/hooks/statusline.mjs', import.meta.url));
const SESSION_START = fileURLToPath(new URL('../templates/web/.claude/hooks/session-start.mjs', import.meta.url));

function project({ version = '1.3.0', head = 'ref: refs/heads/feat/x\n' } = {}) {
    const cwd = mkdtempSync(join(tmpdir(), 'brigade-hook-'));

    if (version) {
        mkdirSync(join(cwd, '.claude'));
        writeFileSync(join(cwd, '.claude/brigade.json'), JSON.stringify({
            version
        }));
    }

    if (head) {
        mkdirSync(join(cwd, '.git'));
        writeFileSync(join(cwd, '.git/HEAD'), head);
    }

    return cwd;
}

const run = (script, input, env = {}) =>
    spawnSync(process.execPath, [
        script
    ], {
        input,
        encoding: 'utf8',
        env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: '',
            ...env
        }
    });

const status = (cwd, input = {
    workspace: {
        project_dir: cwd
    }
}) => run(STATUSLINE, JSON.stringify(input));

test('the status line shows the version and the branch', () => {
    const result = status(project());

    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'Brigade v1.3.0 · feat/x\n');
});

test('the status line finds the project from cwd and from a subfolder', () => {
    const cwd = project();

    mkdirSync(join(cwd, 'src'));
    assert.equal(status(cwd, {
        cwd: join(cwd, 'src')
    }).stdout, 'Brigade v1.3.0 · feat/x\n');
});

test('the status line leaves out what is missing', () => {
    assert.equal(status(project({
        head: null
    })).stdout, 'Brigade v1.3.0\n');

    assert.equal(status(project({
        version: null
    })).stdout, 'Brigade · feat/x\n');

    assert.equal(status(project({
        version: null,
        head: null
    })).stdout, 'Brigade\n');

    assert.equal(status(project({
        head: 'a1b2c3d\n'
    })).stdout, 'Brigade v1.3.0\n');
});

test('the status line survives an unreadable manifest and payload', () => {
    const cwd = project();

    writeFileSync(join(cwd, '.claude/brigade.json'), '{ nope');
    assert.equal(status(cwd).stdout, 'Brigade · feat/x\n');

    const result = run(STATUSLINE, 'not json');

    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'Brigade\n');
});

test('the status line follows a worktree .git file', () => {
    const cwd = project({
        head: null
    });

    mkdirSync(join(cwd, 'real'));
    writeFileSync(join(cwd, 'real/HEAD'), 'ref: refs/heads/wt\n');
    writeFileSync(join(cwd, '.git'), 'gitdir: real\n');
    assert.equal(status(cwd).stdout, 'Brigade v1.3.0 · wt\n');
});

test('the session start hook announces the version', () => {
    const cwd = project();

    const result = run(SESSION_START, JSON.stringify({
        cwd
    }), {
        CLAUDE_PROJECT_DIR: cwd
    });

    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);

    assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.equal(output.hookSpecificOutput.additionalContext, 'Brigade v1.3.0 manages this project.');
    assert.equal(output.systemMessage, 'Brigade v1.3.0 manages this project.');
});

test('the session start hook stays silent and succeeds without a usable manifest', () => {
    const none = project({
        version: null
    });

    const result = run(SESSION_START, 'not json', {
        CLAUDE_PROJECT_DIR: none
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');

    const broken = project();

    writeFileSync(join(broken, '.claude/brigade.json'), '{ nope');

    const second = run(SESSION_START, '{}', {
        CLAUDE_PROJECT_DIR: broken
    });

    assert.equal(second.status, 0);
    assert.equal(second.stdout, '');
});

test('the session start hook injects the branch, the feature and the open audits', () => {
    const cwd = project({
        head: null
    });

    execFileSync('git', [
        'init',
        '-q',
        '-b',
        'feat/x'
    ], {
        cwd
    });

    mkdirSync(join(cwd, '.claude/context/features'), {
        recursive: true
    });

    mkdirSync(join(cwd, '.claude/context/audits'), {
        recursive: true
    });

    writeFileSync(join(cwd, '.claude/context/features/feat-x.md'), '# Feature: x\n\n## Goal\n\nShip x.\n\n## Steps\n\n- [x] one\n- [ ] two\n');
    writeFileSync(join(cwd, '.claude/context/audits/a.md'), 'Status: open\n');
    writeFileSync(join(cwd, '.claude/context/audits/b.md'), 'Status: closed\n');
    writeFileSync(join(cwd, '.claude/context/audits/_template.md'), 'Status: open\n');

    const result = run(SESSION_START, '{}', {
        CLAUDE_PROJECT_DIR: cwd
    });
    const output = JSON.parse(result.stdout);

    assert.equal(output.hookSpecificOutput.additionalContext, [
        'Brigade v1.3.0 manages this project.',
        'Branch: feat/x.',
        'Feature file: .claude/context/features/feat-x.md. Goal: Ship x. Next step: two.',
        'Open audits: 1 (.claude/context/audits/).'
    ].join('\n'));

    assert.equal(output.systemMessage, 'Brigade v1.3.0 manages this project.');
});

test('the session start hook prints the version without a git repository', () => {
    const cwd = project({
        head: null
    });

    const result = run(SESSION_START, '{}', {
        CLAUDE_PROJECT_DIR: cwd,
        GIT_CEILING_DIRECTORIES: tmpdir()
    });

    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, 'Brigade v1.3.0 manages this project.');
});
