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
  work),
  `audit` (keep an audit file between sessions).
- Commands: `/brigade-effort` (your effort per role) and `/brigade-language` (your reply language), both local and
  not committed.
- Shared context in `context/`: `decisions.md` (team decisions), `architecture.md` (optional, read on demand), one
  state file per feature in `context/features/`, audits in `context/audits/`.
- A git guard hook (`hooks/git-guard.mjs`) and the permissions in `settings.json`.

## Install

`init` detects the default branch, the package manager, the commit convention and the language, then shows what will
be set up in one card. Choose "Install as is" (the default) or "Customize" to answer every option one by one. An option
that cannot be detected is asked even in the express path. After "Customize", or when something had to be asked, a recap
is shown before anything is written: "Everything is right" installs, "Change something" lets you pick the groups to
redo (branches, package manager, commit format, languages) and shows the recap again. There are two language
questions: the language of Claude's replies, then the language of code and docs together, or "Different for code and
docs" to choose each apart. Customize also asks your own reply language, which stays on your machine. Cancelling writes
nothing. `--yes` (or `-y`) accepts everything detected. `--stack <name>` forces the stack instead of detecting it (only
`web` for now). `--dry-run` prints what an install or update would do, asks nothing and writes nothing (not even
`.claude/brigade.json`), and lists the lines it would add to `.gitignore` and `.gitattributes`.

Brigade never touches your `CLAUDE.md`: its instructions live in `.claude/rules/brigade.md`, which Claude Code loads
at launch like a `CLAUDE.md`.

When Brigade is already installed, `init` asks whether to keep the installed version or update to the one you run.
Updating does not repeat the setup: your answers stored in `.claude/brigade.json` are reused and only the options the
new version added are asked (your personal reply language is not one of them). A downgrade does the same and keeps the
answers the older version does not know. On the same version it offers to change your options (every question is asked
again, files only change if an answer does) or to leave everything as it is. Without a terminal, it updates. In a
terminal, an update first lists what it will do (files added, updated, merged, removed, kept with a proposal or a conflict) and asks
you to confirm before anything is written. Declining writes nothing.

An existing file is never overwritten silently. If you edited a file and the kit changed it since your last install, the
two are merged (see Update): clean merges are applied, conflicts are written to a `.proposed` next to your file. If the kit
did not change the file, nothing happens. A file Brigade wrote and nobody touched is updated. `.gitignore` and
`.gitattributes` only get the lines they miss. `.claude/context/decisions.md` and `.claude/context/architecture.md` are
written once and then belong to the project: they are never updated nor proposed over.

## Update

Re-run `npx @frontfactory/brigade init`. Kit files you never touched are updated. A file you edited is merged with
the kit's changes, line by line, from three versions: the kit file as Brigade last installed it, your file, and the new
kit file.

- Your edits and the kit's changes touch different lines: the merge is applied to your file ("merged, your edits kept").
  Line endings and file mode stay yours.
- They touch the same lines: your file is never touched. A `<file>.proposed` is written with both versions between
  `<<<<<<< yours`, `=======` and `>>>>>>> kit` markers, and the summary warns you. Resolve the markers, copy the result
  into your file, then delete the `.proposed`. The proposal is written once per kit change: Brigade then counts that kit
  version as seen, so the next updates stay silent, do not rewrite the `.proposed` and do not recreate it if you delete
  it. It stays on disk as a reminder until you delete it, and is refreshed only if the kit changes the file again.
- The kit did not change the file: your file is left alone and nothing is proposed.

The kit file as last installed is kept in `.claude/brigade-base/` (one copy per file Brigade manages, under its path
without the leading `.claude/`, e.g. `.claude/brigade-base/rules/brigade.md`, so that no nested `.claude` folder exists). It is the common ancestor of the merge. Commit it with the rest of `.claude/`: it is shared like the
install, and the merge gives the same result on every machine. Do not edit it by hand; it is rewritten by every update
and removed with a file the kit drops. Files written once (`decisions.md`, `architecture.md`) and the generated options
file have none.

Installs made before the base copies existed have no base yet. For those, the first update falls back to a whole-file
`<file>.proposed` for an edited file the kit changed (diff it, merge what you want, delete the `.proposed`), and stores
the new kit version as the base, so the next updates merge (and the proposal is not written again until the kit changes). A base that is missing or unreadable is treated the same way.

Older installs had your options written inside `.claude/rules/brigade.md`. They now live in the generated
`.claude/rules/brigade-options.md`, and `brigade.md` is pure kit. If you never edited your `brigade.md`, it is updated
silently. If you did (or the manifest is lost), a `brigade.md.proposed` is written with a note: merge it, or delete
your edits and re-run.

A file the kit no longer ships is reported. If it is still exactly what Brigade wrote, it is removed (and the
directories it leaves empty); if you edited it, it is kept and reported again at each update until you delete it.
Brigade only ever removes files recorded in `.claude/brigade.json`.

`.claude/settings.json` is merged by keys instead of being merged by lines: your additions stay, the entries the kit
adds (permissions, hooks) are appended, nothing is duplicated and your own values win. An entry the kit removed or
changed (a hook command, for instance) is removed from your file if you did not change it, so a changed hook is
replaced instead of duplicated; an entry you changed stays. An entry you deleted on purpose comes back at the next
update. If the file is not valid JSON, a `settings.json.proposed` is written as for any other file. Without a base
(older install) entries the kit removed or changed are not removed from your file.

To change your options on purpose, run `init` again on the same version and choose "Change my options" (see Install).

Brigade records what it did in `.claude/brigade.json`: its version, your answers and the sha256 of each file it wrote.
That is how it tells an untouched file from an edited one. Do not edit it by hand. Commit it with the rest of
`.claude/`:
the install is shared by the whole team, and anyone can then update it from any machine.

## Troubleshooting

- `Unknown stack` or `Unknown option` from `init`: only `--yes` (`-y`), `--dry-run` and `--stack <name>` exist, and `web` is the only
  stack for now. Run `npx @frontfactory/brigade --help` to see the usage.
- `.proposed` files keep coming back: a proposal is written once per kit change, then stays until you delete it. Later
  updates neither rewrite nor recreate it unless the kit changes that file again. Once you have merged what you want,
  delete the `.proposed`.
- Conflict markers (`<<<<<<< yours`) in a `.proposed`: your edits and the kit changed the same lines. Resolve them,
  copy the result into your file and delete the `.proposed`. Never leave markers in the file itself.
- `.claude/brigade-base/` is missing or was not committed: nothing breaks, the update falls back to a whole-file
  `.proposed` for edited files and recreates the base. Commit it so the team merges the same way.
- No terminal (CI, pipe): nothing is asked. `init` behaves like `--yes`: a new install accepts every detected answer, an
  existing install is updated with its stored answers, and a new option gets its detected or default value. The run
  prints one line naming the new options and the value used; it never fails for that.
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

Releases are automatic: on a push to `main` or `beta`, once the tests pass, the CI runs semantic-release, which
derives the version from the commits, updates the changelog and publishes `@frontfactory/brigade` to npm.
