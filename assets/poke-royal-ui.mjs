import {sweetMotifs,sweetIcon} from './poke-sweets.mjs?v=sweets-2';
import {readRoyalName,writeRoyalName,normalizeRoyalName} from './poke-royal-profile.mjs?v=sweets-2';
import {royalStatus,royalRanks,ROYAL_GOAL} from './poke-royal.mjs?v=sweets-2';
const $=id=>document.getElementById(id),format=n=>n.toLocaleString('ja-JP');
let previousLive=null,previousDemo=false,timer,personalName=null,demoName='おためしリスナー';
function clearPromotion(){clearTimeout(timer);$('royalPromotion')?.setAttribute('hidden','');$('royalPass')?.classList.remove('is-promoting');$('royalParticles')?.replaceChildren();}
export function resetRoyalAnnouncement(){previousLive=null;clearPromotion();}
export function renderRoyal(s,{demo=false}={}){
 if(demo!==previousDemo)clearPromotion();previousDemo=demo;
 const status=royalStatus(s.logins),{current,next}=status,pass=$('royalPass');
 pass.dataset.rank=current.id;pass.dataset.color=current.color;pass.dataset.motif=current.motif;pass.dataset.ornament=String(current.ornament);pass.dataset.luxury=current.ornament>=9?'regal':current.ornament>=6?'gilded':current.ornament>=3?'laurel':'simple';
 const palette=sweetMotifs[current.motif];for(const [key,value] of Object.entries({bg:palette.bg,panel:palette.panel,edge:palette.edge,accent:palette.accent}))pass.style.setProperty('--pass-'+key,value);pass.style.setProperty('--royal-level',current.ornament);
 $('royalJewels').replaceChildren();for(let i=0;i<current.ornament;i++){const gem=document.createElement('i');$('royalJewels').append(gem);}
 if(!demo&&personalName===null)personalName=readRoyalName();$('royalUsername').textContent=demo?demoName:personalName;
 $('royalEditName').onclick=()=>editName(demo);
 $('royalCrest').innerHTML=sweetIcon(current.motif);$('royalTier').textContent=`身分 ${String(status.index+1).padStart(2,'0')} / ${royalRanks.length}`;
 $('royalTitle').textContent=current.name;$('royalLogins').textContent=format(status.count);
 $('royalNext').textContent=next?next.name:'最終身分に到達';$('royalRemaining').textContent=next?`あと ${format(status.remaining)} 回`:'50,000回達成！';
 $('royalProgress').style.width=`${status.progress*100}%`;
 $('royalMeter').setAttribute('aria-valuemin',String(next?current.at:0));$('royalMeter').setAttribute('aria-valuemax',String(next?.at||ROYAL_GOAL));$('royalMeter').setAttribute('aria-valuenow',String(Math.min(status.count,ROYAL_GOAL)));$('royalMeter').setAttribute('aria-valuetext',next?`${current.name}。次の${next.name}まで${format(status.remaining)}回。`:'最終身分、お菓子の国の伝説。');
 $('royalStart').textContent=`${format(next?current.at:0)}回`;$('royalEnd').textContent=`${format(next?.at||ROYAL_GOAL)}回`;
 $('heroSpeech').textContent=current.line;$('royalGoal').textContent=`最終目標 ${format(ROYAL_GOAL)}回`;
 $('royalDemo').hidden=!demo;
 if(!demo){if(previousLive!==null&&status.index>royalStatus(previousLive).index)celebrate(current);previousLive=status.count;}
 $('royalRoad').onclick=()=>{
  let dialog=$('royalRoadDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='royalRoadDialog';dialog.className='royal-road-dialog';document.body.append(dialog);}
  dialog.innerHTML=`<button class="close" aria-label="閉じる">×</button><p class="eyebrow">THE SWEET KINGDOM</p><h2>50,000回までの、身分の道のり</h2><p>身分はログイン回数、施設と物語は訪問日数で育ちます。</p><ol>${royalRanks.map((r,i)=>`<li ${i===status.index?'aria-current="step"':''}><span class="royal-road-motif">${sweetIcon(r.motif)}</span><div><b>${r.name}</b><small>${format(r.at)}回${i===status.index?' · 現在の身分':''}</small></div><span>${i<status.index?'✓':i===status.index?'◆':'◇'}</span></li>`).join('')}</ol>`;
  dialog.querySelector('button').onclick=()=>dialog.close();dialog.showModal();
 };
 $('royalTryPromotion').hidden=!demo;$('royalTryPromotion').onclick=()=>celebrate(current);
}
function celebrate(rank){
 clearTimeout(timer);const pass=$('royalPass'),notice=$('royalPromotion');pass.classList.remove('is-promoting');
 pass.dataset.effect=rank.effect;notice.hidden=false;$('royalPromotionTitle').replaceChildren();const badge=document.createElement('span');badge.className='royal-promotion-motif';badge.innerHTML=sweetIcon(rank.motif);$('royalPromotionTitle').append(badge,document.createTextNode(`${rank.name}へ昇格しました`));$('royalPromotionLine').textContent=rank.line;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 $('royalParticles').replaceChildren();if(!reduced){for(let i=0;i<(rank.at>=10000?22:10);i++){const particle=document.createElement('span');if(i%4===3){particle.innerHTML=sweetIcon(rank.motif);particle.className='sweet-particle';}else particle.textContent=['✦','✧','•'][i%4];particle.style.setProperty('--i',i);particle.style.left=`${4+(i*17)%92}%`;$('royalParticles').append(particle);}void pass.offsetWidth;pass.classList.add('is-promoting');}
 $('royalDismiss').onclick=()=>{notice.hidden=true;pass.classList.remove('is-promoting');};
 timer=setTimeout(()=>{pass.classList.remove('is-promoting');$('royalParticles').replaceChildren();notice.hidden=true;},reduced?9000:6500);
}

function editName(demo){
 let dialog=$('royalNameDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='royalNameDialog';dialog.className='royal-name-dialog';document.body.append(dialog);}
 dialog.innerHTML='<button type="button" class="close" aria-label="閉じる">×</button><h2>この国での、お名前は？</h2><form id="royalNameForm"><label for="royalNameInput">身分証に表示する名前</label><input id="royalNameInput" name="royalName" type="text" maxlength="40" autocomplete="off" aria-describedby="royalNameHelp"><p id="royalNameHelp"></p><p id="royalNameStatus" role="status"></p><button type="submit">この名前にする</button></form>';
 $('royalNameInput').value=demo?demoName:personalName;$('royalNameHelp').textContent=demo?'20文字まで。お試し画面の中だけで表示し、保存しません。':'20文字まで。このブラウザにだけ保存します。ログインや訪問の記録は変更しません。';
 dialog.querySelector('.close').onclick=()=>dialog.close();$('royalNameForm').onsubmit=e=>{e.preventDefault();const name=normalizeRoyalName($('royalNameInput').value)||'リスナーさん';if(demo){demoName=name;$('royalUsername').textContent=name;dialog.close();return;}const result=writeRoyalName(name);personalName=result.name;$('royalUsername').textContent=personalName;if(result.saved)dialog.close();else $('royalNameStatus').textContent='名前を保存できませんでした。この画面の表示だけ変更しました。';};dialog.showModal();$('royalNameInput').focus();$('royalNameInput').select();
}
