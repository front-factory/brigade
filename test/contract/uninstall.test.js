import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
    brigade, install, MANIFEST, read, readJson, SETTINGS, snapshot, write, writeJson
} from './helpers.js';

const FILE = '.claude/agents/implementer.md';
const exists = (cwd, path) => existsSync(join(cwd, path));

const uninstall = (cwd, extra = []) => brigade(cwd, [
    'uninstall',
    '--yes',
    ...extra
]);

test('untouched kit files, their .proposed, the options file and the manifest are removed', () => {
    const cwd = install();
    const files = Object.keys(readJson(cwd, MANIFEST).files).filter((path) => !/decisions|architecture/.test(path));

    write(cwd, `${FILE}.proposed`, 'kit\n');

    assert.equal(uninstall(cwd).status, 0);

    for (const path of files.filter((name) => name !== SETTINGS)) {
        assert.ok(!exists(cwd, path), path);
    }

    assert.ok(!exists(cwd, `${FILE}.proposed`));
    assert.ok(!exists(cwd, '.claude/rules/brigade-options.md'));
    assert.ok(!exists(cwd, MANIFEST));
});

test('edited kit files and an edited decisions.md are kept', () => {
    const cwd = install();

    write(cwd, FILE, 'mine\n');
    write(cwd, '.claude/context/decisions.md', 'my decisions\n');

    assert.equal(uninstall(cwd).status, 0);
    assert.equal(read(cwd, FILE), 'mine\n');
    assert.equal(read(cwd, '.claude/context/decisions.md'), 'my decisions\n');
    assert.ok(!exists(cwd, MANIFEST));
});

test('settings.json: kit entries are stripped, user entries stay', () => {
    const cwd = install();
    const settings = readJson(cwd, SETTINGS);

    settings.permissions.allow.push('Bash(make:*)');
    writeJson(cwd, SETTINGS, settings);

    assert.equal(uninstall(cwd).status, 0);

    const left = readJson(cwd, SETTINGS);

    assert.deepEqual(left.permissions.allow, [
        'Bash(make:*)'
    ]);

    assert.equal(left.hooks, undefined);
});

test('settings.json is deleted when nothing of the user is left', () => {
    const cwd = install();

    assert.equal(uninstall(cwd).status, 0);
    assert.ok(!exists(cwd, SETTINGS));
});

test('project files, local settings, features and audits are never touched', () => {
    const cwd = install();

    const mine = {
        'CLAUDE.md': 'a\n',
        'CLAUDE.local.md': 'b\n',
        '.claude/settings.local.json': '{"x":1}\n',
        '.claude/context/features/my-branch.md': 'feature\n',
        '.claude/context/audits/2026-01-01-x.md': 'audit\n'
    };

    for (const [
        path,
        content
    ] of Object.entries(mine)) {
        write(cwd, path, content);
    }

    assert.equal(uninstall(cwd).status, 0);

    for (const [
        path,
        content
    ] of Object.entries(mine)) {
        assert.equal(read(cwd, path), content, path);
    }
});

test('--dry-run removes nothing', () => {
    const cwd = install();
    const before = snapshot(cwd);

    assert.equal(uninstall(cwd, [
        '--dry-run'
    ]).status, 0);

    assert.deepEqual(snapshot(cwd), before);
});
