import { styleText } from 'node:util';

// The only place with colors and wording. `styleText` drops the escape codes by itself when the output is not a
// terminal or when NO_COLOR is set.
export const accent = (text) => styleText('yellow', text);
export const dim = (text) => styleText('gray', text);
export const bright = (text) => styleText('whiteBright', text);

// "done|preview": what a status says after a run and in a dry run or an update preview.
const WORDS = {
    created: 'added|would be added',
    updated: 'updated|would be updated',
    merged: 'merged, your edits kept|would be merged, your edits kept',
    appended: 'lines added|lines would be added',
    unchanged: 'already up to date',
    kept: 'yours kept',
    proposed: 'yours kept, proposal written|yours kept, proposal would be written',
    removed: 'removed, no longer in the kit|would be removed, no longer in the kit',
    obsolete: 'yours kept, no longer in the kit',
    deleted: 'removed|would be removed',
    stripped: 'stripped, yours kept|would be stripped, yours kept',
    left: 'yours kept, delete it yourself'
};

// Statuses that leave nothing to tell in an update preview.
export const QUIET = new Set([
    'unchanged',
    'kept'
]);

// One line per file: the status in words, then the path.
export const lines = (report, preview) => report.map(({ path, status, detail }) => {
    const words = WORDS[status].split('|');
    const shown = `${path}${status === 'proposed' ? '.proposed' : ''}${detail ? ` (${detail})` : ''}`;

    return `${(preview ? words.at(-1) : words[0]).padEnd(32)} ${shown}`;
}).join('\n');

export const banner = (version) => `\n  ${accent('B R I G A D E')}  ${dim(version)}\n  ${dim('Claude Code, organized like a kitchen brigade.')}\n`;

// Aligned key/value rows (`rows`: "key|value"), plain when `box` is false.
export function card(title, rows, box = true) {
    const width = Math.max(...rows.map((row) => row.indexOf('|'))) + 2;
    const body = rows.map((row) => `${row.slice(0, row.indexOf('|')).padEnd(width)}${row.slice(row.indexOf('|') + 1)}`);

    return box ? `\n${accent(title)}\n${body.map((line) => `  ${dim('│')} ${line}`).join('\n')}` : body.join('\n');
}
