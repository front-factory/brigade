import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CONVENTIONS } from '../src/conventions.js';
import { detectCommitConvention } from '../src/detect.js';

function project(deps, hook = true) {
    const cwd = mkdtempSync(join(tmpdir(), 'brigade-detect-'));
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ devDependencies: deps }));
    if (hook) {
        mkdirSync(join(cwd, '.husky'));
        writeFileSync(join(cwd, '.husky/commit-msg'), 'npx commitlint --edit "$1"\n');
    }
    return cwd;
}

test('commit convention needs commitlint and a commit-msg hook', () => {
    assert.equal(detectCommitConvention(project({ '@commitlint/config-conventional': '1' })), 'conventional');
    assert.equal(detectCommitConvention(project({ '@commitlint/config-angular': '1' })), 'angular');
    assert.equal(detectCommitConvention(project({ '@commitlint/config-conventional': '1' }, false)), '');
    assert.equal(detectCommitConvention(project({})), '');
});

test('every convention shares the same length limit', () => {
    for (const { format } of Object.values(CONVENTIONS)) assert.match(format, /72 characters max\.$/);
});
