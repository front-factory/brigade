import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide } from '../templates/web/.claude/hooks/git-guard.mjs';

const protectedBranches = ['main', 'develop'];
const run = (command, { agent = 'git-operator', branch = 'feat/x' } = {}) =>
    decide({ command, agent, branch, protectedBranches })?.permissionDecision ?? null;

test('reads are never touched', () => {
    assert.equal(run('git status', { agent: '' }), null);
    assert.equal(run('git log --oneline -5', { agent: 'implementer' }), null);
    assert.equal(run('git branch --show-current', { agent: '' }), null);
    assert.equal(run('npm run build', { agent: '' }), null);
});

test('git writes are denied for everyone but git-operator', () => {
    assert.equal(run('git commit -m "x"', { agent: '' }), 'deny');
    assert.equal(run('git add -A', { agent: 'implementer' }), 'deny');
    assert.equal(run('git -C . checkout -b feat/y', { agent: '' }), 'deny');
    assert.equal(run('cd app && git push', { agent: '' }), 'deny');
});

test('git-operator commits freely on an unprotected branch', () => {
    assert.equal(run('git add src/a.js && git commit -m "feat: a"'), 'allow');
});

test('git-operator asks on protected branches, push, merge and rebase', () => {
    assert.equal(run('git commit -m "x"', { branch: 'develop' }), 'ask');
    assert.equal(run('git push origin feat/x'), 'ask');
    assert.equal(run('git merge feat/x'), 'ask');
    assert.equal(run('git rebase develop'), 'ask');
});

test('destructive git is denied even for git-operator', () => {
    assert.equal(run('git reset --hard HEAD~1'), 'deny');
    assert.equal(run('git push --force'), 'deny');
    assert.equal(run('git clean -fd'), 'deny');
    assert.equal(run('git branch -D old'), 'deny');
});

test('quoted text is not read as a command', () => {
    assert.equal(run('git commit -m "fix; git push"'), 'allow');
});

test('the strictest decision of a compound command wins', () => {
    assert.equal(run('git add a && git push'), 'ask');
});

test('global options before the subcommand are skipped', () => {
    assert.equal(run('git -C . push --force'), 'deny');
    assert.equal(run('git -c user.name=x push -f'), 'deny');
    assert.equal(run('git --git-dir=.git --no-pager reset --hard'), 'deny');
    assert.equal(run('git --work-tree . -C app commit -m "x"', { branch: 'develop' }), 'ask');
    assert.equal(run('git -C app add a.js'), 'allow');
    assert.equal(run('git -C app commit -m "x"', { agent: '' }), 'deny');
});

test('reads behind global options are not writes', () => {
    assert.equal(run('git -C . status', { agent: '' }), null);
    assert.equal(run('git -c core.pager=cat --no-pager log -3', { agent: '' }), null);
    assert.equal(run('git --version', { agent: '' }), null);
});

test('nested git commands are analysed', () => {
    assert.equal(run('echo $(git commit -m "x")', { agent: '' }), 'deny');
    assert.equal(run('echo `git add a`', { agent: '' }), 'deny');
    assert.equal(run('bash -c "git commit -m x"', { agent: '' }), 'deny');
    assert.equal(run("sh -c 'git push --force'"), 'deny');
    assert.equal(run('eval "git clean -fd"'), 'deny');
    assert.equal(run('git ls-files | xargs git rm', { agent: '' }), 'deny');
    assert.equal(run('bash -c "git add a"'), 'allow');
    assert.equal(run('echo $(git status)', { agent: '' }), null);
    assert.equal(run('bash -c "npm test"', { agent: '' }), null);
    assert.equal(run('echo $(echo $(echo $(echo $(git status))))', { agent: '' }), 'deny');
});

test('commands that destroy uncommitted work are denied for git-operator', () => {
    assert.equal(run('git checkout -- src/a.js'), 'deny');
    assert.equal(run('git checkout .'), 'deny');
    assert.equal(run('git checkout -f develop'), 'deny');
    assert.equal(run('git restore src/a.js'), 'deny');
    assert.equal(run('git switch --discard-changes develop'), 'deny');
    assert.equal(run('git stash drop'), 'deny');
    assert.equal(run('git stash clear'), 'deny');
    assert.equal(run('git checkout develop'), 'allow');
    assert.equal(run('git checkout -b feat/y'), 'allow');
    assert.equal(run('git restore --staged src/a.js'), 'allow');
    assert.equal(run('git stash'), 'allow');
});

test('git-operator is asked when the protected branches are unknown', () => {
    const unknown = (command, branch = 'feat/x') => decide({ command, agent: 'git-operator', branch, protectedBranches: null }).permissionDecision;
    assert.equal(unknown('git commit -m "x"'), 'ask');
    assert.equal(unknown('git add a'), 'allow');
    assert.equal(unknown('git push --force'), 'deny');
});
