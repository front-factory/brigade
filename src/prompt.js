import * as p from '@clack/prompts';
import * as ui from './ui.js';

const OTHER = Symbol('other');

// A choice of `choose`.
export const item = (value, hint, label = value) => ({
    value,
    label,
    hint
});

// Thrown when the developer cancels a question; `main` prints the message and exits with 1. Nothing is written
// before the last question, so the project stays untouched.
export class CancelError extends Error {
    constructor() {
        super('Cancelled. Nothing was written.');
        this.name = 'CancelError';
    }
}

const answer = async (pending) => {
    const value = await pending;

    if (p.isCancel(value)) {
        throw new CancelError();
    }

    return value;
};

// Without a terminal (or with --yes) every question resolves to its default and nothing is printed.
export function createPrompter(interactive) {
    const text = async (message, fallback = '', required = false) => {
        if (!interactive) {
            return fallback;
        }

        const reply = await answer(p.text({
            message,
            placeholder: fallback,
            defaultValue: fallback,
            validate: required && !fallback ? (value) => (value?.trim() ? undefined : 'Please type something.') : undefined
        }));

        return reply.trim();
    };

    // `options`: [{ value, label, hint? }], the first one is preselected. `other` adds a free answer.
    const choose = async (message, options, other = false) => {
        if (!interactive) {
            return options[0].value;
        }

        const items = other ? options.concat(item(OTHER, undefined, 'Other…')) : options;

        const value = await answer(p.select({
            message,
            options: items,
            initialValue: options[0].value
        }));

        return value === OTHER ? text(`${message} (type it)`, '', true) : value;
    };

    // Several values among `options` ([{ value, label, hint? }]), none allowed. `initial` is preselected and is the answer
    // without a terminal.
    const multi = async (message, options, initial = []) => {
        if (!interactive) {
            return initial;
        }

        return answer(p.multiselect({
            message,
            options,
            initialValues: initial,
            required: false
        }));
    };

    const say = (message) => interactive && console.log(message);

    return {
        interactive,
        text,
        choose,
        multi,
        say,
        confirm: async (message, initial = true) => (interactive ? answer(p.confirm({
            message,
            initialValue: initial
        })) : initial),
        banner: (version) => say(ui.banner(version)),
        warn: (message) => console.log(`${ui.accent('!')} ${message}`)
    };
}
