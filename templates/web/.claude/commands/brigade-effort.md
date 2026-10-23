---
description: Set your own effort for the main session and the subagents (local, not committed)
allowed-tools: Read, Write, Edit
---

`/brigade-settings` now covers all personal settings in one command; this command stays available.

Ask the developer, in one question, which role and which level they want (`low`, `medium`, `high`):

- **main session**: set `effortLevel` in `.claude/settings.local.json`.
- **implementer** or **git-operator**: write the line `Effort for <role>: <level>` in `CLAUDE.local.md`, replacing the existing line for that role if there is one.

Read the file first and keep everything else in it. Create it if it does not exist. Only change the effort. Tell the developer what was written and that the shared project files were not touched.
