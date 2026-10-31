# Feature: rewrite Brigade from scratch, non-breaking (branch claude/kind-einstein-g564os)

Date: 2026-10-31
Last commit: 670bfdd
Base branch: develop
Uncommitted / stash: the H3 `checks` changes in src/, templates/, test/, README and .claude/ are left in the working tree on purpose: the rewrite replaces those files.

## Goal

Rewrite the CLI, the git guard and the kit from scratch with far less code (src/ ~1,200 lines, guard ~150), keeping the main goal (three roles, git guard, shared durable context, effortless team install) and the v1 contract: same commands and flags, same `.claude/` paths and names, readable v1 manifest. Published as 1.8.0 (no `!`, no BREAKING CHANGE). Distribution stays a CLI copy (a plugin needs an install per developer and cannot ship permissions or rules).

## Steps

- [x] 0. Commit the alignment audit; create this file.
- [x] 1. Contract tests `test/contract/*.test.js` (black-box: CLI in temp dirs, guard via stdin), passing on v1 first.
- [x] 2. New `src/` (cli, detect, options, render, kit, install, uninstall, prompt/ui), until contract tests pass; remove internal tests. Done: 110 tests pass, lint clean, `src/` = 1,400 lines (cli 160, detect 86, install 480, kit 41, options 257, prompt 80, render 92, ui 47, uninstall 157; bin 9).
- [x] 3. Rewritten git guard (~150 lines; nested git in `$(...)`/backticks/`sh -c`/`eval` = deny for main session and implementer, ask for git-operator; `--no-verify` destructive); list the stricter cases here.
- [x] 4. Kit rewrite + audit fixes: options `checks` and `audits`, useful SessionStart hook (injects decisions.md, branch/sync, feature file, stale feature files), status line removed, settings.json `$schema`, env/key denies, dependency installs to `ask`; fixes M1, M2, M3, M5, M7, L2, H2, H3, L4, H4, M4, M6; re-render the dogfood `.claude/`.
- [ ] 5. README, architecture.md, audit rows to `fixed`; delete this file in the last commit.

## Step 3 notes (git guard)

Done: guard = 218 lines after lint (the lint style expands every multi-property object and array; ~150 not reachable). `decide` now returns `{ permissionDecision, permissionDecisionReason }`. Stricter or different than v1 (expectations updated in `test/guard.test.js`):
- Nested git (`$(...)`, backticks, `sh -c`, `eval`, unquoted heredoc substitutions) is never decoded: main session/implementer deny even for reads (`echo $(git status)`); git-operator ask (`bash -c "git add a"` was allow). A destructive pattern (or `--no-verify`/`commit -n`) anywhere in the raw text of a nested command stays deny, so `sh -c 'git push --force'`, `eval "git clean -fd"` and `$(git reset --hard)` in a heredoc are unchanged.
- A `switch`/`checkout` earlier in the same command makes the branch unknown: `git switch -c x && git commit`, `git checkout -b x main && git commit` and `git switch main && git switch -c x && git commit` go from allow to ask.
- New: `--no-verify` anywhere and `commit -n` (also combined, `-anm`) are denied for git-operator.
- Not covered anymore: nested depth limit (any nested git is unknown).

## Step 4 notes (kit)

Done: options `checks` (detect/ask multi/recap, `checkCommand` in render.js) and `audits` (silent option: asked only in Customize, stored true when missing; off = audit skill and template left out of the kit); shorter kit texts (brigade.md 36 lines, audit rule moved to the audit skill description); session-start hook injects version, decisions, branch sync, feature file, stale feature files; settings.json with `$schema`, explicit env/key denies, installs to ask; status line and `test/statusline.test.js` removed (an old `statusLine` entry running statusline.mjs is still dropped on merge); `/brigade-settings` has the `Checks for me:` setting. Dogfood `.claude/` re-rendered; `test/dogfood.test.js` updated for the removed status line and the exact `install` allow rule. New `test/kit.test.js`. src/ = 1,492 lines.

## Decisions and open questions

- Non-breaking 1.x; distribution stays a CLI copy.
- Keep decisions.md, simple feature files, /brigade-settings and its 3 aliases unchanged.
- Audit workflow optional (option `audits`, default true).
- `defaultMode: plan` kept (H1 deferred).

## Notes

- Step 2 decisions: Node minimum is 22 (engines, bin runtime check, CI matrix 22 + latest, decisions.md); publish job stays on 24. Deliberate behavior changes (none visible in the README): write-once files stay recorded in the manifest (stable from the first re-run); the interactive recap is one "redo everything" loop instead of per-group editing; the one-off note about brigade.md moving to brigade-options.md is dropped; dry-run/update wording uses "would be ..." tables in `src/ui.js`; an empty hook list in a user's settings.json is dropped on merge. `acceptEdits`/`opusplan` default migration and the `.claude/brigade-base` cleanup are kept. README still names `src/stacks.js` and Node >= 24 (step 5).

- v1 quirk frozen by `test/contract/install.test.js`: the first re-run of `init` drops the write-once files (`decisions.md`, `architecture.md`) from the manifest `files`; the manifest is stable afterwards. Not a documented promise: the rewrite may keep them recorded (then relax that test).

- The v1 contract is the README (Update, Uninstall, Git guard sections) and `.claude/context/decisions.md`.
- The full plan was discussed in the session of 2026-10-31.

## Active audit

Path: .claude/context/audits/2026-10-31-project-alignment.md
Open IDs: H2 H3 H4 M1 M2 M3 M4 M5 M6 M7 M8 L1 L2 L3 L4 L5 S1 X1 X2 X3 X4 X5
