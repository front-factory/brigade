# Feature: options file (branch feat/options-file)

Date: 2026-10-21
Last commit: 70363c9
Base branch: develop

## Goal

Make `.claude/rules/brigade.md` pure kit (no placeholders) so kit updates never conflict, and move the project's option values into the generated `.claude/rules/brigade-options.md`.

## Steps

- [x] Remove placeholders from templates/web/.claude/rules/brigade.md
- [x] `writeOptionsFile` in src/install.js, wired in src/init.js, shown in the report
- [x] Dogfood: brigade.md copy, generated brigade-options.md, brigade.json hashes
- [x] Tests (install, cli, dogfood) and `npm test`
- [x] decisions.md line and README update
- [x] Migration of old inline brigade.md: `.proposed` + note (edited or lost manifest), printed in the CLI report, tests with an old-template fixture (test/fixtures/old-brigade.md), README paragraph

## Decisions and open questions

- brigade-options.md is not a template and not in the manifest hashes: always regenerated, never `.proposed`.
- `render()` stays: settings.json and the agents still use placeholders.

## Notes

-
