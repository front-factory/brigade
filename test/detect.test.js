import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import './git-env.js';
import { CONVENTIONS } from '../src/conventions.js';
import { detectCommitConvention, detectDefaultBranch, detectLanguage, detectPackageManager, isGitRepo, localBranches } from '../src/detect.js';

const temp = () => mkdtempSync(join(tmpdir(), 'brigade-detect-'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });

// The unborn branch is set by hand so the result never depends on `init.defaultBranch`.
function repo(branch = 'trunk') {
    const cwd = temp();
    git(cwd, 'init');
    git(cwd, 'symbolic-ref', 'HEAD', `refs/heads/${branch}`);
    return cwd;
}

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

test('isGitRepo tells a repository from a plain folder', () => {
    assert.equal(isGitRepo(repo()), true);
    assert.equal(isGitRepo(temp()), false);
});

test('localBranches lists the branches and is empty outside a repository', () => {
    const cwd = repo('main');
    assert.deepEqual(localBranches(cwd), []);
    git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '--allow-empty', '-m', 'init');
    git(cwd, 'branch', 'develop');
    assert.deepEqual(localBranches(cwd).sort(), ['develop', 'main']);
    assert.deepEqual(localBranches(temp()), []);
});

test('the default branch is the remote HEAD, then init.defaultBranch, then the current branch', () => {
    const cwd = repo('current');
    assert.equal(detectDefaultBranch(cwd), 'current');

    git(cwd, 'config', 'init.defaultBranch', 'configured');
    assert.equal(detectDefaultBranch(cwd), 'configured');

    git(cwd, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/remote');
    assert.equal(detectDefaultBranch(cwd), 'remote');

    assert.equal(detectDefaultBranch(temp()), '');
});

test('the package manager comes from packageManager, else from a single lockfile', () => {
    const declared = temp();
    writeFileSync(join(declared, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.1.0' }));
    writeFileSync(join(declared, 'yarn.lock'), '');
    assert.deepEqual(detectPackageManager(declared), { value: 'pnpm', candidates: ['pnpm'] });

    const single = temp();
    writeFileSync(join(single, 'yarn.lock'), '');
    assert.deepEqual(detectPackageManager(single), { value: 'yarn', candidates: ['yarn'] });

    const bun = temp();
    writeFileSync(join(bun, 'bun.lock'), '');
    writeFileSync(join(bun, 'bun.lockb'), '');
    assert.deepEqual(detectPackageManager(bun), { value: 'bun', candidates: ['bun'] });
});

test('several lockfiles or none leave the package manager empty', () => {
    const several = temp();
    writeFileSync(join(several, 'package-lock.json'), '');
    writeFileSync(join(several, 'pnpm-lock.yaml'), '');
    assert.deepEqual(detectPackageManager(several), { value: '', candidates: ['pnpm', 'npm'] });
    assert.deepEqual(detectPackageManager(temp()), { value: '', candidates: [] });
});

test('a broken package.json is ignored', () => {
    const cwd = temp();
    writeFileSync(join(cwd, 'package.json'), '{ broken');
    writeFileSync(join(cwd, 'package-lock.json'), '');
    assert.equal(detectPackageManager(cwd).value, 'npm');
    assert.equal(detectCommitConvention(cwd), '');
});

test('commitlint without a known config detects no convention', () => {
    assert.equal(detectCommitConvention(project({ '@commitlint/cli': '1' })), '');
});

test('the language comes from LC_ALL, then LC_MESSAGES, then LANG', () => {
    assert.equal(detectLanguage({ LC_ALL: 'fr_FR.UTF-8', LANG: 'en_US.UTF-8' }), 'French');
    assert.equal(detectLanguage({ LC_MESSAGES: 'DE_de', LANG: 'en_US.UTF-8' }), 'German');
    assert.equal(detectLanguage({ LANG: 'es_ES.UTF-8' }), 'Spanish');
    assert.equal(detectLanguage({ LANG: 'ja_JP.UTF-8' }), '');
    assert.equal(detectLanguage({}), '');
});
