import assert from 'node:assert/strict';
import {makeState,enter,choose,resolve,dayNow,hourNow} from '../assets/poke-story.mjs';
const start=20000;
assert.equal(dayNow(Date.parse('2026-11-05T15:00:00Z')),dayNow(Date.parse('2026-11-06T14:59:00Z')));
assert.equal(hourNow(Date.parse('2026-11-05T15:00:00Z')),0);
for(let choice=0;choice<3;choice++){
 const s=makeState(start,100+choice);assert.equal(enter(s,start).type,'consult');enter(s,start);assert.equal(s.days.length,1);assert.equal(s.letters.length,1);
 choose(s,choice,start);assert.equal(choose(s,2,start),false);assert.equal(enter(s,start).type,'quiet');
 s.letters[0].reply=['世界一かわいい！','もっと努力しよう','プリン食べよ'][choice];s.letters[0].replyDay=start;
 assert.notEqual(enter(s,start+1).type,'key');const key=enter(s,start+2);assert.equal(key.id,'reply-event-welcome');assert.equal(key.type,['anniversary','assign','apology'][choice]);resolve(s,key,start+2);assert.ok(s.items.includes('ぽけ印の小さな鍵'));
 for(let i=3;i<=30;i++)enter(s,start+i);assert.equal(enter(s,start+30).type,'package');assert.equal(s.letters.filter(l=>l.id==='reply-welcome').length,1);assert.ok(s.letters.find(l=>l.id==='reply-welcome').body.includes(['にやにや','特訓','宝箱'][choice]));
 resolve(s,enter(s,start+30),start+30);assert.equal(s.packageOpened,true);assert.ok(s.items.includes('ふたりだけのひみつ証明書'));assert.notEqual(enter(s,start+31).type,'package');
}
const late=makeState(start,123);choose(late,0,start);for(let i=0;i<31;i++)enter(late,start+i);assert.equal(enter(late,start+30).type,'key');resolve(late,enter(late,start+30),start+30);assert.equal(enter(late,start+30).type,'package');
let variants=new Set(),seen=new Set();for(let seed=1;seed<=100;seed++){const s=makeState(start,seed);enter(s,start);choose(s,0,start);resolve(s,enter(s,start+2),start+2);variants.add(s.letters[0].subject);for(let i=3;i<20;i++){const e=enter(s,start+i,12);seen.add(e.type);if(['hijack','apology','anniversary','assign'].includes(e.type)){resolve(s,e,start+i,'45度');assert.equal(enter(s,start+i,12).type,'quiet');}}}
assert.equal(variants.size,3);for(const type of ['hijack','apology','anniversary','assign','quiet'])assert.ok(seen.has(type));
console.log('PASS: JST date, unique visits, all 3 branches, delayed replies, key/package chain, late key, per-visitor letters, all incidents and quiet days');

const existing=makeState(start,12,29);enter(existing,start);assert.equal(existing.days.length+existing.baseVisits,29);choose(existing,2,start);enter(existing,start+2);resolve(existing,enter(existing,start+2),start+2);assert.equal(enter(existing,start+2).type,'package');
