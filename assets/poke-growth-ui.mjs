import {stages,stageAt,nextStage,dailyLines} from './poke-growth.mjs?v=growth-2';
const $=id=>document.getElementById(id);
export const previewEnabled=()=>new URLSearchParams(globalThis.location?.search||'').get('preview')==='1';
let currentVisits=0,inDemo=false;
export function renderGrowth(s,{demo=false,tab='today'}={}){
 currentVisits=s.logins;inDemo=demo;const stage=stageAt(s.logins),next=nextStage(s.logins),past=[...stages].reverse().find(x=>x.at<=s.logins)?.at||0;
 document.body.dataset.growth=String(stage.at);
 document.querySelector('.wordmark em').textContent=s.logins>=200?'ただいま。':s.logins>=75?'ぽけのもの。':'あそびば。';
 document.querySelector('.hero-sticker').innerHTML=s.logins>=300?'終身名誉<br><b>甘やかし係。</b>':s.logins>=200?'おかえり<br><b>きみの実家。</b>':s.logins>=75?'改装しました<br><b>ぽけのもの。</b>':'本日の主役<br><b>ぽけです。</b>';
 $('loginCount').textContent=`ログイン ${s.logins}回`;
 $('visits').textContent=`訪問 ${s.visits}日`;
 $('loginRule').textContent='会員登録なし。同じタブでの再読み込み・ページ往復は同じ入場として数えます。タブを閉じて再訪するか、30分以上間をあけて戻ると新しい入場です。訪問日数は日本時間で1日1回。';
 const theme=s.settings.findLast(x=>x.startsWith('お部屋の色：'))?.slice(6)||'';
 document.body.dataset.flavor=s.logins>=150?({'カスタード':'custard','カラメル':'caramel','ミルク':'milk'}[theme]||'custard'):'custard';
 $('growthGarden').hidden=tab!=='today';
 const rowStart=Math.floor(Math.max(0,s.visits-1)/10)*10;
 $('growthGarden').innerHTML=`<div class="garden-copy"><span class="eyebrow">YOUR LITTLE PUDDING GARDEN</span><h2>${stage.icon} ${stage.name}</h2><p>${dailyLines[Math.max(0,s.visits-1)%dailyLines.length]}</p></div><div class="growth-stamps" role="img" aria-label="累計${s.visits}日の訪問。今回の10日ぶんのスタンプ"><span class="stamp-range">訪問 ${rowStart+1}〜${rowStart+10}日目</span>${Array.from({length:10},(_,i)=>`<span class="growth-stamp ${s.visits>=rowStart+i+1?'filled':''}" aria-hidden="true">${s.visits>=rowStart+i+1?'🍮':i+1}</span>`).join('')}</div>`;
 $('nextSecretTitle').textContent=`${next.at}回目に、${next.name}がひらく。`;
 $('nextSecretHint').textContent=s.logins<10?'まだ小さな遊び場。10回目のログインで、ぽけのポストがひらきます。':next.hint;
 $('nextSecretDays').textContent=`あと ${Math.max(0,next.at-s.logins)} 回`;
 $('nextSecretBar').style.width=`${Math.max(0,Math.min(100,(s.logins-past)/(next.at-past)*100))}%`;
 document.querySelector('.next-secret').hidden=!['today','collection'].includes(tab);
 $('heroMap').hidden=s.logins<10;
 document.querySelector('.preview-control').hidden=!previewEnabled();
 const notice=$('growthUnlock');let seen=0;try{seen=Number(localStorage.getItem('poke-growth-seen-v1')||0);}catch{}
 notice.hidden=stage.at===1||seen>=stage.at||demo;
 if(!notice.hidden)notice.innerHTML=`<div><span>✦ 遊び場が、ひとつ育ちました。</span><h2>${stage.at}回目：${stage.name}</h2><p>${stage.hint}</p></div><button id="dismissGrowth" aria-label="新しいお部屋のお知らせを閉じる">×</button>`;
 if($('dismissGrowth'))$('dismissGrowth').onclick=()=>{try{if(!inDemo)localStorage.setItem('poke-growth-seen-v1',String(stageAt(currentVisits).at));}catch{}notice.hidden=true;};
}
