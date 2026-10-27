# Feature: uninstall (branch feat/uninstall)

Date: 2026-10-27
Last commit: afa8f7f
Base branch: develop
Uncommitted / stash: all the work is uncommitted

## Goal

Add `brigade uninstall` (audit A9): remove what Brigade wrote, never the team's own work, with the same safety as `init` (plan first, manifest hashes decide, `--dry-run`).

## Steps

- [x] `stripSettings` and exports in src/install.js
- [x] src/uninstall.js (planUninstall, runUninstall)
- [x] src/cli.js route, options, summaries; src/words.js wording
- [x] Tests: test/uninstall.test.js, test/cli.test.js
- [x] README "Uninstall" section
- [x] Audit A9 marked fixed
- [ ] Commit (waiting for the user's go)

## Decisions and open questions

- Kit entries are stripped from a merged settings.json; .gitignore and .gitattributes lines are left; `--yes` is required without a terminal.
- `APPENDS` is also exported from src/install.js, to list the lines left in place.

## Notes

- templates/web/ is untouched, so no dogfood re-render.

## Active audit

Path: .claude/context/audits/2026-10-26-docs-consistency.md
Open IDs: A4, A5, A8
