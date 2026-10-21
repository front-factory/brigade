import { CONVENTIONS } from './conventions.js';
import {
    detectCommitConvention,
    detectDefaultBranch,
    detectLanguage,
    detectPackageManager,
    localBranches
} from './detect.js';

const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
const LANGUAGES = ['English', 'French'];

const languages = (current) => [...new Set([current, ...LANGUAGES].filter(Boolean))].map((value) => ({ value, label: value }));

// The options of the kit, in the order they are asked. `keys` are the names stored in the manifest `answers`: a group
// is missing when any of its keys is. `ask(ctx)` returns the values of its keys. Every answer is detected first, then
// validated by the dev; a previous answer wins over detection.
// ctx: { cwd, prompter, previous (stored answers), answers (decided so far), full (asked from scratch), personal }
export const OPTIONS = [
    {
        keys: ['defaultBranch'],
        ask: async ({ cwd, prompter: { validate, text }, previous }) => ({
            defaultBranch: await validate(
                'Default branch of the repository',
                previous.defaultBranch || detectDefaultBranch(cwd),
                () => text('Default branch of the repository', 'main')
            )
        })
    },
    {
        keys: ['baseBranch'],
        ask: async ({ cwd, prompter: { choose }, previous, answers }) => {
            const { defaultBranch } = answers;
            const baseCandidates = [previous.baseBranch, defaultBranch, localBranches(cwd).includes('develop') && 'develop'].filter(Boolean);
            return {
                baseBranch: await choose(
                    'Reference branch of the work',
                    [...new Set(baseCandidates)].map((value) => ({
                        value,
                        label: value,
                        hint: value === defaultBranch ? 'default branch' : 'feature branches start from it'
                    }))
                )
            };
        }
    },
    {
        keys: ['packageManager'],
        ask: async ({ cwd, prompter: { validate, choose }, previous }) => {
            const manager = detectPackageManager(cwd);
            const managers = [...new Set([...manager.candidates, ...PACKAGE_MANAGERS])];
            return {
                packageManager: await validate(
                    'Package manager',
                    previous.packageManager || manager.value,
                    () => choose(
                        'Package manager',
                        managers.map((value) => ({ value, label: value, hint: manager.candidates.includes(value) ? 'found in the project' : undefined })),
                        { other: false }
                    )
                )
            };
        }
    },
    {
        keys: ['commitConvention', 'commitFormat'],
        ask: async ({ cwd, prompter: { validate, choose, text }, previous }) => {
            const start = previous.commitConvention || detectCommitConvention(cwd) || 'conventional';
            const commitConvention = await validate(
                'Commit convention',
                start,
                () => choose(
                    'Commit convention',
                    [
                        ...Object.entries(CONVENTIONS).map(([value, { label, example }]) => ({ value, label, hint: example })),
                        { value: 'custom', label: 'Custom', hint: 'you describe it in one sentence' }
                    ],
                    { other: false }
                ),
                CONVENTIONS[start]?.label
            );
            const commitFormat = commitConvention === 'custom'
                ? await text('Describe your commit format in one sentence', previous.commitFormat)
                : CONVENTIONS[commitConvention].format;
            return { commitConvention, commitFormat };
        }
    },
    {
        keys: ['replyLanguage'],
        ask: async (ctx) => {
            const { prompter: { validate, choose }, previous } = ctx;
            const replyLanguage = await validate(
                "Default language of Claude's replies for this project (each developer can use their own later)",
                previous.replyLanguage || detectLanguage(),
                () => choose("Default language of Claude's replies for this project", languages())
            );
            // The personal choice lives in settings.local.json, not in the manifest: only asked from scratch.
            if (ctx.full) {
                const mine = await choose(
                    'And for you? This stays on your machine',
                    [
                        { value: 'keep', label: `Keep the project language (${replyLanguage || LANGUAGES[0]})` },
                        { value: 'own', label: 'Use another language for me' }
                    ],
                    { other: false }
                );
                if (mine === 'own') {
                    ctx.personal.language = await choose(
                        'Your own reply language',
                        languages().filter(({ value }) => value !== replyLanguage)
                    );
                }
            }
            return { replyLanguage: replyLanguage || LANGUAGES[0] };
        }
    },
    {
        keys: ['codeLanguage', 'docsLanguage'],
        ask: async ({ prompter: { choose }, previous }) => {
            const codeLanguage = await choose(
                'Language of the code, comments and commit messages (shared by the team)',
                languages(previous.codeLanguage)
            );
            const docsLanguage = await choose(
                'Language of the documentation (shared by the team)',
                languages(previous.docsLanguage || codeLanguage)
            );
            return { codeLanguage, docsLanguage };
        }
    }
];

// `previous`: the stored answers. Returns the options (groups of keys) that have no stored value yet.
export const missingOptions = (previous = {}) => OPTIONS.filter(({ keys }) => keys.some((key) => previous[key] === undefined));

// Asks the options in order. From scratch (`full`) every option is asked; otherwise only the missing ones and the
// others keep their stored answers. Keys the kit does not know (older version) are kept as they are.
export async function askOptions({ cwd, prompter, previous = {}, full }) {
    const missing = new Set(missingOptions(previous));
    const answers = {};
    const personal = {};
    const asked = [];

    for (const option of OPTIONS) {
        if (full || missing.has(option)) {
            Object.assign(answers, await option.ask({ cwd, prompter, previous, answers, full, personal }));
            if (!full) asked.push(option.keys);
        } else {
            for (const key of option.keys) answers[key] = previous[key];
        }
    }
    return { answers: { ...previous, ...answers }, personal, asked };
}
