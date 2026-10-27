import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decide } from '../templates/web/.claude/hooks/git-guard.mjs';

const protectedBranches = [
    'main',
    'develop'
];

const run = (command, { agent = 'git-operator', branch = 'feat/x' } = {}) =>
    decide({
        command,
        agent,
        branch,
        protectedBranches
    })?.permissionDecision ?? null;

test('reads are never touched', () => {
    assert.equal(run('git status', {
        agent: ''
    }), null);

    assert.equal(run('git log --oneline -5', {
        agent: 'implementer'
    }), null);

    assert.equal(run('git branch --show-current', {
        agent: ''
    }), null);

    assert.equal(run('npm run build', {
        agent: ''
    }), null);
});

test('harmless reads are not writes for the main session', () => {
    for (const command of [
        'git merge-base a b',
        'git rev-list HEAD',
        'git for-each-ref',
        'git show-ref',
        'git ls-remote origin',
        'git fetch',
        'git tag',
        'git tag -l "v*"',
        'git tag --list',
        'git tag --contains abc',
        'git tag --points-at HEAD',
        'git reflog',
        'git reflog show HEAD',
        'git branch --list x',
        'git branch -l "feat/*"',
        'git branch -a',
        'git branch -r',
        'git branch -vv',
        'git branch --show-current'
    ]) {
        assert.equal(run(command, {
            agent: ''
        }), null, command);
    }
});

test('tag, branch and reflog writes are still denied for the main session', () => {
    for (const command of [
        'git tag v1',
        'git tag -d v1',
        'git tag -a v1 -m x',
        'git branch x',
        'git branch -d x',
        'git reflog expire --all',
        'git reflog delete HEAD@{1}'
    ]) {
        assert.equal(run(command, {
            agent: ''
        }), 'deny', command);
    }
});

test('git-operator: unknown write subcommands are asked, ref and history deletions denied', () => {
    for (const command of [
        'git update-ref refs/heads/x HEAD',
        'git worktree remove ../w',
        'git ci -m x',
        'git frobnicate'
    ]) {
        assert.equal(run(command), 'ask', command);
    }

    for (const command of [
        'git tag -d v1',
        'git tag --delete v1',
        'git update-ref -d refs/heads/x',
        'git filter-branch --all',
        'git reflog expire --all',
        'git reflog delete HEAD@{1}',
        'git gc --prune=now'
    ]) {
        assert.equal(run(command), 'deny', command);
    }
});

test('tag --force is asked for git-operator and denied for the main session', () => {
    for (const command of [
        'git tag -f v1',
        'git tag --force v1'
    ]) {
        assert.equal(run(command), 'ask', command);
        assert.equal(run(command, {
            agent: ''
        }), 'deny', command);
    }
});

test('branch flags that write: denied for the main session, allowed for git-operator (except -D, -f)', () => {
    for (const command of [
        'git branch -u origin/x',
        'git branch -t x',
        'git branch --track x',
        'git branch --set-upstream-to=origin/x',
        'git branch --unset-upstream',
        'git branch --edit-description',
        'git branch -dr origin/x'
    ]) {
        assert.equal(run(command, {
            agent: ''
        }), 'deny', command);

        assert.equal(run(command), 'allow', command);
    }
});

test('branch -f/--force: denied for the main session, asked for git-operator', () => {
    for (const command of [
        'git branch -f x',
        'git branch --force x',
        'git branch -fu origin/x'
    ]) {
        assert.equal(run(command, {
            agent: ''
        }), 'deny', command);

        assert.equal(run(command), 'ask', command);
    }
});

test('fetch --prune is a read', () => {
    assert.equal(run('git fetch --prune', {
        agent: ''
    }), null);

    assert.equal(run('git fetch --prune'), null);
});

test('git-operator: known safe writes are allowed', () => {
    for (const command of [
        'git tag v1',
        'git tag -a v1 -m "x"',
        'git branch feat/y',
        'git branch -m new',
        'git stash push',
        'git stash pop',
        'git mv a b',
        'git reset HEAD~1',
        'git pull',
        'git cherry-pick abc',
        'git revert abc',
        'git init',
        'git submodule update',
        'git notes add -m x'
    ]) {
        assert.equal(run(command), 'allow', command);
    }
});

test('git writes are denied for everyone but git-operator', () => {
    assert.equal(run('git commit -m "x"', {
        agent: ''
    }), 'deny');

    assert.equal(run('git add -A', {
        agent: 'implementer'
    }), 'deny');

    assert.equal(run('git -C . checkout -b feat/y', {
        agent: ''
    }), 'deny');

    assert.equal(run('cd app && git push', {
        agent: ''
    }), 'deny');
});

test('git-operator commits freely on an unprotected branch', () => {
    assert.equal(run('git add src/a.js && git commit -m "feat: a"'), 'allow');
});

test('git-operator asks on protected branches, push, merge and rebase', () => {
    assert.equal(run('git commit -m "x"', {
        branch: 'develop'
    }), 'ask');

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
    assert.equal(run('git --work-tree . -C app commit -m "x"', {
        branch: 'develop'
    }), 'ask');

    assert.equal(run('git -C app add a.js'), 'allow');
    assert.equal(run('git -C app commit -m "x"', {
        agent: ''
    }), 'deny');
});

test('reads behind global options are not writes', () => {
    assert.equal(run('git -C . status', {
        agent: ''
    }), null);

    assert.equal(run('git -c core.pager=cat --no-pager log -3', {
        agent: ''
    }), null);

    assert.equal(run('git --version', {
        agent: ''
    }), null);
});

test('nested git commands are analysed', () => {
    assert.equal(run('echo $(git commit -m "x")', {
        agent: ''
    }), 'deny');

    assert.equal(run('echo `git add a`', {
        agent: ''
    }), 'deny');

    assert.equal(run('bash -c "git commit -m x"', {
        agent: ''
    }), 'deny');

    assert.equal(run('sh -c \'git push --force\''), 'deny');
    assert.equal(run('eval "git clean -fd"'), 'deny');
    assert.equal(run('git ls-files | xargs git rm', {
        agent: ''
    }), 'deny');

    assert.equal(run('bash -c "git add a"'), 'allow');
    assert.equal(run('echo $(git status)', {
        agent: ''
    }), null);

    assert.equal(run('bash -c "npm test"', {
        agent: ''
    }), null);

    assert.equal(run('echo $(echo $(echo $(echo $(git status))))', {
        agent: ''
    }), 'deny');
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
    const unknown = (command, branch = 'feat/x') => decide({
        command,
        agent: 'git-operator',
        branch,
        protectedBranches: null
    }).permissionDecision;

    assert.equal(unknown('git commit -m "x"'), 'ask');
    assert.equal(unknown('git add a'), 'allow');
    assert.equal(unknown('git push --force'), 'deny');
});

test('an unreadable hook payload asks and exits cleanly', () => {
    const hook = fileURLToPath(new URL('../templates/web/.claude/hooks/git-guard.mjs', import.meta.url));

    for (const input of [
        '{bad',
        '',
        '[]',
        '"x"',
        'null'
    ]) {
        const result = spawnSync(process.execPath, [
            hook
        ], {
            input,
            encoding: 'utf8'
        });

        assert.equal(result.status, 0, `exit code for ${JSON.stringify(input)}`);
        const { hookSpecificOutput } = JSON.parse(result.stdout);

        assert.equal(hookSpecificOutput.hookEventName, 'PreToolUse');
        assert.equal(hookSpecificOutput.permissionDecision, 'ask');
        assert.match(hookSpecificOutput.permissionDecisionReason, /unreadable/);
    }
});

const WRAPPED = [
    'env git commit -m x',
    'env -i FOO=1 git commit -m x',
    'command git commit',
    '/usr/bin/git commit',
    './git commit',
    '(git commit -m x)',
    '{ git commit -m x; }',
    'if true; then git commit -m x; fi',
    'for i in 1; do git commit -m x; done',
    'time git commit',
    'sudo git commit',
    'nice -n 5 nohup git commit'
];

test('wrapped git writes are decided like plain ones', () => {
    for (const command of WRAPPED) {
        assert.equal(run(command, {
            branch: 'develop'
        }), 'ask', command);

        assert.equal(run(command), 'allow', command);
        assert.equal(run(command, {
            agent: ''
        }), 'deny', command);
    }
});

test('a dynamic subcommand cannot be analysed', () => {
    for (const command of [
        'git $(echo commit)',
        'git $SUB',
        'git `echo commit`'
    ]) {
        assert.equal(run(command), 'ask', command);
        assert.equal(run(command, {
            agent: ''
        }), 'deny', command);
    }
});

test('wrapped reads and mere mentions of git are not touched', () => {
    for (const command of [
        '(git status)',
        'env git log',
        '{ git diff; }',
        'sudo git show',
        'echo git commit',
        'grep git file'
    ]) {
        assert.equal(run(command, {
            agent: ''
        }), null, command);
    }
});

test('BRIGADE_UNPROTECT_REFERENCE_BRANCH=1 lifts the reference branch only', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { protectedBranches: read } = await import('../templates/web/.claude/hooks/git-guard.mjs');
    const root = mkdtempSync(join(tmpdir(), 'brigade-guard-'));

    try {
        mkdirSync(join(root, '.claude'));
        writeFileSync(join(root, '.claude', 'brigade.json'), JSON.stringify({
            answers: {
                defaultBranch: 'main',
                baseBranch: 'develop'
            }
        }));

        const on = (command, branch, env) => decide({
            command,
            agent: 'git-operator',
            branch,
            protectedBranches: read(root, env)
        }).permissionDecision;
        const commit = 'git commit -m "x"';

        assert.equal(on(commit, 'develop', {
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '1'
        }), 'allow');

        assert.equal(on(commit, 'main', {
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '1'
        }), 'ask');

        assert.equal(on('git push origin develop', 'develop', {
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '1'
        }), 'ask');

        assert.equal(on('git reset --hard', 'develop', {
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '1'
        }), 'deny');

        assert.equal(on(commit, 'develop', {}), 'ask');
        assert.equal(on(commit, 'develop', {
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '0'
        }), 'ask');

        assert.equal(read(join(root, 'missing'), {
            BRIGADE_UNPROTECT_REFERENCE_BRANCH: '1'
        }), null);
    } finally {
        rmSync(root, {
            recursive: true,
            force: true
        });
    }
});
