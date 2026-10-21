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
