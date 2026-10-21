export const CONVENTIONS = {
    conventional: {
        label: 'Conventional Commits',
        example: 'feat(auth): add login form',
        format: 'Conventional Commits: `type(scope): description` (`feat`, `fix`, `chore`, `refactor`, `docs`, `test`), imperative mood, 72 characters max.'
    },
    angular: {
        label: 'Angular',
        example: 'fix(core): handle empty list',
        format: 'Angular: `type(scope): description` with the types `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `test`, imperative mood, 72 characters max.'
    },
    gitmoji: {
        label: 'Gitmoji',
        example: '✨ Add login form',
        format: 'Gitmoji: `<emoji> Description` (e.g. `✨ Add login form`), imperative mood, 72 characters max.'
    },
    imperative: {
        label: 'Simple imperative',
        example: 'Add login form',
        format: 'A single imperative sentence without prefix (e.g. `Add login form`), 72 characters max.'
    }
};
