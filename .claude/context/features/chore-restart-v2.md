# Branch: chore/restart-v2

Date: 2026-10-21
Last commit: 1824730
Base branch: main
Parent branch: none
Uncommitted / stash: none

## Goal

Restart brigade (@frontfactory/brigade) as v2 and publish it with semantic-release, modelled on vitepress-theme.

## Steps

- [x] release.config.js copied from vitepress-theme
- [x] package.json: no longer private, release script, semantic-release devDependencies, publishConfig
- [x] .github/workflows/ci.yml (test + publish jobs)
- [x] npm install (package-lock.json updated)
- [x] npm test passes, release.config.js loads
- [x] README updated (install command, kit contents, flags, branch state file, releases)
- [ ] NPM_TOKEN secret to create on GitHub
- [x] Commit (ea85bbc, 1824730)

## Decisions taken

- Added conventional-changelog-conventionalcommits (declared by vitepress-theme too; the conventionalcommits preset needs it).
- @semantic-release/npm not declared (bundled with semantic-release, as in vitepress-theme).
- Version stays 0.0.0; semantic-release manages it.

## Open questions

- None.

## Notes

- semantic-release dry-run not run (network/token).

## Active audit

Path: none
Open IDs: none
