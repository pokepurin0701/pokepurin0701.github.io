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
export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
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
