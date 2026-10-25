# Audit: project review

Date: 2026-10-21
Baseline commit: d9c895b
Scope: whole project (CLI in `src/`, kit in `templates/web/` and the repo's `.claude/`, tests, CI/release, docs)
Re-audited 2026-10-22
Status: open

## Findings

| ID | Severity | File | Problem | Status | Notes (commit / reason) |
|----|----------|------|---------|--------|-------------------------|
| G1 | high | templates/web/.claude/hooks/git-guard.mjs (mirrored in .claude/hooks) | Global options are read as the subcommand: `git -C . push --force` and `git -C . commit` on a protected branch by git-operator give `allow` instead of deny/ask (guard bypass). Skip `-C <path>`, `-c k=v`, `--git-dir`, `--work-tree` before reading the subcommand. Reproduced 2026-10-22: `git -C . push --force` and `git -c user.name=x push -f` both give `allow` for git-operator (the `-c` value is read as the subcommand). | fixed | Global options skipped before the subcommand; tests added. |
| G2 | - | git guard | False positive: `git -C . status` is denied for the main session. Confirmed still reproducible 2026-10-22. | fixed | Reads behind global options no longer count as writes; tests added. |
| G3 | - | git guard | Blind spots: `$(git ...)`, `bash -c "git ..."`, backticks, `xargs git`; `git checkout -- .` and `git restore` are allowed for git-operator though they destroy uncommitted work. Confirmed still reproducible 2026-10-22 (`git checkout -- .`, `git restore .` allowed for git-operator; `bash -c "git commit"` returns no decision). | fixed | Nested forms (`$(...)`, backticks, `sh -c`, `eval`, `xargs git`) analysed, work-destroying commands denied for git-operator; tests added. |
| G4 | - | git guard | Hook is fail-open when the stdin JSON is invalid (a crash lets the command through); it should deny/ask. | fixed | Invalid stdin payload now asks; tests added. |
| G5 | - | git guard tests | No guard tests for global options, subshells, `checkout --`, invalid payload. | fixed | Guard tests cover global options, nested commands, work-destroying commands, unknown branches and invalid payload. |
| G6 | medium | git-guard.mjs `protectedBranches()` | Fail-open: when `.claude/brigade.json` is missing or corrupted it returns `[]`, so branch protection is silently off. Should ask/deny or warn. | fixed | `protectedBranches()` returns null when brigade.json is unreadable and git-operator is asked on protected-branch commands; tests added. |
| K1 | - | kit | No check that `.claude/` is the rendered copy of `templates/web/`. | fixed | d3ff822: `test/dogfood.test.js` |
| K2 | - | .claude/brigade.json | Tracked with version 0.0.0. | fixed | d3ff822: untracked and ignored |
| K3 | - | .claude/context/features | Stale feature file `chore-restart-v2.md`. | fixed | d3ff822: removed |
| K4 | - | .claude/context/decisions.md | Empty `decisions.md`. | fixed | d3ff822: 9 decisions |
| K5 | - | .claude/context/architecture.md | Was the template copy. | fixed | d3ff822: describes Brigade |
| C1 | - | src/ (CLI) | `-h`, `--help`, `init --help` exit 0; `--version` added. | fixed | 1eec657 |
| C2 | - | src/ (CLI) | Unknown command reported as such; `--stack` without a value gives a clear message. | fixed | 1eec657 |
| C3 | low | src/ (`ask()`) | `detectCommitConvention` called twice in `ask()`. | fixed | 1eec657 |
| C4 | low | src/ | "72 characters max" repeated; now a shared constant. | fixed | 1eec657 |
| C5 | - | src/ (install) | Install is planned then written (kit files). | fixed | 1eec657; see C5b for the remaining part |
| C5b | - | src/ (install) | `appendMissingLines` and the manifest are still written after the plan (partial atomicity). | fixed | `planExtras` puts the options file, the ignore lines and the manifest (last) in the plan; `applyPlan` is the only writer. |
| C6 | - | src/ (manifest) | Corrupted `brigade.json` now errors instead of being treated as a first install. | fixed | 1eec657 |
| C7 | - | src/ (install) | Stale `.proposed` removed once the target matches the kit. | fixed | 1eec657 |
| C8 | - | src/ (hashes, appends) | CRLF handled in hashes and `.gitignore`/`.gitattributes` appends. | fixed | 1eec657 |
| C9 | - | src/prompt.js | Calls `process.exit(1)` on cancel (untestable); `close` is a no-op. | open | |
| C10 | - | src/ (CLI) | `--dry-run` option. | fixed | Prints the same plan as a real run and writes nothing; README and `--help` updated, tests added. |
| C11 | - | src/detect.js | Language detection from `LANG` is unreliable (often `C`/`en_US`). | fixed | Detection removed; the reply language defaults to English (preselected in the question, applied directly with `--yes` or without a terminal); stored answers still win. |
| C12 | - | src/detect.js | No monorepo / pnpm workspace detection. | deferred | |
| C13 | low | src/stacks.js | Single stack with a trivial `match`. | wontfix (low value) | The mechanism is intentionally ready for more stacks. |
| C14 | low | `.gitignore` / `.gitattributes` append | The `## Claude` heading appended is unconventional (works as a comment). | fixed | Heading removed: the missing lines are appended without a title; existing `## Claude` blocks are left untouched. |
| V1 | medium | src/version.js | `compareVersions` ignores pre-release tags: `1.2.0-beta.1` vs `1.2.0` compares equal, so a beta to stable switch is reported "already up to date" (the repo publishes a `beta` channel). | fixed | pre-release precedence implemented in `compareVersions`, tests added. |
| V2 | low | bin/brigade.js | No runtime Node check: on Node < 24 `styleText`/`parseArgs` fail with a cryptic error; `engines` only warns. Add an explicit message. | open | |
| I1 | low | src/install.js `writeManifest` | `localeCompare` makes the key order locale-dependent; use a plain comparison for a stable manifest. | open | |
| I2 | low | src/install.js | Writes are not atomic (no temp file + rename); extends C5b. | fixed | `writeAtomic` (temp file + rename, temp removed on error); the run as a whole stays non-atomic. |
| P1 | low | src/prompt.js `text` | A custom commit format can be empty: `brigade-options.md` gets a blank "Commit format:" line. Add validation. | fixed | The custom commit format is required in the prompt; a blank one without a terminal falls back to Conventional Commits; tests added. |
| P2 | low | src/cli.js | `interactive` depends on `stdin.isTTY` only; stdout piped still prompts. | open | |
| K6 | low | templates/web/.claude/settings.json | Lockfile deny list lacks `bun.lock`/`bun.lockb`; `Bash(<pm> run:*)` allows any script. | fixed | Bun lockfiles added to the deny list; `<pm> run:*` kept on purpose (project scripts). |
| T1 | - | test/ | CLI untested. | fixed | 1eec657: `test/cli.test.js` |
| T2 | - | test/ | `detect.js` only partly covered (commit convention); `prompt.js` and `summary` rendering untested. | fixed | `detect.js` fully covered (`detect.test.js`); `prompt.js` non-interactive paths and display helpers tested (`prompt.test.js`); plain `summary` covered through the CLI (`cli.test.js`). Left untested: the clack prompts (`text`, `choose`, `validate`, `multi` with a TTY), the cancel path (see C9) and the interactive `print` (needs a TTY). |
| T3 | - | test/ | No coverage measurement (`node --test --experimental-test-coverage`). | fixed | Script `npm run test:coverage` added. Measured 2026-10-22: 96 tests pass, 95.5% lines / 91.4% branches / 94.5% functions (before T2: 95.3% / 87.9% / 86.2%). Least covered: `prompt.js` 80.0% lines, `git-guard.mjs` 86.8%, `cli.js` 87.1% (interactive paths). |
| T4 | low | test/install.test.js | Uses `rm` via `execFileSync` (not portable to Windows); use `rmSync`. | fixed | `rm` replaced by `rmSync`. |
| T5 | low | test/ | Tests depended on the machine's git config (`init.defaultBranch`); made hermetic with GIT_CONFIG_GLOBAL/GIT_CONFIG_NOSYSTEM. | fixed | Empty temp gitconfig used instead of the null device, which git cannot open on Windows. |
| R1 | - | CI | The matrix has a single Node (24) while the comment promises every `engines` version. | fixed | Matrix: Node 24 on ubuntu, macOS and Windows, plus the latest Node on ubuntu. |
| R2 | - | repo | No lint/format tooling (only `.editorconfig`). | open | |
| R3 | low | CI | Dotfiles ARE packaged (`npm pack --dry-run`: 29 files, 24.7 kB, all `templates/web/.claude/**` present); only a CI guard (`npm pack --dry-run` check) is missing. | fixed | Added test/pack.test.js: `npm pack --dry-run --json` must list bin, src and every templates/web file (dotfiles included). |
| R4 | - | release | Publish with npm Trusted Publishing (OIDC) instead of `NPM_TOKEN`. | fixed | `NPM_TOKEN` removed from `ci.yml`. The trusted publisher on npmjs.com remains a manual step. |
| R5 | low | Dependabot | Add `groups` and a `commit-message` prefix compatible with commitlint. `reviewers` in dependabot.yml is deprecated by GitHub: use a CODEOWNERS file. | fixed | Commit-message prefixes, groups added; reviewers replaced by CODEOWNERS. |
| R6 | low | .gitignore | Lacks `.DS_Store`, `.env*`, `coverage/`; ignoring `*.map` is debatable. | fixed | `.DS_Store` added, `*.map` removed; `.env*` and `coverage/` deliberately not added. |
| R7 | low | hooks | No `pre-push` hook running `npm test`. | wontfix (low value) | Tests are fast and CI already runs them on ubuntu, macOS and Windows; a pre-push hook is bypassable with --no-verify and only slows pushes. |
| R8 | medium | .github/workflows/ci.yml | Actions not pinned by SHA in the `publish` job (has `id-token: write`); no `concurrency`, no `timeout-minutes`; `actions: read` unused. | fixed | actions pinned by SHA, `concurrency` and `timeout-minutes` added, `actions: read` removed. |
| R9 | medium | .github/workflows/ci.yml | Tests only on ubuntu; the CLI runs on dev machines (macOS/Windows). Add an OS matrix (relates to T4). | fixed | test job runs on ubuntu, macOS and Windows (Node 24, `fail-fast: false`); Windows/macOS runs not verified locally. |
| R10 | low | CI | Commit format only enforced by the local husky hook (bypassable with `--no-verify`); semantic-release silently ignores non-conforming commits. Add commitlint in CI. | open | |
| D1 | - | README.md | Gained Update, Troubleshooting and git guard security-model sections. | fixed | 2afea10 |
| D2 | - | CONTRIBUTING.md, SECURITY.md | Not written. | wontfix | The user declined them. |
| N1 | medium | src/detect.js, src/install.js | `packageManager` of package.json (and free-text answers such as the language) were substituted verbatim into `settings.json`: a crafted value could add an `allow` permission rule or break the JSON. | fixed | Only npm, pnpm, yarn and bun are accepted (declared field and stored answer, otherwise treated as undetected); values rendered into `.json` files are JSON-escaped; tests added. |
| N2 | medium | templates/web/.claude/hooks/git-guard.mjs | Guard bypass for git-operator: `env git`, `command git`, `/usr/bin/git`, `(git ...)`, `{ git ...; }`, `then`/`do` bodies, `time`, `sudo` and `git $(echo commit)` return no decision. | fixed | Segments now skip grouping, keywords and wrappers (`env`, `command`, `sudo`, `time`...), `git` may be a path, and a dynamic subcommand is unknown (ask or deny). |
| N3 | medium | templates/web/.claude/hooks/git-guard.mjs | git-operator is blacklist-based: `tag -d`, `update-ref -d`, `filter-branch`, `reflog expire`, `gc --prune`, `worktree remove` and aliases like `git ci` are allowed. Propose an allow-list of known write subcommands and `ask` for the rest. | fixed | Allow-list (SAFE) for git-operator, others `ask`; ref/history deletions denied. |
| N4 | low | templates/web/.claude/hooks/git-guard.mjs | False positives denied for the main session: `git tag`, `rev-list`, `merge-base`, `for-each-ref`, `reflog`, `ls-remote`, `show-ref`, `fetch`, `branch --list x`. | fixed | Added to READ or handled by arguments in writes(). |
