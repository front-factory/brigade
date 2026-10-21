# brigade

[![Version](https://flat.badgen.net/npm/v/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)
[![Downloads](https://flat.badgen.net/npm/dt/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)
[![License](https://flat.badgen.net/npm/license/@frontfactory/brigade)](https://www.npmjs.com/package/@frontfactory/brigade)

Sets up a Claude Code architecture in any project, new or existing, without fuss.

```sh
npx @frontfactory/brigade init
```

## What you get

Three roles, each limited to its mission:

| Role | Model (default effort) | Mission |
|---|---|---|
| Main session | Opus in Plan Mode (medium) | Discuss, think, orchestrate, verify, propose, answer. Goes back and forth with the subagents. |
| `implementer` | Sonnet (medium) | Development, nothing else. |
| `git-operator` | Haiku (low) | Git, nothing else, once the work is done. |

Plus base rules for work, security and efficiency, adapted to the stack (web for now). The setup is shared with the
project and committed with it. Each developer can override their own effort locally with `/brigade-effort`.

The rest of the kit, all under `.claude/`:

- Skills: `session-start` (where things stand before the first task), `feature` (branch + state file for multi-step work),
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

When Brigade is already installed, `init` asks whether to keep the installed version or update to the one you run. On
the same version it offers to change your options (the questions are asked again, files only change if an answer
does) or to leave everything as it is. Without a terminal, it updates.

An existing file is never overwritten. If it differs from the kit, a `.proposed` file is written next to it; if it is
identical, nothing happens. A file Brigade wrote and nobody touched is updated. `.gitignore` and `.gitattributes` only
get the lines they miss. `.claude/context/decisions.md` is written once and then belongs to the team: it is never
updated nor proposed over.

## Git

Only `git-operator` writes to git, enforced by a hook. Writing on the default or reference branch, `push`, `merge` and
`rebase` ask for confirmation; destructive commands are denied. Brigade proposes a commit once a piece of work is
finished and never commits without your go.

A feature (work over several steps or sessions) gets its own branch and a state file `.claude/context/features/<branch>.md` (slashes become dashes), committed with the branch, so
the work survives between developers and machines. `CLAUDE.local.md` stays personal.

## Add a stack

Create `templates/<name>/` with the same layout as `templates/web/`, then add one entry in `src/stacks.js`. Placeholders:
`__DEFAULT_BRANCH__`, `__BASE_BRANCH__`, `__PACKAGE_MANAGER__`, `__COMMIT_FORMAT__`, `__REPLY_LANGUAGE__`,
`__CODE_LANGUAGE__`, `__DOCS_LANGUAGE__`.

## Develop

`npm test` runs the tests (`node --test`, no dependency). Commits follow Conventional Commits, checked by commitlint. Node >= 24 is required.

Releases are automatic: on a push to `main` or `beta`, once the tests pass, the CI runs semantic-release, which
derives the version from the commits, updates the changelog and publishes `@frontfactory/brigade` to npm.
