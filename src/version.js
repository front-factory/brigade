import { readFileSync } from 'node:fs';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const split = (version) => {
    const [
        core,
        ...pre
    ] = version.split('+')[0].split('-');

    return [
        core.split('.').map((part) => Number.parseInt(part, 10) || 0),
        pre.length ? pre.join('-').split('.') : []
    ];
};

const NUMERIC = /^\d+$/;

// Semver precedence between two pre-release identifiers: numeric ones numerically and below alphanumeric ones.
function compareIdentifiers(a, b) {
    const [
        numA,
        numB
    ] = [
        NUMERIC.test(a),
        NUMERIC.test(b)
    ];

    if (numA && numB) {
        return Number(a) - Number(b);
    }

    if (numA !== numB) {
        return numA ? -1 : 1;
    }

    return a < b ? -1 : a > b ? 1 : 0;
}

// Positive when `a` is newer than `b`, negative when older, 0 when equal. Build metadata is ignored;
// a pre-release is older than the same version without one.
export function compareVersions(a, b) {
    const [
        [
            coreA,
            preA
        ],
        [
            coreB,
            preB
        ]
    ] = [
        split(a),
        split(b)
    ];

    for (let i = 0; i < Math.max(coreA.length, coreB.length); i++) {
        const diff = (coreA[i] ?? 0) - (coreB[i] ?? 0);

        if (diff !== 0) {
            return diff;
        }
    }

    if (!preA.length || !preB.length) {
        return preB.length - preA.length;
    }

    for (let i = 0; i < Math.min(preA.length, preB.length); i++) {
        const diff = compareIdentifiers(preA[i], preB[i]);

        if (diff !== 0) {
            return diff;
        }
    }

    return preA.length - preB.length;
}
