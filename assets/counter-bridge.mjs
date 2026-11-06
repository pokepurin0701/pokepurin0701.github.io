// The counter is hosted separately so GitHub Pages can keep serving the site.
const counterOrigin = 'https://app-zlmhhw.v2.appdeploy.ai';
const tokenKey = 'poke-shared-token';
const pendingKey = 'poke-counter-pending';

window.addEventListener('message', event => {
  const frame = document.getElementById('pokeSharedCounter');
  if (!frame || event.origin !== counterOrigin || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (message?.type === 'poke-counter-ready') {
    try {
      let token = localStorage.getItem(tokenKey) || '';
      if (!/^[a-f0-9]{64}$/.test(token)) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(tokenKey, token);
      }
      frame.contentWindow.postMessage({
        type: 'poke-counter-init',
        token,
        requestId: localStorage.getItem(pendingKey) || ''
      }, counterOrigin);
    } catch {
      const help = document.getElementById('sharedCounterHelp');
      if (help) help.textContent = '応援の記録にはブラウザの保存機能が必要です。保存を許可して再読み込みしてください。';
    }
  }
  if (message?.type === 'poke-counter-pending' && typeof message.requestId === 'string' &&
      (message.requestId === '' || /^[a-f0-9-]{36}$/.test(message.requestId))) {
    try { localStorage.setItem(pendingKey, message.requestId); } catch { /* In-frame retry remains available. */ }
  }
});
