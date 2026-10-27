import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

import { createPrompter } from '../src/prompt.js';

const OPTIONS = [
    {
        value: 'a',
        label: 'A'
    },
    {
        value: 'b',
        label: 'B'
    }
];

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

    // Strip ANSI codes so assertions do not depend on the terminal colors.
    return stripVTControlCharacters(lines.join('\n'));
}

test('without a terminal every question resolves to its default', async () => {
    const prompter = createPrompter({
        interactive: false
    });

    assert.equal(prompter.interactive, false);
    assert.equal(await prompter.text('Name?', 'main'), 'main');
    assert.equal(await prompter.text('Name?'), '');
    assert.equal(await prompter.choose('Pick', OPTIONS), 'a');
    assert.deepEqual(await prompter.multi('Pick several', OPTIONS), []);
});

test('validate keeps the detected value, or falls back to pick when there is none', async () => {
    const prompter = createPrompter({
        interactive: false
    });
    const pick = async () => 'picked';

    assert.equal(await prompter.validate('Branch', 'main', pick), 'main');
    assert.equal(await prompter.validate('Branch', '', pick), 'picked');
});

test('without a terminal nothing is printed', async () => {
    const prompter = createPrompter({
        interactive: false
    });

    const out = await printed(() => {
        prompter.banner('1.0.0');
        prompter.step(1, 3, 'Detection');
        prompter.card('Setup', [
            [
                'Key',
                'value'
            ]
        ]);

        prompter.files([
            {
                done: true,
                label: 'a',
                detail: 'added'
            }
        ]);

        prompter.info('info');
        prompter.warn('warn');
        prompter.outro('bye');
        prompter.done('Done', [
            'x'
        ]);
    });

    assert.equal(out, '');
});

test('with a terminal the display helpers print', async () => {
    const prompter = createPrompter({
        interactive: true
    });

    const out = await printed(() => {
        prompter.banner('1.0.0');
        prompter.step(2, 3, 'Detection');
        prompter.card('Setup', [
            [
                'Key',
                'value'
            ]
        ]);

        prompter.files([
            {
                done: true,
                label: 'file.md',
                detail: 'added'
            }
        ]);

        prompter.info('some info');
        prompter.warn('some warning');
        prompter.outro('bye');
        prompter.done('All done', [
            'first tip'
        ]);
    });

    for (const text of [
        '1.0.0',
        'Detection',
        'Setup',
        'value',
        'file.md',
        'some info',
        '! some warning',
        'bye',
        '✓ All done',
        'first tip'
    ]) {
        assert.ok(out.includes(text), text);
    }
});

// Ctrl-C on a real prompt: clack reads it from stdin, so it runs in a child process fed with it.
test('cancelling a question throws a CancelError instead of exiting', () => {
    const script = `
        import { createPrompter, CancelError } from './src/prompt.js';

        try {
            await createPrompter({ interactive: true }).text('Name?', 'main');
        } catch (error) {
            console.log(error instanceof CancelError ? error.message : 'other: ' + error.message);
            process.exit(0);
        }
        console.log('answered');
    `;

    const result = spawnSync(process.execPath, [
        '--input-type=module',
        '-e',
        script
    ], {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        encoding: 'utf8',
        input: '\x03'
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(stripVTControlCharacters(result.stdout), /Cancelled\. Nothing was written\./);
});

test('without a terminal a confirmation is a yes', async () => {
    assert.equal(await createPrompter({
        interactive: false
    }).confirm('Go on?'), true);
});
