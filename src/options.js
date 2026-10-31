import {
    detectCommitConvention, detectDefaultBranch, detectPackageManager, localBranches, MANAGERS
} from './detect.js';
import { CONVENTIONS, convention } from './render.js';
import { item } from './prompt.js';
import { card } from './ui.js';

const words = (text) => text.split(' ');
const LANGUAGES = words('English French Spanish German Italian Portuguese Dutch Japanese Chinese Korean');
const APART = '__apart__';

// The values, the preferred one first and without duplicates.
const unique = (...values) => [
    ...new Set(values.flat().filter(Boolean))
];

const languages = (first) => unique(first, LANGUAGES).map((value) => item(value));

const one = (key, value) => (value ? {
    [key]: value
} : null);

// The options of the kit, in the order they are asked. `keys` are the names stored in the manifest `answers`.
// `detect(ctx)` returns the values without asking (a stored answer wins over detection), or null when they cannot be
// told. `ask(ctx, found)` asks and returns the values; `found` is what `detect` told, preselected first. Without a
// terminal every question resolves to its first choice, so `ask` doubles as the default. `valid` tells whether a set of
// answers holds a usable value. ctx: { cwd, p, stored, answers (decided so far), personal, full }.
// Answers hold the dev's choices only: kit text is computed when files are rendered, never stored.
export const OPTIONS = [
    {
        keys: words('defaultBranch'),
        label: 'Default branch',
        detect: ({ cwd, stored }) => one('defaultBranch', stored.defaultBranch || detectDefaultBranch(cwd)),
        ask: async ({ p }, found) => one('defaultBranch', await p.text('Default branch of the repository', found.defaultBranch || 'main')),
        recap: (a) => `Default branch|${a.defaultBranch}`
    },
    {
        keys: words('baseBranch'),
        label: 'Reference branch',
        detect: ({ stored, answers }) => one('baseBranch', stored.baseBranch || answers.defaultBranch),
        ask: async ({ cwd, p, answers }, found) => {
            const { defaultBranch } = answers;
            const names = unique(found.baseBranch, defaultBranch, localBranches(cwd).includes('develop') && 'develop');

            return one('baseBranch', await p.choose('Reference branch of the work', names.map((name) => item(name, name === defaultBranch ? 'default branch' : 'feature branches start from it')), true));
        },
        recap: (a) => `Reference branch|${a.baseBranch}`
    },
    {
        keys: words('packageManager'),
        label: 'Package manager',
        // Only the known managers are accepted: the value ends up in settings.json permission rules.
        valid: (a) => MANAGERS.includes(a.packageManager),
        detect: ({ cwd, stored }) => one('packageManager', MANAGERS.includes(stored.packageManager) ? stored.packageManager : detectPackageManager(cwd).value),
        ask: async ({ cwd, p }, found) => {
            const { candidates } = detectPackageManager(cwd);

            return one('packageManager', await p.choose('Package manager', unique(found.packageManager, candidates, MANAGERS).map((name) => item(name, candidates.includes(name) ? 'found in the project' : undefined))));
        },
        recap: (a) => `Package manager|${a.packageManager}`
    },
    {
        keys: words('commitConvention'),
        label: 'Commit format',
        valid: (a) => Boolean(convention(a.commitConvention) || (a.commitConvention === 'custom' && a.commitFormat)),
        detect: ({ cwd, stored }) => {
            const name = stored.commitConvention || detectCommitConvention(cwd) || 'conventional';

            if (name === 'custom') {
                return stored.commitFormat ? {
                    commitConvention: name,
                    commitFormat: stored.commitFormat
                } : null;
            }

            return convention(name) ? {
                commitConvention: name
            } : null;
        },
        ask: async ({ cwd, p, stored }, found) => {
            const start = found.commitConvention || detectCommitConvention(cwd) || 'conventional';

            const choices = Object.entries(CONVENTIONS).map(([
                value,
                { label, example }
            ]) => item(value, example, label));

            choices.push(item('custom', 'you describe it in one sentence', 'Custom'));
            choices.sort((a, b) => (b.value === start) - (a.value === start));

            const name = await p.choose('Commit convention', choices);
            const format = name === 'custom' ? await p.text('Describe your commit format in one sentence', stored.commitFormat ?? '', true) : '';

            // A blank custom format (no terminal) falls back to the default convention, never to an empty line.
            return format ? {
                commitConvention: name,
                commitFormat: format
            } : {
                commitConvention: convention(name) ? name : 'conventional'
            };
        },
        recap: (a) => `Commit format|${convention(a.commitConvention)?.label ?? 'Custom'}`
    },
    {
        keys: words('replyLanguage codeLanguage docsLanguage'),
        label: 'Languages',
        detect: ({ stored }) => ({
            replyLanguage: stored.replyLanguage || 'English',
            codeLanguage: stored.codeLanguage || 'English',
            docsLanguage: stored.docsLanguage || stored.codeLanguage || 'English'
        }),
        ask: async ({ p, personal, full }, found) => {
            const replyLanguage = await p.choose('Language of Claude\'s replies for this project (each developer can use their own later)', languages(found.replyLanguage), true);
            const together = found.codeLanguage === found.docsLanguage;

            const same = unique(together && found.codeLanguage, 'English', replyLanguage).map((value) => item(value));
            const apart = item(APART, 'you choose each language', 'Different for code and docs');

            const both = await p.choose('Language of the code, comments, commit messages and documentation', together ? [
                ...same,
                apart
            ] : [
                apart,
                ...same
            ]);

            let codeLanguage = both;
            let docsLanguage = both;

            if (both === APART) {
                codeLanguage = await p.choose('Language of the code, comments and commit messages (shared by the team)', languages(found.codeLanguage), true);
                docsLanguage = await p.choose('Language of the documentation (shared by the team)', languages(found.docsLanguage || codeLanguage), true);
            }

            // The personal choice lives in settings.local.json, not in the manifest: only asked on a full install.
            delete personal.language;

            if (full && p.interactive) {
                const mine = await p.choose('And for you? This stays on your machine', [
                    item('keep', undefined, `Keep the project language (${replyLanguage})`),
                    item('own', undefined, 'Use another language for me')
                ]);

                if (mine === 'own') {
                    personal.language = await p.choose('Your own reply language', languages().filter(({ value }) => value !== replyLanguage), true);
                }
            }

            return {
                replyLanguage,
                codeLanguage,
                docsLanguage
            };
        },
        recap: (a) => `Replies|${a.replyLanguage} (project default)\nCode|${a.codeLanguage}\nDocumentation|${a.docsLanguage}`
    }
];

// Whether the answers hold a usable value for every key of the option.
export const has = (option, answers) => option.keys.every((key) => answers[key]) && (option.valid?.(answers) ?? true);

// The recap rows ("label|value") of the answers; an option without a value shows "to choose".
export const recapRows = (answers) => OPTIONS.flatMap((option) => (has(option, answers) ? option.recap(answers) : `${option.label}|to choose`).split('\n'));

const askOne = (option, ctx) => option.ask(ctx, option.detect(ctx) ?? {});

// Decides every option and returns { answers, personal, added } where `added` lists the keys the stored answers
// lacked. `full`: every question is asked (first install, same version); otherwise only the missing options are.
// Unknown stored keys are kept. Without a terminal nothing is asked: stored, detected or default values.
export async function gather({ cwd, p, stored, full }) {
    const ctx = {
        cwd,
        p,
        stored,
        full,
        answers: {},
        personal: {}
    };

    const missing = OPTIONS.filter((option) => !has(option, stored));
    const hasStored = Object.keys(stored).length > 0;

    const ask = async (options) => {
        for (const option of options) {
            Object.assign(ctx.answers, await askOne(option, ctx));
        }
    };

    if (full && p.interactive) {
        const found = {};

        for (const option of OPTIONS) {
            Object.assign(found, option.detect({
                ...ctx,
                answers: found
            }));
        }

        const todo = OPTIONS.filter((option) => !has(option, found));

        console.log(card('Here is what will be set up', recapRows(found)));

        const mode = await p.choose('How do you want to set up Brigade?', [
            item('asis', todo.length ? 'the options still to choose will be asked' : undefined, 'Install as is'),
            item('customize', 'every option, one by one', 'Customize')
        ]);

        let reviewed = mode === 'customize' || todo.length > 0;

        if (mode === 'customize') {
            await ask(OPTIONS);
        } else {
            ctx.answers = found;
            await ask(todo);
        }

        while (reviewed) {
            console.log(card('Your setup', recapRows(ctx.answers)));

            if (await p.choose('Is the setup right?', [
                item('ok', undefined, 'Everything is right'),
                item('redo', undefined, 'Change something: ask everything again')
            ]) === 'ok') {
                reviewed = false;
            } else {
                ctx.answers = {};
                await ask(OPTIONS);
            }
        }
    } else {
        for (const option of OPTIONS) {
            if (full || missing.includes(option)) {
                await ask([
                    option
                ]);
            } else {
                Object.assign(ctx.answers, ...option.keys.map((key) => one(key, stored[key])));
            }
        }
    }

    const answers = {
        ...stored,
        ...ctx.answers
    };

    // A known convention carries no stored text.
    if (convention(answers.commitConvention)) {
        delete answers.commitFormat;
    }

    return {
        answers,
        personal: ctx.personal,
        added: hasStored ? missing.flatMap(({ keys }) => keys) : []
    };
}
