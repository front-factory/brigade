import { readFileSync } from 'node:fs';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const parts = (version) => version.split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);

// Positive when `a` is newer than `b`, negative when older, 0 when equal. Pre-release tags are ignored.
export function compareVersions(a, b) {
    const [left, right] = [parts(a), parts(b)];
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const diff = (left[i] ?? 0) - (right[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}
