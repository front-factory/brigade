// Shared by every convention text.
const LIMIT = '72 characters max.';

export const CONVENTIONS = {
    conventional: {
        label: 'Conventional Commits',
        example: 'feat(auth): add login form',
        format: 'Conventional Commits: `type(scope): description` with the types `feat` (new feature), `fix` (bug fix), `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `revert`, `style`, `test`; '
            + 'the scope is optional, a noun naming a section of the codebase; '
            + 'breaking change (major): `!` before the colon (`feat(api)!: description`) or a footer `BREAKING CHANGE: <description>`; '
            + 'the body starts after one blank line; footers come after a blank line, each token with `-` instead of spaces (`Refs: #12`); '
            + 'imperative mood, ' + LIMIT
    },
    angular: {
        label: 'Angular',
        example: 'fix(core): handle empty list',
        format: 'Angular: `type(scope): summary` with the types `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `test`; '
            + 'type and summary are required, the scope is optional and names the package affected as a changelog reader would see it (empty for a change across packages); '
            + 'the summary is in imperative present tense, not capitalized, with no period at the end; '
            + 'the body is required for every type except `docs`, at least 20 characters, in imperative present tense, explaining why (previous behavior against new behavior); '
            + 'footers come after a blank line: `BREAKING CHANGE: <short summary>`, a blank line, then the description with migration instructions; '
            + '`DEPRECATED: <short description>`, a blank line, then the recommended update path; issue references (`Fixes #<issue>`, `Closes #<pr>`); '
            + 'a revert uses the header `revert: <header of the reverted commit>` and a body with `This reverts commit <SHA>.` and the reason; '
            + 'header ' + LIMIT
    },
    gitmoji: {
        label: 'Gitmoji',
        example: '✨ Add login form',
        format: 'Gitmoji: `<emoji> (scope)[:] Message` (e.g. `✨ Add login form`, `♻️ (components): Transform classes to hooks`); '
            + 'the emoji comes from the official gitmoji list, as unicode (`✨`, shorter) or as a shortcode (`:sparkles:`); '
            + 'the scope is optional, in parentheses, and the colon after it is optional; the message is a brief explanation; '
            + 'imperative mood, ' + LIMIT
    },
    imperative: {
        label: 'Simple imperative',
        example: 'Add login form',
        format: 'A single imperative sentence without prefix (e.g. `Add login form`), ' + LIMIT
    }
};

// The commit format text of the answers. A known convention carries its text from the kit, computed now, never stored;
// a custom (or unknown, from an older version) one is the dev's own stored text.
export const commitFormatOf = ({ commitConvention, commitFormat }) => CONVENTIONS[commitConvention]?.format ?? commitFormat;
