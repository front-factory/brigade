# Feature: Dry run and single install plan (branch feat/dry-run)

Date: 2026-10-25
Last commit: b039657f3fe4793c58b28cbba7382b6229145fea
Base branch: develop
Uncommitted / stash: all the work of this feature (not committed yet)

## Goal

Make the install plan the single description of every write (kit files, options file, ignore lines, manifest), applied by one step with atomic writes, and offer `--dry-run` to print that plan without writing.

## Steps

- [x] 1. C5b: `planExtras` adds the options file, the `.gitignore`/`.gitattributes` lines and the manifest to the plan; `applyPlan` is the only writer
- [x] 2. I2: `writeAtomic` (temp file in the same directory, then rename), used by `applyPlan` and `writeLocalSettings`
- [x] 3. C10: `--dry-run` prints the plan and writes nothing (it already existed from feat/smooth-update; now it runs the same planning path as a real run); README and `--help` updated
- [x] 4. Tests: dry run equals the real run's report and writes nothing, no temp file left behind
- [x] 5. Audit file: C5b, I2, C10 marked fixed

## Decisions and open questions

- The manifest is the last write of the plan, so a failed run still leaves the previous install described.
- Each file is replaced atomically, the run as a whole is not (earlier writes stay on a later failure); a re-run converges.
- `--dry-run` stays non-interactive (like `--yes`): nothing is asked.
- `appendMissingLines(cwd)` is kept as a plan-then-apply wrapper (used by tests); its `dryRun` parameter is gone.

## Notes

- `npm test`: 162 pass.

## Active audit (only if any)

Path: .claude/context/audits/2026-10-21-project-review.md
Open IDs: none from this feature
