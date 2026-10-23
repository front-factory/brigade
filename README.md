# brigade

[![Version](https://flat.badgen.net/npm/v/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)
[![Downloads](https://flat.badgen.net/npm/dt/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)
[![License](https://flat.badgen.net/npm/license/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)

Claude Code, organized like a kitchen brigade.

Brigade sets up a Claude Code architecture in any web project, new or existing, without fuss: a main session that
thinks and orchestrates, an `implementer` that writes the code and a `git-operator` that handles git, each limited to
its mission, with guardrails built in.

```sh
npx @frontfactory/brigade init
```

## What you get

Three roles, each limited to its mission:

| Role           | Model (default effort)     | Mission                                                                                       |
|----------------|----------------------------|-----------------------------------------------------------------------------------------------|
| Main session   | Opus in Plan Mode (medium) | Discuss, think, orchestrate, verify, propose, answer. Goes back and forth with the subagents. |
| `implementer`  | Sonnet (medium)            | Development, nothing else.                                                                    |
| `git-operator` | Haiku (low)                | Git, nothing else, once the work is done.                                                     |

Plus base rules for work, security and efficiency, adapted to the stack (web for now). The setup is shared with the
project and committed with it. Each developer can override their own effort locally with `/brigade-effort`.

The rest of the kit, all under `.claude/`:

- Skills: `session-start` (where things stand before the first task), `feature` (branch + state file for multi-step
  work), `audit` (keep an audit file between sessions).
- Commands: `/brigade-effort` (your effort per role), `/brigade-language` (your reply language) and
  `/brigade-reference-branch` (lift the git guard's protection of the reference branch for you only), all local and
  not committed.
- Shared context in `context/`: `decisions.md` (team decisions), `architecture.md` (optional, read on demand), one
  state file per feature in `context/features/`, audits in `context/audits/`.
- A git guard hook (`hooks/git-guard.mjs`) and the permissions in `settings.json`. The guard protects the default branch
  and the reference branch. To lift the latter for yourself only, run `/brigade-reference-branch`: it sets
  `BRIGADE_UNPROTECT_REFERENCE_BRANCH=1` under `env` in `.claude/settings.local.json` (git-ignored). Restart the session
  after the change. The default branch stays protected, and push, merge, rebase and destructive commands are unchanged.
- A status line (`hooks/statusline.mjs`) showing `Brigade v<version> · <branch>`, and a `SessionStart` hook
  (`hooks/session-start.mjs`) that tells the session which Brigade version manages the project. Both only read
  `.claude/brigade.json` and `.git/HEAD`.
- A launcher (`hooks/run-node.sh`) that runs the hooks even when `node` is not on the PATH of the non-interactive shell
  (nvm, fnm, volta, asdf). If node is nowhere to be found, the hook is skipped with a message and the session goes on.

## Install

Run `npx @frontfactory/brigade init` in your project. Here is what happens:

1. `init` detects the default branch, the package manager, the commit convention and the language, then shows what
   will be set up in one card.
2. You choose "Install as is" (the default) or "Customize" to answer every option one by one. An option that cannot
   be detected is asked even in the express path.
3. After "Customize", or when something had to be asked, a recap is shown before anything is written. "Everything is
   right" installs. "Change something" lets you pick the groups to redo (branches, package manager, commit format,
   languages) and shows the recap again.
4. Cancelling writes nothing.

There are two language questions: the language of Claude's replies, then the language of code and docs together, or
"Different for code and docs" to choose each apart. Customize also asks your own reply language, which stays on your
machine.

Options:

- `--yes` (or `-y`) accepts everything detected.
- `--stack <name>` forces the stack instead of detecting it (only `web` for now).
- `--dry-run` prints what an install or update would do, asks nothing and writes nothing (not even
  `.claude/brigade.json`). It also lists the lines it would add to `.gitignore` and `.gitattributes`.

Brigade never touches your `CLAUDE.md`: its instructions live in `.claude/rules/brigade.md`, which Claude Code loads
at launch like a `CLAUDE.md`.

An existing file is never overwritten silently:

- A file Brigade wrote and nobody touched is updated.
- If you edited a file and the kit changed it since your last install, your file is kept and the kit's version is
  written to a `.proposed` next to it (see Update).
- If the kit did not change the file, nothing happens.
- `.gitignore` and `.gitattributes` only get the lines they miss.
- `.claude/context/decisions.md` and `.claude/context/architecture.md` are written once and then belong to the
  project: they are never updated nor proposed over.

## Update

Re-run `npx @frontfactory/brigade init`.

When Brigade is already installed, `init` asks whether to keep the installed version or update to the one you run.
Without a terminal, it updates. In a terminal, an update first lists what it will do (files added, updated, merged,
removed, kept with a proposal) and asks you to confirm before anything is written. Declining writes
nothing.

- Updating does not repeat the setup: your answers stored in `.claude/brigade.json` are reused and only the options
  the new version added are asked (your personal reply language is not one of them).
- A downgrade does the same and keeps the answers the older version does not know.
- On the same version, `init` offers to change your options (every question is asked again, files only change if an
  answer does) or to leave everything as it is.

### What happens to your files

Kit files you never touched are updated. A file you edited is never overwritten.

- The kit did not change the file since your last install: your file is left alone and nothing is proposed.
- The kit changed the file: your file is kept as it is, and the whole new kit file is written to `<file>.proposed`. Diff
  the two, take what you want, then delete the `.proposed`. There is no merge and no conflict marker. The proposal is
  written once per kit change: Brigade then counts that kit version as seen, so the next updates stay silent, do not
  rewrite the `.proposed` and do not recreate it if you delete it. It stays on disk as a reminder until you delete it,
  and is refreshed only if the kit changes the file again.
- You deleted a kit file: it is recreated at the next update, as the entries of `settings.json` are.

A file the kit no longer ships is reported. If it is still exactly what Brigade wrote, it is removed (and the
directories it leaves empty); if you edited it, it is kept and reported again at each update until you delete it.
Brigade only ever removes files recorded in `.claude/brigade.json`.

### Old base copies

Brigade 1.3.0 kept a copy of each kit file in `.claude/brigade-base/`. Nothing uses it anymore: every update removes
that folder if it exists (the update preview and `--dry-run` list it as removed, a dry run leaves it in place). Only
that exact folder is removed. If you committed it, commit its removal.

### Older installs

Older installs had your options written inside `.claude/rules/brigade.md`. They now live in the generated
`.claude/rules/brigade-options.md`, and `brigade.md` is pure kit. If you never edited your `brigade.md`, it is updated
silently. If you did (or the manifest is lost), a `brigade.md.proposed` is written with a note: merge it, or delete
your edits and re-run.

### settings.json

`.claude/settings.json` is merged by keys instead of being proposed as a whole file:

- Your additions stay, and your own values win.
- The entries the kit adds (permissions, hooks) are appended, and nothing is duplicated.
- An entry the kit removed or changed (a hook command, for instance) is not removed from your file: a changed hook
  command is added next to the old one. Remove the old entry yourself.
- An entry you deleted on purpose comes back at the next update.
- If the file is not valid JSON, a `settings.json.proposed` is written as for any other file.

### Changing your options and the manifest

To change your options on purpose, run `init` again on the same version and choose "Change my options" (see Install).

Brigade records what it did in `.claude/brigade.json`: its version, your answers and the sha256 of each file it wrote.
That is how it tells an untouched file from an edited one. Do not edit it by hand. Commit it with the rest of
`.claude/`: the install is shared by the whole team, and anyone can then update it from any machine.

## Troubleshooting

- `Unknown stack` or `Unknown option` from `init`: only `--yes` (`-y`), `--dry-run` and `--stack <name>` exist, and
  `web` is the only stack for now. Run `npx @frontfactory/brigade --help` to see the usage.
- `.proposed` files keep coming back: a proposal is written once per kit change, then stays until you delete it. Later
  updates neither rewrite nor recreate it unless the kit changes that file again. Once you have merged what you want,
  delete the `.proposed`.
- `.claude/brigade-base/` disappeared after an update: that is the cleanup of the folder Brigade 1.3.0 used. Commit the
  removal.
- No terminal (CI, pipe): nothing is asked. `init` behaves like `--yes`: a new install accepts every detected answer, an
  existing install is updated with its stored answers, and a new option gets its detected or default value. The run
  prints one line naming the new options and the value used; it never fails for that.
- `init` failed while writing (disk full, a path blocked by a file...): writes are not atomic. The files already
  written stay, and `.claude/brigade.json` still holds the previous install. Fix the cause and run `init` again: it
  converges (a file already matching the kit is seen as unchanged and the manifest is corrected).
- "No git repository" warning: run `git init` yourself. Brigade never creates a repository.
- A broken `.claude/settings.local.json` (invalid JSON) is left untouched, so your personal language is not written
  there. Fix the file and run `init` again.

## Security model of the git guard

The hook (`templates/web/.claude/hooks/git-guard.mjs`, PreToolUse on Bash) is a safety net against mistakes, not a
security boundary. It parses the text of the command, so it can miss indirect forms: subshells, `bash -c`, aliases,
scripts. The real protections are the `permissions` in `settings.json` and branch protection on the remote.

"Never read or write secrets" is a rule given to Claude, not an enforcement, beyond the `deny` `Read` rules in
`settings.json`.

## Git

Only `git-operator` writes to git, enforced by a hook. Writing on the default or reference branch, `push`, `merge` and
`rebase` ask for confirmation; destructive commands are denied. Brigade proposes a commit once a piece of work is
finished and never commits without your go.

A feature (work over several steps or sessions) gets its own branch and a state file
`.claude/context/features/<branch>.md` (slashes become dashes), committed with the branch, so
the work survives between developers and machines. `CLAUDE.local.md` stays personal.

## Add a stack

Create `templates/<name>/` with the same layout as `templates/web/`, then add one entry in `src/stacks.js`.
Placeholders:
`__DEFAULT_BRANCH__`, `__BASE_BRANCH__`, `__PACKAGE_MANAGER__`, `__COMMIT_FORMAT__`, `__REPLY_LANGUAGE__`,
`__CODE_LANGUAGE__`, `__DOCS_LANGUAGE__`. Do not use them in `.claude/rules/brigade.md`: it stays pure kit, and the
answers reach it through `.claude/rules/brigade-options.md`, which Brigade generates from the answers (see
`renderOptions` in `src/install.js`).

## Develop

`npm test` runs the tests (`node --test`, no dependency). Commits follow Conventional Commits, checked by commitlint.
Node >= 24 is required.

The CI runs the tests on every push to `main`, `develop` and `beta`, and on pull requests to these branches.

Releases are automatic: on a push to `main` or `beta` (not `develop`, not pull requests), once the tests pass, the CI
runs semantic-release, which derives the version from the commits, updates the changelog and publishes
`@frontfactory/brigade` to npm.
