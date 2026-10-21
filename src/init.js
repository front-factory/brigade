import { isGitRepo } from './detect.js';
import { appendMissingLines, hasKitFiles, installFiles, MANIFEST, readManifest, writeLocalSettings, writeManifest, writeOptionsFile } from './install.js';
import { askOptions } from './options.js';
import { createPrompter } from './prompt.js';
import { DEFAULT_STACK, STACKS, detectStack } from './stacks.js';
import { VERSION, compareVersions } from './version.js';

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
            { value: 'update', label: `${newer ? 'Update' : 'Switch'} to ${version}`, hint: 'new kit files, your answers are kept and only new options are asked. Files you edited are kept' },
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
    prompter.banner(version);
    prompter.info(`Stack: ${name}${stack ? '' : ' (the only one available for now)'}.`);

    const installed = previous?.version;
    const choice = installed && await chooseVersion({ prompter, installed, version });
    if (choice === 'keep') {
        return { kept: installed, stack: previous.stack ?? name, answers: previous.answers, report: [], ignored: [], repo, prompter, personal: {}, local: null };
    }

    if (!repo) {
        prompter.warn('No git repository here. Brigade will not create one: run `git init` when you are ready. The branch names below are kept for then.');
    }
    if (!previous && hasKitFiles({ cwd, stackDir: dir })) {
        prompter.warn(`${MANIFEST} is missing but Brigade files already exist here. Nothing is overwritten: files identical to the kit are adopted and files that differ get a .proposed. If the manifest exists in your team's repo, restore it from git first.`);
    }
    // A version change replays the kit with the stored answers and only asks the missing options. Otherwise (first
    // install, same version) every question is asked.
    const update = choice === 'update' && installed !== version;
    const { answers, personal, asked } = await askOptions({ cwd, prompter, previous: previous?.answers ?? {}, full: !update });

    const { report, hashes } = installFiles({ cwd, stackDir: dir, answers, previous });
    report.push(writeOptionsFile({ cwd, answers }));
    writeManifest({ cwd, version, stack: name, answers, hashes });
    const ignored = appendMissingLines(cwd);
    const local = personal.language ? writeLocalSettings(cwd, { language: personal.language }) : null;

    return { version, stack: name, answers, report, ignored, repo, prompter, personal, local, asked };
}
