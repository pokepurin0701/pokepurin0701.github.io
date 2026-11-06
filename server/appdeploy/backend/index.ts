import { createHash } from 'node:crypto';
import {
  db,
  increment,
  isAppDatabaseError,
  router,
  json,
  error,
} from '@appdeploy/sdk';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const day = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
type Slot = { requestId: string };
type Receipt = { owner: string; day: string; amount: number };
async function readStatus(token: string) {
  const today = day();
  const owner = hash(token);
  const slots = Array.from({ length: 10 }, (_, i) => `${owner}-${today}-${i}`);
  const [records, totals] = await Promise.all([
    db.get<Slot>('daily_slots', slots, { consistent: true }),
    db.get<{ value: number }>('totals', ['global'], { consistent: true }),
  ]);
  return {
    total: totals[0]?.value ?? 0,
    daily: records.filter(Boolean).length,
    day: today,
  };
}
async function praise(token: string, requestId: string) {
  const owner = hash(token);
  const receiptId = hash(`${owner}:${requestId}`);
  // Chosen-ID initialization never resets the existing counter.
  await db.tx.add('totals', [{ id: 'global', value: 0 }]);
  for (let attempt = 0; attempt < 12; attempt++) {
    const [saved] = await db.get<Receipt>('receipts', [receiptId], {
      consistent: true,
    });
    if (saved) {
      if (saved.owner !== owner) throw new Error('Receipt mismatch');
      return { ...(await readStatus(token)), counted: saved.amount === 1 };
    }
    const today = day();
    const ids = Array.from({ length: 10 }, (_, i) => `${owner}-${today}-${i}`);
    const records = await db.get<Slot>('daily_slots', ids, {
      consistent: true,
    });
    const slot = records.findIndex(record => !record);
    if (slot < 0) return { ...(await readStatus(token)), counted: false };
    try {
      // Slot, receipt and counter commit atomically; retries reuse receiptId.
      await db.transact([
        db.tx.add('receipts', [
          { id: receiptId, owner, day: today, amount: 1 },
        ]),
        db.tx.add('daily_slots', [{ id: ids[slot], requestId }]),
        db.tx.update(
          'totals',
          [{ id: 'global', record: { value: increment(1) } }],
          { patch: true }
        ),
      ]);
      return { ...(await readStatus(token)), counted: true };
    } catch (err: unknown) {
      if (isAppDatabaseError(err)) {
        if (
          err.code === 'AppDatabaseDuplicateId' ||
          err.code === 'AppDatabaseUnknownOutcome'
        ) {
          const [receipt] = await db.get<Receipt>('receipts', [receiptId], {
            consistent: true,
          });
          if (receipt?.owner === owner)
            return { ...(await readStatus(token)), counted: true };
          if (err.code === 'AppDatabaseUnknownOutcome') throw err;
          // A duplicate slot aborted this transaction. Read fresh slots before retrying.
          continue;
        }
        if (
          err.code === 'AppDatabaseConflict' ||
          err.code === 'AppDatabaseConditionFailed'
        )
          continue;
      }
      throw err;
    }
  }
  throw new Error('Counter busy');
}
function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
}
type TreeDecoration = { id: string; day: string; emoji: string; nickname: string };
type TreeEntry = Omit<TreeDecoration, 'id'>;
type TreeDaily = TreeEntry & { entryId: string };
const treeSegmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const treePageSize = 100;

function validTreeEmoji(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40
    && [...treeSegmenter.segment(value)].length === 1
    && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(value)
    && /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\p{Emoji_Component}\u200d\ufe0f\u20e3]+$/u.test(value);
}
function treeNickname(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 100
    || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)) return null;
  const nickname = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const length = [...treeSegmenter.segment(nickname)].length;
  return length >= 1 && length <= 20 ? nickname : null;
}
function publicTreeEntry(entry: TreeEntry, id: string): TreeDecoration {
  return { id, day: entry.day, emoji: entry.emoji, nickname: entry.nickname };
}
async function readTreeStatus(token: string, before?: number) {
  const today = day();
  const year = today.slice(0, 4);
  const [totals, daily] = await Promise.all([
    db.get<{ value: number }>('christmas_totals', [year], { consistent: true }),
    db.get<TreeDaily>('christmas_daily', [`${hash(token)}-${today}`], { consistent: true }),
  ]);
  const total = totals[0]?.value ?? 0;
  const end = Math.max(0, Math.min(total, before === undefined ? total : before - 1));
  const start = Math.max(1, end - treePageSize + 1);
  const ids = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => `${year}-${end - i}`);
  const entries = ids.length
    ? await db.get<TreeEntry>('christmas_entries', ids, { consistent: true }) : [];
  const decorations = entries.flatMap((entry, index) => entry ? [publicTreeEntry(entry, ids[index])] : []);
  return {
    day: today,
    year,
    seasonOpen: today.slice(5, 7) === '12',
    total,
    decorations,
    nextCursor: start > 1 && ids.length ? start : null,
    mine: daily[0] ? publicTreeEntry(daily[0], daily[0].entryId) : null,
  };
}
class TreeRequestError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
function requireTreeDay(expectedDay: string) {
  const today = day();
  if (today !== expectedDay)
    throw new TreeRequestError('日付が変わりました。最新のツリーを読み込んでから、もう一度飾ってね。', 409);
  if (today.slice(5, 7) !== '12')
    throw new TreeRequestError('飾りつけは12月1日〜31日に開きます。', 403);
}
async function decorateTree(token: string, emoji: string, nickname: string, expectedDay: string) {
  requireTreeDay(expectedDay);
  const year = expectedDay.slice(0, 4);
  const dailyId = `${hash(token)}-${expectedDay}`;
  // A chosen-ID add cannot reset an existing year's counter.
  await db.tx.add('christmas_totals', [{ id: year, value: 0 }]);
  for (let attempt = 0; attempt < 20; attempt++) {
    requireTreeDay(expectedDay);
    const [daily] = await db.get<TreeDaily>('christmas_daily', [dailyId], { consistent: true });
    if (daily) return { ...(await readTreeStatus(token)), counted: false };
    const [totals] = await db.get<{ value: number }>('christmas_totals', [year], { consistent: true });
    const index = (totals?.value ?? 0) + 1;
    const entryId = `${year}-${index}`;
    const entry: TreeEntry = { day: expectedDay, emoji, nickname };
    requireTreeDay(expectedDay);
    try {
      // The unique daily guard, public entry and sequence counter commit together.
      // Contending visitors reserve the same next index; only one transaction wins.
      await db.transact([
        db.tx.add('christmas_daily', [{ id: dailyId, entryId, ...entry }]),
        db.tx.add('christmas_entries', [{ id: entryId, ...entry }]),
        db.tx.update('christmas_totals', [{ id: year, record: { value: increment(1) } }], { patch: true }),
      ]);
      return { ...(await readTreeStatus(token)), counted: true };
    } catch (err: unknown) {
      if (isAppDatabaseError(err)) {
        if (err.code === 'AppDatabaseDuplicateId' || err.code === 'AppDatabaseUnknownOutcome') {
          const [saved] = await db.get<TreeDaily>('christmas_daily', [dailyId], { consistent: true });
          if (saved) return { ...(await readTreeStatus(token)), counted: err.code === 'AppDatabaseUnknownOutcome' };
          if (err.code === 'AppDatabaseUnknownOutcome') throw err;
          continue;
        }
        if (err.code === 'AppDatabaseConflict' || err.code === 'AppDatabaseConditionFailed') continue;
      }
      throw err;
    }
  }
  throw new Error('Christmas tree busy');
}
function treeFailure(err: unknown) {
  if (err instanceof TreeRequestError) return error(err.message, err.statusCode);
  console.error('Christmas tree request failed', isAppDatabaseError(err) ? err.code : 'unknown');
  if (isAppDatabaseError(err) && err.code === 'AppDatabaseQuotaExceeded')
    return error('ツリーが混み合っています。時間をおいて再試行してね。', 429);
  return error('ツリーを確認できませんでした。同じ飾りつけを再試行できます。', 503);
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'POST /api/tree/status': [
    async ({ body }) => {
      const input = body as { token?: unknown; before?: unknown } | null;
      if (!validToken(input?.token)
        || (input.before !== undefined && (typeof input.before !== 'number' || !Number.isSafeInteger(input.before) || input.before < 0)))
        return error('ツリーの読み込み内容が正しくありません。', 400);
      try {
        return json(await readTreeStatus(input.token, input.before as number | undefined));
      } catch (err: unknown) { return treeFailure(err); }
    },
  ],
  'POST /api/tree/decorate': [
    async ({ body }) => {
      const input = body as { token?: unknown; emoji?: unknown; nickname?: unknown; day?: unknown } | null;
      const nickname = treeNickname(input?.nickname);
      if (!validToken(input?.token) || !validTreeEmoji(input?.emoji) || nickname === null
        || typeof input.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.day))
        return error('ニックネームは1〜20文字、絵文字はひとつを選んでね。', 400);
      try {
        return json(await decorateTree(input.token, input.emoji, nickname, input.day));
      } catch (err: unknown) { return treeFailure(err); }
    },
  ],
  'POST /api/status': [
    async ({ body }) => {
      const input = body as { token?: unknown } | null;
      if (!validToken(input?.token))
        return error('保存用コードが正しくありません。', 400);
      try {
        return json(await readStatus(input.token));
      } catch (err: unknown) {
        console.error(
          'Counter status failed',
          isAppDatabaseError(err) ? err.code : 'unknown'
        );
        if (isAppDatabaseError(err) && err.code === 'AppDatabaseQuotaExceeded') {
          return error('集計サーバーが混み合っています。時間をおいてご利用ください。', 429);
        }
        return error('集計を読み込めませんでした。再試行してください。', 503);
      }
    },
  ],
  'POST /api/praise': [
    async ({ body }) => {
      const input = body as { token?: unknown; requestId?: unknown } | null;
      if (
        !validToken(input?.token) ||
        typeof input?.requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(input.requestId)
      )
        return error('送信内容が正しくありません。', 400);
      try {
        return json(await praise(input.token, input.requestId));
      } catch (err: unknown) {
        console.error(
          'Counter praise failed',
          isAppDatabaseError(err) ? err.code : 'unknown'
        );
        if (isAppDatabaseError(err) && err.code === 'AppDatabaseQuotaExceeded') {
          return error('集計サーバーが混み合っています。同じ応援は後から再試行できます。', 429);
        }
        return error(
          '応援を確認できませんでした。同じ送信を再試行できます。',
          503
        );
      }
    },
  ],
});
