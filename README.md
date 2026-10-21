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

`init` detects the default branch, the package manager, the commit convention and the language, and asks you to
validate each one. `--yes` (or `-y`) accepts everything detected. `--stack <name>` forces the stack instead of
detecting it (only `web` for now).

Brigade never touches your `CLAUDE.md`: its instructions live in `.claude/rules/brigade.md`, which Claude Code loads
at launch like a `CLAUDE.md`.

When Brigade is already installed, `init` asks whether to keep the installed version or update to the one you run.
Updating does not repeat the setup: your answers stored in `.claude/brigade.json` are reused and only the options the
new version added are asked (your personal reply language is not one of them). A downgrade does the same and keeps the
answers the older version does not know. On the same version it offers to change your options (every question is asked
again, files only change if an answer does) or to leave everything as it is. Without a terminal, it updates.

An existing file is never overwritten. If it differs from the kit, a `.proposed` file is written next to it; if it is
identical, nothing happens. A file Brigade wrote and nobody touched is updated. `.gitignore` and `.gitattributes` only
get the lines they miss. `.claude/context/decisions.md` and `.claude/context/architecture.md` are written once and then
belong to the
project: they are never updated nor proposed over.

## Update

Re-run `npx @frontfactory/brigade init`. Kit files you never touched are updated. A file you edited is left as it is
and a `<file>.proposed` is written next to it: diff it, merge what you want, then delete the `.proposed`.

Older installs had your options written inside `.claude/rules/brigade.md`. They now live in the generated
`.claude/rules/brigade-options.md`, and `brigade.md` is pure kit. If you never edited your `brigade.md`, it is updated
silently. If you did (or the manifest is lost), a `brigade.md.proposed` is written with a note: merge it, or delete
your edits and re-run.

To change your options on purpose, run `init` again on the same version and choose "Change my options" (see Install).

Brigade records what it did in `.claude/brigade.json`: its version, your answers and the sha256 of each file it wrote.
That is how it tells an untouched file from an edited one. Do not edit it by hand. Commit it with the rest of
`.claude/`:
the install is shared by the whole team, and anyone can then update it from any machine.

## Troubleshooting

- `Unknown stack` or `Unknown option` from `init`: only `--yes` (`-y`) and `--stack <name>` exist, and `web` is the only
  stack for now. Run `npx @frontfactory/brigade --help` to see the usage.
- `.proposed` files keep coming back: a proposal is rewritten only when the kit changed since the last one. Once you
  have
  merged what you want, delete the `.proposed`.
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
