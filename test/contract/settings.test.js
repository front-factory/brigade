import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    brigade, editManifest, install, project, read, readJson, SETTINGS, sha, writeJson
} from './helpers.js';

const update = (cwd) => brigade(cwd, [
    'init',
    '--yes'
]);

const commands = (settings, event) => (settings.hooks?.[event] ?? []).flatMap((entry) => entry.hooks.map((hook) => hook.command));

// Marks the kit settings as changed since the last install.
function kitChanged(cwd) {
    editManifest(cwd, (manifest) => {
        manifest.files[SETTINGS] = sha('an older kit settings\n');
    });
}

test('on a kit change, user rules and scalar values survive and kit hooks appear once', () => {
    const cwd = install();
    const kit = readJson(cwd, SETTINGS);
    const settings = structuredClone(kit);

    settings.permissions.allow.push('Bash(make:*)');
    settings.model = 'sonnet';
    settings.hooks.PreToolUse.push({
        matcher: 'Edit',
        hooks: [
            {
                type: 'command',
                command: 'echo mine'
            }
        ]
    });

    writeJson(cwd, SETTINGS, settings);
    kitChanged(cwd);

    assert.equal(update(cwd).status, 0);

    const merged = readJson(cwd, SETTINGS);

    assert.ok(merged.permissions.allow.includes('Bash(make:*)'));
    assert.equal(merged.model, 'sonnet');
    assert.ok(commands(merged, 'PreToolUse').includes('echo mine'));

    for (const event of [
        'PreToolUse',
        'SessionStart'
    ]) {
        for (const command of commands(kit, event)) {
            assert.equal(commands(merged, event).filter((name) => name === command).length, 1, command);
        }
    }

    assert.equal(merged.permissions.allow.filter((rule) => rule === kit.permissions.allow[0]).length, 1);
});

test('when the kit settings did not change, a removed kit rule stays removed', () => {
    const cwd = install();
    const settings = readJson(cwd, SETTINGS);
    const removed = settings.permissions.allow.shift();

    writeJson(cwd, SETTINGS, settings);
    const before = read(cwd, SETTINGS);

    assert.equal(update(cwd).status, 0);
    assert.equal(read(cwd, SETTINGS), before);
    assert.ok(!readJson(cwd, SETTINGS).permissions.allow.includes(removed));
});

test('a pre-existing settings.local.json is kept (only language may be added)', () => {
    const cwd = project();

    const local = {
        env: {
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '1'
        },
        permissions: {
            allow: [
                'Bash(make:*)'
            ]
        },
        custom: [
            1,
            2
        ]
    };

    writeJson(cwd, '.claude/settings.local.json', local);
    install(cwd);
    update(cwd);

    const { language, ...rest } = readJson(cwd, '.claude/settings.local.json');

    assert.ok(language === undefined || typeof language === 'string');
    assert.deepEqual(rest, local);
});
