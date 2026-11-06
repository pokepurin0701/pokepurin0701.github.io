import { japanDay, isChristmasSeason, isEmoji, normalizeNickname, cupcakeDescription, ornamentPosition, parseTreeState, isTreePosition } from './christmas-core.mjs?v=placement-1';
import { createChristmasClient } from './christmas-client.mjs?v=placement-1';

export function mountChristmasTree(host, { client = createChristmasClient(), today = japanDay, storageNamespace = 'poke-christmas' } = {}) {
  host.innerHTML = `
    <div class="christmas-heading"><span class="christmas-label">EVERYONE'S CHRISTMAS TREE</span>
      <h2 id="christmas-title"><span>ひとつずつ、</span><span>みんなのクリスマス。</span></h2>
      <p>お菓子のツリーに、あなたのひと粒を。<br>ニックネームを添えて、毎日ひとつ飾ろう。</p>
    </div>
    <div class="christmas-layout">
      <div class="christmas-scene">
        <span class="christmas-snow snow-one" aria-hidden="true">✧</span><span class="christmas-snow snow-two" aria-hidden="true">✦</span>
        <div class="christmas-cake" role="group" tabindex="0" aria-label="ツリーの飾りつけ。好きな場所を選べます。" aria-describedby="christmas-placement-help">
          <img class="christmas-cake-art" src="assets/christmas-cake.svg" alt="${cupcakeDescription}" width="350" height="385">
          <div class="christmas-ornaments"></div>
          <span class="christmas-placement-preview" aria-hidden="true" hidden></span>
        </div>
        <p id="christmas-placement-help" class="christmas-placement-help">絵文字を選んで、置きたい場所をタップ。<br>矢印キーでも位置を選べます。Enterで決定。</p>
        <button class="christmas-confirm" type="button" hidden>ここに飾る</button>
        <p class="christmas-count">みんなのツリーを読み込んでいます…</p>
        <p class="christmas-scene-help">飾りを押すと、飾った人の名前が見られるよ。</p>
        <p class="christmas-selected" role="status" aria-live="polite"></p>
      </div>
      <div class="christmas-workshop">
        <span class="christmas-label">TODAY'S DECORATION</span><h3>今日は、何をのせる？</h3>
        <div class="christmas-palette" role="group" aria-label="おすすめの絵文字"></div>
        <form class="christmas-form">
          <label for="christmas-nickname">ニックネーム <span>（みんなに公開されます）</span></label>
          <input id="christmas-nickname" name="nickname" placeholder="例：ぽけぷりん" maxlength="100" autocomplete="off" required aria-describedby="christmas-name-help">
          <p id="christmas-name-help">20文字まで。本名や連絡先は入れないでね。表示名は本人認証ではありません。</p>
          <label for="christmas-emoji">好きな絵文字をひとつ入力してもOK</label>
          <div class="christmas-input-row"><input id="christmas-emoji" name="emoji" value="🍓" autocomplete="off" maxlength="40" required aria-describedby="christmas-help"><button class="christmas-add" type="submit" disabled>ツリーを準備中…</button></div>
          <p id="christmas-help">日本時間で1人1日1個。12月1日〜31日限定。</p>
          <button class="christmas-choose-place" type="button" disabled>置きたい場所を選ぶ ↑</button>
        </form>
        <p class="christmas-status" role="status" aria-live="polite"></p>
        <button class="christmas-refresh" type="button">みんなの飾りを更新</button>
        <p class="christmas-storage-note">みんなで同じツリーを飾ります。ニックネームと絵文字は公開され、サーバーに保存されます。このブラウザの保存コードで今日の参加を記録します。</p>
      </div>
    </div>
    <section class="christmas-history" aria-labelledby="christmas-history-title">
      <h3 id="christmas-history-title">みんなが飾ったひと粒</h3>
      <p class="christmas-history-help">ツリーには新しい31個を表示。これまでの飾りは、この記録から見られます。</p>
      <ol></ol><button class="christmas-more" type="button" hidden>もっと前の飾りを見る</button>
    </section>`;
  const find = selector => host.querySelector(selector);
  const emojiInput = find('#christmas-emoji');
  const nameInput = find('#christmas-nickname');
  const submit = find('.christmas-add');
  const status = find('.christmas-status');
  const refresh = find('.christmas-refresh');
  const more = find('.christmas-more');
  const cake = find('.christmas-cake');
  const preview = find('.christmas-placement-preview');
  const confirm = find('.christmas-confirm');
  const choosePlace = find('.christmas-choose-place');
  const pendingKey = `${storageNamespace}-pending-v2`;
  const nicknameKey = `${storageNamespace}-nickname`;
  let state = null;
  let entries = [];
  let busy = false;
  let historyExpanded = false;
  let selectedId = null;
  let pending = null;
  let draftPosition = null;
  let storageError = false;
  try {
    nameInput.value = normalizeNickname(localStorage.getItem(nicknameKey)) || '';
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(pendingKey) || 'null'); }
    catch { /* A damaged draft must not be sent or block loading the shared tree. */ }
    if (saved && isChristmasSeason(saved.day) && isEmoji(saved.emoji) && normalizeNickname(saved.nickname)
      && (saved.position === undefined || isTreePosition(saved.position))) {
      pending = { day: saved.day, emoji: saved.emoji, nickname: normalizeNickname(saved.nickname),
        ...(saved.position === undefined ? {} : { position: { ...saved.position } }) };
      draftPosition = pending.position || null;
      nameInput.value = pending.nickname;
      emojiInput.value = pending.emoji;
    }
  } catch { storageError = true; }
  const paletteButtons = ['🍓', '🍮', '🍪', '🍬', '🍫', '🧁', '🍒', '🎀', '⭐', '💖'].map(emoji => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = emoji;
    button.setAttribute('aria-label', `${emoji}を選ぶ`);
    button.addEventListener('click', () => { emojiInput.value = emoji; updateSelection(); });
    find('.christmas-palette').append(button);
    return button;
  });
  function updateSelection() {
    paletteButtons.forEach(button => button.setAttribute('aria-pressed', String(button.textContent === emojiInput.value.trim())));
    preview.textContent = isEmoji(emojiInput.value.trim()) ? emojiInput.value.trim() : '🍓';
  }
  emojiInput.addEventListener('input', updateSelection);
  function canPlace() {
    return !busy && !pending && !storageError && state?.seasonOpen && !state.mine;
  }
  function showPreview() {
    preview.hidden = !draftPosition || !!state?.mine;
    confirm.hidden = preview.hidden;
    confirm.disabled = busy || !!state?.mine;
    if (draftPosition) {
      preview.style.left = `${draftPosition.x}%`;
      preview.style.top = `${draftPosition.y}%`;
    }
    updateSelection();
  }
  function pickPosition(x, y) {
    if (!canPlace()) return;
    const bound = value => Math.round(Math.min(97, Math.max(3, value)) * 100) / 100;
    draftPosition = { x: bound(x), y: bound(y) };
    showPreview();
    status.textContent = 'この場所に仮置きしたよ。「ここに飾る」で決定してね。別の場所をタップすると動かせます。';
  }
  function goToTree() {
    cake.scrollIntoView({ block: 'center', behavior: 'instant' });
    cake.focus({ preventScroll: true });
  }
  cake.addEventListener('click', event => {
    if (event.target.closest('button')) return;
    const rect = cake.getBoundingClientRect();
    pickPosition((event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
  });
  cake.addEventListener('keydown', event => {
    if (event.target !== cake || !canPlace()) return;
    const movement = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[event.key];
    if (movement) {
      event.preventDefault();
      const position = draftPosition || { x: 50, y: 50 };
      pickPosition(position.x + movement[0], position.y + movement[1]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!draftPosition || event.key === ' ') pickPosition(50, 50);
      else find('form').requestSubmit();
    }
  });
  choosePlace.addEventListener('click', () => {
    goToTree();
    status.textContent = '置きたい場所をツリーで選んでね。選んだあとは「ここに飾る」で決定できます。';
  });
  confirm.addEventListener('click', () => find('form').requestSubmit());
  const entryLabel = item => `${item.emoji} ${item.nickname}さんが12月${Number(item.day.slice(-2))}日に飾りました。`;
  function selectEntry(item) {
    selectedId = item.id;
    find('.christmas-selected').textContent = entryLabel(item);
    host.querySelectorAll('[data-entry-id]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.entryId === selectedId)));
  }
  function entryButton(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.entryId = item.id;
    button.setAttribute('aria-label', entryLabel(item));
    button.setAttribute('aria-pressed', String(item.id === selectedId));
    button.title = entryLabel(item);
    button.addEventListener('click', () => selectEntry(item));
    return button;
  }
  function render(message) {
    const active = document.activeElement;
    const focusedEntry = active?.dataset.entryId;
    const focusInHistory = active?.closest('.christmas-history');
    host.hidden = !isChristmasSeason(today());
    if (host.hidden) return;
    const locked = busy || !!pending || !!state?.mine;
    submit.disabled = busy || storageError || !state || !state.seasonOpen || !!state.mine;
    submit.textContent = busy ? '確認しています…' : state?.mine ? '今日は飾りつけ済み ✓' : pending ? '同じひと粒を再送する' : '今日のひと粒を飾る';
    nameInput.disabled = locked;
    emojiInput.disabled = locked;
    paletteButtons.forEach(button => { button.disabled = locked; });
    refresh.disabled = busy;
    more.disabled = busy;
    choosePlace.disabled = !canPlace();
    showPreview();
    if (message) status.textContent = message;
    if (!state) return;
    find('.christmas-count').textContent = `${state.year}年のみんなのツリー · ${state.total}個のひと粒`;
    more.hidden = state.nextCursor === null;
    const ornaments = find('.christmas-ornaments');
    const history = find('.christmas-history ol');
    ornaments.replaceChildren();
    history.replaceChildren();
    entries.slice(0, 31).forEach(item => {
      const button = entryButton(item);
      button.className = 'christmas-ornament';
      button.textContent = item.emoji;
      const position = item.position || ornamentPosition(item.id);
      button.style.left = `${position.x}%`;
      button.style.top = `${position.y}%`;
      ornaments.append(button);
    });
    entries.forEach(item => {
      const li = document.createElement('li');
      const button = entryButton(item);
      button.textContent = `12/${Number(item.day.slice(-2))} ${item.emoji} ${item.nickname}`;
      li.append(button);
      history.append(li);
    });
    if (selectedId && !entries.some(item => item.id === selectedId)) {
      selectedId = null;
      find('.christmas-selected').textContent = '';
    }
    if (!entries.length) {
      const li = document.createElement('li');
      li.textContent = 'まだ飾りはありません。最初のひと粒をどうぞ。';
      history.append(li);
    }
    if (focusedEntry) {
      const scope = focusInHistory ? history : ornaments;
      const replacement = scope.querySelector(`[data-entry-id="${focusedEntry}"]`);
      (replacement || refresh).focus({ preventScroll: true });
    }
  }
  function clearPending() {
    pending = null;
    draftPosition = null;
    try { localStorage.removeItem(pendingKey); } catch { /* Server-confirmed state remains authoritative. */ }
  }
  function accept(response, append = false) {
    const next = parseTreeState(response);
    if (append && state?.year === next.year) {
      entries = [...new Map([...entries, ...next.decorations].map(item => [item.id, item])).values()];
    } else entries = next.decorations;
    historyExpanded = append;
    state = next;
    let notice = '';
    if (pending && state.mine) clearPending();
    else if (pending && pending.day !== state.day) {
      clearPending();
      notice = '日付が変わったので、前の送信は再送しません。今日のひと粒を選んでね。';
    }
    return notice;
  }
  async function load(append = false) {
    if (busy || host.hidden) return;
    busy = true;
    render('みんなの飾りを読み込んでいます…');
    let message;
    try {
      const notice = accept(await client.request('status', append ? { before: state.nextCursor } : {}), append);
      message = notice || (state.mine ? '今日のひと粒は記録済み。また明日も飾りにきてね。' : pending ? '未確認の送信があります。「同じひと粒を再送する」で確認できます。' : 'みんなの飾りを読み込みました。今日のひと粒をどうぞ。');
    } catch (error) {
      message = error.message || 'みんなの飾りを読み込めませんでした。もう一度更新してね。';
    } finally { busy = false; render(message); }
  }
  find('form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !state || state.mine || !state.seasonOpen) return;
    if (!pending) {
      const nickname = normalizeNickname(nameInput.value);
      const emoji = emojiInput.value.trim();
      if (!nickname) { status.textContent = 'ニックネームを1〜20文字で入力してね。'; nameInput.focus(); return; }
      if (!isEmoji(emoji)) { status.textContent = '絵文字をひとつだけ選んでね。'; emojiInput.focus(); return; }
      if (!draftPosition) {
        status.textContent = 'まずは、置きたい場所をツリーで選んでね。';
        goToTree();
        return;
      }
      const draft = { day: state.day, nickname, emoji, position: { ...draftPosition } };
      try {
        localStorage.setItem(pendingKey, JSON.stringify(draft));
        localStorage.setItem(nicknameKey, nickname);
        pending = draft;
      } catch { render('送信の記録を保存できませんでした。ブラウザの保存設定を確認してね。'); return; }
    }
    busy = true;
    render('みんなのツリーに飾っています…');
    let message;
    try {
      const response = await client.request('decorate', pending);
      accept(response);
      clearPending();
      message = response.counted ? 'ひと粒、飾れたよ！名前と一緒にみんなのツリーへ届きました。' : '今日のひと粒はすでに記録済みです。また明日ね。';
    } catch (error) {
      message = `${error.message || '送信を確認できませんでした。'} 同じひと粒を再送しても、二重には飾りません。`;
    } finally { busy = false; render(message); }
  });
  refresh.addEventListener('click', () => load());
  more.addEventListener('click', () => { if (state?.nextCursor) load(true); });
  window.addEventListener('storage', event => {
    if (event.key === pendingKey || event.key === null) {
      // Read the server's daily record before allowing another tab to submit.
      load();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      render();
      if (!historyExpanded || state?.day !== today()) load();
    }
  });
  let lastDay = today();
  setInterval(() => {
    const day = today();
    const changedDay = day !== lastDay;
    lastDay = day;
    if (changedDay) render();
    if (!document.hidden && (changedDay || !historyExpanded || state?.day !== day)) load();
  }, 60_000);
  render(storageError ? 'ブラウザの保存設定を確認して、ページを開き直してね。' : 'みんなのツリーを準備しています…');
  load();
}

const host = document.querySelector('#christmas-tree');
if (host && !host.hasAttribute('data-christmas-manual')) mountChristmasTree(host);
