import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const COPIES = [
    '.claude/settings.json',
    'templates/web/.claude/settings.json'
];

for (const copy of COPIES) {
    const { permissions } = JSON.parse(readFileSync(join(ROOT, copy), 'utf8'));

    test(`${copy}: recoverable discards ask, irreversible commands are denied`, () => {
        assert.ok(permissions.ask.includes('Bash(git branch -D:*)'));
        assert.ok(!permissions.deny.includes('Bash(git branch -D:*)'));

        for (const rule of [
            'Bash(git reset --hard:*)',
            'Bash(git push --force:*)',
            'Bash(git push -f:*)',
            'Bash(git clean -f:*)'
        ]) {
            assert.ok(permissions.deny.includes(rule), rule);
            assert.ok(!permissions.ask.includes(rule), rule);
        }

        for (const rule of [
            'Bash(git push:*)',
            'Bash(git merge:*)',
            'Bash(git rebase:*)'
        ]) {
            assert.ok(permissions.ask.includes(rule), rule);
        }
    });
}
