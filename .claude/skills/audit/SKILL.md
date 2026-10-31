---
name: audit
description: "Use when reporting two or more problems found while reviewing existing code, BEFORE fixing anything, or when resuming an audit."
---

An audit must survive between sessions, machines and developers: it is a committed, shared file.

- Right after the review, BEFORE any fix and before replying with the findings, have `implementer` write `.claude/context/audits/YYYY-MM-DD-topic.md` from `.claude/context/audits/_template.md`: scope, baseline commit (`git rev-parse --short HEAD`), one table row per finding.
- Statuses: `open`, `fixed`, `wontfix` (reason), `deferred`. Set a row to `fixed` as soon as its fix is verified, BEFORE the commit, so the audit file goes in the same commit as the fix (no hash: it does not exist yet; `git log -- <file>` finds it).
- **Commit**: never leave an audit file uncommitted. Audit only: propose the commit to the user, then `git-operator` commits it on the current branch (on a protected branch, ask the user which branch first). With fixes: include it in the task commit.
- Audit files are NOT loaded by default: read them on demand. Never delete one; when every row is closed, set `Status: closed`.
- Keep the active audit's path and open IDs in the feature file (see skill `feature`).
- To resume: work only on `open`/`deferred` rows, and run `git diff <baseline>..HEAD -- <files>` to find what the code changed since. Re-audit only that.
- A `wontfix` that sets a team-wide rule also goes in `.claude/context/decisions.md`.
