import { CONVENTIONS } from './conventions.js';
import {
    detectCommitConvention,
    detectDefaultBranch,
    detectLanguage,
    detectPackageManager,
    isGitRepo,
    localBranches
} from './detect.js';
import { appendMissingLines, installFiles, readManifest, writeLocalSettings, writeManifest } from './install.js';
import { createPrompter } from './prompt.js';
import { DEFAULT_STACK, STACKS, detectStack } from './stacks.js';
import { VERSION, compareVersions } from './version.js';

const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
const LANGUAGES = ['English', 'French'];

// Every answer is detected first, then validated by the dev. A previous answer wins over detection.
async function ask({ cwd, prompter, previous = {} }) {
    const { validate, choose, text } = prompter;
    const branches = localBranches(cwd);

    const defaultBranch = await validate(
        'Default branch of the repository',
        previous.defaultBranch || detectDefaultBranch(cwd),
        () => text('Default branch of the repository', 'main')
    );

    const baseCandidates = [previous.baseBranch, defaultBranch, branches.includes('develop') && 'develop'].filter(Boolean);
    const baseBranch = await choose(
        'Reference branch of the work',
        [...new Set(baseCandidates)].map((value) => ({
            value,
            label: value,
            hint: value === defaultBranch ? 'default branch' : 'feature branches start from it'
        }))
    );

    const manager = detectPackageManager(cwd);
    const managers = [...new Set([...manager.candidates, ...PACKAGE_MANAGERS])];
    const packageManager = await validate(
        'Package manager',
        previous.packageManager || manager.value,
        () => choose(
            'Package manager',
            managers.map((value) => ({ value, label: value, hint: manager.candidates.includes(value) ? 'found in the project' : undefined })),
            { other: false }
        )
    );

    const detectedConvention = previous.commitConvention || detectCommitConvention(cwd) || 'conventional';
    const conventionKey = await validate(
        'Commit convention',
        detectedConvention,
        () => choose(
            'Commit convention',
            [
                ...Object.entries(CONVENTIONS).map(([value, { label, example }]) => ({ value, label, hint: example })),
                { value: 'custom', label: 'Custom', hint: 'you describe it in one sentence' }
            ],
            { other: false }
        ),
        CONVENTIONS[detectedConvention]?.label
    );
    const commitFormat = conventionKey === 'custom'
        ? await text('Describe your commit format in one sentence', previous.commitFormat)
        : CONVENTIONS[conventionKey].format;

    const languages = (current) => [...new Set([current, ...LANGUAGES].filter(Boolean))].map((value) => ({ value, label: value }));

    const replyLanguage = await validate(
        "Default language of Claude's replies for this project (each developer can use their own later)",
        previous.replyLanguage || detectLanguage(),
        () => choose("Default language of Claude's replies for this project", languages())
    );
    const mine = await choose(
        'And for you? This stays on your machine',
        [
            { value: 'keep', label: `Keep the project language (${replyLanguage || LANGUAGES[0]})` },
            { value: 'own', label: 'Use another language for me' }
        ],
        { other: false }
    );
    const ownLanguage = mine === 'own'
        ? await choose('Your own reply language', languages().filter(({ value }) => value !== replyLanguage))
        : '';

    const codeLanguage = await choose(
        'Language of the code, comments and commit messages (shared by the team)',
        languages(previous.codeLanguage)
    );
    const docsLanguage = await choose(
        'Language of the documentation (shared by the team)',
        languages(previous.docsLanguage || codeLanguage)
    );

    const answers = {
        defaultBranch,
        baseBranch,
        packageManager,
        commitConvention: conventionKey,
        commitFormat,
        replyLanguage: replyLanguage || LANGUAGES[0],
        codeLanguage,
        docsLanguage
    };
    return { answers, personal: { language: ownLanguage } };
}

// Asked whenever Brigade is already installed. The first option is the answer when nothing can be asked.
async function chooseVersion({ prompter, installed, version }) {
    if (installed === version) {
        prompter.info(`Brigade ${installed} is already installed here and up to date.`);
        return prompter.choose(
            'What do you want to do?',
            [
                { value: 'update', label: 'Change my options', hint: 'the questions are asked again, files only change if an answer does' },
                { value: 'keep', label: 'Leave it as it is', hint: 'nothing is written' }
            ],
            { other: false }
        );
    }

    const newer = compareVersions(version, installed) > 0;
    prompter.info(`Brigade ${installed} is installed here, this is Brigade ${version}.`);
    return prompter.choose(
        newer ? 'A newer version is available' : 'This Brigade is older than the installed one',
        [
            { value: 'update', label: `${newer ? 'Update' : 'Switch'} to ${version}`, hint: 'new kit files, and the questions are asked again. Files you edited are kept' },
            { value: 'keep', label: `Keep ${installed}`, hint: 'nothing is written' }
        ],
        { other: false }
    );
}

export async function runInit({ cwd, yes = false, stack, stackDir, version = VERSION, interactive = process.stdin.isTTY && !yes, prompter }) {
    const name = stack ?? detectStack(cwd);
    const dir = stackDir ?? (STACKS[name] ?? STACKS[DEFAULT_STACK]).dir;
    const previous = readManifest(cwd);

    prompter ??= createPrompter({ interactive: Boolean(interactive) });
    const repo = isGitRepo(cwd);
    prompter.intro(`Brigade ${version}`);
    prompter.info(`Stack: ${name}${stack ? '' : ' (the only one available for now)'}.`);

    const installed = previous?.version;
    if (installed && await chooseVersion({ prompter, installed, version }) === 'keep') {
        return { kept: installed, stack: previous.stack ?? name, answers: previous.answers, report: [], ignored: [], repo, prompter, personal: {}, local: null };
    }

    if (!repo) {
        prompter.warn('No git repository here. Brigade will not create one: run `git init` when you are ready. The branch names below are kept for then.');
    }
    const { answers, personal } = await ask({ cwd, prompter, previous: previous?.answers });

    const { report, hashes } = installFiles({ cwd, stackDir: dir, answers, previous });
    writeManifest({ cwd, version, stack: name, answers, hashes });
    const ignored = appendMissingLines(cwd);
    const local = personal.language ? writeLocalSettings(cwd, { language: personal.language }) : null;

    return { version, stack: name, answers, report, ignored, repo, prompter, personal, local };
}
