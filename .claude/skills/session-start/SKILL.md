---
name: session-start
description: "Use before the first coding task of a session (not for plain questions)."
---

The SessionStart hook already gave you the branch, the sync with upstream, the feature file of the branch (goal and steps) and any stale feature file. Read only what it did not give: `CLAUDE.local.md` (personal preferences) and the rest of the feature file if needed.

- **Feature file present**: report in 2-3 lines the goal, what is done, the next step. Resume check (see `feature`): new commits on the reference branch (`git log HEAD..<base> --oneline`) and conflict risk, changes to `.claude/context/decisions.md` since the saved date, open audit rows. Ask whether to continue or start something new; do not code before the user confirms.
- **No file**: report the branch and the sync only. Create nothing.
- Behind, no upstream or unpushed commits: say so and propose the push in one sentence.
- Stale feature file reported by the hook: tell the user and propose removing it.
