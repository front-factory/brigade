# Feature: /brigade-settings (branch feat/brigade-settings)

Date: 2026-10-23
Last commit: 413f6dd
Base branch: main

## Goal

One command, `/brigade-settings`, shows and changes all personal settings (reply language, effort per role, reference branch protection). It becomes the recommended entry point; the three legacy commands stay available.

## Steps

- [x] Add `brigade-settings.md` to `templates/web/.claude/commands/` and its dogfood copy
- [x] Add a pointer line to the three legacy commands (both copies)
- [x] Update mentions: README, `src/cli.js`, both `brigade.md` rules, both `local-template.md`
- [x] Refresh the sha256 entries in `.claude/brigade.json`
- [x] Add a dogfood test for the four commands
- [x] `npm test`

## Decisions and open questions

- Legacy commands keep their behavior; only a one-line pointer was added.
- Lifting the reference branch protection only matters when it differs from the default branch; documented in the two commands and brigade.md (wording only).

## Notes

- `test/fixtures/old-brigade.md` still mentions the old commands on purpose (fixture of a past kit version).
