---
name: feature
description: "Use once the user accepts a feature, and when pausing, handing off, ending, resuming or finishing one."
---

A feature = work with several steps, sessions or files. Only features get a branch and a state file. Small work has no branch requirement, no file, no handoff: it ends with a commit proposal on the current branch (the protected branches of `.claude/rules/brigade-options.md` still need the user's confirmation).

- **Detection**: see `brigade.md` (Git). The answer is yes / no / "small work".
- **Yes**: `git-operator` creates the branch (with the user's go), named `type/short-description` (e.g. `feat/login`). Create the file at once from `.claude/context/features/_template.md` with the goal and the planned steps, in `.claude/context/features/`. File name: the branch with slashes as dashes (`feat/login` -> `feat-login.md`).
- **No / small work**: continue on the current branch, no file, do not ask again. If it grows into a feature, tell the user and re-propose.
- **During**: `implementer` updates the file at important steps.
- **Pause / handoff / end of session**: have `implementer` bring the file up to date, propose the commit, then the push (see `brigade.md`).
- **Resume**: `session-start` reads the file and runs the resume check.
- **End**: remove the file in the last commit before the branch is merged.
- The file travels with the branch (shared between developers and machines). `CLAUDE.local.md` stays personal.
