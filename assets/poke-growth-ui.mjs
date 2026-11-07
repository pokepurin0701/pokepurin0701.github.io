import {stages,stageAt,nextStage,dailyLines} from './poke-growth.mjs?v=sweets-1';
const $=id=>document.getElementById(id);
export const previewEnabled=()=>new URLSearchParams(globalThis.location?.search||'').get('preview')==='1';
let currentVisits=0,inDemo=false;
export function renderGrowth(s,{demo=false,tab='today'}={}){
 currentVisits=s.visits;inDemo=demo;const stage=stageAt(s.visits),next=nextStage(s.visits),past=[...stages].reverse().find(x=>x.at<=s.visits)?.at||0;
 document.body.dataset.growth=String(stage.at);
 document.querySelector('.wordmark em').textContent=s.visits>=200?'ただいま。':s.visits>=75?'ぽけのもの。':'あそびば。';

 $('loginCount').textContent=`ログイン ${s.logins}回`;
 $('visits').textContent=`訪問 ${s.visits}日`;
 $('loginRule').textContent='会員登録なし。同じタブでの再読み込み・ページ往復は同じ入場として数えます。タブを閉じて再訪するか、30分以上間をあけて戻ると新しい入場です。訪問日数は日本時間で1日1回。';
 const theme=s.settings.findLast(x=>x.startsWith('お部屋の色：'))?.slice(6)||'';
 document.body.dataset.flavor=s.visits>=150?({'カスタード':'custard','カラメル':'caramel','ミルク':'milk'}[theme]||'custard'):'custard';
 $('growthGarden').hidden=tab!=='today';
 const rowStart=Math.floor(Math.max(0,s.visits-1)/10)*10;
 $('growthGarden').innerHTML=`<div class="garden-copy"><span class="eyebrow">YOUR LITTLE PUDDING GARDEN</span><h2>${stage.icon} ${stage.name}</h2><p>${dailyLines[Math.max(0,s.visits-1)%dailyLines.length]}</p></div><div class="growth-stamps" role="img" aria-label="累計${s.visits}日の訪問。今回の10日ぶんのスタンプ"><span class="stamp-range">訪問 ${rowStart+1}〜${rowStart+10}日目</span>${Array.from({length:10},(_,i)=>`<span class="growth-stamp ${s.visits>=rowStart+i+1?'filled':''}" aria-hidden="true">${s.visits>=rowStart+i+1?'🍮':i+1}</span>`).join('')}</div>`;
 $('nextSecretTitle').textContent=`累計訪問${next.at}日目に、${next.name}がひらく。`;
 $('nextSecretHint').textContent=s.visits<10?'まだ小さなお菓子の国。累計訪問10日目で、ぽけのポストがひらきます。':next.hint;
 $('nextSecretDays').textContent=`あと ${Math.max(0,next.at-s.visits)} 日`;
 $('nextSecretBar').style.width=`${Math.max(0,Math.min(100,(s.visits-past)/(next.at-past)*100))}%`;
 document.querySelector('.next-secret').hidden=!['today','collection'].includes(tab);
 $('heroMap').hidden=s.visits<10;
 for(const control of document.querySelectorAll('.preview-control'))control.hidden=!previewEnabled();
 const notice=$('growthUnlock');let seen=0;try{seen=Number(localStorage.getItem('poke-facility-days-seen-v1')||0);}catch{}
 notice.hidden=stage.at===1||seen>=stage.at||demo;
 if(!notice.hidden)notice.innerHTML=`<div><span>✦ 遊び場が、ひとつ育ちました。</span><h2>訪問${stage.at}日目：${stage.name}</h2><p>${stage.hint}</p></div><button id="dismissGrowth" aria-label="新しいお部屋のお知らせを閉じる">×</button>`;
 if($('dismissGrowth'))$('dismissGrowth').onclick=()=>{try{if(!inDemo)localStorage.setItem('poke-facility-days-seen-v1',String(stageAt(currentVisits).at));}catch{}notice.hidden=true;};
}
