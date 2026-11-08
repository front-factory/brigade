# Audit: architecture and coherence of the web kit compared with obra/superpowers

Date: 2026-11-08
Baseline commit: 2f077fd
Scope: templates/web/.claude/ (rules, agents, skills), compared with obra/superpowers
Status: open

## Findings

| ID | Severity | File | Problem | Status | Notes (commit / reason) |
|----|----------|------|---------|--------|-------------------------|
| R1 | medium | templates/web/.claude/skills/feature/SKILL.md:6 | Hardcodes `main` and `develop` ("`main` and `develop` still need the user's confirmation") in a kit shipped to every project; a project whose default/reference branches have other names gets wrong guidance. brigade.md says the names live in `rules/brigade-options.md`. Fix: say "the default and reference branches" instead. | open | |
| R2 | low | templates/web/.claude/skills/feature/SKILL.md:8, templates/web/.claude/agents/git-operator.md:14 | The feature skill always proposes `feat/<name>`, while git-operator names branches `type/short-description`; a fix or refactor done as a feature (this repo has `fix-git-guard-blind-spots.md`) gets inconsistent naming. Fix: propose `<type>/<name>` in the feature skill. | open | |
| R3 | low | templates/web/.claude/rules/brigade.md | `audit`, `debug` and `feature` each have an explicit trigger rule in brigade.md; `session-start` relies only on its skill description. Inconsistent pattern (rule = when, skill = how). Fix: one trigger line in brigade.md, or state that skill descriptions alone trigger. | open | |
| R4 | medium | templates/web/.claude/rules/brigade.md:14 | Verification of a subagent's work now checks compliance with the brief only; superpowers' second review stage (code quality: duplication, naming, edge cases, security) has no equivalent. Design decision for the user: add a short quality check to the diff review, or keep compliance only. | open | |
