import { japanDay, isChristmasSeason } from './christmas-core.mjs?v=steps-1';
import { mountChristmasTree } from './christmas.mjs?v=steps-1';
import { createChristmasTestClient } from './christmas-test-client.mjs?v=steps-1';

const prefix = 'poke-christmas-test-';
const dayKey = `${prefix}day`;
const query = new URLSearchParams(location.search);
const person = query.get('person') === 'friend' ? 'friend' : 'me';
const personSelect = document.querySelector('#test-person');
const tomorrow = document.querySelector('#test-tomorrow');
const error = document.querySelector('#test-error');
let day = `${japanDay().slice(0, 4)}-12-01`;
try {
  const saved = localStorage.getItem(dayKey);
  if (isChristmasSeason(saved)) day = saved;
} catch { error.textContent = 'このテストにはブラウザの保存機能が必要です。保存設定を確認してね。'; }
personSelect.value = person;
document.querySelector('#test-date').textContent = `テスト日：${day.slice(0, 4)}年12月${Number(day.slice(-2))}日`;
tomorrow.disabled = day.endsWith('-31');
personSelect.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('person', personSelect.value);
  location.assign(url.href);
});
tomorrow.addEventListener('click', () => {
  if (day.endsWith('-31')) return;
  const next = `${day.slice(0, 8)}${String(Number(day.slice(-2)) + 1).padStart(2, '0')}`;
  try { localStorage.setItem(dayKey, next); location.reload(); }
  catch { error.textContent = 'テスト日を保存できませんでした。ブラウザの保存設定を確認してね。'; }
});
document.querySelector('#test-reset').addEventListener('click', () => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
    const url = new URL(location.href);
    url.searchParams.delete('person');
    location.assign(url.href);
  } catch { error.textContent = 'テストの記録をリセットできませんでした。ブラウザの保存設定を確認してね。'; }
});
mountChristmasTree(document.querySelector('#christmas-tree'), {
  client: createChristmasTestClient({ person, today: () => day }),
  today: () => day,
  storageNamespace: `${prefix}${person}`,
});
document.querySelector('label[for="christmas-nickname"] span').textContent = '（テスト画面に表示されます）';
document.querySelector('#christmas-name-help').textContent = '20文字まで。テスト用の名前で試してね。';
document.querySelector('.christmas-storage-note').textContent = 'このテストの飾りとニックネームは、このブラウザだけに保存します。本番には送信しません。「もうひとり」からも同じテストの飾りを見られます。';
