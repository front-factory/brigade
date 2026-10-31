import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MANAGERS = [
    'npm',
    'pnpm',
    'yarn',
    'bun'
];

const LOCKFILES = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'bun.lock': 'bun',
    'bun.lockb': 'bun',
    'package-lock.json': 'npm'
};

const git = (cwd, ...args) => {
    try {
        return execFileSync('git', args, {
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
};

// The parsed file, or null when it is missing or not valid JSON.
export const readJson = (file) => {
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
};

export const isGitRepo = (cwd) => git(cwd, 'rev-parse', '--is-inside-work-tree') === 'true';

export const localBranches = (cwd) => git(cwd, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean);

// Remote HEAD first, then `init.defaultBranch`, then the current branch. Empty when nothing is found.
export const detectDefaultBranch = (cwd) => git(cwd, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, '')
    || git(cwd, 'config', 'init.defaultBranch')
    || git(cwd, 'symbolic-ref', '--short', 'HEAD');

// The `packageManager` field wins when it names a known manager (anything else is ignored: the value ends up in
// settings.json permission rules). Otherwise one lockfile decides; several are a leftover, so `value` stays empty.
export function detectPackageManager(cwd) {
    const field = readJson(join(cwd, 'package.json'))?.packageManager;
    const declared = typeof field === 'string' ? field.split('@')[0] : '';

    const candidates = MANAGERS.includes(declared) ? [
        declared
    ] : [
        ...new Set(Object.keys(LOCKFILES).filter((file) => existsSync(join(cwd, file))).map((file) => LOCKFILES[file]))
    ];

    return {
        value: candidates.length === 1 ? candidates[0] : '',
        candidates
    };
}

// commitlint counts only when it is a dependency and wired to a `commit-msg` hook.
export function detectCommitConvention(cwd) {
    const pkg = readJson(join(cwd, 'package.json'));

    const deps = {
        ...pkg?.dependencies,
        ...pkg?.devDependencies
    };

    if (!existsSync(join(cwd, '.husky', 'commit-msg'))) {
        return '';
    }

    return (deps['@commitlint/config-angular'] && 'angular') || (deps['@commitlint/config-conventional'] && 'conventional') || '';
}
