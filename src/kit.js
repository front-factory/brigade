import {
    existsSync, readdirSync, readFileSync, statSync
} from 'node:fs';
import {
    basename, dirname, join
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from './render.js';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

// A stack is a folder in `templates/` plus one entry here; `match` tells whether a project looks like it.
export const STACKS = {
    web: {
        dir: join(TEMPLATES, 'web'),
        match: (cwd) => existsSync(join(cwd, 'package.json'))
    }
};

// Left out of the kit when the `audits` option is off.
const AUDIT_FILES = new Set([
    '.claude/skills/audit/SKILL.md',
    '.claude/context/audits/_template.md'
]);

export const DEFAULT_STACK = 'web';

// Written once, then the team's own: never updated, never proposed over.
export const WRITE_ONCE = new Set([
    '.claude/context/decisions.md',
    '.claude/context/architecture.md'
]);

export const detectStack = (cwd) => Object.keys(STACKS).find((name) => STACKS[name].match(cwd)) ?? DEFAULT_STACK;

// The files of a stack rendered with the answers, sorted: [{ path, content, mode }].
export function kitFiles(stack, answers) {
    const dir = STACKS[stack].dir;

    return readdirSync(dir, {
        recursive: true
    }).map((name) => name.split('\\').join('/')).sort().filter((path) => statSync(join(dir, path)).isFile() && basename(path) !== '.DS_Store' && !(answers.audits === false && AUDIT_FILES.has(path))).map((path) => ({
        path,
        content: render(readFileSync(join(dir, path), 'utf8'), answers, path.endsWith('.json')),
        mode: statSync(join(dir, path)).mode & 0o777
    }));
}
