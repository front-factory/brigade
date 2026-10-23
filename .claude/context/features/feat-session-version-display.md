# Feature: Session version display (branch feat/session-version-display)

Date: 2026-10-23
Last commit: 7db713c
Base branch: develop
Uncommitted / stash: all the work below is uncommitted

## Goal

Show in the Claude Code session of a project that Brigade manages it, and which version: a permanent status line and a `SessionStart` hook message.

## Steps

- [x] `hooks/statusline.mjs`: `Brigade v<version> · <branch>`, read-only (`.git/HEAD`), never throws
- [x] `hooks/session-start.mjs`: `hookSpecificOutput.additionalContext` + `systemMessage`, silent without a manifest
- [x] Wired in `templates/web/.claude/settings.json` (`statusLine`, `SessionStart`)
- [x] Installer picks the new files up (it lists the template folder, no explicit list to change)
- [x] Tests: `test/statusline.test.js`, install and dogfood tests
- [x] This repo's own copy synced with `node bin/brigade.js init --yes` (hooks, settings, base copies, hashes)
- [x] README paragraph

## Decisions and open questions

- SessionStart output: JSON with `hookSpecificOutput.additionalContext` (context for the model) and `systemMessage` (shown to the user). Not checked against the docs: confirm both fields behave as expected in a real session.
- An existing project's own `statusLine` is kept by the settings merge (the developer's value wins); only new installs and untouched files get it.

## Notes

- `npm test`: 181 pass, 0 fail.
