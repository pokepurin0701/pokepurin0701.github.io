import {renderRoyal,resetRoyalAnnouncement} from './poke-royal-ui.mjs?v=sweets-2';
import {kingdomText} from './poke-royal.mjs?v=sweets-2';
import {canUse,stageAt,nextStage} from './poke-growth.mjs?v=sweets-2';
import {renderGrowth,previewEnabled} from './poke-growth-ui.mjs?v=sweets-2';
import {entrySession} from './poke-entry.mjs?v=sweets-2';
import {renderStory,restoreStoryLabels} from './poke-story-ui.mjs?v=sweets-2';
import './counter-bridge.mjs';
import {initial,applyAction,rank,news,sayings,rules,milestones,dayKey,dayNumber} from './poke-core.mjs?v=sweets-2';
const $=s=>document.querySelector(s),key='poke-play-v1',tokenKey='poke-play-token',api=String(window.POKE_API_URL||'').replace(/\/$/,'');
let state=initial(),demo=null,tab='today',total=null,busy=false,timer,saveFailed=false,loadFailed=false;
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved)state=validate(saved);}catch{saveFailed=true;loadFailed=true;}
let token;try{token=localStorage.getItem(tokenKey);if(!/^[a-f0-9]{64}$/.test(token||'')){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem(tokenKey,token);}}catch{}
function validate(s){const base=initial();if(s&&s.v===1)s={...base,...s,logins:s.logins??s.visits};if(!s||s.v!==1||!Number.isInteger(s.visits)||s.visits<0||s.visits>100000)throw Error('進捗ファイルの形式を確認してください。');for(const k of ['logins','praises','dailyPraises','coins','jobs','logo'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>1e9)throw Error('進捗の数値が正しくありません。');for(const k of ['items','achievements','settings','loginSessions'])if(!Array.isArray(s[k])||s[k].length>1000||s[k].some(x=>typeof x!=='string'||x.length>200))throw Error('進捗の項目が正しくありません。');if(!Array.isArray(s.events)||s.events.length>500||s.events.some(x=>!x||['key','text','date'].some(k=>typeof x[k]!=='string'||x[k].length>500)))throw Error('アルバムの形式が正しくありません。');for(const k of ['lastVisit','praiseDay','jobDay','title','mood'])if(typeof s[k]!=='string'||s[k].length>200)throw Error('進捗の形式が正しくありません。');return Object.fromEntries(Object.keys(base).map(k=>[k,s[k]??base[k]]));}
const esc=x=>kingdomText(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('#toast').style.display='none',4000);}
function persist(){if(loadFailed){toast('元の保存記録を保護しています。バックアップを確認してください。');return;}try{localStorage.setItem(key,JSON.stringify(state));}catch{saveFailed=true;toast('端末に保存できません。進捗を書き出して保管してください。');}}
async function request(action,overrideToken=token){if(!overrideToken)throw Error('保存用コードを作れません。ブラウザの保存設定をご確認ください。');const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(api+'/api/play',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+overrideToken},body:JSON.stringify(action),signal:controller.signal});if(!r.ok)throw Error('サーバーに接続できません。少し待って再試行してください。');return await r.json();}finally{clearTimeout(timeout);}}
async function act(action){if(busy)return;if(loadFailed&&!demo){toast('保存記録を読み込めませんでした。元の記録は変更していません。');return;}busy=true;const old=(demo||state).achievements.length,prev=(demo||state).logins;try{if(demo){demo=applyAction(demo,action);}else if(api){const result=await request(action);state=validate(result.state);total=result.total;persist();}else{try{const latest=JSON.parse(localStorage.getItem(key)||'null');if(latest)state=validate(latest);}catch{}state=applyAction(state,action);persist();}render();if((demo||state).achievements.length>old)toast(canUse('collection',(demo||state).visits)?'隠し実績を発見しました！メニューの「たからもの」で確認できます。':'隠し実績を発見しました！実績は記録されています。');}catch(e){toast(e.message);}finally{busy=false;}}
const artwork = 'assets/fridge/c07ea34707ca730c.webp';
let albumLimit = 20;
const cardIcons = {
  '今日のぽけのお告げ': '✧', 'ぽけの本日の状態': '☀', '本日の王城のお手伝い': '⚑',
  'ログインの記念品': '♧', '隠し実績': '✦', 'ひみつの地図': '⌘',
  'ぽけからの受信箱': '✉', 'ふざけた設定': '⚙', '謎の統計データ': '▥',
  'ぽけのジョーク規約': '§', '勝手なアップデート履歴': '↗', '隠しコマンド': '⌨',
  '事件アルバム': '▤', '夜食の部屋・夢の売店': '☾', '秘密の休憩室': '☕'
};
function card(title, body, cls = '') {
  return `<section class="card ${cls}"><div class="card-header"><span class="card-icon" aria-hidden="true">${cardIcons[title] || '✦'}</span><h2>${title}</h2></div>${body}</section>`;
}
function locked(at, label, cls = '') {
  const remaining = Math.max(0, at - (demo || state).visits);
  return `<section class="card locked-card ${cls}"><span class="lock-symbol" aria-hidden="true">⌑</span><div><span class="lock-tag">COMING SOON · ${at}訪問日目にOPEN</span><h2>${label}</h2><p class="small">あと${remaining}日の訪問で、ここにもひみつが増えます。</p></div></section>`;
}
function render() {
  restoreStoryLabels();
  const s = demo || state, n = dayNumber(), date = dayKey(), d = n % 7;
  if(!canUse(tab,s.visits))tab='today';
  for(const b of document.querySelectorAll('nav [data-tab]'))b.hidden=!canUse(b.dataset.tab,s.visits);
  $('.ticker').hidden=s.visits<10;
  $('#coins').hidden=s.visits<30;

  $('.sidebar-caption').innerHTML=s.visits<10?'訪れた日だけ、<br>この国のひみつが育つ。':'いつもの場所に、<br>まだ知らないひみつ。';
  $('#news').textContent = s.visits >= 3 ? news[n % news.length] : 'ぽけ、あなたの来訪に気づいて褒め待ちを開始。';
  $('#todayDate').textContent = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', weekday: 'short'
  }).format(new Date());
  $('#rank').textContent = rank(s.logins);
  $('#visits').textContent = `訪問 ${s.visits}日目`;
  $('#coins').textContent = `◈ ${s.coins} コイン`;
  $('#checkin').disabled = s.lastVisit === date;
  $('#checkin').textContent = s.lastVisit === date ? '本日の訪問、記録しました ✓' : '今日の訪問を記録 →';
  $('#storage').textContent = api ? '進捗はサーバーに保存します。引き継ぎコードで別の端末でも続けられます。' : saveFailed ? 'このブラウザに保存できていません。進捗を書き出して保管してください。' : '個人の進捗はこのブラウザに保存します。全員の応援数は集計サーバーに保存します。別の端末へ個人の進捗を移すときは、進捗ファイルを読み込んでください。';
  $('#transfer').hidden = !api;
  $('#demo').hidden = !demo;
  document.body.dataset.stage = s.visits >= 200 ? 'home' : s.visits >= 75 ? 'takeover' : 'normal';
  $('.stamp').textContent = s.visits >= 200 ? 'ここを実家とします。' : s.visits >= 75 ? 'ぽけが勝手に改造中。' : 'ぽけがのんびり営業中。';
  const tier = Math.min(3, Math.floor(s.praises / 5));
  const responses = ['ありがとうございます。もう少し具体的にお願いします。', 'いい感じです。続けてください。', 'ぽけの自己肯定感が上昇しています。', 'ぽけは満足しました。でも、もう一回どうぞ。'];

  $('.hero').hidden = tab !== 'today';
  $('.next-secret').hidden = !['today', 'collection'].includes(tab);
  const headings = {
    today: ["TODAY'S LITTLE ADVENTURE", 'きょう、ぽけから何かある？', '何もない日も、ふたりの日常。'],
    letters: ['LETTERS FROM POKE', '忘れたころに、きみ宛て。', 'お返事は、ぽけの宝物。'],
    collection: ['YOUR LITTLE TREASURE ROOM', '集めたひみつは、たからもの。', 'あなた専用の、ひみつの棚。'],
    album: ['THE VERY UNIMPORTANT ARCHIVE', 'なんでもない日の、大事件。', 'ここに来た日の、足あと。'],
    office: ["THE ROYAL CANDY HALL", '王城の広間へ、ようこそ。', '真面目に、ふざけています。']
  };
  $('#sectionEyebrow').textContent = headings[tab][0];
  $('#sectionTitle').textContent = headings[tab][1];
  $('#sectionNote').textContent = headings[tab][2];
  for (const b of document.querySelectorAll('nav button')) b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
  let html = '';
  if (tab === 'today') {
    html += `<section class="card praise-card"><div><div class="card-header"><span class="card-icon" aria-hidden="true">♡</span><h2>まずは、ぽけを甘やかす。</h2></div><div class="praise-talk"><span class="poke-avatar"><img src="${artwork}" alt="ぽけ"></span><p>${responses[tier]}</p></div></div><div class="praise-actions"><button class="big-button" data-action="praise">${['ぽけを褒める', 'もっと褒める', '全力で褒める', '人生をかけて褒める'][tier]}</button>${tier ? `<div class="buttons">${Array.from({ length: tier }, (_, i) => `<button data-action="praise">${['声も最高', '発想も天才', '存在に拍手'][i]}</button>`).join('')}</div>` : ''}<p class="small">今日のコイン獲得 ${s.praiseDay === date ? s.dailyPraises : 0} / 10 · 褒めるのは何回でも。</p></div></section>`;
    html += card('今日のぽけのお告げ', `<p class="kicker">${date.replaceAll('-', ' / ')} · 本日のありがたいひと言</p><p class="quote">「${sayings[n % sayings.length]}」</p><p class="small">ぽけ推し活教団 第${d + 1}条</p>`, 'accent');
    const energy = (n * 7) % 101;
    html += card('ぽけの本日の状態', `<div class="row"><span>ご機嫌</span><b>${['プリンがあってご機嫌', '褒め言葉を待っています', '二度寝したので元気', 'プリンがなくて少し不満', 'だいたいご機嫌', 'おやつのことで頭がいっぱい', '今日は少しのんびり'][d]}</b></div><div class="energy"><span>やる気</span><strong>${energy}<small>%</small></strong><div class="meter" role="img" aria-label="やる気 ${energy}パーセント"><span style="width:${energy}%"></span></div></div><div class="row"><span>あなたへのお願い</span><b>もっと褒めて</b></div>`, 'condition-card');
    html += s.visits >= 30 ? card('本日の王城のお手伝い', s.jobDay === date ? '<p class="quote">おつかれさま。今日は、ここまで。</p><p class="small">30コインをお贈りしました。お手伝いは終わったので、好きなだけ遊んでください。</p>' : `<p class="job-question">${d % 2 ? 'ぽけの謎発言「明日を昨日にすれば間に合う」を解読してください。' : 'ぽけの良いところをひとつ選んでください。'}</p><div class="buttons">${(d % 2 ? ['仕様です', '天才です'] : ['声', '発想', '全部']).map(x => `<button data-job="${x}">${x}</button>`).join('')}</div><p class="small">どれを選んでも大歓迎です。本日のお礼は30コイン。</p>`, 'wide job-card') : '';
    if(canUse('shared',s.visits)) html += `<section class="card wide shared-card"><div class="shared-top"><span class="shared-seal" aria-hidden="true">♧</span><div><p class="eyebrow">A VERY IMPORTANT EVERYONE PROJECT</p><h2>ぽけを世界一、甘やかす計画。</h2><p>みんなの応援で、ぽけの居場所がちょっと豪華に。</p></div><span class="mini-label">全員参加企画</span></div>${demo ? '<div class="shared-body"><p class="small">見学中は全員の応援数に加算しません。自分の進捗に戻ると参加できます。</p></div>' : `<details id="sharedRoom" class="shared-room"><summary><span>企画室を開いて、みんなと一緒に応援する</span><span aria-hidden="true">＋</span></summary><div class="shared-body"><iframe id="pokeSharedCounter" src="https://app-zlmhhw.v2.appdeploy.ai/" title="全員の応援集計と応援ボタン" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe><p id="sharedCounterHelp" class="small">この企画のボタンが全員の累計に加算されます。表示できないときは<a href="https://app-zlmhhw.v2.appdeploy.ai/" target="_blank" rel="noopener noreferrer">応援ページを直接開く ↗</a></p></div></details>`}</section>`;
    if (canUse('night',s.visits) && (s.achievements.includes('夜の訪問者') || n % 7 === 0)) html += card('夜食の部屋・夢の売店', `<p class="quote">ちょっとだけ、寄り道しませんか。</p><p class="small">夜のぽけは、いつもよりのんびり。何にしますか？</p><div class="buttons">${['プリン', 'お茶', 'もう寝る'].map(x => `<button data-night="${x}">${x}</button>`).join('')}</div><p class="small">深夜0〜4時に見つかる部屋。週に一度は、昼間にも開いています。</p>`, 'wide night-card');
    if (s.visits >= 100) html += card('秘密の休憩室', '<p class="quote">もう、ここが実家でいいと思います。</p><p class="small">ここでは何もしなくて大丈夫。あなたのために、お茶を置いておきます。</p><div class="buttons"><button data-ceremony="100">あの訪問記念をもう一度 ↗</button></div>', 'wide lounge-card');
  }
  if (tab === 'collection') {
    html += `<section class="card wide"><div class="collection-intro"><span class="collection-emblem" aria-hidden="true">✦</span><div><p class="eyebrow">YOUR FAVORITE MEMORY</p><p class="quote">${esc(s.title)}</p><p class="small">お気に入りの実績を、思い出の名札に。身分証の称号とは別に選べます。</p></div></div><div class="buttons">${[...new Set(['ぽけの観察者', s.title, rank(s.logins), ...s.achievements])].map(x => `<button data-title="${esc(x)}" aria-pressed="${s.title === x}">${esc(x)}</button>`).join('')}</div></section>`;
    html += card('思い出の記念品', s.items.length ? `<div class="shelf">${s.items.map(x => `<div class="treasure"><span aria-hidden="true">${x.includes('表彰') || x.includes('感謝') ? '🏆' : x.includes('マニュアル') ? '📖' : x.includes('プリン') ? '🍮' : '📦'}</span>${esc(x)}</div>`).join('')}</div>` : '<div class="empty"><span class="empty-icon" aria-hidden="true">✉</span>郵便受けは、まだ空っぽ。<br>記念品は、累計訪問30日目から少しずつ増えていきます。</div>');
    html += card('隠し実績', s.achievements.length ? `<p class="small">これまでに見つけたひみつ：${s.achievements.length}個</p><div class="buttons">${s.achievements.map(x => `<span class="badge">✦ ${esc(x)}</span>`).join('')}</div>` : '<div class="empty"><span class="empty-icon" aria-hidden="true">⌕</span>まだ見つかっていない、ひみつがある。<br>たとえば、この場所の看板とか……。</div>');
    const symbols = { 1: '☀', 3: '⚑', 5: '✉', 10: '✦', 15: '⚙', 20: '▤', 30: '♧', 50: '♡', 75: '✳', 100: '♔', 150: '⚐', 200: '⌂', 250: '⌕', 300: '★' };
    html += card('ひみつの地図', `<p class="map-intro">まだ開いていない扉も、あなたのペースで。お休みしても、ここから続けられます。</p><div class="secret-map">${milestones.map(([count, msg]) => `<div class="map-stop ${s.visits >= count ? 'unlocked' : ''}"><span class="map-day">${String(count).padStart(2, '0')} VISIT DAYS</span><span class="map-symbol" aria-hidden="true">${s.visits >= count ? symbols[count] : '⌑'}</span><p>${s.visits >= count ? esc(msg) : count === 10 ? 'なにかが届く。' : count === 30 ? '荷物のひみつ。' : count === 100 ? '特別な休憩室。' : count === 200 ? '終わりの、その先。' : 'まだ、ひみつ。'}</p>${s.visits >= count && [30, 100, 150, 200, 300].includes(count) ? `<button data-ceremony="${count}">訪問記念を見る ↗</button>` : ''}</div>`).join('')}</div><p class="small" style="margin-top:18px">300訪問日を超えても、50訪問日ごとに新しい感謝状が届きます。</p>`, 'wide');
  }
  if (tab === 'album') {
    const events = [...s.events].reverse();
    html += card('事件アルバム', events.length ? `<p class="map-intro">${events.length}件の出来事が、この場所の歴史になりました。</p><div class="timeline">${events.slice(0, albumLimit).map(e => `<article class="timeline-entry"><time>${esc(e.date.replaceAll('-', ' / '))}</time><p>${esc(e.text)}</p></article>`).join('')}</div>${events.length > albumLimit ? '<button class="more-album" data-more-albums="true">もっと昔の事件を見る ↓</button>' : '<p class="small">ここが、あなたとぽけの始まり。</p>'}` : '<div class="empty"><span class="empty-icon" aria-hidden="true">▤</span>まだ、まっさらなアルバム。<br>ぽけとの毎日を、ここに残していきましょう。</div>', 'wide');
  }
  if (tab === 'office') {
    html += s.visits >= 30 ? card('ぽけからの受信箱', [['ご来訪のお礼', 'あなたのアクセスによって、ぽけの自己肯定感が上昇しています。'], [s.praises >= 10 ? '褒めすぎについて' : '本日のお願い', s.praises >= 10 ? '褒めすぎではありませんか？ ありがとうございます。もう少しお願いします。' : 'ぽけの良いところをひとつ申告してください。'], [s.visits >= 100 ? '居住のお知らせ' : '王城からのお知らせ', s.visits >= 100 ? 'あなたの席を常設しました。お休みしても撤去しません。' : '今日のお手伝いはここまでです。休憩を大切にしましょう。']].map(([t, m]) => `<article class="letter"><b>✉ ${t}</b><p>${m}</p></article>`).join('')) : locked(30, 'ぽけからの受信箱');
    html += s.visits >= 30 ? card('ふざけた設定', `<p class="small">ぽけのご機嫌を、なんとかする設定です。</p><div class="buttons">${['甘やかす', 'もっと甘やかす', 'めちゃくちゃ甘やかす'].map(x => `<button data-mood="${x}" aria-pressed="${s.mood === x}">${x}</button>`).join('')}</div><p class="quote">ぽけ「もっと！」</p><p class="small">設定：${esc(s.mood)}</p>`) : locked(30, 'ふざけた設定');
    html += s.visits >= 10 ? card('謎の統計データ', `<div class="stats"><div><strong>${s.praises}</strong><span>甘やかした回数</span></div><div><strong>${s.jobs}</strong><span>王城のお手伝い</span></div><div><strong>測定不能</strong><span>ぽけの信頼度</span></div><div><strong>すごい</strong><span>サイトへの貢献</span></div><div><strong>0</strong><span>おやつの待ち時間</span></div><div><strong>${s.achievements.length}</strong><span>見つけた秘密</span></div></div>`, 'wide') : locked(10, '謎の統計データ');
    html += card('ぽけのジョーク規約', rules.slice(0, s.visits >= 120 ? 5 : s.visits >= 70 ? 4 : s.visits >= 30 ? 3 : 1).map(x => `<p class="small" style="margin-bottom:12px">${x}</p>`).join('') + '<p class="small">この遊び場だけの、おかしなルールです。</p><div class="buttons"><button data-action="rules">最後まで読みました ✓</button></div>');
    html += card('隠しコマンド', '<p class="small">ぽけの好きな甘いもの。<br>英語でそっと、教えてください。</p><form id="commandForm"><input name="command" aria-label="合言葉" placeholder="ひみつの合言葉" maxlength="30" autocomplete="off"><button>送信 ↗</button></form>');
    html += card('勝手なアップデート履歴', milestones.filter(([at]) => s.visits >= at).map(([at, msg], i) => `<article class="letter"><b>v${i + 1}.0 · ${at}訪問日目</b><p>${msg}</p></article>`).reverse().join('') || '<p class="small">ぽけが更新を準備しています。</p>', 'wide');
  }
  if(tab==='today'&&s.visits<10)html=card('ぽけと、最初のひと粒。',`<p class="quote">${['今日も会えたね。ぽけ、ここで待ってた。','来てくれただけで、もう十分えらい。','きみの席は、ちゃんと用意しておくね。'][n%3]}</p><div class="buttons"><button data-action="praise">ぽけを褒める ♡</button></div><p class="small">あと${10-s.visits}日の訪問で、ぽけのポストがひらきます。訪問スタンプは1日ひとつ。</p>`,'wide starter-card');
  if(tab==='office'&&canUse('decorate',s.visits))html+=card('おへやの模様替え',`<p class="small">累計訪問150日のお礼に。好きなプリンの色を選んでね。</p><div class="buttons">${['カスタード','カラメル','ミルク'].map(x=>`<button data-decorate="${x}" aria-pressed="${s.settings.includes('お部屋の色：'+x)}">${x}</button>`).join('')}</div>`);
  if(tab==='today'&&canUse('tea',s.visits))html+=card('実家のお茶会',s.events.some(e=>e.key==='tea:'+date)?'<p class="quote">お茶、ごちそうさま。また明日ね。</p>':`<p class="small">200日の訪問を重ねてくれたきみに。今日は何を飲む？</p><div class="buttons">${['ほうじ茶','ミルク','お水'].map(x=>`<button data-tea="${x}">${x}</button>`).join('')}</div>`);
  if(tab==='office'&&canUse('research',s.visits))html+=card('プリン研究所',s.events.some(e=>e.key==='research:'+date)?'<p class="quote">本日の研究、完了です。ノートはたからものへ。</p>':`<p class="small">累計訪問250日目からの新しいお部屋。今日の研究テーマは？</p><div class="buttons">${['かため','とろとろ','ほろにが'].map(x=>`<button data-research="${x}">${x}プリン</button>`).join('')}</div>`);
  const sharedOpen = $('#sharedRoom')?.open;
  $('#content').innerHTML = tab === 'today' && s.visits>=10 ? `<details class="story-legacy"><summary>いつものあそび・みんなの応援企画 ＋</summary><div class="grid">${html}</div></details>` : `<div class="grid">${html}</div>`;
  renderGrowth(s,{demo:!!demo,tab});
  renderRoyal(s,{demo:!!demo});
  renderStory(tab, {legacyVisits:s.visits,legacyDemo:!!demo});
  if (sharedOpen && $('#sharedRoom')) $('#sharedRoom').open = true;
}

function ceremony(at){$('#certificate').textContent=`累計訪問${at}日記念「王国の思い出」`;$('#ceremony').dataset.days=at;$('#ceremony').showModal();}
function download(name,body,type='application/json'){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#checkin').onclick=()=>act({type:'visit'});$('#logo').onclick=async()=>{await act({type:'logo'});toast('そこ、インターホンではありません。');};
function updatePreview(){if(!previewEnabled())return;const count=Number($('#preview').value),days=Number($('#previewVisits').value);demo=count||days?{...structuredClone(state),logins:count||state.logins,visits:days||state.visits,lastVisit:dayKey()}:null;if(demo)demo=applyAction(demo,{type:'resume'});render();}
$('#preview').onchange=updatePreview;$('#previewVisits').onchange=updatePreview;
document.querySelector('nav').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;render();}};
$('#content').onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.moreAlbums){albumLimit+=20;render();return;}const clickRect=b.getBoundingClientRect();if(b.dataset.action)await act({type:b.dataset.action});if(b.dataset.action==='praise')heartBurst(clickRect);if(b.dataset.decorate){await act({type:'decorate',value:b.dataset.decorate});toast('お部屋を模様替えしました。');}if(b.dataset.tea){await act({type:'tea',value:b.dataset.tea});toast('ぽけと、ひと休みしました。');}if(b.dataset.research){await act({type:'research',value:b.dataset.research});toast('プリン研究ノートをたからものに追加しました。');}if(b.dataset.job){await act({type:'job',choice:b.dataset.job});toast('ぽけ「その解釈、賛成です！」');}if(b.dataset.mood){await act({type:'mood',value:b.dataset.mood});toast('ぽけ「もっと！」');}if(b.dataset.title)await act({type:'title',value:b.dataset.title});if(b.dataset.night){await act({type:'night',choice:b.dataset.night});toast(b.dataset.night==='もう寝る'?'おやすみなさい。また好きなときに来てください。':'少しのんびりしていってください。');}if(b.dataset.ceremony)ceremony(Number(b.dataset.ceremony));};
$('#content').onsubmit=async e=>{if(e.target.id!=='commandForm')return;e.preventDefault();const value=new FormData(e.target).get('command').trim().toLowerCase();await act({type:'command',value});toast(value==='pudding'?'合言葉、正解です！':'ぽけ「もう少し甘い答えをお願いします」');};
$('#closeCeremony').onclick=()=>$('#ceremony').close();$('#saveCertificate').onclick=()=>download('ぽけの表彰状.txt',`ぽけぷりん 表彰状\n\n${$('#certificate').textContent}\n\nあなたは大変よく訪問しました。\nまた好きなときに遊びに来てください。\n\n発行日：${dayKey()}`,'text/plain');
$('#backup').onclick=()=>download('poke-progress-'+dayKey()+'.json',JSON.stringify(state,null,2));
$('#restore').onchange=async e=>{const file=e.target.files[0];try{if(!file)return;if(api)throw Error('サーバー保存時は「別の端末へ引き継ぐ」を使ってください。');if(file.size>500000)throw Error('ファイルが大きすぎます。');const imported=validate(JSON.parse(await file.text()));if(!confirm('このブラウザの進捗を読み込んだ内容で置き換えます。よろしいですか？'))return;state=imported;loadFailed=false;demo=null;$('#preview').value='0';$('#previewVisits').value='0';resetRoyalAnnouncement();persist();render();toast('進捗を読み込みました。');}catch(error){toast(error.message);}finally{e.target.value='';}};
$('#transfer').onclick=()=>$('#transferDialog').showModal();$('#closeTransfer').onclick=()=>$('#transferDialog').close();$('#copyToken').onclick=async()=>{try{await navigator.clipboard.writeText(token);toast('引き継ぎコードをコピーしました。公開しないでください。');}catch{toast('コピーできませんでした。ブラウザのクリップボード設定をご確認ください。');}};
$('#useToken').onclick=async()=>{const next=$('#tokenInput').value.trim();if(!/^[a-f0-9]{64}$/.test(next)){toast('引き継ぎコードの形式を確認してください。');return;}try{const result=await request({type:'resume'},next);const restored=validate(result.state);localStorage.setItem(tokenKey,next);token=next;state=restored;total=result.total;persist();demo=null;$('#preview').value='0';$('#previewVisits').value='0';resetRoyalAnnouncement();$('#tokenInput').value='';$('#transferDialog').close();render();toast('進捗を引き継ぎました。');}catch(error){toast(error.message);}};
render();await act({type:'login',session:entrySession()});await act({type:'visit'});
document.addEventListener('visibilitychange',async()=>{if(!document.hidden&&!demo){await act({type:'login',session:entrySession()});if(state.lastVisit!==dayKey())await act({type:'visit'});}});


function heartBurst(rect) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const heart = document.createElement('span');
  heart.className = 'heart-burst';
  heart.textContent = '♡';
  heart.setAttribute('aria-hidden', 'true');
  heart.style.left = `${rect.left + rect.width / 2}px`;
  heart.style.top = `${rect.top}px`;
  document.body.append(heart);
  setTimeout(() => heart.remove(), 850);
}
function jumpToPlay() {
  $('#playContent').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  $('#playContent').focus({ preventScroll: true });
}
$('#heroPlay').onclick = () => { tab = 'today'; render(); jumpToPlay(); };
$('#heroMap').onclick = () => { tab = 'collection'; render(); jumpToPlay(); };
$('#leavePreview').onclick = () => {
  $('#preview').value = '0';
  $('#previewVisits').value = '0';
  $('#preview').onchange({ target: $('#preview') });
};
$('#preview').addEventListener('change', jumpToPlay);

$('#previewVisits').addEventListener('change',jumpToPlay);
