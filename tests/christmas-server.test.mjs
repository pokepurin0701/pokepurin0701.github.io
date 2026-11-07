import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const directory = mkdtempSync(join(tmpdir(), 'poke-tree-server-test-'));
const mock = `
export const tables = new Map();
export const reads = [];
let nextFailure = null;
let readHook = null;
export const onRead = callback => { readHook = callback; };
export const failNext = (code, committed = false) => { nextFailure = {code, committed}; };
export const reset = () => { tables.clear(); reads.length = 0; nextFailure = null; readHook = null; };
const err = code => Object.assign(new Error(code), {code});
const table = name => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
function execute(op, draft) {
  const t = draft.get(op.table) || new Map(); draft.set(op.table, t);
  if (op.type === 'add') return op.records.map(r => {
    if (t.has(r.id)) throw err('AppDatabaseDuplicateId');
    t.set(r.id, structuredClone(r)); return r.id;
  });
  return op.records.map(r => {
    if (!t.has(r.id)) throw err('AppDatabaseConditionFailed');
    const old = t.get(r.id);
    for (const [k, v] of Object.entries(r.record)) old[k] = v?.increment ? (old[k] || 0) + v.amount : v;
    return true;
  });
}
function operation(type, name, records) {
  const op = {type, table: name, records};
  return {op, then(resolve, reject) {
    try {
      let result;
      try { result = execute(op, tables); }
      catch (e) { if (type === 'add' && e.code === 'AppDatabaseDuplicateId') result = [null]; else throw e; }
      resolve(result);
    } catch (e) { reject(e); }
  }};
}
export const db = {
  get: async (name, ids, options) => {
    reads.push({name, ids: [...ids], consistent: options?.consistent});
    const result = ids.map(id => structuredClone(table(name).get(id) || null));
    if (readHook) readHook(name, ids);
    return result;
  },
  tx: {add: (name, rs) => operation('add', name, rs), update: (name, rs) => operation('update', name, rs)},
  transact: async ops => {
    const failure = nextFailure; nextFailure = null;
    if (failure && !failure.committed) throw err(failure.code);
    const draft = structuredClone(tables);
    const result = ops.map(o => execute(o.op, draft));
    tables.clear(); for (const [name, t] of draft) tables.set(name, t);
    if (failure) throw err(failure.code);
    return result;
  },
};
export const increment = amount => ({increment: true, amount});
export const isAppDatabaseError = e => typeof e?.code === 'string';
export const json = (body, statusCode = 200) => ({body, statusCode});
export const error = (message, statusCode) => ({body: {error: message}, statusCode});
export const router = routes => async event => routes[event.route][0]({body: event.body});
`;
writeFileSync(join(directory, 'sdk.mjs'), mock);
const input = readFileSync(new URL('../server/appdeploy/backend/index.ts', import.meta.url), 'utf8');
writeFileSync(join(directory, 'backend.mjs'), stripTypeScriptTypes(input).replace("from '@appdeploy/sdk'", "from './sdk.mjs'"));
const { handler } = await import(pathToFileURL(join(directory, 'backend.mjs')));
const { tables, reads, reset, failNext, onRead } = await import(pathToFileURL(join(directory, 'sdk.mjs')));
const RealDate = globalThis.Date;
let instant = '2026-12-01T03:00:00Z';
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return new RealDate(instant).getTime(); }
};
after(() => { globalThis.Date = RealDate; rmSync(directory, {recursive: true, force: true}); });
const token = 'a'.repeat(64), other = 'b'.repeat(64);
const userToken = n => n.toString(16).padStart(64, '0');
const call = (route, body) => handler({route: `POST /api/tree/${route}`, body});
const decorate = (overrides = {}) => call('decorate', {token, emoji: '🍓', nickname: 'いちご', day: '2026-12-01', ...overrides});
const setDay = value => { instant = value; };
function begin() { reset(); setDay('2026-12-01T03:00:00Z'); }

test('different visitors share named decorations, without exposing participant identities', async () => {
  begin();
  const empty = await call('status', {token});
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.body, {day: '2026-12-01', year: '2026', seasonOpen: true, total: 0, decorations: [], nextCursor: null, mine: null});
  await decorate();
  const second = await decorate({token: other, emoji: '🍮', nickname: 'ぷりん'});
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.total, 2);
  assert.deepEqual(second.body.decorations, [
    {id: '2026-2', day: '2026-12-01', emoji: '🍮', nickname: 'ぷりん'},
    {id: '2026-1', day: '2026-12-01', emoji: '🍓', nickname: 'いちご'},
  ]);
  assert.deepEqual((await call('status', {token})).body.mine, second.body.decorations[1]);
  assert.deepEqual((await call('status', {token: other})).body.mine, second.body.decorations[0]);
  const publicJSON = JSON.stringify(second.body);
  assert.ok(!publicJSON.includes(token) && !publicJSON.includes(other));
  assert.ok(!publicJSON.includes(createHash('sha256').update(token).digest('hex')));
  assert.ok(!publicJSON.includes('owner') && !publicJSON.includes('entryId'));
  assert.ok(reads.every(read => read.consistent === true));
});

test('same-day retries preserve original nickname and emoji and count only once', async () => {
  begin();
  const first = await decorate();
  assert.equal(first.body.counted, true);
  const duplicate = await decorate({emoji: '🎀', nickname: '別の名前'});
  assert.equal(duplicate.body.counted, false);
  assert.equal(duplicate.body.total, 1);
  assert.deepEqual(duplicate.body.mine, first.body.mine);
  assert.equal(tables.get('christmas_entries').size, 1);
  assert.equal(tables.get('christmas_daily').size, 1);
});

test('chosen placement is shared and daily retries preserve its original coordinates', async () => {
  begin();
  const position = {x: 26.25, y: 71.5};
  const first = await decorate({position});
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body.mine.position, position);
  const viewer = await call('status', {token: other});
  assert.deepEqual(viewer.body.decorations[0].position, position);
  assert.equal(viewer.body.mine, null);
  const duplicate = await decorate({position: {x: 80, y: 20}, nickname: '別の名前', emoji: '🍮'});
  assert.equal(duplicate.body.counted, false);
  assert.deepEqual(duplicate.body.mine, first.body.mine);
  const guard = [...tables.get('christmas_daily').values()][0];
  assert.deepEqual(guard.position, position);
  const legacy = await decorate({token: other});
  assert.equal(legacy.statusCode, 200);
  assert.equal(Object.hasOwn(legacy.body.mine, 'position'), false);
  assert.deepEqual(legacy.body.decorations[1].position, position);
});

test('invalid or nonfinite placement is rejected while boundary coordinates are accepted', async () => {
  begin();
  for (const position of [null, {}, {x: 50}, {y: 50}, {x: '50', y: 50}, {x: 50, y: null},
    {x: NaN, y: 50}, {x: Infinity, y: 50}, {x: 50, y: -Infinity},
    {x: 2.99, y: 50}, {x: 97.01, y: 50}, {x: 50, y: 2.99}, {x: 50, y: 97.01}]) {
    assert.equal((await decorate({position})).statusCode, 400, String(position));
  }
  assert.equal((await call('status', {token})).body.total, 0);
  assert.deepEqual((await decorate({position: {x: 3, y: 97}})).body.mine.position, {x: 3, y: 97});
  assert.deepEqual((await decorate({token: other, position: {x: 97, y: 3, private: 'ignored'}})).body.mine.position, {x: 97, y: 3});
});

test('concurrent writes by the same visitor reserve just one daily decoration', async () => {
  begin();
  const results = await Promise.all(Array.from({length: 8}, (_, i) => decorate({nickname: `名前${i}`})));
  assert.ok(results.every(result => result.statusCode === 200));
  assert.equal(results.filter(result => result.body.counted).length, 1);
  assert.equal((await call('status', {token})).body.total, 1);
  assert.equal(tables.get('christmas_entries').size, 1);
});

test('concurrent visitors retain every decoration and a contiguous public sequence', async () => {
  begin();
  const results = await Promise.all(Array.from({length: 10}, (_, i) => decorate({token: userToken(i + 1), nickname: `名前${i}`})));
  assert.ok(results.every(result => result.statusCode === 200 && result.body.counted));
  const status = await call('status', {token});
  assert.equal(status.body.total, 10);
  assert.equal(new Set(status.body.decorations.map(entry => entry.id)).size, 10);
  assert.equal(tables.get('christmas_daily').size, 10);
  assert.equal(tables.get('christmas_entries').size, 10);
  assert.equal(tables.get('christmas_totals').get('2026').value, 10);
});

test('unknown committed outcomes are reconciled; failed transactions leave no partial entries', async () => {
  begin();
  failNext('AppDatabaseUnknownOutcome', true);
  const committed = await decorate();
  assert.equal(committed.statusCode, 200);
  assert.equal(committed.body.counted, true);
  assert.equal(committed.body.total, 1);
  assert.equal((await decorate()).body.total, 1);
  reset();
  failNext('AppDatabaseUnknownOutcome', false);
  const originalError = console.error;
  console.error = () => {};
  let failed;
  try { failed = await decorate(); } finally { console.error = originalError; }
  assert.equal(failed.statusCode, 503);
  assert.equal((await call('status', {token})).body.total, 0);
  assert.equal(tables.get('christmas_entries')?.size || 0, 0);
  const retried = await decorate();
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.body.total, 1);
});

test('pagination reads at most 100 entries per page and does not skip older decorations', async () => {
  begin();
  for (let i = 1; i <= 205; i++) {
    assert.equal((await decorate({token: userToken(i), nickname: `訪問者${i}`})).statusCode, 200);
  }
  reads.length = 0;
  const latest = (await call('status', {token})).body;
  assert.equal(latest.total, 205);
  assert.equal(latest.decorations.length, 100);
  assert.equal(latest.decorations[0].id, '2026-205');
  assert.equal(latest.decorations.at(-1).id, '2026-106');
  assert.equal(latest.nextCursor, 106);
  const older = (await call('status', {token, before: latest.nextCursor})).body;
  assert.equal(older.decorations[0].id, '2026-105');
  assert.equal(older.decorations.at(-1).id, '2026-6');
  assert.equal(older.nextCursor, 6);
  const oldest = (await call('status', {token, before: older.nextCursor})).body;
  assert.deepEqual(oldest.decorations.map(entry => entry.id), ['2026-5', '2026-4', '2026-3', '2026-2', '2026-1']);
  assert.equal(oldest.nextCursor, null);
  const all = [...latest.decorations, ...older.decorations, ...oldest.decorations];
  assert.equal(new Set(all.map(entry => entry.id)).size, 205);
  assert.ok(reads.filter(read => read.name === 'christmas_entries').every(read => read.ids.length <= 100));
});

test('JST midnight controls December opening, daily allowance, and year isolation', async () => {
  begin();
  setDay('2026-11-30T14:59:59Z');
  assert.equal((await call('status', {token})).body.seasonOpen, false);
  assert.equal((await decorate({day: '2026-11-30'})).statusCode, 403);
  setDay('2026-11-30T15:00:00Z');
  assert.equal((await decorate()).body.counted, true);
  setDay('2026-12-01T14:59:59Z');
  assert.equal((await call('status', {token})).body.mine.nickname, 'いちご');
  setDay('2026-12-01T15:00:00Z');
  assert.equal((await decorate()).statusCode, 409);
  assert.equal((await call('status', {token})).body.mine, null);
  assert.equal((await decorate({day: '2026-12-02'})).body.total, 2);
  setDay('2026-12-26T14:59:59Z');
  assert.equal((await decorate({day: '2026-12-26'})).body.total, 3);
  setDay('2026-12-26T15:00:00Z');
  assert.equal((await call('status', {token})).body.seasonOpen, false);
  assert.equal((await decorate({day: '2026-12-27'})).statusCode, 403);
  setDay('2026-12-31T15:00:00Z');
  assert.equal((await decorate({day: '2027-01-01'})).statusCode, 403);
  assert.equal((await decorate({day: '2026-12-26'})).statusCode, 409);
  setDay('2027-11-30T15:00:00Z');
  assert.equal((await call('status', {token})).body.total, 0);
  const nextYear = await decorate({day: '2027-12-01'});
  assert.equal(nextYear.body.total, 1);
  assert.equal(nextYear.body.decorations[0].id, '2027-1');
  assert.equal(tables.get('christmas_totals').get('2026').value, 3);
});

test('invalid inputs cannot write; single joined emoji and normalized nicknames are accepted', async () => {
  begin();
  for (const overrides of [
    {token: 'invalid'}, {emoji: '🍓🍪'}, {emoji: '<img>'}, {emoji: ''},
    {nickname: ''}, {nickname: '   '}, {nickname: 'あ'.repeat(21)},
    {nickname: 'a\nb'}, {nickname: '\u202etest'}, {nickname: {}}, {day: 'invalid'},
  ]) assert.equal((await decorate(overrides)).statusCode, 400, JSON.stringify(overrides));
  for (const before of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2', null]) {
    assert.equal((await call('status', {token, before})).statusCode, 400);
  }
  assert.equal((await call('status', {token: 'invalid'})).statusCode, 400);
  assert.equal((await call('status', null)).statusCode, 400);
  assert.equal((await call('decorate', null)).statusCode, 400);
  assert.equal((await call('status', {token})).body.total, 0);
  const first = await decorate({emoji: '👨‍👩‍👧‍👦', nickname: '  ぷりん   です  '});
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.mine.nickname, 'ぷりん です');
  assert.equal(first.body.mine.emoji, '👨‍👩‍👧‍👦');
  const literal = await decorate({token: other, nickname: '<b>ぽけ</b>'});
  assert.equal(literal.body.mine.nickname, '<b>ぽけ</b>');
});


test('a request crossing midnight while reading prerequisites cannot write the previous day', async () => {
  begin();
  setDay('2026-12-26T14:59:59Z');
  onRead(name => { if (name === 'christmas_totals') setDay('2026-12-26T15:00:00Z'); });
  const result = await decorate({day: '2026-12-26'});
  assert.equal(result.statusCode, 409);
  assert.equal(tables.get('christmas_entries')?.size || 0, 0);
  assert.equal(tables.get('christmas_daily')?.size || 0, 0);
  assert.equal(tables.get('christmas_totals').get('2026').value, 0);
});
