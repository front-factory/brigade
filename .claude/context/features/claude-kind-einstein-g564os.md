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
- [ ] 2. New `src/` (cli, detect, options, render, kit, install, uninstall, prompt/ui), until contract tests pass; remove internal tests.
- [ ] 3. Rewritten git guard (~150 lines; nested git in `$(...)`/backticks/`sh -c`/`eval` = deny for main session and implementer, ask for git-operator; `--no-verify` destructive); list the stricter cases here.
- [ ] 4. Kit rewrite + audit fixes: options `checks` and `audits`, useful SessionStart hook (injects decisions.md, branch/sync, feature file, stale feature files), status line removed, settings.json `$schema`, env/key denies, dependency installs to `ask`; fixes M1, M2, M3, M5, M7, L2, H2, H3, L4, H4, M4, M6; re-render the dogfood `.claude/`.
- [ ] 5. README, architecture.md, audit rows to `fixed`; delete this file in the last commit.

## Decisions and open questions

- Non-breaking 1.x; distribution stays a CLI copy.
- Keep decisions.md, simple feature files, /brigade-settings and its 3 aliases unchanged.
- Audit workflow optional (option `audits`, default true).
- `defaultMode: plan` kept (H1 deferred).

## Notes

- v1 quirk frozen by `test/contract/install.test.js`: the first re-run of `init` drops the write-once files (`decisions.md`, `architecture.md`) from the manifest `files`; the manifest is stable afterwards. Not a documented promise: the rewrite may keep them recorded (then relax that test).

- The v1 contract is the README (Update, Uninstall, Git guard sections) and `.claude/context/decisions.md`.
- The full plan was discussed in the session of 2026-10-31.

## Active audit

Path: .claude/context/audits/2026-10-31-project-alignment.md
Open IDs: H2 H3 H4 M1 M2 M3 M4 M5 M6 M7 M8 L1 L2 L3 L4 L5 S1 X1 X2 X3 X4 X5
