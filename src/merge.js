// Three-way merge of text, line by line (diff3): `base` is the common ancestor, `ours` and `theirs` both derive from it.

export const MARKERS = { ours: '<<<<<<< yours', split: '=======', theirs: '>>>>>>> kit' };

// Above this many table cells the files are too different or too big to align cheaply: the caller falls back.
const MAX_CELLS = 16_000_000;

// A line keeps its newline, so a missing final newline is a change like any other.
const toLines = (text) => text.replace(/\r\n/g, '\n').match(/[^\n]*\n|[^\n]+/g) ?? [];

// For every line of `a`, the index of its matching line in `b` (longest common subsequence), or -1.
// Returns null when the unmatched middle is too big.
function align(a, b) {
    const links = new Array(a.length).fill(-1);
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) {
        links[start] = start;
        start++;
    }
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) links[--endA] = --endB;

    const rows = endA - start;
    const cols = endB - start;
    if ((rows + 1) * (cols + 1) > MAX_CELLS) return null;

    // table[i][j]: length of the longest common subsequence of a[start + i..endA) and b[start + j..endB).
    const width = cols + 1;
    const table = new Uint32Array((rows + 1) * width);
    for (let i = rows - 1; i >= 0; i--) {
        for (let j = cols - 1; j >= 0; j--) {
            table[i * width + j] = a[start + i] === b[start + j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
        }
    }
    for (let i = 0, j = 0; i < rows && j < cols;) {
        if (a[start + i] === b[start + j]) links[start + i++] = start + j++;
        else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i++;
        else j++;
    }
    return links;
}

const same = (a, b) => a.length === b.length && a.every((line, index) => line === b[index]);

// { text, conflicts } or null when the files cannot be aligned cheaply. Line endings follow `ours`.
// Where both sides changed the same lines differently, the text holds both between conflict markers.
export function merge3(base, ours, theirs) {
    const [b, o, t] = [base, ours, theirs].map(toLines);
    const toOurs = align(b, o);
    const toTheirs = align(b, t);
    if (!toOurs || !toTheirs) return null;

    const out = [];
    let conflicts = 0;
    const settle = (baseLines, oursLines, theirsLines) => {
        if (same(oursLines, theirsLines) || same(theirsLines, baseLines)) out.push(...oursLines);
        else if (same(oursLines, baseLines)) out.push(...theirsLines);
        else {
            // A marker always starts a line, even after a last line that had no newline.
            const closed = (lines) => (lines.length && !lines.at(-1).endsWith('\n') ? [...lines.slice(0, -1), `${lines.at(-1)}\n`] : lines);
            out.push(`${MARKERS.ours}\n`, ...closed(oursLines), `${MARKERS.split}\n`, ...closed(theirsLines), `${MARKERS.theirs}\n`);
            conflicts++;
        }
    };

    // Base lines that both sides kept are the anchors: what lies between two anchors is settled as a block.
    let [fromBase, fromOurs, fromTheirs] = [0, 0, 0];
    for (let i = 0; i <= b.length; i++) {
        const anchor = i < b.length && toOurs[i] !== -1 && toTheirs[i] !== -1;
        if (i < b.length && !anchor) continue;
        const [toO, toT] = i < b.length ? [toOurs[i], toTheirs[i]] : [o.length, t.length];
        settle(b.slice(fromBase, i), o.slice(fromOurs, toO), t.slice(fromTheirs, toT));
        if (i < b.length) out.push(b[i]);
        [fromBase, fromOurs, fromTheirs] = [i + 1, toO + 1, toT + 1];
    }

    const eol = ours.includes('\r\n') ? '\r\n' : '\n';
    const text = out.join('');
    return { text: eol === '\n' ? text : text.replace(/\n/g, eol), conflicts };
}
