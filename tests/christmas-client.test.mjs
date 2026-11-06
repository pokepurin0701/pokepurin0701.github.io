import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const origin = 'https://app-zlmhhw.v2.appdeploy.ai';
const host = 'https://pokepurin0701.github.io';
const token = 'a'.repeat(64);
const clientSource = readFileSync(new URL('../assets/christmas-client.mjs', import.meta.url), 'utf8').replace('export function createChristmasClient', 'function createChristmasClient');
const bridgeSource = stripTypeScriptTypes(readFileSync(new URL('../server/appdeploy/src/tree-bridge.ts', import.meta.url), 'utf8')).replace('export function installTreeBridge', 'function installTreeBridge');
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function parentEnvironment(initialToken = token) {
  const frames = [];
  const handlers = new Map();
  const storage = new Map(initialToken ? [['poke-shared-token', initialToken]] : []);
  const timers = new Map();
  let timerId = 0;
  const window = {
    addEventListener: (name, listener) => handlers.set(name, listener),
    removeEventListener: name => handlers.delete(name),
  };
  const document = {
    createElement: () => {
      const listeners = new Map();
      const frame = {
        removed: false,
        contentWindow: { messages: [], postMessage(message, target) { this.messages.push({ message, target }); } },
        addEventListener: (name, listener) => listeners.set(name, listener),
        remove() { this.removed = true; },
        fire: name => listeners.get(name)?.(),
      };
      return frame;
    },
    body: { append: frame => frames.push(frame) },
  };
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const sandbox = {
    window, document, localStorage, crypto: webcrypto,
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
  };
  runInNewContext(`${clientSource}\nglobalThis.create = createChristmasClient;`, sandbox);
  const client = sandbox.create();
  const emit = (data, eventOrigin = origin, source = frames.at(-1)?.contentWindow) => handlers.get('message')?.({ data, origin: eventOrigin, source });
  const ready = () => emit({ type: 'poke-tree-ready', version: 1 });
  const finish = (request, data, more = {}) => emit({ type: 'poke-tree-response', id: request.id, action: request.action, ok: true, data, ...more });
  return { client, frames, localStorage, storage, timers, emit, ready, finish, handlers };
}

test('connect lazily, reuse the existing token, and ignore spoofed ready/reply messages', async () => {
  const e = parentEnvironment();
  assert.equal(e.frames.length, 0);
  const promise = e.client.request('status', { token: 'attacker', before: 99 });
  const frame = e.frames[0];
  assert.equal(frame.hidden, true);
  assert.equal(frame.src, `${origin}/?bridge=christmas`);
  assert.equal(frame.src.includes(token), false);
  e.emit({ type: 'poke-tree-ready', version: 1 }, 'https://wrong.example');
  e.emit({ type: 'poke-tree-ready', version: 1 }, origin, {});
  await tick();
  assert.equal(frame.contentWindow.messages.length, 0);
  frame.fire('load');
  assert.equal(frame.contentWindow.messages[0].target, origin);
  e.ready(); await tick();
  const sent = frame.contentWindow.messages.at(-1);
  assert.equal(sent.target, origin);
  assert.equal(sent.message.body.token, token);
  assert.equal(sent.message.body.before, 99);
  let completed = false;
  promise.then(() => { completed = true; });
  e.finish(sent.message, { total: 999 }, { action: 'decorate' });
  e.emit({ type: 'poke-tree-response', id: sent.message.id, action: 'status', ok: true, data: { total: 999 } }, origin, {});
  await tick(); assert.equal(completed, false);
  e.finish(sent.message, { total: 4 });
  assert.equal((await promise).total, 4);
  assert.equal(e.timers.size, 0);
  e.client.close();
});

test('match concurrent replies by request id, protect token, and retain HTTP error status', async () => {
  const e = parentEnvironment();
  const first = e.client.request('status');
  const second = e.client.request('decorate', { token: 'other', nickname: 'ぽけ', emoji: '🍓', day: '2026-12-01', extra: 'ignored' });
  e.ready(); await tick();
  assert.equal(e.frames.length, 1);
  const [a, b] = e.frames[0].contentWindow.messages.map(item => item.message);
  assert.notEqual(a.id, b.id);
  assert.equal(b.body.token, token);
  assert.equal(b.body.extra, undefined);
  assert.equal(b.body.nickname, 'ぽけ');
  e.finish(b, { counted: true });
  assert.equal((await second).counted, true);
  e.finish(a, undefined, { ok: false, message: '日付が変わりました。', status: 409 });
  await assert.rejects(first, error => error.message === '日付が変わりました。' && error.status === 409);
  e.client.close();
});

test('chosen decoration position passes through both transport boundaries', async () => {
  const e = parentEnvironment();
  const position = {x: 27.25, y: 68.5};
  const promise = e.client.request('decorate', {nickname: 'ぽけ', emoji: '🍓', day: '2026-12-01', position});
  e.ready(); await tick();
  const sent = e.frames[0].contentWindow.messages.at(-1).message;
  assert.equal(sent.body.position.x, position.x);
  assert.equal(sent.body.position.y, position.y);
  e.finish(sent, {counted: true});
  assert.equal((await promise).counted, true);
  e.client.close();

  const bridge = bridgeEnvironment();
  const calls = [];
  bridge.install(async (route, body) => { calls.push({route, body}); return {data: {counted: true}}; });
  await bridge.emit({type: 'poke-tree-request', id: webcrypto.randomUUID(), action: 'decorate', body: sent.body});
  assert.equal(calls[0].route, '/api/tree/decorate');
  assert.equal(calls[0].body.position.x, position.x);
  assert.equal(calls[0].body.position.y, position.y);
});

test('an old deployment timeout is retryable with a fresh iframe and rejects late messages', async () => {
  const e = parentEnvironment();
  const first = e.client.request('status');
  const rejection = assert.rejects(first, /接続できません/);
  [...e.timers.values()].find(item => item.delay === 12_000).fn();
  await rejection;
  const oldFrame = e.frames[0];
  assert.equal(oldFrame.removed, true);
  const retry = e.client.request('status');
  e.emit({ type: 'poke-tree-ready', version: 1 }, origin, oldFrame.contentWindow);
  oldFrame.fire('error');
  await tick();
  assert.equal(e.frames[1].removed, false);
  e.ready(); await tick();
  e.finish(e.frames[1].contentWindow.messages[0].message, { total: 2 });
  assert.equal((await retry).total, 2);
  e.client.close();
});

test('request timeout does not discard another pending request or its later retry', async () => {
  const e = parentEnvironment();
  const first = e.client.request('status');
  e.ready(); await tick();
  const second = e.client.request('decorate', { nickname: 'ぽけ', emoji: '🍓', day: '2026-12-01' });
  await tick();
  const timeout = [...e.timers.values()].find(item => item.delay === 15_000);
  const rejection = assert.rejects(first, /確認に時間がかかっています/);
  timeout.fn(); await rejection;
  const requests = e.frames[0].contentWindow.messages.map(item => item.message);
  e.finish(requests[0], { stale: true });
  e.finish(requests[1], { counted: true });
  assert.equal((await second).counted, true);
  const third = e.client.request('status'); await tick();
  e.finish(e.frames[0].contentWindow.messages.at(-1).message, { total: 1 });
  assert.equal((await third).total, 1);
  e.client.close();
});

test('missing identity is securely generated, storage failure blocks sending, and close rejects pending work', async () => {
  const e = parentEnvironment(null);
  const pending = e.client.request('status');
  assert.match(e.storage.get('poke-shared-token'), /^[a-f0-9]{64}$/);
  const rejected = assert.rejects(pending, /接続を終了/);
  e.client.close(); await rejected;
  assert.equal(e.handlers.has('message'), false);
  assert.equal(e.frames[0].removed, true);
  const unavailable = parentEnvironment();
  unavailable.localStorage.getItem = () => { throw new Error('blocked'); };
  await assert.rejects(unavailable.client.request('status'), /保存機能が必要/);
  assert.equal(unavailable.frames.length, 0);
  await assert.rejects(unavailable.client.request('unknown'), /操作が正しくありません/);
  unavailable.client.close();
});

function bridgeEnvironment(search = '?bridge=christmas') {
  const messages = [];
  const handlers = new Map();
  const parent = { postMessage: (message, target) => messages.push({ message, target }) };
  const window = { location: { search }, parent, addEventListener: (name, fn) => handlers.set(name, fn) };
  const document = { body: { hidden: false, style: {} }, getElementById: () => { throw new Error('Counter UI must not run in bridge mode'); } };
  const sandbox = { window, document, URLSearchParams };
  runInNewContext(`${bridgeSource}\nglobalThis.install = installTreeBridge;`, sandbox);
  const emit = (data, eventOrigin = host, source = parent) => handlers.get('message')?.({ data, origin: eventOrigin, source });
  return { install: sandbox.install, window, document, sandbox, messages, handlers, emit };
}

test('bridge mode hides the page, verifies parent/origin/action, and forwards only allowed fields', async () => {
  const normal = bridgeEnvironment('');
  assert.equal(normal.install(() => { throw new Error('unexpected request'); }), false);
  assert.equal(normal.document.body.hidden, false);
  assert.equal(normal.messages.length, 0);
  const e = bridgeEnvironment();
  const calls = [];
  assert.equal(e.install(async (route, body) => { calls.push({ route, body }); return { data: { total: 2 } }; }), true);
  assert.equal(e.document.body.hidden, true);
  assert.equal(e.document.body.style.display, 'none');
  assert.equal(e.messages[0].message.type, 'poke-tree-ready');
  const message = { type: 'poke-tree-request', id: webcrypto.randomUUID(), action: 'status', body: { token, before: 7, extra: 'ignored' } };
  await e.emit(message, 'https://wrong.example');
  await e.emit(message, host, {});
  await e.emit({ ...message, action: 'praise' });
  await e.emit({ ...message, body: { token: 'bad' } });
  assert.equal(calls.length, 0);
  await e.emit(message);
  assert.equal(calls[0].route, '/api/tree/status');
  assert.equal(calls[0].body.token, token);
  assert.equal(calls[0].body.before, 7);
  assert.equal(calls[0].body.extra, undefined);
  const result = e.messages.at(-1);
  assert.equal(result.target, host);
  assert.equal(result.message.id, message.id);
  assert.equal(result.message.action, 'status');
  assert.equal(result.message.data.total, 2);
  assert.equal(JSON.stringify(result).includes(token), false);
  await e.emit({ type: 'poke-tree-connect', version: 1 });
  assert.equal(e.messages.at(-1).message.type, 'poke-tree-ready');
});

test('bridge returns safe API errors with a usable HTTP status', async () => {
  const e = bridgeEnvironment();
  e.install(async () => { throw { response: { status: 409, data: { error: '日付が変わりました。' } } }; });
  await e.emit({ type: 'poke-tree-request', id: webcrypto.randomUUID(), action: 'decorate', body: { token, nickname: 'ぽけ', emoji: '🍓', day: '2026-12-01' } });
  const response = e.messages.at(-1).message;
  assert.equal(response.ok, false);
  assert.equal(response.status, 409);
  assert.equal(response.message, '日付が変わりました。');
});

test('main startup in bridge mode skips all counter UI and counter API operations', () => {
  const e = bridgeEnvironment();
  const source = stripTypeScriptTypes(readFileSync(new URL('../server/appdeploy/src/main.ts', import.meta.url), 'utf8')).replace(/^import .*;\s*$/gm, '');
  const calls = [];
  runInNewContext(source, { ...e.sandbox, installTreeBridge: e.install, api: { post: (path, body) => { calls.push({ path, body }); return Promise.resolve({ data: {} }); } } });
  assert.equal(calls.length, 0);
  assert.equal(e.messages.length, 1);
  assert.equal(e.messages[0].message.type, 'poke-tree-ready');
});
