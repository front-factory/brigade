import assert from 'node:assert/strict';
import { test } from 'node:test';
import { merge3 } from '../src/merge.js';

const lines = (...items) => `${items.join('\n')}\n`;

test('changes in different places are both kept', () => {
    const result = merge3(lines('a', 'b', 'c', 'd', 'e'), lines('A', 'b', 'c', 'd', 'e'), lines('a', 'b', 'c', 'd', 'E'));
    assert.deepEqual(result, { text: lines('A', 'b', 'c', 'd', 'E'), conflicts: 0 });
});

test('the same change on both sides is taken once', () => {
    const result = merge3(lines('a', 'b'), lines('a', 'X'), lines('a', 'X'));
    assert.deepEqual(result, { text: lines('a', 'X'), conflicts: 0 });
});

test('identical sides give that text, whatever the base', () => {
    assert.equal(merge3('old\n', 'same\n', 'same\n').text, 'same\n');
    assert.equal(merge3('', 'same\n', 'same\n').text, 'same\n');
});

test('only one side changed: that side wins', () => {
    assert.equal(merge3(lines('a', 'b'), lines('a', 'b'), lines('a', 'Z')).text, lines('a', 'Z'));
    assert.equal(merge3(lines('a', 'b'), lines('a', 'Z'), lines('a', 'b')).text, lines('a', 'Z'));
});

test('the same line changed differently is a conflict with markers', () => {
    const result = merge3(lines('a', 'b', 'c'), lines('a', 'mine', 'c'), lines('a', 'kit', 'c'));
    assert.equal(result.conflicts, 1);
    assert.equal(result.text, lines('a', '<<<<<<< yours', 'mine', '=======', 'kit', '>>>>>>> kit', 'c'));
});

test('a line removed by one side and edited by the other is a conflict', () => {
    const result = merge3(lines('a', 'b', 'c'), lines('a', 'c'), lines('a', 'B', 'c'));
    assert.equal(result.conflicts, 1);
    assert.equal(result.text, lines('a', '<<<<<<< yours', '=======', 'B', '>>>>>>> kit', 'c'));
});

test('two separate conflicts are counted', () => {
    const result = merge3(lines('a', 'x', 'b', 'y', 'c'), lines('a', '1', 'b', '2', 'c'), lines('a', 'I', 'b', 'II', 'c'));
    assert.equal(result.conflicts, 2);
});

test('lines added at the start and at the end of the file are kept', () => {
    const result = merge3(lines('b'), lines('top', 'b'), lines('b', 'bottom'));
    assert.deepEqual(result, { text: lines('top', 'b', 'bottom'), conflicts: 0 });
});

test('lines removed at the start and at the end of the file are removed', () => {
    const result = merge3(lines('a', 'b', 'c', 'd'), lines('b', 'c', 'd'), lines('a', 'b', 'c'));
    assert.deepEqual(result, { text: lines('b', 'c'), conflicts: 0 });
});

test('an empty base: both sides added the same thing, or different things', () => {
    assert.deepEqual(merge3('', 'a\n', ''), { text: 'a\n', conflicts: 0 });
    assert.deepEqual(merge3('', '', 'k\n'), { text: 'k\n', conflicts: 0 });
    assert.equal(merge3('', 'a\n', 'k\n').conflicts, 1);
});

test('everything removed by one side while the other kept it', () => {
    assert.deepEqual(merge3(lines('a', 'b'), '', lines('a', 'b')), { text: '', conflicts: 0 });
});

test('the two sides add different lines at the same place: conflict', () => {
    const result = merge3(lines('a', 'b'), lines('a', 'mine', 'b'), lines('a', 'kit', 'b'));
    assert.equal(result.text, lines('a', '<<<<<<< yours', 'mine', '=======', 'kit', '>>>>>>> kit', 'b'));
});

test('CRLF is ignored for the merge and the result follows the developer\'s line endings', () => {
    const result = merge3('a\nb\nc\n', 'A\r\nb\r\nc\r\n', 'a\nb\nC\n');
    assert.deepEqual(result, { text: 'A\r\nb\r\nC\r\n', conflicts: 0 });
    assert.equal(merge3('a\r\nb\r\n', 'a\nb\n', 'a\r\nB\r\n').text, 'a\nB\n');
});

test('a conflict keeps the developer\'s CRLF in the markers too', () => {
    const result = merge3('a\r\n', 'mine\r\n', 'kit\r\n');
    assert.equal(result.text, '<<<<<<< yours\r\nmine\r\n=======\r\nkit\r\n>>>>>>> kit\r\n');
});

test('a missing final newline is a change like another and markers stay on their own line', () => {
    assert.deepEqual(merge3('a\nb', 'a\nb', 'a\nb\n'), { text: 'a\nb\n', conflicts: 0 });
    assert.equal(merge3('a\nb', 'a\nmine', 'a\nkit').text, 'a\n<<<<<<< yours\nmine\n=======\nkit\n>>>>>>> kit\n');
});

test('a repeated line does not mislead the alignment', () => {
    const base = lines('x', '', 'y', '', 'z');
    const result = merge3(base, lines('x', '', 'Y', '', 'z'), lines('x', '', 'y', '', 'Z'));
    assert.deepEqual(result, { text: lines('x', '', 'Y', '', 'Z'), conflicts: 0 });
});

test('merging a result again with the same kit changes nothing', () => {
    const base = lines('a', 'b', 'c');
    const first = merge3(base, lines('a', 'mine', 'c'), lines('a', 'b', 'c', 'd'));
    assert.deepEqual(merge3(base, first.text, lines('a', 'b', 'c', 'd')), first);
});

test('files too different to align cheaply give null', () => {
    const big = (prefix) => Array.from({ length: 5000 }, (_, index) => `${prefix}${index}\n`).join('');
    assert.equal(merge3(big('a'), big('b'), big('c')), null);
});
