import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCKFILES = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'bun.lock': 'bun',
    'bun.lockb': 'bun',
    'package-lock.json': 'npm'
};

export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];

function git(cwd, ...args) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return '';
    }
}

function readJson(file) {
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

export function isGitRepo(cwd) {
    return git(cwd, 'rev-parse', '--is-inside-work-tree') === 'true';
}

export function localBranches(cwd) {
    return git(cwd, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean);
}

// Remote HEAD first, then `init.defaultBranch`, then the current branch. Empty when nothing is found.
export function detectDefaultBranch(cwd) {
    const remote = git(cwd, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, '');
    if (remote) return remote;

    const configured = git(cwd, 'config', 'init.defaultBranch');
    if (configured) return configured;

    return git(cwd, 'symbolic-ref', '--short', 'HEAD');
}

// `packageManager` wins when it names a known manager; several lockfiles are a leftover, so `value` stays empty and the candidates are listed.
export function detectPackageManager(cwd) {
    const field = readJson(join(cwd, 'package.json'))?.packageManager;
    // Anything but a known manager is ignored: the value ends up in settings.json permission rules.
    const declared = typeof field === 'string' ? field.split('@')[0] : '';
    if (PACKAGE_MANAGERS.includes(declared)) return { value: declared, candidates: [declared] };

    const candidates = [...new Set(
        Object.entries(LOCKFILES).filter(([file]) => existsSync(join(cwd, file))).map(([, name]) => name)
    )];
    return { value: candidates.length === 1 ? candidates[0] : '', candidates };
}

// commitlint counts only when it is a dependency and wired to a `commit-msg` hook.
export function detectCommitConvention(cwd) {
    const pkg = readJson(join(cwd, 'package.json'));
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    if (!existsSync(join(cwd, '.husky', 'commit-msg'))) return '';
    if (deps['@commitlint/config-angular']) return 'angular';
    return deps['@commitlint/config-conventional'] ? 'conventional' : '';
}
