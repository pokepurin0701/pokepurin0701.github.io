const serverOrigin = 'https://app-zlmhhw.v2.appdeploy.ai';
const tokenKey = 'poke-shared-token';
const unavailable = 'みんなのツリーに接続できませんでした。少し待ってから「みんなの飾りを更新」で再試行してね。';

function participantToken() {
  try {
    let token = localStorage.getItem(tokenKey) || '';
    if (!/^[a-f0-9]{64}$/.test(token)) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(tokenKey, token);
    }
    return token;
  } catch {
    throw new Error('飾りを記録するにはブラウザの保存機能が必要です。保存設定を確認してね。');
  }
}

export function createChristmasClient() {
  let frame = null;
  let connection = null;
  let connectionTimer;
  let ready = false;
  let resolveConnection;
  let rejectConnection;
  let closed = false;
  const requests = new Map();

  function removeFrame() {
    frame?.remove();
    frame = null;
    ready = false;
    connection = null;
    clearTimeout(connectionTimer);
  }
  function receive(event) {
    if (event.origin !== serverOrigin || !frame || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (message?.type === 'poke-tree-ready' && message.version === 1) {
      ready = true;
      clearTimeout(connectionTimer);
      resolveConnection?.();
      return;
    }
    if (message?.type !== 'poke-tree-response' || typeof message.id !== 'string') return;
    const pending = requests.get(message.id);
    if (!pending || pending.action !== message.action) return;
    if (message.ok !== true && message.ok !== false) return;
    requests.delete(message.id);
    clearTimeout(pending.timer);
    if (message.ok) pending.resolve(message.data);
    else {
      const error = new Error(typeof message.message === 'string' ? message.message : unavailable);
      if (Number.isInteger(message.status)) error.status = message.status;
      pending.reject(error);
    }
  }
  window.addEventListener('message', receive);

  function connect() {
    if (closed) return Promise.reject(new Error('ツリーへの接続は終了しました。ページを開き直してね。'));
    if (ready) return Promise.resolve();
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      resolveConnection = resolve;
      rejectConnection = reject;
    });
    const currentConnection = connection;
    const fail = () => {
      if (connection !== currentConnection) return;
      rejectConnection?.(new Error(unavailable));
      for (const pending of requests.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(unavailable));
      }
      requests.clear();
      removeFrame();
    };
    frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'みんなのクリスマスツリーへの接続';
    frame.src = `${serverOrigin}/?bridge=christmas`;
    const connectingFrame = frame;
    connectingFrame.addEventListener('load', () => {
      if (frame === connectingFrame) connectingFrame.contentWindow?.postMessage({ type: 'poke-tree-connect', version: 1 }, serverOrigin);
    });
    frame.addEventListener('error', fail, { once: true });
    connectionTimer = setTimeout(fail, 12_000);
    document.body.append(frame);
    return currentConnection;
  }

  return {
    async request(action, payload = {}) {
      if (action !== 'status' && action !== 'decorate') throw new Error('ツリーの操作が正しくありません。');
      const token = participantToken();
      await connect();
      if (!frame || closed) throw new Error(unavailable);
      const id = crypto.randomUUID();
      const body = action === 'status'
        ? { token, ...(payload.before === undefined ? {} : { before: payload.before }) }
        : { token, emoji: payload.emoji, nickname: payload.nickname, day: payload.day,
          ...(payload.position === undefined ? {} : { position: payload.position }) };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          requests.delete(id);
          reject(new Error('飾りの確認に時間がかかっています。同じ内容で再試行してね。1日に二重には飾りません。'));
        }, 15_000);
        requests.set(id, { action, resolve, reject, timer });
        try {
          frame.contentWindow.postMessage({ type: 'poke-tree-request', id, action, body }, serverOrigin);
        } catch {
          clearTimeout(timer);
          requests.delete(id);
          reject(new Error(unavailable));
        }
      });
    },
    close() {
      closed = true;
      window.removeEventListener('message', receive);
      rejectConnection?.(new Error('ツリーへの接続を終了しました。'));
      for (const pending of requests.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('ツリーへの接続を終了しました。'));
      }
      requests.clear();
      removeFrame();
    },
  };
}
