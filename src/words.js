// How a file status is told to the dev, once for a real run and once for a preview.
export const WORDS = {
    created: 'added',
    updated: 'updated',
    merged: 'merged, your edits kept',
    unchanged: 'already up to date',
    kept: 'yours kept',
    proposed: 'yours kept, proposal written',
    removed: 'removed, no longer in the kit',
    obsolete: 'yours kept, no longer in the kit'
};

export const PREVIEW_WORDS = {
    ...WORDS,
    created: 'would be added',
    updated: 'would be updated',
    merged: 'would be merged, your edits kept',
    proposed: 'yours kept, proposal would be written',
    removed: 'would be removed, no longer in the kit'
};

// Statuses that change something on disk.
export const CHANGING = new Set(['created', 'updated', 'merged', 'removed']);

// Statuses that leave a `<file>.proposed` next to the developer's file.
export const PROPOSALS = new Set(['proposed']);
