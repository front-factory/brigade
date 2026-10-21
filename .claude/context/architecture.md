# Architecture

<!-- Optional. Not loaded by default: read on demand. Keep it short. -->

## Overview

Brigade is a Node CLI (`npx @frontfactory/brigade`) that installs a Claude Code kit into a project: agents, skills, commands, rules, a git guard hook and settings.

Layout:
- `bin/brigade.js`: executable entry, calls `main` from `src/cli.js`.
- `src/cli.js`: argument parsing, output summary.
- `src/init.js`: `runInit`, the whole init flow and its questions.
- `src/detect.js`: detects git repo, default branch, package manager, commit convention, language.
- `src/stacks.js`: registry of stacks (`templates/<stack>/`) and stack detection (default: `web`).
- `src/conventions.js`: commit conventions and their `format` text.
- `src/install.js`: rendering, file installation, manifest, appended lines, local settings.
- `src/prompt.js`: prompts (`@clack/prompts`), with a non-interactive mode that takes the first option.
- `src/version.js`: package version and `compareVersions`.
- `templates/web/`: the kit, copied as is into the project (same relative paths) with placeholders rendered.
- `test/`: `node:test` suites (`install`, `guard`, `dogfood`).
- `.claude/`: this repo's own install, the rendered copy of `templates/web/`.

Init flow (`runInit`):
1. Detect the stack and read the manifest `.claude/brigade.json` if any.
2. If already installed, ask: update or keep (keep writes nothing).
3. Ask the answers (each one detected first, previous answer wins).
4. `installFiles` renders and writes the kit.
5. `writeManifest` stores version, stack, answers and file hashes.
6. `appendMissingLines` adds the Claude lines to `.gitignore` and `.gitattributes`.
7. `writeLocalSettings` stores the personal reply language in `.claude/settings.local.json`.

File states (`installFiles`):
- `created`: the target does not exist.
- `unchanged`: the target already equals the rendered content.
- `updated`: the target equals what Brigade last wrote (manifest hash), so it is overwritten.
- `proposed`: the target was edited, so the new content goes to `<file>.proposed`.
- `kept`: write-once file (`.claude/context/decisions.md`) that exists and differs: never touched.

Placeholders: `__DEFAULT_BRANCH__`, `__BASE_BRANCH__`, `__PACKAGE_MANAGER__`, `__COMMIT_FORMAT__`, `__REPLY_LANGUAGE__`, `__CODE_LANGUAGE__`, `__DOCS_LANGUAGE__`. Unknown ones are left as is.

## Conventions

- ES modules, 4-space indent, single quotes, short English comments.
- A new stack = a folder in `templates/` plus one entry in `src/stacks.js`.
- Changing `templates/web/` means re-rendering the same change in `.claude/` (the dogfood test fails otherwise).
