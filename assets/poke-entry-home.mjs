import {recordEntry} from './poke-entry.mjs?v=royal-1';
function record(){try{const s=recordEntry();const link=document.querySelector('.poke-play-link');if(link){link.textContent=s.logins>=10?'✉ 育った遊び場へ →':`🌱 ぷりんの遊び場へ · ログイン${s.logins}回目 →`;link.setAttribute('aria-label',`ぷりんの遊び場へ。ログイン${s.logins}回、訪問${s.visits}日。`);}}catch{const note=document.getElementById('entrySaveNote');if(note)note.textContent='このブラウザでは記録を保存できません。保存設定を確認すると、遊び場を育てられます。';}}
record();document.addEventListener('visibilitychange',()=>{if(!document.hidden)record();});
