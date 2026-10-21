import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

import { banner, bullets, card, checklist, step } from '../src/ui.js';

const ANSI = /\x1b\[/;
const ROWS = [['Default branch', 'main'], ['Package manager', 'pnpm'], ['Replies', 'French (project default)']];

// Tests run with stdout piped: colors are off, the output is plain text.
test('plain output carries no ANSI', () => {
    for (const text of [banner('1.2.3'), card('Setup', ROWS), step(1, 3, 'Detection'), checklist([{ done: true, label: 'a', detail: 'added' }]), bullets(['x'])]) {
        assert.doesNotMatch(text, ANSI);
    }
});

test('a card aligns its keys and fits its content', () => {
    const lines = card('Your setup', ROWS, { columns: 100 }).split('\n').slice(1);
    assert.equal(new Set(lines.map((line) => line.length)).size, 1);
    assert.match(lines[0], /^╭─ Your setup ─+╮$/);
    assert.match(lines[1], /^│ Default branch {3}main +│$/);
    assert.match(lines[2], /^│ Package manager {2}pnpm +│$/);
    assert.match(lines.at(-1), /^╰─+╯$/);
    assert.equal(lines[0].length, 15 + 2 + 'French (project default)'.length + 4);
});

test('a card is capped to a narrow terminal', () => {
    const lines = card('Setup', [['Key', 'a very long value that cannot fit in twenty columns']], { columns: 20 }).split('\n').slice(1);
    assert.ok(lines.every((line) => line.length <= 20));
    assert.equal(new Set(lines.map((line) => line.length)).size, 1);
    assert.match(lines[1], /…/);
});

test('0 or missing columns fall back to 80', () => {
    const long = [['Key', 'x'.repeat(200)]];
    for (const columns of [0, undefined]) {
        const lines = card('Setup', long, { columns }).split('\n').slice(1);
        assert.ok(lines.every((line) => line.length <= 80));
        assert.equal(lines[0].length, 80);
    }
});

test('the checklist ticks done items and aligns the details', () => {
    const lines = checklist([
        { done: true, label: 'a.md', detail: 'added' },
        { done: false, label: 'long/path.md', detail: 'already up to date' }
    ]).split('\n');
    assert.equal(lines[0], '  ✓ a.md          added');
    assert.equal(lines[1], '  - long/path.md  already up to date');
});

const render = (env) => execFileSync(process.execPath, ['--input-type=module', '-e', "import { card } from './src/ui.js'; process.stdout.write(card('T', [['k', 'v']]))"], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env }
});

test('colors follow the environment: forced on, then off with NO_COLOR', () => {
    assert.match(render({ FORCE_COLOR: '1' }), ANSI);
    assert.doesNotMatch(render({ NO_COLOR: '1' }), ANSI);
});
