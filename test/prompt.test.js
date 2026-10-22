import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPrompter } from '../src/prompt.js';

const OPTIONS = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

// Collects what the prompter prints; `fn` is run with console.log replaced.
async function printed(fn) {
    const lines = [];
    const log = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
        await fn();
    } finally {
        console.log = log;
    }
    return lines.join('\n');
}

test('without a terminal every question resolves to its default', async () => {
    const prompter = createPrompter({ interactive: false });
    assert.equal(prompter.interactive, false);
    assert.equal(await prompter.text('Name?', 'main'), 'main');
    assert.equal(await prompter.text('Name?'), '');
    assert.equal(await prompter.choose('Pick', OPTIONS), 'a');
    assert.deepEqual(await prompter.multi('Pick several', OPTIONS), []);
});

test('validate keeps the detected value, or falls back to pick when there is none', async () => {
    const prompter = createPrompter({ interactive: false });
    const pick = async () => 'picked';
    assert.equal(await prompter.validate('Branch', 'main', pick), 'main');
    assert.equal(await prompter.validate('Branch', '', pick), 'picked');
});

test('without a terminal nothing is printed', async () => {
    const prompter = createPrompter({ interactive: false });
    const out = await printed(() => {
        prompter.banner('1.0.0');
        prompter.step(1, 3, 'Detection');
        prompter.card('Setup', [['Key', 'value']]);
        prompter.files([{ done: true, label: 'a', detail: 'added' }]);
        prompter.info('info');
        prompter.warn('warn');
        prompter.outro('bye');
        prompter.done('Done', ['x']);
        prompter.close();
    });
    assert.equal(out, '');
});

test('with a terminal the display helpers print', async () => {
    const prompter = createPrompter({ interactive: true });
    const out = await printed(() => {
        prompter.banner('1.0.0');
        prompter.step(2, 3, 'Detection');
        prompter.card('Setup', [['Key', 'value']]);
        prompter.files([{ done: true, label: 'file.md', detail: 'added' }]);
        prompter.info('some info');
        prompter.warn('some warning');
        prompter.outro('bye');
        prompter.done('All done', ['first tip']);
    });
    for (const text of ['1.0.0', 'Detection', 'Setup', 'value', 'file.md', 'some info', '! some warning', 'bye', '✓ All done', 'first tip']) {
        assert.ok(out.includes(text), text);
    }
});
