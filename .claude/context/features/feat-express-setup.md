# Feature: express setup (branch feat/express-setup)

Date: 2026-10-21
Last commit: 39354af
Base branch: develop

## Goal

Make the interactive `brigade init` setup friendlier: fewer questions, one editable recap before anything is written, one language choice.

## Steps

- [x] Express mode: detect everything, one note, "Install as is" / "Customize"
- [x] Editable recap before writing ("Everything is right" / "Change something" by group)
- [x] Language questions: replies first, then code + docs together ("Different for code and docs" asks them apart)
- [x] Shorter outro (3 lines), recap lines shared between the recap and the final summary
- [x] Tests with an injected fake prompter, README updated
- [x] Own look: `src/ui.js` (banner, step labels, cards, checklist, bullets) around clack, tests in `test/ui.test.js`
- [x] (Tried then removed) a home-made setup form screen; reverted to the express flow on clack prompts
- [ ] Spinner while writing (not done, see decisions)

## Decisions and open questions

- No spinner: the files are written synchronously, so a clack spinner would never animate. Say if you still want one.
- "Install as is" with nothing to ask goes straight to writing: the express note already is the recap, showing it twice would be noise. The recap loop (with "Change something") appears after "Customize" or when an undetectable option was asked. Open: a "Change something" choice right in the express step would need a third choice.
- Updates with stored answers (missing options only) are unchanged, no express there. The languages group is now one option: if any language key is missing, the questions are re-asked (stored values lead; a stored code != docs split preselects "Different for code and docs").
- The replies question lists the detected language first (Spanish, ...), not only French.
- The personal "for you" question is skipped in express (use /brigade-language), asked in Customize and when languages are edited.
- Non-interactive paths use the previous loop (`prompter.interactive` false): same defaults as before.

- Look: clack stays for the prompts only. `intro`/`note`/`log.*`/`cancel` are replaced by our own output (`banner`, `card`, `step`, `files`, `info`, `warn`, `done`) so the grey rail does not frame the header and recaps. The prompter exposes them, the fake one in tests has no-ops.
- Colors via `styleText` (auto plain without TTY / with NO_COLOR). It has no 256-color support, so the "orange" accent is bold yellow (amber). A true orange would need raw escape codes: say if wanted.
- Steps are always 1/3 Detection, 2/3 Review, 3/3 Installation (in express with nothing to ask, Review is just a dim "Installing as detected." line).
- `recapLines` became `recapRows` (rows [label, value]); `src/cli.js` joins them in plain text for the non-interactive output (unchanged).

## Notes

- `prompter` gained `interactive` and `multi`. `recapLines` in `src/options.js` is shared with `src/cli.js`.

## Form removed

- The home-made form (`src/form.js`, `prompter.form`, `formFields`, `formCard`/`fit`) was removed; the express flow was rewritten by hand on the clack prompts: detect, ONE card "Here is what will be set up", then "Install as is" / "Customize".
- Editable recap ("Your setup", "Everything is right" / "Change something" with `prompter.multi` by group) after Customize or when an undetectable option was asked; re-asked options skip "Is that right?" and start from `ctx.current`.
- Steps back to 1/3 Detection, 2/3 Review, 3/3 Installation. Tests use a scripted fake prompter (with `multi`, no `form`).
