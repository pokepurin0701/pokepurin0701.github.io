type Post = (path: string, body: Record<string, unknown>) => Promise<{ data: unknown }>;
const hostOrigin = 'https://pokepurin0701.github.io';

// In bridge mode the iframe handles only tree requests: no counter reads or writes.
export function installTreeBridge(post: Post): boolean {
  if (new URLSearchParams(window.location.search).get('bridge') !== 'christmas') return false;
  document.body.hidden = true;
  document.body.style.display = 'none';
  if (window.parent === window) return true;
  const announce = () => window.parent.postMessage({ type: 'poke-tree-ready', version: 1 }, hostOrigin);
  window.addEventListener('message', async event => {
    if (event.origin !== hostOrigin || event.source !== window.parent) return;
    const message = event.data;
    if (message?.type === 'poke-tree-connect' && message.version === 1) {
      announce();
      return;
    }
    if (message?.type !== 'poke-tree-request'
      || typeof message.id !== 'string' || !/^[a-f0-9-]{36}$/.test(message.id)
      || (message.action !== 'status' && message.action !== 'decorate')) return;
    const input = message.body;
    if (!input || typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token)) return;
    const action: 'status' | 'decorate' = message.action;
    const body: Record<string, unknown> = action === 'status'
      ? { token: input.token, ...(input.before === undefined ? {} : { before: input.before }) }
      : { token: input.token, emoji: input.emoji, nickname: input.nickname, day: input.day };
    const response = { type: 'poke-tree-response', id: message.id, action };
    try {
      const { data } = await post(`/api/tree/${action}`, body);
      window.parent.postMessage({ ...response, ok: true, data }, hostOrigin);
    } catch (failure: unknown) {
      const error = failure as { response?: { status?: unknown; data?: { error?: unknown; message?: unknown } }; status?: unknown } | null;
      const status = error?.response?.status ?? error?.status;
      const supplied = error?.response?.data?.error ?? error?.response?.data?.message;
      const message = typeof supplied === 'string' && supplied.length <= 300
        ? supplied
        : 'みんなのツリーを確認できませんでした。同じ内容で再試行してね。';
      window.parent.postMessage({ ...response, ok: false, message, ...(Number.isInteger(status) ? { status } : {}) }, hostOrigin);
    }
  });
  announce();
  return true;
}
