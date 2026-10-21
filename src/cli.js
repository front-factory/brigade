import { parseArgs } from 'node:util';

import { runInit } from './init.js';
import { recapRows } from './options.js';
import { STACKS } from './stacks.js';
import { VERSION } from './version.js';

const HELP = `Usage: brigade init [--yes] [--stack <name>]
       brigade --version

  --yes           accept every detected or default answer, ask nothing
                  (an installed project is updated with its stored answers; new options get their default)
  --stack <name>  force the stack (${Object.keys(STACKS).join(', ')}); detected otherwise
  -h, --help      show this help
  -v, --version   show the version
`;

const WORDS = {
    created: 'added',
    updated: 'updated',
    unchanged: 'already up to date',
    kept: 'yours kept',
    proposed: 'yours kept, proposal written'
};

function parse(args) {
    let values;
    try {
        ({ values } = parseArgs({ args, options: { yes: { type: 'boolean', short: 'y' }, stack: { type: 'string' } } }));
    } catch (error) {
        const arg = /'([^']+)'/.exec(error.message)?.[1];
        if (error.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE' && arg?.startsWith('--stack')) {
            throw new Error(`--stack needs a value (${Object.keys(STACKS).join(', ')})`);
        }
        if (error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || error.code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL') {
            throw new Error(`Unknown option: ${arg}`);
        }
        throw error;
    }
    const options = { yes: values.yes ?? false, stack: values.stack };
    if (options.stack === '') throw new Error(`--stack needs a value (${Object.keys(STACKS).join(', ')})`);
    if (options.stack && !STACKS[options.stack]) throw new Error(`Unknown stack: ${options.stack}`);
    return options;
}

// Plain-text rows, the label padded to a common column.
const plain = (rows) => rows.map(([label, value]) => `${label.padEnd(17)}${value}`).join('\n');

function summary({ version, answers, report, ignored, repo, personal, local, asked = [] }) {
    const files = report.map(({ path, status }) => ({
        done: status === 'created' || status === 'updated',
        label: `${path}${status === 'proposed' ? '.proposed' : ''}`,
        detail: WORDS[status],
        plain: `${WORDS[status].padEnd(28)} ${path}${status === 'proposed' ? '.proposed' : ''}`
    }));
    for (const { path, status, added } of ignored) {
        if (status === 'updated') files.push({ done: true, label: path, detail: `lines added (${added.join(', ')})`, plain: `${'lines added'.padEnd(28)} ${path} (${added.join(', ')})` });
    }

    const notes = report.filter(({ note }) => note).map(({ path, note }) => `${path}: ${note}`);
    const rows = [
        ['Brigade', version],
        ...recapRows(answers),
        ['Replies for you', personal.language && local?.status === 'written' ? `${personal.language} (your machine only)` : 'project default']
    ];
    const added = asked.flat().map((key) => `${key}: ${answers[key]}`).join(', ');
    return { files, notes, rows, added, kept: report.some(({ status }) => status === 'proposed'), repo };
}

const plainFiles = (files, notes) => [...files.map(({ plain }) => plain), ...(notes.length ? ['', ...notes] : [])].join('\n');

function print(result, interactive) {
    const { prompter } = result;
    if (result.kept) {
        if (interactive) prompter.outro(`Kept Brigade ${result.kept}. Nothing was written.`);
        else console.log(`Brigade ${result.kept} kept. Nothing was written.`);
        return;
    }

    const { files, notes, rows, added, kept, repo } = summary(result);

    if (!interactive) {
        const news = added ? `\n\nNew options, default used: ${added}` : '';
        console.log(`Brigade installed (stack: ${result.stack}).\n\n${plainFiles(files, notes)}\n\n${plain(rows)}${news}\n\nCommit .claude/ including .claude/brigade.json so the install is shared with your team and can be updated from any machine.`);
        return;
    }

    prompter.step(3, 3, 'Installation');
    prompter.files(files);
    for (const note of notes) prompter.info(note);
    prompter.card('Your setup', rows);
    if (added) prompter.info(`New options set up: ${added}`);
    if (kept) prompter.warn('Some files of yours differ from the kit: they were kept. Merge the .proposed version if you want it.');
    if (!repo) prompter.warn('Remember to run `git init` before your first commit.');
    prompter.done('Done. Brigade is ready.', [
        'Commit `.claude/` (with `brigade.json`) to share the install.',
        'Run `claude` here, Shift+Tab for Plan Mode.',
        '/brigade-language and /brigade-effort set your own preferences.'
    ]);
}

const isHelp = (arg) => arg === '--help' || arg === '-h';

export async function main(argv) {
    const [command, ...rest] = argv;
    if (command === undefined || command === 'help' || isHelp(command)) {
        console.log(HELP);
        return 0;
    }
    if (command === '--version' || command === '-v') {
        console.log(VERSION);
        return 0;
    }
    if (command !== 'init') {
        console.error(`brigade: Unknown command: ${command}\n\n${HELP}`);
        return 1;
    }
    if (rest.some(isHelp)) {
        console.log(HELP);
        return 0;
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
