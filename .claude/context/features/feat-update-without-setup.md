# Feature: Update without setup (branch feat/update-without-setup)

Date: 2026-10-21
Last commit: aa24bf7
Base branch: develop

## Goal

Update the library to a new version without going through the options setup again, unless the new version has new options that must be set up (only those are asked).

## Steps

- [x] Read-only investigation of the CLI, the update flow, the manifest and the tests
- [x] Design validated by the user (single entry point `brigade init`, no subcommand, no flag)
- [x] `src/options.js`: ordered OPTIONS declaration, missing options detected against the manifest answers
- [x] Update path in `runInit`: stored answers replayed, only missing options asked; same version and first install ask all
- [x] Non-interactive: defaults used, new options listed in one line of the CLI summary
- [x] Tests (test/install.test.js), `npm test` passes (31)
- [x] README: Install, Update, Troubleshooting; `--help` text

## Decisions and open questions

- Constraints from `decisions.md`: the manifest stores the answers; untouched files updated, edited ones get a `.proposed`; the CLI never creates a git repo; CLAUDE.md never touched.
- Base is develop (aa24bf7), which already includes the CLI hardening (strict `readManifest`, CRLF-normalized sha, plan-then-write `installFiles`, CLI help/version).
- `runInit` reads the manifest through the strict `readManifest`: a corrupted manifest is an error, a missing one is a first install.
- Missing option = key undefined in the stored answers; a group of dependent keys is missing if any key is. No version numbers.

## Notes

- Today: `init` on an installed project asks keep/update, then re-asks every question (`ask()` in `src/init.js`).
