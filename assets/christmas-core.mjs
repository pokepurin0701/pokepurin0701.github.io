const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

export function japanDay(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export const isDecemberDay = day => /^\d{4}-12-(0[1-9]|[12][0-9]|3[01])$/.test(day);
export const isChristmasSeason = day => isDecemberDay(day) && day.slice(-2) <= '26';

export function isEmoji(value) {
  return typeof value === 'string' && value.length <= 40
    && [...segmenter.segment(value)].length === 1
    && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(value)
    && /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\p{Emoji_Component}\u200d\ufe0f\u20e3]+$/u.test(value);
}

export function normalizeNickname(value) {
  if (typeof value !== 'string' || value.length > 100
    || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)) return null;
  const name = value.trim().normalize('NFC').replace(/\s+/gu, ' ');
  return name && [...segmenter.segment(name)].length <= 20 ? name : null;
}

export const cupcakeDescription = '金色の星と濃い緑のクリームをのせた、チョコカップケーキのクリスマスツリー';
export function isTreePosition(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Number.isFinite(value.x) && Number.isFinite(value.y)
    && value.x >= 3 && value.x <= 97 && value.y >= 3 && value.y <= 97;
}
const ornamentPositions = [
  [2, 25, 20], [2, 33, 25], [3, 41, 36], [3, 49, 43],
  [4, 57, 53], [5, 65, 63], [6, 72, 75], [6, 78, 75],
].flatMap(([count, y, width]) => Array.from({ length: count }, (_, i) => ({
  x: 50 - width / 2 + width * (i + 0.5) / count, y,
})));

export function ornamentPosition(id) {
  const sequence = Number(id.split('-')[1]);
  return ornamentPositions[(sequence - 1) % ornamentPositions.length];
}

export function parseTreeState(value) {
  const invalid = () => { throw new Error('ツリーの記録を読み込めませんでした。もう一度更新してね。'); };
  if (!value || typeof value !== 'object'
    || typeof value.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)
    || value.year !== value.day.slice(0, 4) || typeof value.seasonOpen !== 'boolean'
    || !Number.isSafeInteger(value.total) || value.total < 0
    || !Array.isArray(value.decorations) || value.decorations.length > 100
    || value.decorations.length > value.total
    || (value.nextCursor !== null && (!Number.isSafeInteger(value.nextCursor) || value.nextCursor < 1 || value.nextCursor > value.total))) return invalid();
  const entry = item => {
    if (!item || typeof item.id !== 'string' || !/^\d{4}-[1-9]\d*$/.test(item.id)
      || item.id.slice(0, 4) !== value.year || !Number.isSafeInteger(Number(item.id.slice(5)))
      || !isDecemberDay(item.day) || item.day.slice(0, 4) !== value.year
      || !isEmoji(item.emoji) || !normalizeNickname(item.nickname)
      || (item.position !== undefined && !isTreePosition(item.position))) return invalid();
    return { id: item.id, day: item.day, emoji: item.emoji, nickname: normalizeNickname(item.nickname),
      ...(item.position === undefined ? {} : { position: { x: item.position.x, y: item.position.y } }) };
  };
  const decorations = value.decorations.map(entry);
  if (new Set(decorations.map(item => item.id)).size !== decorations.length) return invalid();
  const mine = value.mine === null ? null : entry(value.mine);
  if (mine && mine.day !== value.day) return invalid();
  return { day: value.day, year: value.year, seasonOpen: value.seasonOpen, total: value.total,
    decorations, mine, nextCursor: value.nextCursor };
}
