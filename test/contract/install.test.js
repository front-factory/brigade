import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    brigade, install, kitFiles, MANIFEST, project, read, readJson, sha, snapshot, VERSION, write
} from './helpers.js';

test('every kit file lands at the same relative path', () => {
    const cwd = install();
    const files = snapshot(cwd);

    for (const path of kitFiles()) {
        assert.ok(Object.hasOwn(files, path), path);
    }
});

test('no placeholder is left in any written file', () => {
    const cwd = install();

    for (const [
        path,
        content
    ] of Object.entries(snapshot(cwd))) {
        assert.doesNotMatch(content, /__[A-Z][A-Z_]*__/, path);
    }
});

test('brigade-options.md names the default branch and the package manager', () => {
    const options = read(install(), '.claude/rules/brigade-options.md');

    assert.match(options, /`main`/);
    assert.match(options, /`npm`/);
});

test('the manifest records version, stack, answers and the sha256 of each file', () => {
    const cwd = install();
    const manifest = readJson(cwd, MANIFEST);

    assert.equal(manifest.version, VERSION);
    assert.equal(manifest.stack, 'web');

    for (const key of [
        'defaultBranch',
        'baseBranch',
        'packageManager',
        'commitConvention',
        'replyLanguage',
        'codeLanguage',
        'docsLanguage'
    ]) {
        assert.equal(typeof manifest.answers[key], 'string', key);
    }

    assert.equal(manifest.answers.defaultBranch, 'main');
    assert.equal(manifest.answers.packageManager, 'npm');
    assert.ok(Object.keys(manifest.files).length > 0);

    for (const [
        path,
        hash
    ] of Object.entries(manifest.files)) {
        assert.match(hash, /^[0-9a-f]{64}$/, path);
        assert.equal(hash, sha(read(cwd, path)), path);
    }

    for (const path of kitFiles()) {
        assert.ok(Object.hasOwn(manifest.files, path), path);
    }
});

test('.gitignore and .gitattributes get their lines, existing lines are kept, nothing is duplicated', () => {
    const cwd = project();

    write(cwd, '.gitignore', 'node_modules\ndist\n');
    write(cwd, '.gitattributes', '*.png binary\n');
    install(cwd);
    install(cwd);

    const ignore = read(cwd, '.gitignore').split('\n');
    const attributes = read(cwd, '.gitattributes').split('\n');

    assert.ok(ignore.includes('node_modules'));
    assert.ok(ignore.includes('dist'));
    assert.equal(ignore.filter((line) => line === '.claude/settings.local.json').length, 1);
    assert.equal(ignore.filter((line) => line === 'CLAUDE.local.md').length, 1);
    assert.ok(attributes.includes('*.png binary'));
    assert.equal(attributes.filter((line) => line === '.claude/hooks/* text eol=lf').length, 1);
});

test('CLAUDE.md and CLAUDE.local.md are left byte-identical', () => {
    const cwd = project();

    write(cwd, 'CLAUDE.md', '# Mine\r\n\u00e9 no trailing newline');
    write(cwd, 'CLAUDE.local.md', 'local\n');
    install(cwd);
    install(cwd);

    assert.equal(read(cwd, 'CLAUDE.md'), '# Mine\r\n\u00e9 no trailing newline');
    assert.equal(read(cwd, 'CLAUDE.local.md'), 'local\n');
});

test('a run without a terminal and without --yes behaves like --yes', () => {
    const withYes = install();
    const cwd = project();

    const result = brigade(cwd, [
        'init'
    ]);

    assert.equal(result.status, 0);
    assert.deepEqual(Object.keys(snapshot(cwd)).sort(), Object.keys(snapshot(withYes)).sort());
    assert.deepEqual(readJson(cwd, MANIFEST), readJson(withYes, MANIFEST));
});

test('a second identical run changes no file', () => {
    const cwd = install();
    const before = snapshot(cwd);

    const result = brigade(cwd, [
        'init',
        '--yes'
    ]);

    // v1 quirk, frozen: the first re-run drops the write-once files from the manifest `files` (see the feature file).
    // Everything else is untouched, and from then on the manifest is stable too.
    const settled = snapshot(cwd);

    const others = Object.entries(before).filter(([
        path
    ]) => path !== MANIFEST);

    const after = Object.entries(settled).filter(([
        path
    ]) => path !== MANIFEST);

    assert.equal(result.status, 0);
    assert.deepEqual(after, others);

    brigade(cwd, [
        'init',
        '--yes'
    ]);

    assert.deepEqual(snapshot(cwd), settled);
});
