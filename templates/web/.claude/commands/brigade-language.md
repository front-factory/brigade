---
description: Choose the language of Claude's replies for you only (local, not committed)
allowed-tools: Read, Write, Edit
---

`/brigade-settings` now covers all personal settings in one command; this command stays available.

The project sets a default reply language in `.claude/settings.json` (key `language`). Read it, then ask the developer one question: keep the project language, or use their own?

- **Keep**: remove the `language` key from `.claude/settings.local.json` if it is there.
- **Their own**: ask which language, then set `language` in `.claude/settings.local.json`.

Read the file first and keep every other key. Create it if it does not exist. Only change `language`. Tell the developer what was written and that the shared project files were not touched.
