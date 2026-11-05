# Feature: session-context (branch feat/session-context)

Date: 2026-11-05
Last commit: 7d6e0f3
Base branch: develop

## Goal

Tighten orchestration rules taken from the caveman review, and have the SessionStart hook inject the working context (branch, feature summary, open audits).

## Steps

- [x] Rules: briefs stay in plain prose, keep existing comments, follow up with SendMessage, precise briefs, verify with git diff
- [ ] SessionStart hook injects branch, feature goal and next step, open audit count; session-start skill relies on it

## Decisions and open questions

-

## Notes

-
