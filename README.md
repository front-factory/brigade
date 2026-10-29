# brigade

[![Version](https://flat.badgen.net/npm/v/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)
[![Downloads](https://flat.badgen.net/npm/dt/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)
[![License](https://flat.badgen.net/npm/license/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)

Claude Code, organized like a kitchen brigade.

Brigade sets up a Claude Code architecture in any web project, new or existing, without fuss.

```sh
npx @frontfactory/brigade init
```

You are the chef de cuisine, and this is your kitchen. You decide the menu and have the last word, but you don't stand
at the stove. The sous-chef (the main session) takes your orders, briefs the cooks and tastes every plate. A chef de
partie writes the code. At the pass, the counter between the kitchen and the dining room, the expediter handles git: it
checks the plate and sends it out, only when you say go. Everybody stays at their station, with guardrails built in.

## What you get

Three roles, each limited to its mission:

| In the kitchen | Brigade role   | Model (default effort)     | Mission                                                                                                                       |
|----------------|----------------|----------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Sous-chef      | Main session   | Opus (medium) | Discusses, plans, orchestrates, verifies, proposes. Goes back and forth with the subagents; never writes code or touches git. |
| Chef de partie | `implementer`  | Sonnet (medium)            | Writes the code, as briefed. Nothing else.                                                                                    |
| Expediter      | `git-operator` | Haiku (low)                | Handles git, once the work is done and you said go.                                                                           |

Plus base rules for work, security and efficiency, adapted to the stack (web for now). The setup is shared with the
project and committed with it. The rest of the kit, all under `.claude/`:

- Skills: `session-start`, `feature` (branch + state file for multi-step work), `audit`.
- Commands: `/brigade-settings` sets your reply language, your effort per role and the reference-branch protection, all
  local.
- Shared context in `context/`: `decisions.md`, `architecture.md` (optional), features and audits.
- A git guard hook, a status line, a `SessionStart` hook and a launcher that finds `node` (nvm, fnm, volta, asdf).
- `settings.json` permissions.

The guard protects the default branch and the reference branch. To lift the latter for yourself only, run
`/brigade-settings`: it sets `BRIGADE_UNPROTECT_REFERENCE_BRANCH=1` in `.claude/settings.local.json`. Restart the session.

For a personal effort per role (`implementer`, `git-operator`), copy `.claude/context/local-template.md` to
`CLAUDE.local.md` at the project root (git-ignored), or let `/brigade-settings` write it.

## Install

Run `npx @frontfactory/brigade init` in your project:

1. `init` detects the default branch, the package manager, the commit convention, then shows what will be set up.
2. You choose "Install as is" (the default) or "Customize" to answer every option. An option that cannot be detected is
   asked even in the express path.
3. After "Customize", or when something had to be asked, a recap is shown before anything is written. "Everything is
   right" installs; "Change something" lets you redo groups of options.
4. Cancelling writes nothing.

Replies are in English unless you choose another language (it is not guessed from your locale). The language of code and
docs is asked next, together or apart. Customize also asks your own reply language, which stays on your machine.

Options:

- `--yes` (or `-y`) accepts everything detected.
- `--stack <name>` forces the stack instead of detecting it (only `web` for now).
- `--dry-run` prints the install plan, asks nothing, writes nothing, and exits with code 0.
- `--version` (or `-v`) prints the version, `--help` (or `-h`) the usage.

Brigade never touches your `CLAUDE.md`: its rules live in `.claude/rules/brigade.md`, which Claude Code loads at launch.

## Update

Re-run `npx @frontfactory/brigade init`. When Brigade is already installed, `init` asks whether to keep the installed
version or update. Without a terminal (CI, pipe) nothing is asked and `init` behaves like `--yes`: a new option gets its
detected or default value, and one line names it.

- Your answers stored in `.claude/brigade.json` are reused; only the options the new version added are asked.
- On the same version, `init` offers "Change my options" or leaving everything as it is.

What happens to your files:

- Files you never touched are updated. An edited file is never overwritten: if the kit changed it, the new kit version
  is written to `<file>.proposed`, once per kit change. It stays until you delete it and is not recreated or rewritten
  unless the kit changes that file again. Diff, take what you want, delete it.
- A kit file you deleted is recreated.
- A file the kit no longer ships is removed if untouched, otherwise kept and reported at each update.
- `.claude/settings.json` is merged by keys: your values win and nothing is duplicated. A kit entry removed or changed
  is not removed from your file; remove the old one yourself.
- `decisions.md` and `architecture.md` are written once and then belong to you.
- `.gitignore` and `.gitattributes` only get the lines they miss.

`.claude/brigade.json` records the version, your answers and the sha256 of each file written. Commit it, do not edit it.

## Uninstall

Run `npx @frontfactory/brigade uninstall`. It lists what it will do and asks before removing anything.

- Removed: every kit file you never edited, their leftover `.proposed` files, `.claude/rules/brigade-options.md` and
  `.claude/brigade.json` (last), then the folders left empty.
- Kept and reported (delete them yourself): kit files you edited, and `decisions.md` or `architecture.md` once they
  differ from the template.
- `.claude/settings.json`: the kit's entries are removed, yours stay. The file is deleted if nothing of yours is left.
- Never touched: `CLAUDE.md`, `CLAUDE.local.md`, `.claude/settings.local.json`, your features and audits. The lines
  Brigade added to `.gitignore` and `.gitattributes` stay: remove them yourself if you want.
- `--dry-run` prints the plan and writes nothing. Without a terminal, `--yes` is required.

Removed files remain in your git history.

## Troubleshooting

- `Unknown stack` or `Unknown option`: run `npx @frontfactory/brigade --help`.
- `.proposed` files keep coming back: see Update.
- `init` failed while writing: files are replaced atomically one by one. Fix the cause and rerun: it converges, and the
  manifest still holds the previous install.
- "No git repository" warning: run `git init` yourself. A broken `.claude/settings.local.json` is left untouched: fix it
  and rerun.

## Git guard

The hook (`templates/web/.claude/hooks/git-guard.mjs`, PreToolUse on Bash) is a safety net, not a security boundary. It
parses the text of the command, so it can miss subshells, `bash -c`, aliases and scripts. The real protections are the
`permissions` in `settings.json` and branch protection on the remote. "Never read or write secrets" is a rule given to
Claude, not an enforcement, beyond the `deny` `Read` rules.

The hooks run through a launcher that looks for `node`. If it finds none, it fails open: the guard is off for the
session, and Claude Code shows a "node was not found" warning when a hook runs. Add `node` to the PATH of
non-interactive shells and restart.

Only `git-operator` writes to git. `push`, `merge` and `rebase` ask for confirmation, destructive commands are denied.
Brigade proposes a commit once the work is finished and never commits without your go. A feature gets its own branch
and a state file `.claude/context/features/<branch>.md` (slashes become dashes), committed with the branch.

## Add a stack

Create `templates/<name>/` with the same layout as `templates/web/`, then add one entry in `src/stacks.js`.
Placeholders: `__DEFAULT_BRANCH__`, `__BASE_BRANCH__`, `__PACKAGE_MANAGER__`, `__COMMIT_FORMAT__`, `__REPLY_LANGUAGE__`,
`__CODE_LANGUAGE__`, `__DOCS_LANGUAGE__`. Do not use them in `.claude/rules/brigade.md`: it stays pure kit, and the
answers reach it through `.claude/rules/brigade-options.md` (see `renderOptions` in `src/install.js`).

## Develop

`npm test` runs the tests (`node --test`), `npm run test:coverage` adds the coverage report. Commits follow Conventional Commits, checked by commitlint. Node >= 24.

The CI runs the tests on pushes and pull requests to `main`, `develop` and `beta`. On a push to `main` or `beta`,
semantic-release derives the version from the commits, updates the changelog and publishes to npm.
