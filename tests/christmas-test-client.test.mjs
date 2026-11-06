import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { christmasTestStoreKey, createChristmasTestClient } from '../assets/christmas-test-client.mjs';
import { parseTreeState } from '../assets/christmas-core.mjs';

const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
after(() => {
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
  else delete globalThis.localStorage;
  if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
  else delete globalThis.navigator;
});
let day;
let values;
let writesFail;
function begin() {
  day = '2026-12-01';
  values = new Map([['poke-shared-token', 'production-token'], ['poke-christmas-nickname', '本番の名前']]);
  writesFail = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { if (writesFail) throw new Error('quota'); values.set(key, value); },
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  return createChristmasTestClient({ today: () => day });
}
const decorate = (client, overrides = {}) => client.request('decorate', { day, emoji: '🍓', nickname: 'ぽけ', ...overrides });

test('two test participants share named entries without production keys or private person fields', async () => {
  const me = begin();
  const friend = createChristmasTestClient({ person: 'friend', today: () => day });
  assert.equal((await me.request('status')).total, 0);
  const first = await decorate(me);
  assert.equal(first.counted, true);
  assert.deepEqual(parseTreeState(first), {
    day, year: '2026', seasonOpen: true, total: 1,
    decorations: [{ id: '2026-1', day, emoji: '🍓', nickname: 'ぽけ' }],
    nextCursor: null, mine: { id: '2026-1', day, emoji: '🍓', nickname: 'ぽけ' },
  });
  assert.equal((await friend.request('status')).mine, null);
  const second = await decorate(friend, { emoji: '🍮', nickname: ' ぷりん ' });
  assert.equal(second.total, 2);
  assert.equal(second.mine.nickname, 'ぷりん');
  assert.deepEqual((await me.request('status')).decorations, second.decorations);
  assert.ok(!JSON.stringify(second).includes('person'));
  assert.equal(values.get('poke-shared-token'), 'production-token');
  assert.equal(values.get('poke-christmas-nickname'), '本番の名前');
  assert.deepEqual([...values.keys()].filter(key => key.startsWith(christmasTestStoreKey)), [`${christmasTestStoreKey}-2026`]);
});

test('a daily retry keeps the original name and emoji; next day and next year are separate', async () => {
  const client = begin();
  const first = await decorate(client);
  const duplicate = await decorate(client, { emoji: '🍪', nickname: '別名' });
  assert.equal(duplicate.counted, false);
  assert.equal(duplicate.total, 1);
  assert.deepEqual(duplicate.mine, first.mine);
  day = '2026-12-02';
  assert.equal((await client.request('status')).mine, null);
  assert.equal((await decorate(client)).total, 2);
  day = '2027-12-01';
  assert.equal((await client.request('status')).total, 0);
  assert.equal((await decorate(client)).total, 1);
  assert.ok(values.has(`${christmasTestStoreKey}-2026`));
});

test('invalid content, stale date, off-season writes and invalid actions cannot save', async () => {
  const client = begin();
  for (const overrides of [{ emoji: '🍓🍮' }, { nickname: '' }, { nickname: 'あ'.repeat(21) }, { nickname: 'name\nother' }]) {
    await assert.rejects(decorate(client, overrides), error => error.status === 400);
  }
  await assert.rejects(decorate(client, { day: '2026-12-02' }), error => error.status === 409);
  await assert.rejects(client.request('status', { before: -1 }), error => error.status === 400);
  await assert.rejects(client.request('erase'), error => error.status === 400);
  day = '2026-11-30';
  assert.equal((await client.request('status')).seasonOpen, false);
  await assert.rejects(decorate(client), error => error.status === 403);
  assert.equal([...values.keys()].filter(key => key.startsWith(christmasTestStoreKey)).length, 0);
});

test('a storage write failure never returns success or creates an ornament', async () => {
  const client = begin();
  writesFail = true;
  await assert.rejects(decorate(client), error => error.status === 503 && error.message.includes('保存できません'));
  assert.equal((await client.request('status')).total, 0);
  writesFail = false;
  assert.equal((await decorate(client)).total, 1);
  values.set(`${christmasTestStoreKey}-2026`, '{damaged');
  await assert.rejects(client.request('status'), error => error.status === 503);
});

test('the lock rechecks the date, and simultaneous same-day writes still store one entry', async () => {
  const client = begin();
  let lockName;
  let queue = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request(name, callback) { lockName = name; const result = queue.then(callback); queue = result.catch(() => {}); return result; },
  } } });
  const results = await Promise.all([decorate(client), decorate(client, { nickname: '別名' })]);
  assert.equal(results.filter(result => result.counted).length, 1);
  assert.equal((await client.request('status')).total, 1);
  assert.equal(lockName, `${christmasTestStoreKey}-2026`);
  day = '2026-12-02';
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    async request(_name, callback) { day = '2026-12-03'; return callback(); },
  } } });
  await assert.rejects(decorate(client), error => error.status === 409);
  assert.equal((await client.request('status')).total, 1);
});

test('closed clients reject operations without changing the demo store', async () => {
  const client = begin();
  client.close();
  await assert.rejects(client.request('status'), error => error.status === 503);
  await assert.rejects(decorate(client), error => error.status === 503);
  assert.throws(() => createChristmasTestClient({ person: 'other', today: () => day }));
});
