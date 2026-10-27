import * as p from '@clack/prompts';

import * as ui from './ui.js';

const OTHER = Symbol('other');

// Thrown when the developer cancels a question; `main` prints the message and exits with 1.
export class CancelError extends Error {
    constructor() {
        super('Cancelled. Nothing was written.');
        this.name = 'CancelError';
    }
}

// Non-interactive (no TTY or `--yes`): every question resolves to its default and nothing is printed.
export function createPrompter({ interactive }) {
    // Nothing is written before the last question, so cancelling leaves the project untouched.
    const answer = async (pending) => {
        const value = await pending;

        if (p.isCancel(value)) {
            throw new CancelError();
        }

        return value;
    };

    // `required`: a blank answer is refused, unless the fallback gives Enter something to keep.
    async function text(message, fallback = '', { required = false } = {}) {
        if (!interactive) {
            return fallback;
        }

        const validate = required && !fallback.trim() ? (value) => (value?.trim() ? undefined : 'Please type something.') : undefined;

        return (await answer(p.text({
            message,
            placeholder: fallback,
            defaultValue: fallback,
            validate
        }))).trim();
    }

    // `options`: [{ value, label, hint? }]. The first one is preselected.
    async function choose(message, options, { other = true } = {}) {
        if (!interactive) {
            return options[0].value;
        }

        const items = options.map(({ value, label, hint }) => ({
            value,
            label,
            hint
        }));

        if (other) {
            items.push({
                value: OTHER,
                label: 'Other…'
            });
        }

        const value = await answer(p.select({
            message,
            options: items,
            initialValue: options[0].value
        }));

        return value === OTHER ? text(`${message} (type it)`) : value;
    }

    // A detected value is proposed first; Enter keeps it, "no" goes on to `pick`.
    async function validate(message, detected, pick, shown = detected) {
        if (!detected) {
            return pick();
        }

        if (!interactive) {
            return detected;
        }

        const keep = await answer(p.confirm({
            message: `${message}: ${shown}. Is that right?`,
            initialValue: true
        }));

        return keep ? detected : pick();
    }

    // A yes/no question. Nothing is asked without a dev: yes.
    async function confirm(message) {
        if (!interactive) {
            return true;
        }

        return answer(p.confirm({
            message,
            initialValue: true
        }));
    }

    // Several values among `options` ([{ value, label, hint? }]), at least one. Nothing is asked without a dev.
    async function multi(message, options) {
        if (!interactive) {
            return [];
        }

        return answer(p.multiselect({
            message,
            options: options.map(({ value, label, hint }) => ({
                value,
                label,
                hint
            })),
            required: true
        }));
    }

    const when = (fn) => (...args) => interactive && fn(...args);

    return {
        text,
        interactive,
        choose,
        confirm,
        multi,
        validate,
        banner: when((version) => console.log(ui.banner(version))),
        step: when((n, total, label) => console.log(ui.step(n, total, label))),
        card: when((title, rows) => console.log(ui.card(title, rows))),
        files: when((items) => console.log(`\n${ui.checklist(items)}`)),
        info: when((message) => console.log(`${ui.dim('·')} ${ui.dim(message)}`)),
        warn: when((message) => console.log(`${ui.accent('!')} ${message}`)),
        outro: when((message) => console.log(`\n${message}`)),
        done: when((message, lines) => console.log(`\n${ui.success('✓')} ${ui.bright(message)}\n${ui.bullets(lines)}\n`))
    };
}
