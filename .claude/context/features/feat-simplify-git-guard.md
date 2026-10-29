# Feature: simplify the git guard (branch feat/simplify-git-guard)

Date: 2026-10-29
Last commit: 1d0f49b
Base branch: docs/bugs-robustness-audit

## Goal

Make `templates/web/.claude/hooks/git-guard.mjs` simpler and easier to maintain without changing its behaviour. It went from about 375 to 623 lines with the fixes of audit `.claude/context/audits/2026-10-29-bugs-robustness.md`. The project wants fewer moving parts, and the guard is a safety net, not a security boundary (see `.claude/context/decisions.md`).

## Steps

- [x] 1. Review and list the simplifications (see Candidates)
- [x] 2. The user chooses
- [x] 3. Refactor, with `test/guard.test.js` as the safety net
- [x] 4. Sync `.claude/hooks/git-guard.mjs` and its hash in `.claude/brigade.json`
- [x] 5. Check lint and tests
- [ ] Commit

Current step: done, waiting for the commit.

## Decisions and open questions

- Chosen: group A (items 1 to 5) plus item 6. Items 7 and 8 and group C are rejected.
- Item 5 was applied only in part: the `UNKNOWN` inlining and the `indexOf` helper would not save lines, so they were skipped; the main block is simplified.
- Item 2 was applied only for the tag/branch force rule; merging the `ON_PROTECTED` branches was skipped (no real gain).
- Item 6 tests changed: `git switch feat/y && git commit` (from main), `git checkout feat/y && git commit`, and `git checkout -b feat/y && git checkout file.md && git commit` now ask. The test "ambiguous checkout" was renamed.
- Result: 623 to 516 lines (git-guard.mjs). `npm test` 213 pass, `npm run lint` clean.

## Notes

- Line counts below are estimates on 623 lines. The lint style puts one array element per line, which inflates the file: converting Sets to `'a b c'.split(' ')` is the biggest single gain.

## Candidates

Group A: no behaviour change (ranked by gain, all low risk)

1. Sets as space-separated strings. `READ`, `ASK`, `ON_PROTECTED`, `SAFE` (lines 9-83, 75 lines) become `new Set('status diff ...'.split(' '))`. Also `SAFE` is built from `ON_PROTECTED` (7 names are repeated: commit, cherry-pick, revert, am, pull, reset, rm). Saves about 60 lines. No test change.
2. `decide()` if-chain (lines 521-543). Merge the two force branches (`tag` / `branch`, lines 529-532) into one rule with one message; merge the three `ON_PROTECTED` branches into one block that computes the reason. Saves about 6 lines. Only reason texts change (tests do not check them, except "unreadable").
3. `writes()` and `destructive()` (lines 377-441). Read forms of `reflog`, `remote`, `worktree`, `stash` become a table `{ reflog: /^(?!expire|delete)/, ... }` (4 ifs of 3 lines now). A tiny helper `flag(rest, 'a|b')` replaces the repeated `(^|\s)(...)(\s|$)` patterns (about 14 times), and `reflog expire|delete`, `tag -d`, `branch -D`, `stash drop|clear` are no longer spelled twice. Saves about 10 lines, clearer. No test change.
4. `nestedTexts()` (lines 250-267). The `sh -c` and `eval` loops become one regex with an alternation. Saves about 6 lines. No test change.
5. Small items: inline `UNKNOWN` (used twice, lines 94-97, 4 lines); the stdin validation of the main block (lines 585-597) written as one try block (about 3 lines); the double `indexOf` in `heredocs()` (lines 139, 186) put in a small helper (clarity, 0 lines). Saves about 7 lines. No test change.

Group A total: about 90 lines (623 to about 535).

Group B: small, explicit behaviour changes

6. `branchesAfter()` (lines 443-487, 45 lines): keep only the part that matters. A `switch`/`checkout` that creates a branch (`-b`, `-c`, `-B`, `-C`) gives `[name]`; any other `switch`/`checkout` makes the branch unknown (`null`, so `commit`-like commands later in the command are asked). Drops the "is it a file?" analysis. Saves about 22 lines. Change: more asks, never fewer (`git switch feat/y && git commit` and `git checkout feat/y && git commit` go from allow to ask). Tests that change: "protected-branch check follows switches" (the `git switch feat/y && ...` asserts, lines 522-524 and 530) and "ambiguous checkout" (lines 535 and 549-551). Medium gain, low risk (over-asking is safe).
7. `heredocs()` arithmetic tracking (kind `arith`, lines 158-166, 167-176): remove, and instead ignore a `<<` followed by a number-only word (`(?!\d+\b)`), so `$((1<<2))` still does not open a heredoc. Saves about 12 lines. Change: `$((a<<b))` with letters would be read as a heredoc and could hide following lines (fail-open on a rare case). Tests unchanged (lines 559-560 use digits). Medium risk, kept as an option.
8. `configWrites()` (lines 335-366, 32 lines): drop the valued-options parsing (`--file`, `--blob`, ...) and the new `get`/`list`/`set` forms. Read = a `--get*`/`--list`/`-l` flag, or exactly one positional. Saves about 15 lines. Change: `git config --file .gitmodules user.name` and `git config get|list ...` become writes (deny for main session). Tests that change: lines 67-68, 71.

Group B total: about 50 lines more (to about 485).

Group C: not recommended

9. Drop `config` and `symbolic-ref` special cases altogether (about 40 lines, `configWrites` + `symbolicRefWrites`). Change: every `git config` / `git symbolic-ref` is a write (deny for the main session, ask for git-operator), including plain reads. About 25 test lines change. Annoying in daily use; saves little more than candidate 8.
10. Drop `branchesAfter()` entirely (45 lines, about 40 test lines). Fail-open: `git switch main && git commit` would be allowed on a feature branch. Not recommended.
11. Merge `strip`, `substitutions`, `heredocs`, `nestedTexts` into one tokenizer. Would save about 60 lines but is a rewrite of the riskiest part (quote handling); the guard tests cover many cases but not all. Not recommended.
12. `LEADING` regex (line 294): drop `timeout`/`stdbuf`/`nice`/`nohup` wrappers. Saves 0 lines (one regex), only shortens it; tests at lines 620-638 would change. Not worth it.

Estimated size: now 623; group A about 535; groups A+B about 485; with group C about 400-440.

## Active audit

none (the audit is closed)
