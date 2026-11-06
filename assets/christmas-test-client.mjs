import { isChristmasSeason, isEmoji, normalizeNickname } from './christmas-core.mjs';

// This adapter deliberately has no network transport or production identity.
export const christmasTestStoreKey = 'poke-christmas-test-store-v1';
const people = new Set(['me', 'friend']);
const publicEntry = ({ id, day, emoji, nickname }) => ({ id, day, emoji, nickname });
const failure = (message, status) => Object.assign(new Error(message), { status });

function readStore(year) {
  let value;
  try {
    value = JSON.parse(localStorage.getItem(`${christmasTestStoreKey}-${year}`) || 'null');
  } catch {
    throw failure('テストの記録を読み込めませんでした。保存設定を確認するか、テストをリセットしてね。', 503);
  }
  if (value === null) return { year, decorations: [] };
  const dates = new Set();
  if (value.year !== year || !Array.isArray(value.decorations)
    || value.decorations.some((entry, index) => {
      if (!entry || entry.id !== `${year}-${index + 1}` || !people.has(entry.person)
        || !isChristmasSeason(entry.day) || entry.day.slice(0, 4) !== year
        || !isEmoji(entry.emoji) || !normalizeNickname(entry.nickname)) return true;
      const uniqueDay = `${entry.person}-${entry.day}`;
      if (dates.has(uniqueDay)) return true;
      dates.add(uniqueDay);
      return false;
    })) {
    throw failure('テストの記録を読み込めませんでした。「テストをリセット」からやり直してね。', 503);
  }
  return value;
}

export function createChristmasTestClient({ person = 'me', today } = {}) {
  if (!people.has(person) || typeof today !== 'function') {
    throw failure('テストの参加者または日付が正しくありません。', 400);
  }
  let closed = false;
  function currentDay() {
    const day = today();
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw failure('テストの日付が正しくありません。テストをリセットしてね。', 400);
    }
    return day;
  }
  function snapshot(day, store, before) {
    const total = store.decorations.length;
    const end = Math.max(0, Math.min(total, before === undefined ? total : before - 1));
    const start = Math.max(0, end - 100);
    const mine = store.decorations.find(entry => entry.person === person && entry.day === day);
    return {
      day,
      year: day.slice(0, 4),
      seasonOpen: isChristmasSeason(day),
      total,
      decorations: store.decorations.slice(start, end).reverse().map(publicEntry),
      nextCursor: start > 0 ? start + 1 : null,
      mine: mine ? publicEntry(mine) : null,
    };
  }
  return {
    async request(action, payload = {}) {
      if (closed) throw failure('テストへの接続は終了しました。ページを開き直してね。', 503);
      const day = currentDay();
      const year = day.slice(0, 4);
      if (action === 'status') {
        if (payload.before !== undefined
          && (!Number.isSafeInteger(payload.before) || payload.before < 0)) {
          throw failure('テストの記録の読み込み内容が正しくありません。', 400);
        }
        return snapshot(day, readStore(year), payload.before);
      }
      if (action !== 'decorate') throw failure('テストの操作が正しくありません。', 400);
      const nickname = normalizeNickname(payload.nickname);
      if (!nickname || !isEmoji(payload.emoji)) {
        throw failure('ニックネームは1〜20文字、絵文字はひとつを選んでね。', 400);
      }
      if (payload.day !== day) {
        throw failure('テストの日付が変わりました。みんなの飾りを更新してから、もう一度飾ってね。', 409);
      }
      if (!isChristmasSeason(day)) throw failure('飾りつけは12月1日〜31日に開きます。', 403);
      const save = () => {
        if (closed) throw failure('テストへの接続は終了しました。ページを開き直してね。', 503);
        // Recheck after waiting for another tab's lock; never write into the old day.
        if (currentDay() !== day) throw failure('テストの日付が変わりました。飾りを更新してね。', 409);
        const store = readStore(year);
        const existing = store.decorations.some(entry => entry.person === person && entry.day === day);
        if (existing) return { ...snapshot(day, store), counted: false };
        const entry = { id: `${year}-${store.decorations.length + 1}`, day, emoji: payload.emoji, nickname, person };
        const updated = { year, decorations: [...store.decorations, entry] };
        try {
          localStorage.setItem(`${christmasTestStoreKey}-${year}`, JSON.stringify(updated));
        } catch {
          throw failure('テストの飾りを保存できませんでした。ブラウザの保存設定を確認してね。', 503);
        }
        return { ...snapshot(day, updated), counted: true };
      };
      return globalThis.navigator?.locks
        ? navigator.locks.request(`${christmasTestStoreKey}-${year}`, save)
        : save();
    },
    close() { closed = true; },
  };
}
