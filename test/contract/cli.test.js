import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    brigade, install, project, snapshot, VERSION
} from './helpers.js';

test('-v and --version print the package version and exit 0', () => {
    for (const flag of [
        '-v',
        '--version'
    ]) {
        const result = brigade(project(), [
            flag
        ]);

        assert.equal(result.status, 0);
        assert.match(result.stdout, new RegExp(VERSION.replaceAll('.', '\\.')));
    }
});

test('-h, --help and no arguments exit 0', () => {
    for (const args of [
        [
            '-h'
        ],
        [
            '--help'
        ],
        []
    ]) {
        const result = brigade(project(), args);

        assert.equal(result.status, 0, args.join(' '));
        assert.match(result.stdout, /init/);
    }
});

test('an unknown command exits 1', () => {
    assert.equal(brigade(project(), [
        'nope'
    ]).status, 1);
});

test('an unknown option exits 1 and writes nothing', () => {
    const cwd = project();
    const before = snapshot(cwd);

    assert.equal(brigade(cwd, [
        'init',
        '--nope'
    ]).status, 1);

    assert.deepEqual(snapshot(cwd), before);
});

test('an unknown stack exits 1 and writes nothing', () => {
    const cwd = project();
    const before = snapshot(cwd);

    assert.equal(brigade(cwd, [
        'init',
        '--stack',
        'nope'
    ]).status, 1);

    assert.deepEqual(snapshot(cwd), before);
});

test('init --dry-run writes nothing and exits 0', () => {
    const cwd = project();
    const before = snapshot(cwd);

    assert.equal(brigade(cwd, [
        'init',
        '--dry-run'
    ]).status, 0);

    assert.deepEqual(snapshot(cwd), before);
});

test('init --dry-run on an installed project writes nothing', () => {
    const cwd = install();
    const before = snapshot(cwd);

    assert.equal(brigade(cwd, [
        'init',
        '--dry-run'
    ]).status, 0);

    assert.deepEqual(snapshot(cwd), before);
});

test('uninstall without a terminal and without --yes writes nothing and fails', () => {
    const cwd = install();
    const before = snapshot(cwd);

    assert.notEqual(brigade(cwd, [
        'uninstall'
    ]).status, 0);

    assert.deepEqual(snapshot(cwd), before);
});
