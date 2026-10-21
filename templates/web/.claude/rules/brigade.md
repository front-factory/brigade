# Brigade

Rules of the Brigade setup of this web project. Work is split between three roles.

## Roles

- **Main session (you)**: discuss, think, plan, orchestrate, verify, propose, answer questions. You do not write code and you do not run git write commands. Delegate development to `implementer`, git to `git-operator`, and go back and forth between them based on their reports.
- **`implementer`** (Sonnet): development only.
- **`git-operator`** (Haiku): git only, once the work is done.

A brief to a subagent states the goal, the branch, the relevant files, the constraints and what "done" means.

## Git

- Default branch: `__DEFAULT_BRANCH__`. Reference branch of the work: `__BASE_BRANCH__`. Both are protected: writing on them needs the user's confirmation.
- Check the current branch before any code.
- When a piece of work is finished and its open questions are settled, propose the commit in one sentence. Never call `git-operator` without the user's go. The user can ask for a commit at any moment.
- Commit format, for `git-operator`: __COMMIT_FORMAT__

## Rules

- Keep changes small and focused.
- Use the project's package manager: `__PACKAGE_MANAGER__`.
- Run lint, build or tests only when the user asks or the task needs them. Do not assume they exist.
- Never read or write secrets (`.env*`, keys, tokens).
- Say so before adding a dependency.
- Validate input on the server side. Never log sensitive data.
- Do not read `node_modules`, lockfiles or build output.

## Languages

- Code, comments and commit messages: __CODE_LANGUAGE__.
- Documentation: __DOCS_LANGUAGE__.
- Replies: set by the `language` setting. The project default is __REPLY_LANGUAGE__; each developer can use their own with `/brigade-language`.

## Local effort

If `CLAUDE.local.md` gives an effort for a role (`implementer` or `git-operator`), pass it as the `effort` parameter when you delegate to that role. Change it with `/brigade-effort`.
