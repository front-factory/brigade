# Team decisions

<!-- Shared by everyone. Written once by Brigade at install, then yours: never overwritten. -->
<!-- One line per decision: what + why. Newest at the bottom. -->
<!-- To change a decision, edit it in place (git keeps the history). -->
<!-- Keep this file under ~30 lines: move details and replaced decisions to decisions-archive.md. -->

- Node >= 24 (`engines`): `node:test` replaces a test dependency.
- The CLI never creates a git repository: the user decides when to `git init`.
- `.claude/brigade.json` stores the version, the answers and the sha256 of written files: untouched files are updated, edited ones get a `.proposed`.
- `decisions.md` and `architecture.md` are write-once: the project owns them, Brigade never overwrites them.
- Brigade never touches CLAUDE.md: its rules live in `.claude/rules/brigade.md`.
- The git guard is a safety net, not a security boundary.
- Releases are automated by semantic-release from Conventional Commits: version and CHANGELOG are never edited by hand.
- This repo's `.claude/` is the rendered copy of `templates/web/` (dogfooding): `test/dogfood.test.js` guards against drift.
- `.claude/brigade.json` is committed and shared like in any install (the whole team shares the install, any developer can install or update from any machine): `test/dogfood.test.js` checks it matches `.claude/`.
- `rules/brigade.md` is pure kit (no placeholders); project options live in the generated `rules/brigade-options.md`, so kit updates never conflict.
- Manifest `answers` hold only the user's choices; kit-owned text is resolved at render time (like `commitFormatOf`): an update always brings the latest kit, whatever the options.
- `node_modules` stays readable: a targeted read of the installed version beats web docs; broad searches skip it through `.gitignore`.
