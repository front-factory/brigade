import { CONVENTIONS } from './conventions.js';
import { runInit } from './init.js';
import { STACKS } from './stacks.js';

const HELP = `Usage: brigade init [--yes] [--stack <name>]

  --yes           accept every detected or default answer, ask nothing
  --stack <name>  force the stack (${Object.keys(STACKS).join(', ')}); detected otherwise
`;

const WORDS = {
    created: 'added',
    updated: 'updated',
    unchanged: 'already up to date',
    kept: 'yours kept',
    proposed: 'yours kept, proposal written'
};

function parse(args) {
    const options = { yes: false, stack: undefined };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--yes' || args[i] === '-y') options.yes = true;
        else if (args[i] === '--stack') options.stack = args[++i];
        else throw new Error(`Unknown option: ${args[i]}`);
    }
    if (options.stack && !STACKS[options.stack]) throw new Error(`Unknown stack: ${options.stack}`);
    return options;
}

function summary({ version, answers, report, ignored, repo, personal, local }) {
    const lines = report.map(({ path, status }) => `${WORDS[status].padEnd(28)} ${path}${status === 'proposed' ? '.proposed' : ''}`);
    for (const { path, status, added } of ignored) {
        if (status === 'updated') lines.push(`${'lines added'.padEnd(28)} ${path} (${added.join(', ')})`);
    }

    const settings = [
        `Brigade          ${version}`,
        `Default branch   ${answers.defaultBranch}`,
        `Reference branch ${answers.baseBranch}`,
        `Package manager  ${answers.packageManager}`,
        `Commit format    ${CONVENTIONS[answers.commitConvention]?.label ?? 'Custom'}`,
        `Replies          ${answers.replyLanguage} (project default)`,
        `Code             ${answers.codeLanguage}`,
        `Documentation    ${answers.docsLanguage}`,
        `Replies for you  ${personal.language && local?.status === 'written' ? `${personal.language} (your machine only)` : 'project default'}`
    ];
    return { files: lines.join('\n'), settings: settings.join('\n'), kept: report.some(({ status }) => status === 'proposed'), repo };
}

function print(result, interactive) {
    const { prompter } = result;
    if (result.kept) {
        if (interactive) prompter.outro(`Kept Brigade ${result.kept}. Nothing was written.`);
        else console.log(`Brigade ${result.kept} kept. Nothing was written.`);
        return;
    }

    const { files, settings, kept, repo } = summary(result);

    if (!interactive) {
        console.log(`Brigade installed (stack: ${result.stack}).\n\n${files}\n\n${settings}`);
        return;
    }

    prompter.note(files, 'Files');
    prompter.note(settings, 'Your setup');
    if (kept) prompter.warn('Some files of yours differ from the kit: they were kept. Merge the .proposed version if you want it.');
    if (!repo) prompter.warn('Remember to run `git init` before your first commit.');
    prompter.outro('Done. Run `claude` here, use Plan Mode (Shift+Tab) to discuss, and /brigade-language and /brigade-effort for your own settings.');
}

export async function main(argv) {
    const [command, ...rest] = argv;
    if (command !== 'init') {
        console.log(HELP);
        return command === undefined || command === '--help' ? 0 : 1;
    }

    try {
        const options = parse(rest);
        const interactive = Boolean(process.stdin.isTTY) && !options.yes;
        print(await runInit({ cwd: process.cwd(), interactive, ...options }), interactive);
        return 0;
    } catch (error) {
        console.error(`brigade: ${error.message}`);
        return 1;
    }
}
