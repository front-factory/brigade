# Feature: git guard blind spots (branch fix/git-guard-blind-spots)

Date: 2026-10-22
Last commit: d9c895b
Base branch: main

## Goal

Close the git guard blind spots found by the project review: global options (G1, G2), nested commands and work-destroying commands (G3), and the fail-open protected branches (G6).

## Steps

- [x] G1/G2: skip global options before the subcommand
- [x] G3: analyse `$(...)`, backticks, `sh -c`, `eval`, `xargs git`; deny `checkout --`/`.`/`-f`, `restore` (worktree), `switch --discard-changes`, `stash drop|clear`
- [x] G6: `protectedBranches()` returns `null` when brigade.json is unreadable; git-operator is asked on protected-branch commands
- [x] Tests in test/guard.test.js, hook mirrored, brigade.json hash updated
- [ ] Commit

## Decisions and open questions

- Nested forms nested deeper than 3 levels that contain `git` are treated as a write (ask for git-operator).
- G4: an invalid, empty or non-object stdin payload makes the hook ask ("Hook payload unreadable: confirm.") instead of crashing; G5 tests spawn the hook as a child process.

## Notes

- V1, R8, R9, T4 and K6 of the audit were also handled on this branch.
- `npm test` passes (79 tests).

## Active audit

Path: .claude/context/audits/2026-10-21-project-review.md
Open IDs: none (guard)
