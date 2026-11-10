import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sweetMotifs,motifForTitle} from '../assets/poke-sweets.mjs';
import {royalRanks,royalStatus,promotionBetween,kingdomText} from '../assets/poke-royal.mjs';
import {initial,applyAction,rank} from '../assets/poke-core.mjs';
import {canUse} from '../assets/poke-growth.mjs';
import {recordEntry,readProgress} from '../assets/poke-entry.mjs';
const now=new Date('2026-11-08T03:00:00Z');
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('every royal title has exact before/at/after boundaries and changing crests/lines',()=>{
 for(let i=0;i<royalRanks.length;i++){
  const r=royalRanks[i];assert.equal(royalStatus(r.at).current,r);assert.equal(royalStatus(r.at+1).current,r);assert.equal(rank(r.at),r.name);
  if(i){assert.equal(royalStatus(r.at-1).current,royalRanks[i-1]);assert.equal(promotionBetween(r.at-1,r.at),r);assert.ok(sweetMotifs[r.motif]);assert.equal(r.motif,motifForTitle(r.name));assert.notEqual(r.line,royalRanks[i-1].line);}
 }
 assert.equal(royalStatus(50000).complete,true);assert.equal(royalStatus(50001).remaining,0);assert.equal(royalStatus(50000).next,null);assert.equal(royalStatus(49999).remaining,1);assert.equal(royalStatus(50000).progress,1);
 for(const n of [-1,NaN,Infinity,'50000'])assert.equal(royalStatus(n).count,0);
 assert.equal(promotionBetween(50000,50001),null);assert.equal(promotionBetween(999,50000).at,50000);
});
test('many logins with few days and few logins with many days have independent behavior',()=>{
 let s={...initial(),logins:49999,visits:1};s=applyAction(s,{type:'login',session:'a'.repeat(32)},now);assert.equal(rank(s.logins),'お菓子の国の伝説');assert.equal(s.visits,1);assert.equal(canUse('letters',s.visits),false);assert.equal(s.items.length,0);
 s={...initial(),visits:250,logins:1};assert.equal(rank(s.logins),'お菓子の国の旅人');for(const f of ['letters','office','shared','decorate','tea','research'])assert.equal(canUse(f,s.visits),true);
});
test('v1 counters, legacy title, keepsakes and achievements survive read, entry, export/import',()=>{
 const store=memory(),legacy={...initial(),visits:30,logins:73,lastVisit:'2026-11-08',title:'アルバイト',items:['謎の荷物（未開封）','30回記念の表彰状','とても大事な宝物'],achievements:['仕事が早い人'],events:[{key:'old',date:'2026-10-01',text:'本日の業務完了。'}],settings:['もっと甘やかす'],jobs:7};
 const original=structuredClone(legacy);store.setItem('poke-play-v1',JSON.stringify(legacy));assert.deepEqual(readProgress(store),legacy);
 const next=recordEntry(now,store,memory());assert.equal(next.logins,74);assert.equal(next.visits,30);assert.equal(next.jobs,7);assert.equal(next.title,original.title);for(const item of original.items)assert.ok(next.items.includes(item));assert.deepEqual(next.achievements,original.achievements);assert.ok(next.events.some(e=>JSON.stringify(e)===JSON.stringify(original.events[0])));assert.equal(kingdomText(next.title),'クッキーの見習い');assert.equal(next.title,'アルバイト');
 const restored=JSON.parse(JSON.stringify(next));store.setItem('poke-play-v1',JSON.stringify(restored));assert.deepEqual(readProgress(store),next);assert.deepEqual(legacy,original);
});
test('legacy visits-only save uses the same counter migration as before',()=>{
 const store=memory(),old=initial();delete old.logins;delete old.loginSessions;old.visits=42;store.setItem('poke-play-v1',JSON.stringify(old));const loaded=readProgress(store);assert.equal(loaded.logins,42);assert.equal(loaded.visits,42);
});
test('facilities use visiting days in UI and core actions, not royal titles',()=>{
 const play=readFileSync(new URL('../assets/play.mjs',import.meta.url),'utf8'),story=readFileSync(new URL('../assets/poke-story-ui.mjs',import.meta.url),'utf8');assert.ok(!/canUse\([^\n;]*s\.logins/.test(play));assert.ok(!story.includes('legacyLogins'));assert.ok(story.includes("canUse('letters',context.legacyVisits)"));
 for(const [visits,logins,allowed] of [[1,50000,false],[250,1,true]]){let s={...initial(),visits,logins};s=applyAction(s,{type:'job',choice:'全部'},now);assert.equal(s.jobs,allowed?1:0);s=applyAction(s,{type:'decorate',value:'ミルク'},now);assert.equal(s.settings.includes('お部屋の色：ミルク'),allowed);s=applyAction(s,{type:'research',value:'かため'},now);assert.equal(s.items.includes('プリン研究ノート：かため'),allowed);}
});
test('the identity is derived and never erases personal progress or story/season data',()=>{
 const s=initial(),before=structuredClone(s);royalStatus(s.logins);rank(s.logins);assert.deepEqual(s,before);
 const source=readFileSync(new URL('../assets/poke-royal-ui.mjs',import.meta.url),'utf8');assert.ok(!source.includes('localStorage'));assert.ok(!source.includes('showModal();\n }\nfunction celebrate'));assert.ok(!/やで|せや|やん|ほんま/.test(royalRanks.map(r=>r.line).join('')));
});
