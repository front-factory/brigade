---
name: feature
description: "Use once the user accepts a feature, and when pausing, handing off, ending, resuming or finishing one."
---

A feature = work with several steps, sessions or files. Only features get a branch and a state file. Small work (a fix, a doc tweak, a few files, one sitting) has no branch requirement, no file, no handoff: it ends with a commit on the current branch (`main` and `develop` still need the user's confirmation).

- **Detection**: see the rule in `brigade.md` (Git). The proposal is a branch `feat/<name>` + state file; the answer is yes / no / "small work".
- **Yes**: `git-operator` creates the branch (with the user's go). Create the file at once from `.claude/context/features/_template.md` with the goal and the planned steps. File name: the branch with slashes as dashes (`feat/login` -> `feat-login.md`), in `.claude/context/features/`.
- **No / small work**: continue on the current branch, no file, do not ask again for that work. If it grows into a feature, tell the user and re-propose.
- **During the feature**: `implementer` updates the file at important steps.
- **Pause / handoff / end of session**: make sure the file is up to date (have `implementer` fix it), propose the commit, then the push (see `brigade.md`, Git).
- **Resume**: `session-start` reads the file and reports it, then runs the resume check: new commits on the base branch (`git log HEAD..<base> --oneline`) and conflict risk, changes to `.claude/context/decisions.md` since the saved date, audit rows still open.
- **End**: remove the file in the last commit before the branch is merged.
- The file is versioned with the branch, so it is shared between developers and machines. `CLAUDE.local.md` stays personal.
