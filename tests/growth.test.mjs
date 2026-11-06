import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,applyAction} from '../assets/poke-core.mjs';
import {recordEntry,entrySession,readProgress} from '../assets/poke-entry.mjs';
import {stages,canUse,nextStage,stageAt} from '../assets/poke-growth.mjs';
import {makeState,enter,choose,resolve} from '../assets/poke-story.mjs';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const time=new Date('2026-11-06T05:00:00Z');
test('reloads and fridge/play navigation share a session, another entry on the same day increments only logins',()=>{
 const store=storage(),tab=storage();let s=recordEntry(time,store,tab);assert.equal(s.logins,1);assert.equal(s.visits,1);
 for(let i=0;i<10;i++)s=recordEntry(new Date(time.getTime()+i*1000),store,tab);
 assert.equal(s.logins,1);assert.equal(s.visits,1);
 s=recordEntry(new Date(time.getTime()+120000),store,storage());assert.equal(s.logins,2);assert.equal(s.visits,1);
 s=recordEntry(new Date(time.getTime()+31*60000),store,tab);assert.equal(s.logins,3);assert.equal(s.visits,1);
});
test('Japan midnight changes the visiting day while keeping an active login session',()=>{
 const store=storage(),tab=storage();recordEntry(new Date('2026-11-06T14:59:00Z'),store,tab);
 const s=recordEntry(new Date('2026-11-06T15:01:00Z'),store,tab);assert.equal(s.visits,2);assert.equal(s.logins,1);assert.equal(s.lastVisit,'2026-11-07');
});
test('ten and thirty entries unlock rooms without waiting for ten or thirty days',()=>{
 const store=storage();let s;
 for(let i=0;i<30;i++){
  s=recordEntry(new Date(time.getTime()+i*1000),store,storage());assert.equal(s.logins,i+1);assert.equal(s.visits,1);
  assert.equal(canUse('letters',s.logins),i>=9);assert.equal(canUse('office',s.logins),i>=29);
 }
 assert.ok(s.items.includes('30回記念の表彰状'));assert.ok(!canUse('shared',s.logins));
});
test('returning after missed days preserves counts, and old visits migrate as a known minimum of entries',()=>{
 const store=storage(),old=initial();delete old.logins;delete old.loginSessions;old.visits=12;old.lastVisit='2026-11-01';store.setItem('poke-play-v1',JSON.stringify(old));
 assert.equal(readProgress(store).logins,12);const s=recordEntry(time,store,storage());assert.equal(s.logins,13);assert.equal(s.visits,13);
 const later=recordEntry(new Date('2026-12-01T05:00:00Z'),store,storage());assert.equal(later.visits,14);assert.equal(later.logins,14);
});
test('all growth thresholds have a locked before and unlocked after state',()=>{
 for(const [feature,at] of Object.entries({letters:10,office:30,shared:50,decorate:150,tea:200,research:250})){
  assert.equal(canUse(feature,at-1),false);assert.equal(canUse(feature,at),true);
 }
 assert.equal(canUse('unknown',9999),false);assert.equal(stageAt(9).at,1);assert.equal(nextStage(9).at,10);assert.equal(nextStage(10).at,30);assert.equal(stageAt(300).at,300);assert.equal(nextStage(350).at,400);assert.equal(stages.length,10);
});
test('decorations, tea and research require their login thresholds; daily rewards cannot be repeated',()=>{
 let s=initial();for(const action of [{type:'decorate',value:'ミルク'},{type:'tea',value:'お水'},{type:'research',value:'かため'}])s=applyAction(s,action,time);
 assert.equal(s.settings.length,0);assert.equal(s.items.length,0);assert.equal(s.coins,0);
 s.logins=150;s=applyAction(s,{type:'decorate',value:'ミルク'},time);s=applyAction(s,{type:'decorate',value:'カラメル'},time);assert.deepEqual(s.settings,['お部屋の色：カラメル']);
 s.logins=250;for(let i=0;i<3;i++){s=applyAction(s,{type:'tea',value:'お水'},time);s=applyAction(s,{type:'research',value:'かため'},time);}
 assert.equal(s.coins,5);assert.equal(s.items.filter(x=>x.startsWith('プリン研究ノート')).length,1);assert.equal(s.events.filter(e=>e.key.startsWith('research:')).length,1);
});
test('many logins do not advance letter delays or the thirty visiting-day parcel',()=>{
 const s=makeState(100,42,1);enter(s,100);choose(s,0,100);s.letters[0].reply='世界一かわいいよ';s.letters[0].replyDay=100;
 for(let i=0;i<100;i++)assert.equal(enter(s,100).type,'quiet');assert.equal(s.days.length,1);assert.equal(s.letters.length,1);
 const e=enter(s,102);assert.equal(e.id,'reply-event-welcome');resolve(s,e,102);assert.notEqual(enter(s,102).type,'package');assert.equal(s.days.length,2);
});
test('bad stored state is reported instead of being silently overwritten',()=>{
 const store=storage();store.setItem('poke-play-v1','bad json');assert.throws(()=>recordEntry(time,store,storage()));assert.equal(store.getItem('poke-play-v1'),'bad json');
 const tab=storage();const a=entrySession(1000,tab),b=entrySession(1001,tab),c=entrySession(1801001,tab);assert.equal(a,b);assert.notEqual(b,c);
});
