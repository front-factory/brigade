import * as p from '@clack/prompts';

const OTHER = Symbol('other');

// Non-interactive (no TTY or `--yes`): every question resolves to its default and nothing is printed.
export function createPrompter({ interactive }) {
    // Nothing is written before the last question, so cancelling leaves the project untouched.
    const answer = async (pending) => {
        const value = await pending;
        if (p.isCancel(value)) {
            p.cancel('Cancelled. Nothing was written.');
            process.exit(1);
        }
        return value;
    };

    async function text(message, fallback = '') {
        if (!interactive) return fallback;
        return (await answer(p.text({ message, placeholder: fallback, defaultValue: fallback }))).trim();
    }

    // `options`: [{ value, label, hint? }]. The first one is preselected.
    async function choose(message, options, { other = true } = {}) {
        if (!interactive) return options[0].value;

        const items = options.map(({ value, label, hint }) => ({ value, label, hint }));
        if (other) items.push({ value: OTHER, label: 'Other…' });

        const value = await answer(p.select({ message, options: items, initialValue: options[0].value }));
        return value === OTHER ? text(`${message} (type it)`) : value;
    }

    // A detected value is proposed first; Enter keeps it, "no" goes on to `pick`.
    async function validate(message, detected, pick, shown = detected) {
        if (!detected) return pick();
        if (!interactive) return detected;

        const keep = await answer(p.confirm({ message: `${message}: ${shown}. Is that right?`, initialValue: true }));
        return keep ? detected : pick();
    }

    const when = (fn) => (...args) => interactive && fn(...args);

    return {
        text,
        choose,
        validate,
        intro: when((title) => p.intro(title)),
        info: when((message) => p.log.info(message)),
        warn: when((message) => p.log.warn(message)),
        note: when((message, title) => p.note(message, title)),
        outro: when((message) => p.outro(message)),
        close: () => {}
    };
}
