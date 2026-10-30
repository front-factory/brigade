# Audit: settings friction

Date: 2026-10-30
Baseline commit: f77e87b
Scope: `templates/web/.claude/settings.json` and the main-session workflow: rules that block or slow down legitimate work, following the node_modules deny fix (80e5a49)
Status: open

## Findings

| ID | Severity | File | Problem | Status | Notes (commit / reason) |
|----|----------|------|---------|--------|-------------------------|
| F1 | medium | templates/web/.claude/settings.json | `Read(./dist/**)`, `Read(./build/**)`, `Read(./.next/**)`, `Read(./coverage/**)` have the same flaw as the removed node_modules rule: these folders are gitignored, so broad searches already skip them, while the deny blocks targeted reads when debugging build output or a coverage report. | fixed | Removed the build-output read denies (F1); added test and install allows (F2) |
| F2 | medium | templates/web/.claude/settings.json | `allow` has `Bash(<pm> run:*)` but not `<pm> test`, `<pm> install` or `npx`, so `npm test` asks every time. This repo's `settings.local.json` adds `Bash(npm test *)` to work around it. | fixed | Removed the build-output read denies (F1); added test and install allows (F2) |
| F3 | medium | templates/web/.claude/settings.json, templates/web/.claude/rules/brigade.md | `defaultMode: plan` pushes the plan-file workflow onto plain questions (2026-10-30: a question asking for solutions got a plan and ExitPlanMode), while the rules say the main session answers questions and small work stays silent. | open | Related: 2026-10-29 A3 (plan mode chosen as a safety net) |
| F4 | low | templates/web/.claude/settings.json | `Bash(rm -rf /:*)` is a prefix rule: it denies any `rm -rf` with an absolute path (e.g. `rm -rf /abs/project/dist`), broader than the intent (the root only). To verify against Claude Code's matching. | open | |
| F5 | low | templates/web/.claude/settings.json | Lockfile denies block reading the resolved version of a dependency; mitigated since node_modules is readable (`node_modules/<lib>/package.json`) and `npm ls` works. | open | Likely wontfix |
