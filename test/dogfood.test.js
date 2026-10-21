import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CONVENTIONS } from '../src/conventions.js';
import { render } from '../src/install.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(ROOT, 'templates', 'web');

// Project-owned files: they differ from the template on purpose.
const SKIP = new Set(['.claude/context/decisions.md', '.claude/context/architecture.md']);

const ANSWERS = {
    defaultBranch: 'main',
    baseBranch: 'develop',
    packageManager: 'npm',
    commitFormat: CONVENTIONS.conventional.format,
    replyLanguage: 'French',
    codeLanguage: 'English',
    docsLanguage: 'English'
};

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(abs);
        return entry.name === '.DS_Store' ? [] : [abs];
    });
}

test('the .claude/ of this repo is the rendered copy of templates/web/', () => {
    for (const source of listFiles(TEMPLATES)) {
        const path = relative(TEMPLATES, source).split('\\').join('/');
        if (SKIP.has(path)) continue;

        const expected = render(readFileSync(source, 'utf8'), ANSWERS);
        const actual = readFileSync(join(ROOT, path), 'utf8');
        assert.equal(actual, expected, `${path} drifted from templates/web/${path}`);
    }
});
