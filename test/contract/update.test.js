import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
    brigade, editManifest, install, MANIFEST, read, readJson, sha, snapshot, VERSION, write
} from './helpers.js';

const FILE = '.claude/agents/implementer.md';

const update = (cwd) => brigade(cwd, [
    'init',
    '--yes'
]);

test('a kit file deleted by the user is recreated', () => {
    const cwd = install();
    const kit = read(cwd, FILE);

    rmSync(join(cwd, FILE));

    assert.equal(update(cwd).status, 0);
    assert.equal(read(cwd, FILE), kit);
});

test('a file equal to its recorded sha but different from the kit is updated', () => {
    const cwd = install();
    const kit = read(cwd, FILE);

    write(cwd, FILE, 'old kit version\n');
    editManifest(cwd, (manifest) => {
        manifest.files[FILE] = sha('old kit version\n');
    });

    assert.equal(update(cwd).status, 0);
    assert.equal(read(cwd, FILE), kit);
    assert.ok(!existsSync(join(cwd, `${FILE}.proposed`)));
    assert.equal(readJson(cwd, MANIFEST).files[FILE], sha(kit));
});

test('a user-edited file is kept and the kit version goes to .proposed when the kit changed', () => {
    const cwd = install();
    const kit = read(cwd, FILE);

    write(cwd, FILE, 'mine\n');
    editManifest(cwd, (manifest) => {
        manifest.files[FILE] = sha('a third version\n');
    });

    assert.equal(update(cwd).status, 0);
    assert.equal(read(cwd, FILE), 'mine\n');
    assert.equal(read(cwd, `${FILE}.proposed`), kit);
});

test('a user-edited file gets no .proposed when the kit did not change', () => {
    const cwd = install();

    write(cwd, FILE, 'mine\n');

    assert.equal(update(cwd).status, 0);
    assert.equal(read(cwd, FILE), 'mine\n');
    assert.ok(!existsSync(join(cwd, `${FILE}.proposed`)));
});

test('write-once files edited by the user are never overwritten and get no .proposed', () => {
    for (const recorded of [
        undefined,
        sha('another version\n')
    ]) {
        const cwd = install();

        for (const path of [
            '.claude/context/decisions.md',
            '.claude/context/architecture.md'
        ]) {
            write(cwd, path, 'mine\n');
        }

        editManifest(cwd, (manifest) => {
            for (const path of Object.keys(manifest.files).filter((name) => /decisions|architecture/.test(name))) {
                if (recorded) {
                    manifest.files[path] = recorded;
                }
            }
        });

        assert.equal(update(cwd).status, 0);

        for (const path of [
            '.claude/context/decisions.md',
            '.claude/context/architecture.md'
        ]) {
            assert.equal(read(cwd, path), 'mine\n');
            assert.ok(!existsSync(join(cwd, `${path}.proposed`)));
        }
    }
});

test('a file the kit no longer ships is removed when untouched and kept when edited', () => {
    const cwd = install();

    write(cwd, '.claude/agents/gone.md', 'old\n');
    write(cwd, '.claude/agents/gone-edited.md', 'edited\n');
    editManifest(cwd, (manifest) => {
        manifest.files['.claude/agents/gone.md'] = sha('old\n');
        manifest.files['.claude/agents/gone-edited.md'] = sha('original\n');
    });

    assert.equal(update(cwd).status, 0);
    assert.ok(!existsSync(join(cwd, '.claude/agents/gone.md')));
    assert.equal(read(cwd, '.claude/agents/gone-edited.md'), 'edited\n');
});

test('an unknown key in answers is preserved', () => {
    const cwd = install();

    editManifest(cwd, (manifest) => {
        manifest.answers.futureOption = 'keep me';
    });

    assert.equal(update(cwd).status, 0);
    assert.equal(readJson(cwd, MANIFEST).answers.futureOption, 'keep me');
});

test('a manifest from an older version updates to the current version without a terminal', () => {
    const cwd = install();

    editManifest(cwd, (manifest) => {
        manifest.version = '1.0.0';
    });

    assert.equal(update(cwd).status, 0);
    assert.equal(readJson(cwd, MANIFEST).version, VERSION);
});

test('a corrupted brigade.json makes init fail with exit 1 and writes nothing', () => {
    const cwd = install();

    write(cwd, MANIFEST, '{ not json');

    const before = snapshot(cwd);

    assert.equal(update(cwd).status, 1);
    assert.deepEqual(snapshot(cwd), before);
});
