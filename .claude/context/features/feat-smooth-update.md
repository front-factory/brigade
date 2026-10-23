# Feature: Smooth update (branch feat/smooth-update)

Date: 2026-10-23
Last commit: 7461d57
Base branch: develop

## Goal

Make the update between two Brigade versions smooth, non-destructive and effective.

## Steps

- [x] 1. Preview before writing (interactive confirm) and `--dry-run`
- [x] 2. Obsolete files: removed if untouched, kept and reported if edited, empty folders cleaned
- [x] 3. `.claude/settings.json` merged by keys, `.proposed` fallback when not valid JSON
- [ ] 4. Three-way merge of other files (store the previous kit content): not started, out of this brief
- [ ] 5. CHANGELOG excerpt between versions: not started, out of this brief

## Decisions and open questions

- Dry run is non-interactive (like `--yes`): no question, no manifest; it lists the plan, the options file status and the `.gitignore`/`.gitattributes` lines it would add (`appendMissingLines(cwd, dryRun)` computes them without writing).
- Merge: objects by key, arrays as union by value (developer's first), scalars stay the developer's. The manifest keeps the kit hash of settings.json, so the next update merges again.
- settings.json merge: kit entries removed or changed between versions are not removed from the developer's file (a changed hook command can end up duplicated) until step 4 (three-way merge with the stored previous kit content). Accepted by the user for now.
- A settings.json entry the developer deliberately deleted comes back at the next update (the kit adds what is missing). Accepted by the user; documented in the README.

## Notes

- `installFiles` is split into `planFiles` (reads only) and `applyPlan` (writes); `runInit` inserts the preview between them.
- A file the developer edited and the kit did not change since the last install is `kept`: no `.proposed`, recorded hash unchanged. A `.proposed` left by an earlier version is left alone (never deleted silently), it is removed only once the target matches the kit.
