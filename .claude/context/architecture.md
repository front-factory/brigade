# Architecture

<!-- Optional. Not loaded by default: read on demand. Keep it short. -->

## Overview

Brigade is a Node CLI (`npx @frontfactory/brigade`) that installs a Claude Code kit into a project: agents, skills, commands, rules, a git guard hook and settings. Node >= 22.

Layout:
- `bin/brigade.js`: executable entry, checks the Node version, calls `main` from `src/cli.js`.
- `src/cli.js`: argument parsing, command dispatch, output.
- `src/detect.js`: detects git repo, default branch, package manager, commit convention, checks.
- `src/options.js`: the options (detect, ask, recap, validate) and the stored answers.
- `src/kit.js`: the stack registry (`templates/<stack>/`), stack detection (default: `web`) and the kit file list.
- `src/render.js`: placeholders and `renderOptions` (builds `brigade-options.md`).
- `src/install.js`: install and update: plan, file states, settings merge, manifest, appended lines.
- `src/uninstall.js`: removal of untouched kit files and kit entries.
- `src/prompt.js`, `src/ui.js`: prompts (`@clack/prompts`, non-interactive mode) and output tables.
- `templates/web/`: the kit, copied as is into the project (same relative paths) with placeholders rendered.
- `test/`: `node:test` suites: `contract/` (black-box CLI and guard), `unit`, `kit`, `guard`, `dogfood`, `pack`, `run-node`.
- `.claude/`: this repo's own install, the rendered copy of `templates/web/`.

Init flow (`init`):
1. Detect the stack and read the manifest `.claude/brigade.json` if any.
2. If already installed, ask: update or keep (keep writes nothing).
3. Resolve the options (detected first, previous answer wins; only new ones are asked on update).
4. Plan the kit files, then write them atomically, one by one.
5. Write the manifest (version, stack, answers, file hashes) last, plus the `.gitignore` and `.gitattributes` lines.
6. Store the personal reply language in `.claude/settings.local.json`.

File states:
- `created`: the target does not exist.
- `unchanged`: the target already equals the rendered content.
- `updated`: the target equals what Brigade last wrote (manifest hash), so it is overwritten.
- `proposed`: the target was edited, so the new content goes to `<file>.proposed`.
- `kept`: write-once file (`decisions.md`, `architecture.md`) that exists and differs: never touched.
- `obsolete`: a file the kit no longer ships: removed if untouched, otherwise kept and reported.

## Conventions

- ES modules, 4-space indent, single quotes, short English comments.
- A new stack = a folder in `templates/` plus one entry in the registry of `src/kit.js`.
- Changing `templates/web/` means re-rendering the same change in `.claude/` (the dogfood test fails otherwise).
- The v1 contract (commands, flags, `.claude/` paths, manifest) is frozen by `test/contract/`.
