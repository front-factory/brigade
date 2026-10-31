import { runInit, VERSION } from './install.js';
import { STACKS } from './kit.js';
import { recapRows } from './options.js';
import { CancelError, createPrompter } from './prompt.js';
import { runUninstall } from './uninstall.js';
import * as ui from './ui.js';

const STACK_NAMES = Object.keys(STACKS).join(', ');

const HELP = `Usage: brigade init [--yes] [--dry-run] [--stack <name>]
       brigade uninstall [--yes] [--dry-run]
       brigade --version

  uninstall       remove what Brigade wrote and keep every file you edited (needs --yes without a terminal)

  --yes           accept every detected or default answer, ask nothing
                  (an installed project is updated with its stored answers; new options get their default)
  --dry-run       list what an install or update would do, write nothing, ask nothing
  --stack <name>  force the stack (${STACK_NAMES}); detected otherwise
  -h, --help      show this help
  -v, --version   show the version
`;

function parse(args, command) {
    const options = {
        yes: false,
        dryRun: false,
        stack: undefined
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--yes' || arg === '-y') {
            options.yes = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (command === 'init' && arg.split('=')[0] === '--stack') {
            options.stack = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : args[++i];

            if (!options.stack || options.stack.startsWith('-')) {
                throw new Error(`--stack needs a value (${STACK_NAMES})`);
            }

            if (!Object.hasOwn(STACKS, options.stack)) {
                throw new Error(`Unknown stack: ${options.stack}`);
            }
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    return options;
}

function printInit(result, { p, dryRun }) {
    if (result.kept) {
        console.log(`Brigade ${result.kept} kept. Nothing was written.`);

        return;
    }

    const { report, warnings, answers, personal, added, stack } = result;
    const asked = added.map((key) => `${key}: ${answers[key]}`).join(', ');
    const mine = personal.language && !warnings.length ? `${personal.language} (your machine only)` : 'project default';

    const rows = [
        `Brigade|${VERSION}`,
        ...recapRows(answers),
        `Replies for you|${mine}`
    ];

    const hints = [
        'Commit `.claude/` (with `brigade.json`) to share the install with your team.',
        'Run `claude` here: it starts in Plan Mode.',
        '/brigade-settings sets your own preferences (language, effort, reference branch).'
    ];

    const title = dryRun ? `Brigade dry run (stack: ${stack}). Nothing was written.` : `Brigade installed (stack: ${stack}).`;

    console.log(`\n${title}\n\n${ui.lines(report, dryRun)}\n${ui.card('Your setup', rows, p.interactive)}`);

    if (asked) {
        console.log(`\nNew options, default used: ${asked}`);
    }

    warnings.forEach(p.warn);

    console.log(dryRun ? '\nRun without --dry-run to apply.' : `\n${hints.map((hint) => `  ${ui.accent('›')} ${hint}`).join('\n')}`);
}

function printUninstall({ report, aborted }, { dryRun }) {
    const left = 'The lines Brigade added to .gitignore and .gitattributes stay: remove them yourself if you want.';

    console.log(aborted ? 'Nothing was removed.' : `\nBrigade ${dryRun ? 'uninstall dry run. Nothing was removed' : 'removed'}.\n\n${ui.lines(report, dryRun)}\n\n${left}\nRemoved files are still in your git history.${dryRun ? '\n\nRun without --dry-run to apply.' : ''}`);
}

const isHelp = (arg) => arg === '--help' || arg === '-h';

export async function main(argv) {
    const [
        command,
        ...rest
    ] = argv;

    if (command === undefined || command === 'help' || isHelp(command)) {
        console.log(HELP);

        return 0;
    }

    if (command === '--version' || command === '-v') {
        console.log(VERSION);

        return 0;
    }

    if (command !== 'init' && command !== 'uninstall') {
        console.error(`brigade: Unknown command: ${command}\n\n${HELP}`);

        return 1;
    }

    if (rest.some(isHelp)) {
        console.log(HELP);

        return 0;
    }

    try {
        const { yes, dryRun, stack } = parse(rest, command);
        const p = createPrompter(Boolean(process.stdin.isTTY && process.stdout.isTTY) && !yes && !dryRun);

        const options = {
            cwd: process.cwd(),
            p,
            yes,
            dryRun,
            stack
        };

        if (command === 'uninstall') {
            printUninstall(await runUninstall(options), options);
        } else {
            printInit(await runInit(options), options);
        }

        return 0;
    } catch (error) {
        if (error instanceof CancelError) {
            console.log(`\n${ui.dim(error.message)}`);

            return 1;
        }

        console.error(`brigade: ${error.message}`);

        return 1;
    }
}
