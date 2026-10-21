#!/usr/bin/env node
// Git guard (PreToolUse on Bash): only `git-operator` writes to git.
// Reads the hook payload on stdin; `agent_type` is set for subagents and absent for the main session.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const READ = new Set(['status', 'diff', 'log', 'show', 'blame', 'rev-parse', 'ls-files', 'ls-tree', 'grep', 'describe', 'shortlog', 'cat-file']);
const ASK = new Set(['push', 'merge', 'rebase']);
const ON_PROTECTED = new Set(['commit', 'cherry-pick', 'revert', 'am', 'pull', 'reset', 'rm']);
const RANK = { allow: 0, ask: 1, deny: 2 };

// Quoted text (commit messages) must not be read as commands.
const strip = (command) => command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');

function gitCommands(command) {
    return strip(command)
        .split(/&&|\|\||;|\||\n/)
        .map((segment) => segment.trim().match(/^(?:\w+=\S+\s+)*git\s+((?:-\S+\s+)*)([\w-]+)\s*(.*)$/))
        .filter(Boolean)
        .map(([, , sub, rest]) => ({ sub, rest }));
}

// `git branch` and `git remote` only read when given no mutating flag.
function writes({ sub, rest }) {
    if (READ.has(sub)) return false;
    if (sub === 'branch') return /(^|\s)(-[dDmMcC]|--delete|--move|--copy)\b/.test(rest) || /(^|\s)[^-\s]/.test(rest);
    if (sub === 'remote') return !/^(-v|--verbose)?\s*$/.test(rest);
    if (sub === 'config') return !/(^|\s)(--get|--list|-l)\b/.test(rest);
    if (sub === 'stash') return !/^list\b/.test(rest);
    return true;
}

function destructive({ sub, rest }) {
    return (sub === 'reset' && /--hard/.test(rest))
        || (sub === 'push' && /(^|\s)(--force|--force-with-lease|-f)\b/.test(rest))
        || (sub === 'clean' && /(^|\s)-\w*f/.test(rest))
        || (sub === 'branch' && /(^|\s)-D\b/.test(rest));
}

export function decide({ command, agent, branch, protectedBranches }) {
    let decision = { permissionDecision: 'allow', reason: '' };
    const raise = (permissionDecision, reason) => {
        if (RANK[permissionDecision] > RANK[decision.permissionDecision] || decision.reason === '') decision = { permissionDecision, reason };
    };

    const found = gitCommands(command).filter(writes);
    if (found.length === 0) return null;

    for (const git of found) {
        if (agent !== 'git-operator') {
            raise('deny', 'Only git-operator writes to git: delegate to it, after the user\'s go.');
        } else if (destructive(git)) {
            raise('deny', `git ${git.sub}: destructive command, not allowed.`);
        } else if (ASK.has(git.sub)) {
            raise('ask', `git ${git.sub} always needs the user's confirmation.`);
        } else if (ON_PROTECTED.has(git.sub) && protectedBranches.includes(branch)) {
            raise('ask', `"${branch}" is a protected branch: confirm before writing on it.`);
        } else {
            raise('allow', 'git-operator: git write on an unprotected branch.');
        }
    }
    return decision;
}

function currentBranch(cwd) {
    try {
        return execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return '';
    }
}

function protectedBranches(root) {
    try {
        const { answers } = JSON.parse(readFileSync(join(root, '.claude', 'brigade.json'), 'utf8'));
        return [answers.defaultBranch, answers.baseBranch].filter(Boolean);
    } catch {
        return [];
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

    const decision = decide({
        command: input.tool_input?.command ?? '',
        agent: input.agent_type ?? '',
        branch: currentBranch(input.cwd || root),
        protectedBranches: protectedBranches(root)
    });

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
