import { isGitRepo } from './detect.js';
import {
    applyPlan, hasKitFiles, MANIFEST, planExtras, planFiles, readManifest, writeLocalSettings
} from './install.js';
import { askOptions } from './options.js';
import { createPrompter } from './prompt.js';
import {
    DEFAULT_STACK, STACKS, detectStack
} from './stacks.js';
import { VERSION, compareVersions } from './version.js';
import {
    CHANGING, PREVIEW_WORDS, PROPOSALS
} from './words.js';

// Asked whenever Brigade is already installed. The first option is the answer when nothing can be asked.
async function chooseVersion({ prompter, installed, version }) {
    if (installed === version) {
        prompter.info(`Brigade ${installed} is already installed here and up to date.`);

        return prompter.choose(
            'What do you want to do?',
            [
                {
                    value: 'update',
                    label: 'Change my options',
                    hint: 'the questions are asked again, files only change if an answer does'
                },
                {
                    value: 'keep',
                    label: 'Leave it as it is',
                    hint: 'nothing is written'
                }
            ],
            {
                other: false
            }
        );
    }

    const newer = compareVersions(version, installed) > 0;

    prompter.info(`Brigade ${installed} is installed here, this is Brigade ${version}.`);

    return prompter.choose(
        newer ? 'A newer version is available' : 'This Brigade is older than the installed one',
        [
            {
                value: 'update',
                label: `${newer ? 'Update' : 'Switch'} to ${version}`,
                hint: 'new kit files, your answers are kept and only new options are asked. Files you edited are kept'
            },
            {
                value: 'keep',
                label: `Keep ${installed}`,
                hint: 'nothing is written'
            }
        ],
        {
            other: false
        }
    );
}

// Lists the files that change and asks to go on. Nothing to change: nothing to ask.
async function confirmChanges({ prompter, report }) {
    const changes = report.filter(({ status }) => CHANGING.has(status) || PROPOSALS.has(status) || status === 'obsolete');

    prompter.info('What this update will do:');
    prompter.files(changes.map(({ path, status }) => ({
        done: CHANGING.has(status),
        label: `${path}${PROPOSALS.has(status) ? '.proposed' : ''}`,
        detail: PREVIEW_WORDS[status]
    })));

    const untouched = report.length - changes.length;

    prompter.info(`${untouched} other file${untouched === 1 ? '' : 's'} already up to date or yours, left alone.`);

    return changes.length === 0 || prompter.confirm('Apply these changes?');
}

// `dryRun`: nothing is asked and nothing is written, the result lists what a real run would do.
export async function runInit({ cwd, yes = false, dryRun = false, stack, stackDir, version = VERSION, interactive = process.stdin.isTTY && !yes && !dryRun, prompter }) {
    const name = stack ?? detectStack(cwd);
    const dir = stackDir ?? (STACKS[name] ?? STACKS[DEFAULT_STACK]).dir;
    const previous = readManifest(cwd);

    prompter ??= createPrompter({
        interactive: Boolean(interactive)
    });

    const repo = isGitRepo(cwd);

    prompter.banner(version);
    prompter.info(`Stack: ${name}${stack ? '' : ' (the only one available for now)'}.`);

    const installed = previous?.version;

    const choice = installed && await chooseVersion({
        prompter,
        installed,
        version
    });

    if (choice === 'keep') {
        return {
            kept: installed,
            stack: previous.stack ?? name,
            answers: previous.answers,
            report: [],
            ignored: [],
            repo,
            prompter,
            personal: {},
            local: null
        };
    }

    if (!repo) {
        prompter.warn('No git repository here. Brigade will not create one: run `git init` when you are ready. The branch names below are kept for then.');
    }

    if (!previous && hasKitFiles({
        cwd,
        stackDir: dir
    })) {
        prompter.warn(`${MANIFEST} is missing but Brigade files already exist here. Nothing is overwritten: files identical to the kit are adopted and files that differ are kept, and get a .proposed only when the kit changed them. If the manifest exists in your team's repo, restore it from git first.`);
    }

    // A version change replays the kit with the stored answers and only asks the missing options. Otherwise (first
    // install, same version) every question is asked.
    const update = choice === 'update' && installed !== version;

    const { answers, personal, asked } = await askOptions({
        cwd,
        prompter,
        previous: previous?.answers ?? {},
        full: !update
    });

    const plan = planFiles({
        cwd,
        stackDir: dir,
        answers,
        previous
    });
    const { report } = plan;

    // An update shows what it will change before writing anything.
    if (!dryRun && previous && prompter.interactive && !await confirmChanges({
        prompter,
        report
    })) {
        return {
            kept: installed,
            stack: previous.stack ?? name,
            answers: previous.answers,
            report: [],
            ignored: [],
            repo,
            prompter,
            personal: {},
            local: null
        };
    }

    // The plan now holds every write, the manifest included.
    const extras = planExtras({
        cwd,
        version,
        stack: name,
        answers,
        hashes: plan.hashes
    });

    report.push(...extras.report);
    plan.writes.push(...extras.writes);
    const { ignored } = extras;

    if (dryRun) {
        return {
            dryRun,
            version,
            stack: name,
            answers,
            report,
            ignored,
            repo,
            prompter,
            personal: {},
            local: null,
            asked
        };
    }

    applyPlan(cwd, plan);

    const local = personal.language ? writeLocalSettings(cwd, {
        language: personal.language
    }) : null;

    return {
        version,
        stack: name,
        answers,
        report,
        ignored,
        repo,
        prompter,
        personal,
        local,
        asked
    };
}
