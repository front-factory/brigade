#!/usr/bin/env node
// Git guard (PreToolUse on Bash): only `git-operator` writes to git. A simple safety net, not a shell parser.
// Reads the hook payload on stdin; `agent_type` is set for subagents and absent for the main session.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const words = (list) => new Set(list.split(' '));

const READ = words('status diff log show blame rev-parse ls-files ls-tree grep describe shortlog cat-file merge-base rev-list for-each-ref show-ref ls-remote fetch check-ignore check-attr check-ref-format diff-tree diff-index diff-files name-rev cherry range-diff whatchanged help version var count-objects verify-commit verify-tag');
const ON_PROTECTED = words('commit cherry-pick revert am pull reset rm');
const KNOWN = words('add restore switch checkout branch tag stash mv init clone submodule notes');
const GLOBAL_VALUED = words('-C -c --git-dir --work-tree --namespace --super-prefix --config-env');
const SKIPPED = words('command exec time nohup then do else elif if while until !');
const WRAPPERS = words('env sudo nice timeout stdbuf xargs command exec time nohup');
const WRAPPER_VALUED = words('-u -g -n -k -s -i -o -e -I -P -L -d -E --kill-after --signal');
const RANK = 'allow ask deny'.split(' ');
const SHELL_C = '(?:eval|(?:ba|z|da)?sh\\s+(?:-\\w+\\s+)*-\\w*c)';
const NESTED = /\$\([^)]*\bgit\b|`[^`]*\bgit\b/;
const READ_FORM = /^(reflog (?!(expire|delete)\b)|remote ((-v|--verbose)?\s*$|(get-url|show)\b)|worktree list\b|stash (list|show)\b|symbolic-ref (-q |--quiet |--short )*[^-\s]+\s*$)/;

const flag = (rest, names, end = '\\s|$') => new RegExp(`(^|\\s)(${names})(${end})`).test(rest);

const subOf = (git) => git.split(' ')[0];
const restOf = (git) => git.slice(git.indexOf(' ') + 1);

const verdict = (permissionDecision, permissionDecisionReason) => ({
    permissionDecision,
    permissionDecisionReason
});

// Drops heredoc bodies, blanks quotes (data); git hidden in `$(...)`, backticks, `sh -c`, `eval` becomes `git ?`.
function scan(command) {
    let text = command.replace(/"[^"\\$\n]*<<[^"\\$\n]*"|'[^'\n]*<<[^'\n]*'/g, '""');
    let nested = false;

    for (let m; (m = /(?<!<|\$\(\([^)\n]*)<<(?!<)(-?)[ \t]*(["']?)([\w-]+)\2[^\n]*\n/.exec(text));) {
        const lines = text.slice(m.index + m[0].length).split('\n');
        const end = lines.findIndex((line) => (m[1] ? line.replace(/^\t+/, '') : line) === m[3]);

        nested ||= m[2] === '' && NESTED.test(lines.slice(0, end === -1 ? lines.length : end).join('\n'));
        text = text.slice(0, m.index) + m[0].replace('<<', '<') + lines.slice(end === -1 ? lines.length : end + 1).join('\n');
    }

    const code = text.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (quoted, offset) => {
        nested ||= (quoted[0] === '"' && NESTED.test(quoted)) || (/\bgit\b/.test(quoted) && new RegExp(`${SHELL_C}\\s*$`).test(text.slice(0, offset)));

        return '""';
    });

    return nested || NESTED.test(code) || new RegExp(`\\b${SHELL_C}\\b[^;&|\\n]*\\bgit\\b`).test(code) ? `${code}\ngit ?` : code;
}

// The "subcommand arguments" of the git command of a segment, '? ' when the subcommand cannot be analysed.
function parse(segment) {
    const tokens = segment.trim().split(/\s+/);
    let i = 0;

    for (; i < tokens.length && (WRAPPERS.has(tokens[i]) || /^\w+=/.test(tokens[i]) || SKIPPED.has(tokens[i])); i++) {
        const word = tokens[i];

        while (WRAPPERS.has(word) && tokens[i + 1]?.startsWith('-')) {
            i += WRAPPER_VALUED.has(tokens[i + 1]) && !(word === 'sudo' && tokens[i + 1] === '-n') ? 2 : 1;
        }

        i += word === 'timeout' && /^\d/.test(tokens[i + 1] ?? '') ? 1 : 0;
    }

    if (!/(^|\/)git$/.test(tokens[i] ?? '')) {
        return null;
    }

    i++;

    while (tokens[i]?.startsWith('-')) {
        i += GLOBAL_VALUED.has(tokens[i]) ? 2 : 1;
    }

    return tokens[i] === undefined ? null : /^[\w-]+$/.test(tokens[i]) ? `${tokens[i]} ${tokens.slice(i + 1).join(' ')}` : '? ';
}

function configWrites(rest) {
    const one = rest.replace(/(--file|-f|--blob|--type|--default)\s+\S+/g, '').split(/\s+/).filter((token) => token && !token.startsWith('-')).length === 1;

    return flag(rest, '--unset(-all)?|--add|--replace-all|--edit|-e|--rename-section|--remove-section|set|unset|edit')
        || (!flag(rest, '--get[\\w-]*|--list|-l|get|list') && !one);
}

function writes(sub, rest) {
    if (READ.has(sub) || READ_FORM.test(`${sub} ${rest}`)) {
        return false;
    }

    if (sub === 'branch') {
        return flag(rest, '-\\w*[dDmMcCuft]\\w*|--delete|--move|--copy|--force|--track|--set-upstream-to|--unset-upstream|--edit-description', '\\s|=|$')
            || (!flag(rest, '-l|-a|-r|-v+|--list|--all|--remotes|--verbose|--show-current|--contains|--merged|--no-merged|--points-at') && /(^|\s)[^-\s]/.test(rest));
    }

    if (sub === 'tag') {
        return flag(rest, '-\\w*[dasfumF]\\w*|--delete|--annotate|--sign|--force|--local-user|--message|--file')
            || (rest !== '' && !flag(rest, '-l|-n\\d*|--list|--contains|--points-at|--merged|--no-merged'));
    }

    return sub === 'config' ? configWrites(rest) : true;
}

function destructive(git) {
    const sub = subOf(git);
    const rest = restOf(git);

    return (sub === 'reset' && /--hard/.test(rest))
        || (sub === 'push' && flag(rest, '--force|--force-with-lease|-f', '\\b|=|$'))
        || (sub === 'clean' && /(^|\s)-\w*f/.test(rest))
        || (sub === 'branch' && /(^|\s)-D\b/.test(rest))
        || (sub === 'checkout' && flag(rest, '--|-f|--force|\\.'))
        || (sub === 'restore' && (!flag(rest, '--staged|-S') || flag(rest, '--worktree|-W')))
        || (sub === 'switch' && flag(rest, '--discard-changes|-f|--force'))
        || (sub === 'tag' && flag(rest, '-\\w*d\\w*|--delete'))
        || (sub === 'update-ref' && /(^|\s)-d\b/.test(rest))
        || (/^(stash|reflog)$/.test(sub) && /^(drop|clear|expire|delete)\b/.test(rest))
        || sub === 'filter-branch'
        || (sub === 'gc' && /--prune/.test(rest))
        || flag(rest, '--no-verify')
        || (sub === 'commit' && /(^|\s)-[a-zA-Z]*n/.test(rest));
}

export function decide({ command, agent, branch, protectedBranches }) {
    const commands = scan(command).split(/&&|\|\||;|\||\n|[(){}]|(?<![>&<])&(?![>&])/).map(parse).filter((git) => git && writes(subOf(git), restOf(git)));

    const bannedInRaw = command.replace(/["']/g, ' ').split(/&&|\|\||;|\||\n|[(){}`]/).some((piece) => destructive(parse(piece.slice(Math.max(piece.search(/\bgit\b/), 0))) ?? ''));

    let level = 0;
    let reason = 'git-operator: git write on an unprotected branch.';
    let switched = false;

    const raise = (decision, why) => {
        if (RANK.indexOf(decision) > level) {
            level = RANK.indexOf(decision);
            reason = why;
        }
    };

    for (const git of commands) {
        const sub = subOf(git);
        const rest = restOf(git);
        const onProtected = ON_PROTECTED.has(sub);

        if (agent !== 'git-operator') {
            raise('deny', 'Only git-operator writes to git: delegate to it, after the user\'s go.');
        } else if (destructive(git)) {
            raise('deny', `git ${sub}: destructive command, not allowed.`);
        } else if (sub === '?') {
            raise(bannedInRaw ? 'deny' : 'ask', 'Nested or built git command that cannot be analysed: confirm.');
        } else if (/^(push|merge|rebase)$/.test(sub)) {
            raise('ask', `git ${sub} always needs the user's confirmation.`);
        } else if ((sub === 'tag' || sub === 'branch') && flag(rest, '-\\w*f\\w*|--force')) {
            raise('ask', `git ${sub} --force moves an existing ${sub}: confirm.`);
        } else if (onProtected && (protectedBranches === null || switched)) {
            raise('ask', 'Protected branches or current branch unknown (manifest unreadable, or a switch earlier in the command): confirm.');
        } else if (onProtected && protectedBranches.includes(branch)) {
            raise('ask', `"${branch}" is a protected branch: confirm before writing on it.`);
        } else if (!onProtected && !KNOWN.has(sub)) {
            raise('ask', `git ${sub}: not in the known safe list, confirm.`);
        }

        switched ||= sub === 'switch' || sub === 'checkout';
    }

    return commands.length > 0 ? verdict(RANK[level], reason) : null;
}

function currentBranch(cwd) {
    try {
        process.chdir(cwd);

        return execFileSync('git', 'symbolic-ref --short HEAD'.split(' ')).toString().trim();
    } catch {
        return '';
    }
}

// BRIGADE_UNPROTECT_REFERENCE_BRANCH=1 (personal, in .claude/settings.local.json) lifts the reference branch only.
export function protectedBranches(root, env = process.env) {
    try {
        const { answers } = JSON.parse(readFileSync(join(root, '.claude', 'brigade.json'), 'utf8'));

        return `${answers.defaultBranch} ${env.BRIGADE_UNPROTECT_REFERENCE_BRANCH === '1' ? '' : answers.baseBranch}`.split(' ').filter(Boolean);
    } catch {
        return null;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    let input = null;

    try {
        input = JSON.parse(readFileSync(0, 'utf8'));
    } catch { /* unreadable payload: asked below */ }

    const root = process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();

    const decision = input?.constructor === Object
        ? decide({
            command: input.tool_input?.command ?? '',
            agent: input.agent_type ?? '',
            branch: currentBranch(input.cwd || root),
            protectedBranches: protectedBranches(root)
        })
        : verdict('ask', 'Hook payload unreadable: confirm.');

    if (decision) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                ...decision
            }
        }));
    }
}
