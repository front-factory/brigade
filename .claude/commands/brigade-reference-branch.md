---
description: Lift or restore the git guard's protection of the reference branch for you only (local, not committed)
allowed-tools: Read, Write, Edit
---

`/brigade-settings` now covers all personal settings in one command; this command stays available.

The project protects its default branch and its reference branch (both named in `.claude/rules/brigade-options.md`). Ask the developer one question: keep the reference branch protected as the project does, or lift its protection for them only? The default branch stays protected either way. This only applies when the reference branch differs from the default branch; if they are the same branch, it stays protected as the default branch and the setting has no effect.

- **Keep**: remove `BRIGADE_UNPROTECT_REFERENCE_BRANCH` from the `env` key of `.claude/settings.local.json` if it is there (drop `env` if it ends up empty).
- **Lift**: set `BRIGADE_UNPROTECT_REFERENCE_BRANCH` to `"1"` in the `env` key of `.claude/settings.local.json`.

Read the file first and keep every other key, including the other entries of `env`. Create it if it does not exist. Only change that variable. Tell the developer what was written, that the shared project files were not touched, and that the session must be restarted for an `env` change to apply. Pushes, merges, rebases and destructive commands are still confirmed or denied as before.
