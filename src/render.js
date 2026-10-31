import { createHash } from 'node:crypto';

export const OPTIONS_FILE = '.claude/rules/brigade-options.md';

// Line endings do not count: a CRLF checkout of a kit file is the same file.
export const sha = (content) => createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');

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

export const convention = (name) => (Object.hasOwn(CONVENTIONS, name) ? CONVENTIONS[name] : undefined);

export const CHECKS = [
    'test',
    'lint'
];

// The command that runs a check. `bun test` is bun's own runner, not the `test` script, so bun goes through `run`.
export const checkCommand = (packageManager, check) => (check === 'test' && packageManager !== 'bun' ? `${packageManager} test` : `${packageManager} run ${check}`);

// A known convention carries its text from the kit, computed now, never stored; a custom one is the dev's own text.
const commitFormatOf = ({ commitConvention, commitFormat }) => convention(commitConvention)?.format ?? commitFormat;

// `json`: the values go inside JSON strings, so quotes, backslashes and control characters are escaped.
// Unknown placeholders are left as they are.
export function render(content, answers, json = false) {
    // Angular states its own body rule; every other format leaves the body optional.
    const body = answers.commitConvention === 'angular' ? '' : ' Add a body when the "why" is not obvious.';

    const values = {
        DEFAULT_BRANCH: answers.defaultBranch,
        BASE_BRANCH: answers.baseBranch,
        PACKAGE_MANAGER: answers.packageManager,
        COMMIT_FORMAT: commitFormatOf(answers) + body,
        REPLY_LANGUAGE: answers.replyLanguage,
        CODE_LANGUAGE: answers.codeLanguage,
        DOCS_LANGUAGE: answers.docsLanguage
    };

    return content.replace(/__([A-Z_]+)__/g, (match, key) => {
        if (values[key] === undefined) {
            return match;
        }

        return json ? JSON.stringify(String(values[key])).slice(1, -1) : values[key];
    });
}

// The project's answers in plain English. Not a kit file: generated from the answers, always overwritten.
export const renderOptions = (answers) => {
    const checks = (Array.isArray(answers.checks) ? answers.checks : []).filter((check) => CHECKS.includes(check)).map((check) => `\`${checkCommand(answers.packageManager, check)}\``);

    return `# Brigade options

<!-- Generated by Brigade from .claude/brigade.json. Do not edit: changes are overwritten at the next install or update. -->

Options of this project, referred to by \`.claude/rules/brigade.md\`.

- Default branch: \`${answers.defaultBranch}\`.
- Reference branch of the work: \`${answers.baseBranch}\`.
- Package manager: \`${answers.packageManager}\`.
- Commit format: ${commitFormatOf(answers)}
- Code, comments and commit messages language: ${answers.codeLanguage}.
- Documentation language: ${answers.docsLanguage}.
- Reply language, project default: ${answers.replyLanguage}.
- Checks at the end of each task (project default): ${checks.length ? checks.join(', ') : 'none'}.
`;
};
