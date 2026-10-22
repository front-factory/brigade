import { CONVENTIONS } from './conventions.js';
import {
    PACKAGE_MANAGERS,
    detectCommitConvention,
    detectDefaultBranch,
    detectLanguage,
    detectPackageManager,
    localBranches
} from './detect.js';

const LANGUAGES = ['English', 'French'];
const ENGLISH = LANGUAGES[0];
const DIFFERENT = '__different__';
const LANGUAGE_KEYS = ['replyLanguage', 'codeLanguage', 'docsLanguage'];

// A stored manager that is not a known one (hand-edited manifest) counts as not stored.
const storedManager = (previous) => (PACKAGE_MANAGERS.includes(previous.packageManager) ? previous.packageManager : '');

const languages = (current) => [...new Set([current, ...LANGUAGES].filter(Boolean))].map((value) => ({ value, label: value }));

// The options of the kit, in the order they are asked. `keys` are the names stored in the manifest `answers`: a group
// is missing when any of its keys is. `ask(ctx)` returns the values of its keys. Every answer is detected first, then
// validated by the dev; a previous answer wins over detection. `detect(ctx)` returns the same values without asking
// (express install), or null when they cannot be told.
// ctx: { cwd, prompter, previous (stored answers), current (answers being edited), answers (decided so far), full (asked from scratch), personal }
export const OPTIONS = [
    {
        keys: ['defaultBranch'],
        detect: ({ cwd, previous }) => {
            const defaultBranch = previous.defaultBranch || detectDefaultBranch(cwd);
            return defaultBranch ? { defaultBranch } : null;
        },
        ask: async ({ cwd, prompter: { validate, text }, previous, current }) => ({
            defaultBranch: await validate(
                'Default branch of the repository',
                previous.defaultBranch || detectDefaultBranch(cwd),
                () => text('Default branch of the repository', current.defaultBranch || 'main')
            )
        })
    },
    {
        keys: ['baseBranch'],
        detect: ({ previous, answers }) => {
            const baseBranch = previous.baseBranch || answers.defaultBranch;
            return baseBranch ? { baseBranch } : null;
        },
        ask: async ({ cwd, prompter: { choose }, previous, current, answers }) => {
            const { defaultBranch } = answers;
            const baseCandidates = [current.baseBranch, previous.baseBranch, defaultBranch, localBranches(cwd).includes('develop') && 'develop'].filter(Boolean);
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
        detect: ({ cwd, previous }) => {
            const packageManager = storedManager(previous) || detectPackageManager(cwd).value;
            return packageManager ? { packageManager } : null;
        },
        ask: async ({ cwd, prompter: { validate, choose }, previous, current }) => {
            const manager = detectPackageManager(cwd);
            const managers = [...new Set([current.packageManager, ...manager.candidates, ...PACKAGE_MANAGERS].filter(Boolean))];
            return {
                packageManager: await validate(
                    'Package manager',
                    storedManager(previous) || manager.value,
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
        detect: ({ cwd, previous }) => {
            const commitConvention = previous.commitConvention || detectCommitConvention(cwd) || 'conventional';
            if (commitConvention === 'custom') return previous.commitFormat ? { commitConvention, commitFormat: previous.commitFormat } : null;
            return CONVENTIONS[commitConvention] ? { commitConvention, commitFormat: CONVENTIONS[commitConvention].format } : null;
        },
        ask: async ({ cwd, prompter: { validate, choose, text }, previous, current }) => {
            const start = previous.commitConvention || current.commitConvention || detectCommitConvention(cwd) || 'conventional';
            const commitConvention = await validate(
                'Commit convention',
                start,
                () => choose(
                    'Commit convention',
                    [
                        ...Object.entries(CONVENTIONS).map(([value, { label, example }]) => ({ value, label, hint: example })),
                        { value: 'custom', label: 'Custom', hint: 'you describe it in one sentence' }
                    ].sort((a, b) => (b.value === current.commitConvention) - (a.value === current.commitConvention)),
                    { other: false }
                ),
                CONVENTIONS[start]?.label
            );
            const custom = commitConvention === 'custom'
                ? await text('Describe your commit format in one sentence', previous.commitFormat || current.commitFormat, { required: true })
                : '';
            // A blank custom format (no terminal) falls back to the default convention, never to an empty line.
            if (commitConvention === 'custom' && custom) return { commitConvention, commitFormat: custom };
            const convention = CONVENTIONS[commitConvention] ? commitConvention : 'conventional';
            return { commitConvention: convention, commitFormat: CONVENTIONS[convention].format };
        }
    },
    {
        keys: LANGUAGE_KEYS,
        // The recommended setup: stored values first, then the language found (none when unknown), English for code and docs.
        detect: ({ previous }) => {
            const replyLanguage = previous.replyLanguage || detectLanguage();
            const codeLanguage = previous.codeLanguage || ENGLISH;
            return { ...(replyLanguage && { replyLanguage }), codeLanguage, docsLanguage: previous.docsLanguage || codeLanguage };
        },
        ask: async (ctx) => {
            const { prompter: { choose }, previous, current } = ctx;
            const known = { ...current, ...previous };

            // First question: replies. The language found comes first, stored values lead.
            const detected = detectLanguage();
            const replyOptions = languages(known.replyLanguage || detected);
            if (!known.replyLanguage) replyOptions[0].hint = 'recommended';
            const replyLanguage = await choose(
                "Language of Claude's replies for this project (each developer can use their own later)",
                replyOptions,
                { other: false }
            );

            // Second question: code and docs together, or apart. A stored split keeps "Different" first.
            const together = known.codeLanguage && known.codeLanguage === known.docsLanguage ? known.codeLanguage : undefined;
            const split = known.codeLanguage && known.docsLanguage && !together;
            const sameChoices = [...new Set([ENGLISH, replyLanguage])].map((value) => ({ value, label: value }));
            if (together && !sameChoices.some(({ value }) => value === together)) sameChoices.push({ value: together, label: together });
            const different = { value: DIFFERENT, label: 'Different for code and docs', hint: 'you choose each language' };
            const first = split ? different : sameChoices.find(({ value }) => value === (together || ENGLISH));
            const codeDocs = await choose(
                'Language of the code, comments, commit messages and documentation',
                [first, ...[...sameChoices, different].filter((option) => option !== first)],
                { other: false }
            );

            let languagesChosen;
            if (codeDocs === DIFFERENT) {
                const codeLanguage = await choose(
                    'Language of the code, comments and commit messages (shared by the team)',
                    languages(known.codeLanguage)
                );
                const docsLanguage = await choose(
                    'Language of the documentation (shared by the team)',
                    languages(known.docsLanguage || codeLanguage)
                );
                languagesChosen = { replyLanguage, codeLanguage, docsLanguage };
            } else {
                languagesChosen = { replyLanguage, codeLanguage: codeDocs, docsLanguage: codeDocs };
            }

            // The personal choice lives in settings.local.json, not in the manifest: only asked from scratch.
            delete ctx.personal.language;
            if (ctx.full) {
                const { replyLanguage } = languagesChosen;
                const mine = await choose(
                    'And for you? This stays on your machine',
                    [
                        { value: 'keep', label: `Keep the project language (${replyLanguage})` },
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
            return languagesChosen;
        }
    }
];

// The answers as the dev reads them, before and after the files are written. Missing ones are still to be chosen.
export function recapRows(answers) {
    const show = (value, text = value) => (value === undefined ? 'to choose' : text);
    return [
        ['Default branch', show(answers.defaultBranch)],
        ['Reference branch', show(answers.baseBranch)],
        ['Package manager', show(answers.packageManager)],
        ['Commit format', show(answers.commitConvention, CONVENTIONS[answers.commitConvention]?.label ?? 'Custom')],
        ['Replies', show(answers.replyLanguage, `${answers.replyLanguage} (project default)`)],
        ['Code', show(answers.codeLanguage)],
        ['Documentation', show(answers.docsLanguage)]
    ];
}

// `previous`: the stored answers. Returns the options (groups of keys) that have no stored value yet.
export const missingOptions = (previous = {}) => OPTIONS.filter(({ keys }) => keys.some((key) => previous[key] === undefined) || (keys.includes('packageManager') && !storedManager(previous)));

// What each option would be without asking. The ones that cannot be told are left out of the state.
function propose(ctx) {
    const answers = {};
    for (const option of OPTIONS) {
        const found = option.detect({ ...ctx, answers });
        for (const [key, value] of Object.entries(found ?? {})) if (value !== undefined) answers[key] = value;
    }
    return answers;
}

// The groups the dev can re-open from the recap, each covering some options of OPTIONS.
const GROUPS = [
    { value: 'branches', label: 'Branches', options: [0, 1] },
    { value: 'packageManager', label: 'Package manager', options: [2] },
    { value: 'commit', label: 'Commit format', options: [3] },
    { value: 'languages', label: 'Languages', options: [4] }
];

// Asks the given options in order, each one seeing the answers decided so far.
async function askEach(options, ctx) {
    for (const option of options) Object.assign(ctx.answers, await option.ask(ctx));
}

// A first install with a dev to ask. Everything is detected and shown in one card; "Install as is" takes it (the
// options that cannot be told are still asked), "Customize" asks every option. After a customization, or when
// something had to be asked, the recap can be edited group by group until it is right. Nothing is written before it
// returns, so cancelling leaves the project untouched.
async function askInteractive({ cwd, prompter, previous }) {
    prompter.step(1, 3, 'Detection');
    const personal = {};
    const answers = propose({ cwd, prompter, previous, current: {}, answers: {}, full: true, personal });
    const unresolved = OPTIONS.filter(({ keys }) => keys.some((key) => answers[key] === undefined));

    prompter.step(2, 3, 'Review');
    prompter.card('Here is what will be set up', recapRows(answers));
    const mode = await prompter.choose(
        'How do you want to set up Brigade?',
        [
            { value: 'asis', label: 'Install as is', hint: unresolved.length ? 'the options still to choose will be asked' : undefined },
            { value: 'customize', label: 'Customize', hint: 'every option, one by one' }
        ],
        { other: false }
    );

    let reviewed = false;
    if (mode === 'customize') {
        for (const key of Object.keys(answers)) delete answers[key];
        await askEach(OPTIONS, { cwd, prompter, previous, current: {}, answers, full: true, personal });
        reviewed = true;
    } else if (unresolved.length) {
        await askEach(unresolved, { cwd, prompter, previous, current: {}, answers, full: false, personal });
        reviewed = true;
    } else {
        prompter.info('Installing as detected.');
    }

    while (reviewed) {
        prompter.card('Your setup', recapRows(answers));
        const verdict = await prompter.choose(
            'Is the setup right?',
            [
                { value: 'ok', label: 'Everything is right' },
                { value: 'change', label: 'Change something' }
            ],
            { other: false }
        );
        if (verdict === 'ok') break;

        const chosen = await prompter.multi('What do you want to change?', GROUPS.map(({ value, label }) => ({ value, label })));
        // Re-asked options skip "Is that right?" and start from the current values.
        const editor = { ...prompter, validate: async (_message, _detected, pick) => pick() };
        const current = { ...answers };
        const options = GROUPS.filter(({ value }) => chosen.includes(value)).flatMap(({ options }) => options.map((index) => OPTIONS[index]));
        await askEach(options, { cwd, prompter: editor, previous: {}, current, answers, full: true, personal });
    }
    return { answers: { ...previous, ...answers }, personal, asked: [] };
}

// Asks the options in order. From scratch (`full`) every option is asked; otherwise only the missing ones and the
// others keep their stored answers. Keys the kit does not know (older version) are kept as they are.
// Without a dev to ask (`prompter.interactive` false) every question resolves to its default.
export async function askOptions({ cwd, prompter, previous = {}, full }) {
    if (full && prompter.interactive) return askInteractive({ cwd, prompter, previous });

    const missing = new Set(missingOptions(previous));
    const answers = {};
    const personal = {};
    const asked = [];

    for (const option of OPTIONS) {
        if (full || missing.has(option)) {
            Object.assign(answers, await option.ask({ cwd, prompter, previous, current: {}, answers, full, personal }));
            if (!full) asked.push(option.keys);
        } else {
            for (const key of option.keys) answers[key] = previous[key];
        }
    }
    return { answers: { ...previous, ...answers }, personal, asked };
}
