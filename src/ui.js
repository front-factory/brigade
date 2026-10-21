import { styleText } from 'node:util';

// The only place with colors and layout. `styleText` drops the escape codes by itself when the output is not a
// terminal or when NO_COLOR is set, so every helper degrades to plain text.
// Palette: amber accent, bright (cream) text, dim secondary, green for success, red for errors only.
const paint = (format, text) => styleText(format, text);

export const accent = (text) => paint(['bold', 'yellow'], text);
export const bright = (text) => paint('whiteBright', text);
export const dim = (text) => paint('gray', text);
export const success = (text) => paint('green', text);
export const warning = (text) => paint('yellow', text);
export const danger = (text) => paint('red', text);

const TAGLINE = 'Claude Code, organized like a kitchen brigade.';
const FALLBACK_COLUMNS = 80;

// A terminal reporting 0 columns (or none) is treated as 80.
const columnsOf = (columns = process.stdout.columns) => (columns > 0 ? columns : FALLBACK_COLUMNS);

const truncate = (text, max) => (text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`);

// Compact welcome header: letter-spaced wordmark, dimmed version, a rule, the tagline.
export function banner(version) {
    const wordmark = [...'BRIGADE'].join(' ');
    return [
        '',
        `  ${accent(wordmark)}  ${dim(version)}`,
        `  ${dim('─'.repeat(TAGLINE.length))}`,
        `  ${dim(TAGLINE)}`,
        ''
    ].join('\n');
}

// A section label such as "1/3  Detection".
export function step(n, total, label) {
    return `\n${accent(`${n}/${total}`)}  ${bright(label)}`;
}

// An aligned key/value card with rounded borders, fitted to its content and capped to the terminal width.
// `rows`: [[label, value]].
export function card(title, rows, { columns } = {}) {
    const keyWidth = Math.max(0, ...rows.map(([key]) => key.length));
    const content = Math.max(title.length + 2, ...rows.map(([, value]) => keyWidth + 2 + value.length));
    const inner = Math.max(12, Math.min(content, columnsOf(columns) - 4));
    const valueWidth = Math.max(0, inner - keyWidth - 2);

    const name = truncate(title, inner - 2);
    const top = `${dim('╭─')} ${accent(name)} ${dim(`${'─'.repeat(inner - name.length - 2)}─╮`)}`;
    const body = rows.map(([key, value]) => {
        const shown = truncate(value, valueWidth);
        const pad = ' '.repeat(Math.max(0, inner - keyWidth - 2 - shown.length));
        return `${dim('│')} ${dim(key.padEnd(keyWidth))}  ${bright(shown)}${pad} ${dim('│')}`;
    });
    const bottom = dim(`╰${'─'.repeat(inner + 2)}╯`);
    return ['', top, ...body, bottom].join('\n');
}

// A tidy list. `items`: [{ done, label, detail? }]. Done items get a green check, the others are dimmed.
export function checklist(items) {
    const width = Math.max(0, ...items.map(({ label }) => label.length));
    return items.map(({ done, label, detail = '' }) => {
        const gap = ' '.repeat(width - label.length);
        return done
            ? `  ${success('✓')} ${bright(label)}${gap}  ${dim(detail)}`
            : `  ${dim('-')} ${dim(label)}${gap}  ${dim(detail)}`;
    }).join('\n');
}

// Short lines with accent bullets.
export const bullets = (lines) => lines.map((line) => `  ${accent('›')} ${bright(line)}`).join('\n');
