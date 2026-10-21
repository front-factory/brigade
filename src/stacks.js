import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

// A stack is a folder in `templates/` plus one entry here. `match` tells whether a project looks like it.
export const STACKS = {
    web: {
        label: 'Web',
        dir: join(TEMPLATES, 'web'),
        match: (cwd) => existsSync(join(cwd, 'package.json'))
    }
};

export const DEFAULT_STACK = 'web';

export function detectStack(cwd) {
    return Object.keys(STACKS).find((name) => STACKS[name].match(cwd)) ?? DEFAULT_STACK;
}
