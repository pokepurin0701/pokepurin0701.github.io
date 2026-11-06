import {initial,applyAction} from './poke-core.mjs?v=growth-2';
const sessionKey='poke-entry-session-v1',idle=30*60*1000;
let memory;
// A session spans page navigation and reloads in this tab. A new tab or a
// return after 30 idle minutes starts another entry, even on the same date.
export function entrySession(now=Date.now(),store=globalThis.sessionStorage){
 let previous=memory;
 try{previous=JSON.parse(store.getItem(sessionKey)||'null');}catch{}
 const current=previous&&/^[a-f0-9]{32}$/.test(previous.id)&&Number.isFinite(previous.lastActive)&&now>=previous.lastActive&&now-previous.lastActive<idle
 ? {...previous,lastActive:now}
 : {id:Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join(''),lastActive:now};
 memory=current;try{store.setItem(sessionKey,JSON.stringify(current));}catch{}
 return current.id;
}
export function readProgress(store=globalThis.localStorage){
 const raw=store.getItem('poke-play-v1');if(!raw)return initial();
 const input=JSON.parse(raw),base=initial();if(!input||input.v!==1)throw Error('保存記録を読み込めません。');
 const s={...base,...input,logins:input.logins??input.visits};
 for(const k of ['visits','logins','praises','dailyPraises','coins','jobs','logo'])if(!Number.isSafeInteger(s[k])||s[k]<0)throw Error('保存記録の数値が正しくありません。');
 for(const k of ['items','achievements','settings','loginSessions'])if(!Array.isArray(s[k])||s[k].some(x=>typeof x!=='string'))throw Error('保存記録の項目が正しくありません。');
 if(!Array.isArray(s.events)||s.events.some(e=>!e||['key','text','date'].some(k=>typeof e[k]!=='string')))throw Error('出来事の保存記録が正しくありません。');
 for(const k of ['lastVisit','praiseDay','jobDay','title','mood'])if(typeof s[k]!=='string')throw Error('保存記録の形式が正しくありません。');
 return Object.fromEntries(Object.keys(base).map(k=>[k,s[k]]));
}
export function recordEntry(now=new Date(),store=globalThis.localStorage,sessionStore=globalThis.sessionStorage){
 let s=readProgress(store);s=applyAction(s,{type:'login',session:entrySession(now.getTime(),sessionStore)},now);s=applyAction(s,{type:'visit'},now);store.setItem('poke-play-v1',JSON.stringify(s));return s;
}
