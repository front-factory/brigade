# Feature: CLI hardening (branch feat/cli-hardening)

Date: 2026-10-21
Last commit: d3ff822
Base branch: develop

## Goal

Harden the Brigade CLI (`src/`): no half-installed state, clear errors on bad input, and a few small cleanups, each covered by tests.

## Steps

- [x] Atomic install: compute the full plan first, then write (no half-installed state on error; `prompt.js` promises "Nothing was written" on cancel)
- [x] Corrupted `.claude/brigade.json`: clear error instead of being treated as a first install (`readManifest` currently swallows every error)
- [x] CLI: `-h`/`--help` exit 0 (also `init --help`), `--version`, unknown command reported as such, `--stack` without a value gives a clear message
- [x] Stale `.proposed` files cleaned when the target becomes identical to the kit
- [x] Small cleanups: `detectCommitConvention` called twice in `ask()`, shared "72 characters max" constant in `conventions.js`, CRLF handling in `normalize` and hashes
- [x] Tests for each of the above (cli, install, detect)

## Decisions and open questions

- Out of scope: `--dry-run`, finer language detection, monorepos.

## Notes

- `installFiles` now plans (reads only) then writes; `readManifest` throws on a corrupt or non-object manifest. `npm test`: 37 pass.
