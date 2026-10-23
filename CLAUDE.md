## Git

**Without an explicit commit instruction from the user:**

- Never run Git commands that change repository state (`commit`, `add`, `reset`, `checkout`, `stash`, etc.)
- Read-only commands (`git status`, `git diff`, `git log`) are allowed when needed

**When the user asks for a commit,** split unrelated changes into separate commits with focused messages. Don't combine
layout changes, bug fixes, and new features in one commit.

**When adding packages,** put runtime and development dependencies in separate commits:

- `build(deps): add <package>` for a runtime dependency
- `build(deps-dev): add <package>` for a development-only dependency

Commit only the relevant manifest and lockfile for those commits, with no source changes.
