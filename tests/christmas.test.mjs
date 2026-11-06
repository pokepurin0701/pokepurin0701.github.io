import { test } from 'node:test';
import assert from 'node:assert/strict';
import { japanDay, isChristmasSeason, isEmoji, normalizeNickname, ornamentPosition, parseTreeState } from '../assets/christmas-core.mjs';

test('December opens and closes at midnight in Japan', () => {
  for (const [instant, expected, open] of [
    ['2026-11-30T14:59:59Z', '2026-11-30', false],
    ['2026-11-30T15:00:00Z', '2026-12-01', true],
    ['2026-12-31T14:59:59Z', '2026-12-31', true],
    ['2026-12-31T15:00:00Z', '2027-01-01', false],
  ]) {
    assert.equal(japanDay(new Date(instant)), expected);
    assert.equal(isChristmasSeason(expected), open);
  }
});

test('accept a single emoji including joined families, modifiers, flags, and keycaps', () => {
  for (const emoji of ['🍓', '🍮', '❤️', '👨‍👩‍👧‍👦', '👍🏽', '🇯🇵', '1️⃣', '🏳️‍🌈']) assert.equal(isEmoji(emoji), true, emoji);
  for (const value of ['', 'hello', 'あ', '🍓🍮', '<img>', '1', '🍓a', null]) assert.equal(isEmoji(value), false, String(value));
});

test('nickname length counts visible characters and rejects hidden controls', () => {
  assert.equal(normalizeNickname('  ぽけ  '), 'ぽけ');
  assert.equal(normalizeNickname('か\u3099'), 'が');
  assert.equal(normalizeNickname('👨‍👩‍👧‍👦'), '👨‍👩‍👧‍👦');
  assert.equal(normalizeNickname('あ'.repeat(20)), 'あ'.repeat(20));
  assert.equal(normalizeNickname('<b>ぽけ</b>'), '<b>ぽけ</b>');
  for (const value of [null, '', '  ', 'あ'.repeat(21), 'ぽけ\n別の人', '名前\u202e', 'x'.repeat(101)]) assert.equal(normalizeNickname(value), null);
});

test('any latest 31 shared entries have distinct stable positions on the cream', () => {
  for (const start of [1, 22, 1001]) {
    const positions = Array.from({ length: 31 }, (_, i) => ornamentPosition(`2026-${start + i}`));
    assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, 31);
    assert.ok(positions.every(({ x, y }) => x > 0 && x < 100 && y >= 25 && y <= 78));
  }
  assert.deepEqual(ornamentPosition('2026-1'), ornamentPosition('2026-32'));
});

const entry = { id: '2026-1', day: '2026-12-01', emoji: '🍓', nickname: 'ぽけ' };
const snapshot = { day: '2026-12-01', year: '2026', seasonOpen: true, total: 1,
  decorations: [entry], mine: entry, nextCursor: null };
test('shared snapshots preserve names, dates and mine while excluding private fields', () => {
  const parsed = parseTreeState({ ...snapshot, decorations: [{ ...entry, owner: 'private' }] });
  assert.deepEqual(parsed, snapshot);
  assert.notEqual(parsed.decorations[0], entry);
  assert.equal(parseTreeState({ ...snapshot, mine: null }).mine, null);
});

test('malformed shared snapshots cannot produce fake names, counts or duplicate positions', () => {
  for (const value of [null, {}, { ...snapshot, total: -1 }, { ...snapshot, total: 0 },
    { ...snapshot, decorations: [{ ...entry, emoji: '<script>' }] },
    { ...snapshot, decorations: [{ ...entry, id: '2026-0' }] },
    { ...snapshot, decorations: [{ ...entry, day: '2026-12-32' }] },
    { ...snapshot, decorations: [{ ...entry, nickname: '' }] },
    { ...snapshot, total: 2, decorations: [entry, entry] },
    { ...snapshot, nextCursor: '1' }, { ...snapshot, year: '2027' },
    { ...snapshot, mine: { ...entry, day: '2026-12-02' } },
  ]) assert.throws(() => parseTreeState(value));
});
