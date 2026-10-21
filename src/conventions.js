// Shared by every convention text.
const LIMIT = '72 characters max.';

export const CONVENTIONS = {
    conventional: {
        label: 'Conventional Commits',
        example: 'feat(auth): add login form',
        format: 'Conventional Commits: `type(scope): description` (`feat`, `fix`, `chore`, `refactor`, `docs`, `test`), imperative mood, ' + LIMIT
    },
    angular: {
        label: 'Angular',
        example: 'fix(core): handle empty list',
        format: 'Angular: `type(scope): description` with the types `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `test`, imperative mood, ' + LIMIT
    },
    gitmoji: {
        label: 'Gitmoji',
        example: '✨ Add login form',
        format: 'Gitmoji: `<emoji> Description` (e.g. `✨ Add login form`), imperative mood, ' + LIMIT
    },
    imperative: {
        label: 'Simple imperative',
        example: 'Add login form',
        format: 'A single imperative sentence without prefix (e.g. `Add login form`), ' + LIMIT
    }
};
