import { api } from '@appdeploy/client';
import './styles.css';
import { installTreeBridge } from './tree-bridge';

if (!installTreeBridge((path, body) => api.post(path, body))) {
const hostOrigin = 'https://pokepurin0701.github.io';
const embedded = window.parent !== window;
const $ = (id: string) => document.getElementById(id)!;
let token = '';
let total = 0;
let daily = 0;
let busy = false;
let pending = '';
let failed = false;
const goals: [number, string][] = [
  [1000, '椅子にクッション'],
  [5000, 'おやつ置き場'],
  [10000, '全自動褒め装置'],
  [30000, '褒め装置のお休み部屋'],
  [50000, 'ぽけ甘やかし省'],
  [100000, 'みんなの記念式典'],
];
function render() {
  $('total').textContent = total.toLocaleString();
  $('daily').textContent = String(daily);
  ($('praise') as HTMLButtonElement).disabled = busy || !token;
  $('praise').textContent = busy
    ? '応援を送っています…'
    : pending
      ? '同じ応援を再送する'
      : daily >= 10
        ? 'ぽけをもっと褒める ♡'
        : 'みんなと一緒に応援する ♡';
  const next = goals.find(([count]) => count > total);
  $('next').textContent = next
    ? `次は ${next[0].toLocaleString()}回：${next[1]}`
    : 'すべての目標を達成！みんな、ありがとう。';
  ($('progress') as HTMLProgressElement).max = next?.[0] ?? 100000;
  ($('progress') as HTMLProgressElement).value = total;
  $('goals').replaceChildren(
    ...goals.map(([count, name]) => {
      const row = document.createElement('li');
      row.textContent = `${total >= count ? '✓' : '○'} ${name} · ${count.toLocaleString()}回`;
      return row;
    })
  );
  if (embedded)
    window.parent.postMessage(
      { type: 'poke-counter-status', total, daily },
      hostOrigin
    );
}
function savePending(value: string) {
  pending = value;
  if (embedded)
    window.parent.postMessage(
      { type: 'poke-counter-pending', requestId: value },
      hostOrigin
    );
  else {
    try {
      localStorage.setItem('poke-counter-pending', value);
    } catch {
      /* Keep in memory. */
    }
  }
}
async function status() {
  if (!token || busy) return;
  busy = true;
  render();
  try {
    const { data } = await api.post('/api/status', { token });
    total = data.total;
    daily = data.daily;
    failed = false;
    $('message').textContent = pending
      ? '未確認の応援があります。同じ応援を再送できます。'
      : 'みんなの応援を読み込みました。';
    $('total').dataset.loaded = 'true';
  } catch {
    failed = true;
    $('message').textContent =
      '集計を読み込めませんでした。「最新の集計を読む」で再試行してください。';
  } finally {
    busy = false;
    render();
  }
}
async function sendPraise() {
  if (!token || busy) return;
  busy = true;
  render();
  if (!pending) savePending(crypto.randomUUID());
  try {
    const { data } = await api.post('/api/praise', {
      token,
      requestId: pending,
    });
    total = data.total;
    daily = data.daily;
    failed = false;
    savePending('');
    $('message').textContent = data.counted
      ? '応援が届きました！ぽけの居場所が少し豪華になります。'
      : '今日の10回は記録済み。ぽけ「もっと褒めてもいいですよ！」';
    $('total').dataset.loaded = 'true';
  } catch {
    failed = true;
    $('message').textContent =
      '応援を確認できませんでした。同じ応援を再送できます。二重には加算しません。';
  } finally {
    busy = false;
    render();
  }
}
$('praise').onclick = sendPraise;
$('refresh').onclick = status;
if (embedded) {
  document.body.classList.add('embedded');
  window.addEventListener('message', event => {
    if (event.origin !== hostOrigin || event.source !== window.parent) return;
    const msg = event.data;
    if (
      msg?.type === 'poke-counter-init' &&
      typeof msg.token === 'string' &&
      /^[a-f0-9]{64}$/.test(msg.token)
    ) {
      token = msg.token;
      if (
        typeof msg.requestId === 'string' &&
        /^[a-f0-9-]{36}$/.test(msg.requestId)
      )
        pending = msg.requestId;
      status();
    }
    if (msg?.type === 'poke-counter-praise' && token) sendPraise();
  });
  window.parent.postMessage({ type: 'poke-counter-ready' }, hostOrigin);
} else {
  try {
    token = localStorage.getItem('poke-shared-token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n =>
        n.toString(16).padStart(2, '0')
      ).join('');
      localStorage.setItem('poke-shared-token', token);
    }
    pending = localStorage.getItem('poke-counter-pending') || '';
  } catch {
    $('message').textContent =
      '保存が無効になっています。ブラウザの保存設定を許可して再読み込みしてください。';
  }
  status();
}
render();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !failed) status();
});
}

