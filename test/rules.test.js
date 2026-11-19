import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PREFIXES = [
    '.claude',
    'templates/web/.claude'
];

const read = (prefix, path) => readFileSync(join(ROOT, prefix, path), 'utf8');
const count = (text, needle) => text.split(needle).length - 1;

for (const prefix of PREFIXES) {
    test(`${prefix}: rules/brigade.md has the discussion rules`, () => {
        const text = read(prefix, 'rules/brigade.md');

        assert.equal(count(text, 'A question gets an answer, not an action'), 1);
        assert.equal(count(text, 'Before any change of behavior'), 1);
        assert.equal(count(text, 'A plan or a picked approach is not a go'), 1);
        assert.equal(count(text, 'said go'), 1);
    });

    test(`${prefix}: the feature skill Design bullet points to brigade.md`, () => {
        const design = read(prefix, 'skills/feature/SKILL.md').split('\n').find((line) => line.startsWith('- **Design**'));

        assert.ok(design, 'Design bullet missing');
        assert.match(design, /brigade\.md/);
    });

    test(`${prefix}: the feature skill Plan bullet needs a go`, () => {
        const plan = read(prefix, 'skills/feature/SKILL.md').split('\n').find((line) => line.startsWith('- **Plan**'));

        assert.ok(plan, 'Plan bullet missing');
        assert.match(plan, /says go/);
    });

    test(`${prefix}: the audit skill has Fixing, the discussion and the feature proposal`, () => {
        const text = read(prefix, 'skills/audit/SKILL.md');
        const fixing = text.split('\n').find((line) => line.startsWith('- **Fixing**'));

        assert.ok(fixing, 'Fixing bullet missing');
        assert.match(fixing, /brigade\.md/);
        assert.match(fixing, /discussion/);
        assert.equal(count(text, 'propose a feature'), 1);
        assert.equal(count(text, 'open IDs'), 1);
    });

    test(`${prefix}: git-operator lists the discards and the denied commands`, () => {
        const text = read(prefix, 'agents/git-operator.md');

        for (const command of [
            '`restore`',
            '`checkout --`',
            '`branch -D`',
            '`stash drop`',
            '`tag -d`'
        ]) {
            assert.ok(text.includes(command), command);
        }

        assert.match(text, /`reset --hard`, force push, `clean -f` and history rewrites are denied/);
    });

    test(`${prefix}: briefs carry excerpts and implementer reads only those lines`, () => {
        const rules = read(prefix, 'rules/brigade.md');
        const implementer = read(prefix, 'agents/implementer.md');

        assert.equal(count(rules, 'paste the exact excerpt with its line numbers'), 1);
        assert.equal(count(rules, 'pass `effort: low` unless `CLAUDE.local.md` gives an effort for that role'), 1);
        assert.equal(count(implementer, 'read only those lines with a small margin'), 1);
    });

    test(`${prefix}: brigade-settings has the git guard setting`, () => {
        const text = read(prefix, 'commands/brigade-settings.md');

        assert.equal(count(text, 'BRIGADE_GIT_GUARD'), 2);
        assert.match(text, /\*\*git guard\*\*/);
        assert.match(text, /\*\*Git guard\*\*/);
    });
}
