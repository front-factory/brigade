import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
    dirname, join, relative
} from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    OPTIONS_FILE, render, renderOptions, sha
} from '../src/install.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(ROOT, 'templates', 'web');

// Project-owned files: they differ from the template on purpose.
const SKIP = new Set([
    '.claude/context/decisions.md',
    '.claude/context/architecture.md'
]);

const ANSWERS = {
    defaultBranch: 'main',
    baseBranch: 'develop',
    packageManager: 'npm',
    commitConvention: 'conventional',
    replyLanguage: 'French',
    codeLanguage: 'English',
    docsLanguage: 'English'
};

function listFiles(dir) {
    return readdirSync(dir, {
        withFileTypes: true
    }).flatMap((entry) => {
        const abs = join(dir, entry.name);

        if (entry.isDirectory()) {
            return listFiles(abs);
        }

        return entry.name === '.DS_Store' ? [] : [
            abs
        ];
    });
}

test('the .claude/ of this repo is the rendered copy of templates/web/', () => {
    for (const source of listFiles(TEMPLATES)) {
        const path = relative(TEMPLATES, source).split('\\').join('/');

        if (SKIP.has(path)) {
            continue;
        }

        const expected = render(readFileSync(source, 'utf8'), ANSWERS);
        const actual = readFileSync(join(ROOT, path), 'utf8');

        assert.equal(actual, expected, `${path} drifted from templates/web/${path}`);
    }
});

test('the committed .claude/brigade.json matches the kit and the answers', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, '.claude', 'brigade.json'), 'utf8'));

    assert.deepEqual(manifest.answers, ANSWERS);

    const paths = new Set();

    for (const source of listFiles(TEMPLATES)) {
        const path = relative(TEMPLATES, source).split('\\').join('/');

        paths.add(path);

        if (SKIP.has(path)) {
            continue;
        }

        const expected = sha(render(readFileSync(source, 'utf8'), ANSWERS));

        assert.equal(manifest.files[path], expected, `brigade.json hash of ${path} is stale`);
    }

    for (const path of Object.keys(manifest.files)) {
        assert.ok(paths.has(path), `brigade.json lists ${path}, which is not in the kit`);
    }
});

test('brigade.md has no placeholder and brigade-options.md is generated from the answers', () => {
    assert.doesNotMatch(readFileSync(join(TEMPLATES, '.claude/rules/brigade.md'), 'utf8'), /__[A-Z_]+__/);
    assert.equal(readFileSync(join(ROOT, OPTIONS_FILE), 'utf8'), renderOptions(ANSWERS));

    const manifest = JSON.parse(readFileSync(join(ROOT, '.claude', 'brigade.json'), 'utf8'));

    assert.equal(manifest.files[OPTIONS_FILE], undefined);
});

test('the settings deny the lockfiles of every supported package manager', () => {
    const settings = JSON.parse(readFileSync(join(TEMPLATES, '.claude/settings.json'), 'utf8'));

    for (const lock of [
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
        'bun.lock',
        'bun.lockb'
    ]) {
        assert.ok(settings.permissions.deny.includes(`Read(./${lock})`), `${lock} is not denied`);
    }
});

test('the settings wire the status line and the session start hook to scripts of the kit', () => {
    const settings = JSON.parse(readFileSync(join(TEMPLATES, '.claude/settings.json'), 'utf8'));

    assert.match(settings.statusLine.command, /run-node\.sh.*\.claude\/hooks\/statusline\.mjs/);
    assert.match(settings.hooks.SessionStart[0].hooks[0].command, /run-node\.sh.*\.claude\/hooks\/session-start\.mjs/);
    assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /run-node\.sh.*\.claude\/hooks\/git-guard\.mjs/);
});

test('the kit ships /brigade-settings next to the three legacy personal-option commands', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, '.claude', 'brigade.json'), 'utf8'));

    for (const name of [
        'settings',
        'effort',
        'language',
        'reference-branch'
    ]) {
        const path = `.claude/commands/brigade-${name}.md`;

        assert.ok(manifest.files[path], `${path} is not in brigade.json`);
        assert.match(readFileSync(join(TEMPLATES, path), 'utf8'), /^allowed-tools: Read, Write, Edit$/m);
    }
});
