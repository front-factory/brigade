import assert from 'node:assert/strict';
import {
    mkdtempSync, rmSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { detectPackageManager } from '../src/detect.js';
import { compareVersions, mergeKit } from '../src/install.js';
import { render } from '../src/render.js';

function project(files) {
    const cwd = mkdtempSync(join(tmpdir(), 'brigade-unit-'));

    for (const [
        name,
        content
    ] of Object.entries(files)) {
        writeFileSync(join(cwd, name), content);
    }

    return cwd;
}

const detect = (files) => {
    const cwd = project(files);
    const found = detectPackageManager(cwd);

    rmSync(cwd, {
        recursive: true,
        force: true
    });

    return found;
};

test('the declared packageManager wins over a lockfile', () => {
    const found = detect({
        'package.json': '{"packageManager":"pnpm@9.0.0"}',
        'package-lock.json': '{}'
    });

    assert.equal(found.value, 'pnpm');
});

test('several lockfiles are ambiguous: no value, all candidates', () => {
    const found = detect({
        'package.json': '{}',
        'package-lock.json': '{}',
        'yarn.lock': ''
    });

    assert.equal(found.value, '');
    assert.deepEqual(found.candidates.sort(), [
        'npm',
        'yarn'
    ]);
});

test('an unknown packageManager field is ignored', () => {
    const found = detect({
        'package.json': '{"packageManager":"evil; rm -rf /@1"}',
        'bun.lockb': ''
    });

    assert.equal(found.value, 'bun');
});

test('placeholders are JSON-escaped in .json files only, unknown ones are left as is', () => {
    const answers = {
        defaultBranch: 'main',
        replyLanguage: 'Fran"cais\\'
    };

    assert.equal(render('"__REPLY_LANGUAGE__"', answers, true), '"Fran\\"cais\\\\"');
    assert.equal(render('__REPLY_LANGUAGE__', answers), 'Fran"cais\\');
    assert.equal(render('__NOPE__ __DEFAULT_BRANCH__', answers), '__NOPE__ main');
});

const hook = (command) => ({
    hooks: [
        {
            type: 'command',
            command
        }
    ]
});

const kit = {
    model: 'opus',
    permissions: {
        allow: [
            'Bash(git status:*)',
            'Bash(npm test:*)'
        ]
    },
    hooks: {
        PreToolUse: [
            hook('sh ".claude/hooks/run-node.sh" ".claude/hooks/git-guard.mjs"')
        ]
    }
};

test('settings merge: the user wins, arrays are unioned, a user hook stays', () => {
    const mine = {
        model: 'sonnet',
        permissions: {
            allow: [
                'Bash(make:*)',
                'Bash(git status:*)'
            ]
        },
        hooks: {
            PreToolUse: [
                hook('echo mine')
            ]
        }
    };

    const merged = mergeKit(mine, kit);

    assert.equal(merged.model, 'sonnet');
    assert.deepEqual(merged.permissions.allow, [
        'Bash(make:*)',
        'Bash(git status:*)',
        'Bash(npm test:*)'
    ]);

    assert.equal(merged.hooks.PreToolUse.length, 2);
    assert.equal(merged.hooks.PreToolUse[0].hooks[0].command, 'echo mine');
});

test('settings merge: no duplicate kit hook, an old kit hook command is replaced', () => {
    const again = mergeKit(kit, kit);

    assert.equal(again.hooks.PreToolUse.length, 1);

    const old = {
        hooks: {
            PreToolUse: [
                hook('node .claude/hooks/git-guard.mjs')
            ]
        }
    };

    const merged = mergeKit(old, kit);

    assert.deepEqual(merged.hooks.PreToolUse, kit.hooks.PreToolUse);
});

test('versions compare with pre-release precedence', () => {
    assert.ok(compareVersions('1.8.0', '1.7.4') > 0);
    assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
    assert.ok(compareVersions('1.8.0-beta.1', '1.8.0') < 0);
    assert.ok(compareVersions('1.8.0-beta.2', '1.8.0-beta.10') < 0);
    assert.ok(compareVersions('1.8.0-alpha', '1.8.0-alpha.1') < 0);
    assert.equal(compareVersions('1.8.0+build', '1.8.0'), 0);
});
