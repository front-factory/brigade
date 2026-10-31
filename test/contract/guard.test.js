import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guard, guardProject } from './helpers.js';

const OPERATOR = 'git-operator';

const decide = (command, agent, branch = 'feat/x', options = {}) => guard({
    command,
    agent,
    cwd: guardProject(branch),
    ...options
});

test('the main session and implementer are denied git writes', () => {
    for (const agent of [
        undefined,
        'implementer'
    ]) {
        for (const command of [
            'git commit -m x',
            'git push',
            'git add .'
        ]) {
            assert.equal(decide(command, agent), 'deny', `${agent} ${command}`);
        }
    }
});

test('the main session is not denied on reads', () => {
    for (const command of [
        'git status',
        'git log --oneline',
        'git diff',
        'git -C . status'
    ]) {
        assert.notEqual(decide(command), 'deny', command);
        assert.equal(decide(command), null, command);
    }
});

test('git-operator commits on a feature branch without a prompt', () => {
    assert.ok([
        null,
        'allow'
    ].includes(decide('git commit -m x', OPERATOR)));
});

test('git-operator is asked for push, merge and rebase', () => {
    for (const command of [
        'git push',
        'git merge x',
        'git rebase x'
    ]) {
        assert.equal(decide(command, OPERATOR), 'ask', command);
    }
});

test('git-operator is denied destructive commands', () => {
    for (const command of [
        'git reset --hard',
        'git push --force',
        'git push -f',
        'git clean -fd',
        'git branch -D x',
        'git checkout -- .'
    ]) {
        assert.equal(decide(command, OPERATOR), 'deny', command);
    }
});

test('git-operator is asked before committing on main or develop', () => {
    for (const branch of [
        'main',
        'develop'
    ]) {
        assert.equal(decide('git commit -m x', OPERATOR, branch), 'ask', branch);
    }
});

test('BRIGADE_UNPROTECT_REFERENCE_BRANCH lifts develop only', () => {
    const env = {
        BRIGADE_UNPROTECT_REFERENCE_BRANCH: '1'
    };

    assert.notEqual(decide('git commit -m x', OPERATOR, 'develop', {
        env
    }), 'ask');

    assert.notEqual(decide('git commit -m x', OPERATOR, 'develop', {
        env
    }), 'deny');

    assert.equal(decide('git commit -m x', OPERATOR, 'main', {
        env
    }), 'ask');
});

test('a destructive command inside a quoted message or a quoted heredoc is not denied', () => {
    const commands = [
        'git commit -m "docs: explain git reset --hard"',
        'git commit -m \'never run git reset --hard\'',
        'git commit -F - <<\'EOF\'\nfix: stop using git reset --hard\n\ngit push --force is bad\nEOF'
    ];

    for (const command of commands) {
        assert.ok([
            null,
            'allow'
        ].includes(decide(command, OPERATOR)), command);
    }
});

test('an unreadable payload is asked', () => {
    assert.equal(guard({
        raw: 'not json',
        cwd: guardProject(),
        agent: OPERATOR
    }), 'ask');
});

test('a missing brigade.json makes the commit of git-operator asked', () => {
    assert.equal(guard({
        command: 'git commit -m x',
        agent: OPERATOR,
        cwd: guardProject('feat/x', {
            manifest: false
        })
    }), 'ask');
});

test('a non-git command yields no decision', () => {
    assert.equal(decide('ls', OPERATOR), null);
    assert.equal(decide('ls'), null);
});
