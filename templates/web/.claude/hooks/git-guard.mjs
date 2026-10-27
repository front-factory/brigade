#!/usr/bin/env node
// Git guard (PreToolUse on Bash): only `git-operator` writes to git.
// Reads the hook payload on stdin; `agent_type` is set for subagents and absent for the main session.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const READ = new Set([
    'status',
    'diff',
    'log',
    'show',
    'blame',
    'rev-parse',
    'ls-files',
    'ls-tree',
    'grep',
    'describe',
    'shortlog',
    'cat-file',
    'merge-base',
    'rev-list',
    'for-each-ref',
    'show-ref',
    'ls-remote',
    'fetch'
]);

const ASK = new Set([
    'push',
    'merge',
    'rebase'
]);

const ON_PROTECTED = new Set([
    'commit',
    'cherry-pick',
    'revert',
    'am',
    'pull',
    'reset',
    'rm'
]);

// Known safe writes for git-operator; any other write subcommand (aliases included) is asked.
const SAFE = new Set([
    'add',
    'commit',
    'restore',
    'switch',
    'checkout',
    'branch',
    'tag',
    'stash',
    'mv',
    'rm',
    'cherry-pick',
    'revert',
    'am',
    'pull',
    'reset',
    'init',
    'clone',
    'submodule',
    'notes'
]);

const RANK = {
    allow: 0,
    ask: 1,
    deny: 2 
};

// Quoted text (commit messages) must not be read as commands.
const strip = (command) => command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');

const UNKNOWN = {
    sub: '?',
    rest: '' 
};
const MAX_DEPTH = 3;

const VALUED_OPTIONS = new Set([
    '-C',
    '-c',
    '--git-dir',
    '--work-tree',
    '--namespace',
    '--super-prefix',
    '--config-env'
]);
const SHELL_ARG = '("(?:[^"\\\\]|\\\\.)*"|\'[^\']*\'|[^;&|\\n]+)';

// Text run by `$(...)`, backticks, `sh -c` and `eval`, taken before strip() blanks quotes.
function nestedTexts(command) {
    const texts = [];
    const unquote = (arg) => (/^["']/.test(arg) ? arg.slice(1, -1).replace(/\\"/g, '"') : arg);
    const bare = command.replace(/'[^']*'/g, '\'\'');

    for (let at = bare.indexOf('$('); at !== -1; at = bare.indexOf('$(', at + 2)) {
        let depth = 1;
        let end = at + 2;

        for (; end < bare.length && depth > 0; end++) {
            depth += bare[end] === '(' ? 1 : bare[end] === ')' ? -1 : 0;
        }

        texts.push(bare.slice(at + 2, depth === 0 ? end - 1 : end));
    }

    for (const [
        , inner
    ] of bare.matchAll(/`([^`]*)`/g)) {
        texts.push(inner);
    }

    for (const [
        , arg
    ] of command.matchAll(new RegExp(`\\b(?:ba|z|da)?sh\\s+(?:-\\w+\\s+)*-\\w*c\\s+${SHELL_ARG}`, 'g'))) {
        texts.push(unquote(arg));
    }

    for (const [
        , arg
    ] of command.matchAll(new RegExp(`\\beval\\s+${SHELL_ARG}`, 'g'))) {
        texts.push(unquote(arg));
    }

    return texts;
}

// Skips the global options (`-C <path>`, `-c k=v`, `--no-pager`...) to find the subcommand.
function parseGit(text) {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    let i = 0;

    while (i < tokens.length && tokens[i].startsWith('-')) {
        i += VALUED_OPTIONS.has(tokens[i]) ? 2 : 1;
    }

    // A subcommand built at run time (`$(...)`, `$SUB`, backticks) cannot be analysed.
    if (/^[$`]/.test(tokens[i] ?? '')) {
        return UNKNOWN;
    }

    if (!/^[\w-]+$/.test(tokens[i] ?? '')) {
        return null;
    }

    return {
        sub: tokens[i],
        rest: tokens.slice(i + 1).join(' ') 
    };
}

// Grouping, keywords and wrapper commands that may come before `git` in a segment.
const LEADING = /^(?:[(!]|\{(?=\s)|(?:then|else|elif|do|if|while|until)\b|env\s+(?:(?:-u\s+\S+|-\S+|\w+=\S+)\s+)*|(?:command|exec|time|nohup|nice|sudo)\s+(?:(?:-n\s+\d+|-\S+)\s+)*|\w+=\S+\s+)\s*/;

function gitSegment(segment) {
    let text = segment.trim();

    for (let rest = text.replace(LEADING, ''); rest !== text; rest = text.replace(LEADING, '')) {
        text = rest;
    }

    return text.match(/^(?:xargs\s+(?:\S+\s+)*?)?(?:\S*\/)?git(?:\s+(.*))?$/);
}

function gitCommands(command, depth = 0) {
    if (depth > MAX_DEPTH) {
        return /\bgit\b/.test(command) ? [
            UNKNOWN
        ] : [];
    }

    const nested = nestedTexts(command).flatMap((text) => gitCommands(text, depth + 1));

    const direct = strip(command)
        .split(/&&|\|\||;|\||\n|[()]/)
        .map(gitSegment)
        .filter(Boolean)
        .map(([
            , text
        ]) => parseGit(text ?? ''))
        .filter(Boolean);

    return [
        ...direct,
        ...nested
    ];
}

// `git branch`, `tag`, `remote`... only read when listing: no mutating flag, no name to create.
function writes({ sub, rest }) {
    if (READ.has(sub)) {
        return false;
    }

    if (sub === 'branch') {
        if (/(^|\s)(-\w*[dDmMcCuft]\w*|--delete|--move|--copy|--force|--track|--set-upstream-to|--unset-upstream|--edit-description)(\s|=|$)/.test(rest)) {
            return true;
        }

        return !/(^|\s)(-l|-a|-r|-v+|--list|--all|--remotes|--verbose|--show-current|--contains|--merged|--no-merged|--points-at)(\s|$)/.test(rest) && /(^|\s)[^-\s]/.test(rest);
    }

    if (sub === 'tag') {
        if (/(^|\s)(-\w*[dasfumF]\w*|--delete|--annotate|--sign|--force|--local-user|--message|--file)(\s|$)/.test(rest)) {
            return true;
        }

        return rest !== '' && !/(^|\s)(-l|-n\d*|--list|--contains|--points-at|--merged|--no-merged)(\s|$)/.test(rest);
    }

    if (sub === 'reflog') {
        return /^(expire|delete)\b/.test(rest);
    }

    if (sub === 'remote') {
        return !/^(-v|--verbose)?\s*$/.test(rest);
    }

    if (sub === 'config') {
        return !/(^|\s)(--get|--list|-l)\b/.test(rest);
    }

    if (sub === 'stash') {
        return !/^list\b/.test(rest);
    }

    return true;
}

function destructive({ sub, rest }) {
    return (sub === 'reset' && /--hard/.test(rest))
        || (sub === 'push' && /(^|\s)(--force|--force-with-lease|-f)\b/.test(rest))
        || (sub === 'clean' && /(^|\s)-\w*f/.test(rest))
        || (sub === 'branch' && /(^|\s)-D\b/.test(rest))
        // Commands that destroy uncommitted work.
        || (sub === 'checkout' && /(^|\s)(--|-f|--force|\.)(\s|$)/.test(rest))
        || (sub === 'restore' && (!/(^|\s)(--staged|-S)(\s|$)/.test(rest) || /(^|\s)(--worktree|-W)(\s|$)/.test(rest)))
        || (sub === 'switch' && /(^|\s)(--discard-changes|-f|--force)(\s|$)/.test(rest))
        || (sub === 'stash' && /^(drop|clear)\b/.test(rest))
        // Commands that delete refs or history for good.
        || (sub === 'tag' && /(^|\s)(-\w*d\w*|--delete)(\s|$)/.test(rest))
        || (sub === 'update-ref' && /(^|\s)-d\b/.test(rest))
        || sub === 'filter-branch'
        || (sub === 'reflog' && /^(expire|delete)\b/.test(rest))
        || (sub === 'gc' && /--prune/.test(rest));
}

export function decide({ command, agent, branch, protectedBranches }) {
    let decision = {
        permissionDecision: 'allow',
        reason: '' 
    };

    const raise = (permissionDecision, reason) => {
        if (RANK[permissionDecision] > RANK[decision.permissionDecision] || decision.reason === '') {
            decision = {
                permissionDecision,
                reason 
            };
        }
    };

    const found = gitCommands(command).filter(writes);

    if (found.length === 0) {
        return null;
    }

    for (const git of found) {
        if (agent !== 'git-operator') {
            raise('deny', 'Only git-operator writes to git: delegate to it, after the user\'s go.');
        } else if (destructive(git)) {
            raise('deny', `git ${git.sub}: destructive command, not allowed.`);
        } else if (git.sub === '?') {
            raise('ask', 'Nested git command that cannot be analysed: confirm.');
        } else if (ASK.has(git.sub)) {
            raise('ask', `git ${git.sub} always needs the user's confirmation.`);
        } else if (git.sub === 'tag' && /(^|\s)(-\w*f\w*|--force)(\s|$)/.test(git.rest)) {
            raise('ask', 'git tag --force moves an existing tag: confirm.');
        } else if (git.sub === 'branch' && /(^|\s)(-\w*f\w*|--force)(\s|$)/.test(git.rest)) {
            raise('ask', 'git branch --force moves an existing branch: confirm.');
        } else if (ON_PROTECTED.has(git.sub) && protectedBranches === null) {
            raise('ask', 'Protected branches unknown (.claude/brigade.json missing or invalid): confirm.');
        } else if (ON_PROTECTED.has(git.sub) && protectedBranches.includes(branch)) {
            raise('ask', `"${branch}" is a protected branch: confirm before writing on it.`);
        } else if (!SAFE.has(git.sub)) {
            raise('ask', `git ${git.sub}: not in the known safe list, confirm.`);
        } else {
            raise('allow', 'git-operator: git write on an unprotected branch.');
        }
    }

    return decision;
}

function currentBranch(cwd) {
    try {
        return execFileSync('git', [
            'symbolic-ref',
            '--short',
            'HEAD'
        ], {
            cwd,
            encoding: 'utf8',
            stdio: [
                'ignore',
                'pipe',
                'ignore'
            ] 
        }).trim();
    } catch {
        return '';
    }
}

// BRIGADE_UNPROTECT_REFERENCE_BRANCH=1 (personal, in .claude/settings.local.json) lifts the reference branch only.
export function protectedBranches(root, env = process.env) {
    try {
        const { answers } = JSON.parse(readFileSync(join(root, '.claude', 'brigade.json'), 'utf8'));
        const lifted = env.BRIGADE_UNPROTECT_REFERENCE_BRANCH === '1';

        return [
            answers.defaultBranch,
            lifted ? null : answers.baseBranch
        ].filter(Boolean);
    } catch {
        return null;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    let input;

    try {
        input = JSON.parse(readFileSync(0, 'utf8'));
    } catch {
        input = null;
    }

    const valid = input !== null && typeof input === 'object' && !Array.isArray(input);

    if (!valid) {
        input = {};
    }

    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

    // An unreadable payload must not crash the hook (exit 1 lets the command through).
    const decision = valid
        ? decide({
            command: input.tool_input?.command ?? '',
            agent: input.agent_type ?? '',
            branch: currentBranch(input.cwd || root),
            protectedBranches: protectedBranches(root)
        })
        : {
            permissionDecision: 'ask',
            reason: 'Hook payload unreadable: confirm.' 
        };

    if (decision) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: decision.permissionDecision,
                permissionDecisionReason: decision.reason
            }
        }));
    }
}
