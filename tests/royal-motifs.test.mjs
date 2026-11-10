import {test} from 'node:test';
import assert from 'node:assert/strict';
import {royalRanks,royalStatus} from '../assets/poke-royal.mjs';
import {sweetIcon,sweetMotifs,motifForTitle} from '../assets/poke-sweets.mjs';
import {royalNameKey,defaultRoyalName,normalizeRoyalName,readRoyalName,writeRoyalName} from '../assets/poke-royal-profile.mjs';
test('each named dessert gets the matching small illustration, including the user examples',()=>{
 const expected=['cookie','candy','pudding','biscuit','macaron','chocolate','tart','parfait','caramel','cream','guardian','legend'];
 for(let i=0;i<royalRanks.length;i++){const r=royalRanks[i];assert.equal(r.motif,expected[i],r.name);assert.equal(r.ornament,i);assert.ok(sweetIcon(r.motif).includes(`data-sweet="${expected[i]}"`));}
 for(const [title,motif] of [['キャラメル伯爵','caramel'],['プリン公爵','pudding'],['マカロン子爵','macaron'],['キャンディ騎士','candy']])assert.equal(motifForTitle(title),motif);
});
test('all stickers are self-contained accessible SVG with no user-controlled HTML or external assets',()=>{
 for(const [key,motif] of Object.entries(sweetMotifs)){const svg=sweetIcon(key);assert.ok(svg.includes('viewBox="0 0 64 64"'));assert.ok(svg.includes('role="img"'));assert.ok(svg.includes(motif.label));assert.ok(!/<script|onload=|href=|<foreignObject/.test(svg));for(const property of ['bg','panel','edge','accent'])assert.match(motif[property],/^#[0-9a-f]{6}$/i);}
 assert.ok(sweetIcon('__proto__').includes('data-sweet="kingdom"'));assert.ok(sweetIcon('<script>').includes('data-sweet="kingdom"'));assert.ok(!sweetIcon('<script>').includes('<script>'));
});
test('login boundaries and final goal remain unchanged; decoration becomes progressively richer',()=>{
 assert.deepEqual(royalRanks.map(r=>r.at),[0,10,30,100,300,1000,3000,5000,10000,20000,30000,50000]);
 assert.equal(royalStatus(9999).current.motif,'parfait');assert.equal(royalStatus(10000).current.motif,'caramel');assert.equal(royalStatus(50000).complete,true);for(let i=1;i<royalRanks.length;i++)assert.ok(royalRanks[i].ornament>royalRanks[i-1].ornament);
});
test('a display name uses its own key and does not alter login, visit, story or seasonal records',()=>{
 const entries=new Map([['poke-play-v1','{"logins":123,"visits":45}'],['poke-connected-story-v1','letters-kept'],['poke-tree-nickname','seasonal-kept']]);const store={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};const before=new Map(entries);
 assert.equal(readRoyalName(store),defaultRoyalName);const result=writeRoyalName('  ぷりんのお友達  ',store);assert.deepEqual(result,{name:'ぷりんのお友達',saved:true});assert.equal(readRoyalName(store),'ぷりんのお友達');for(const [k,v] of before)assert.equal(entries.get(k),v);assert.equal(entries.size,before.size+1);assert.equal(entries.get(royalNameKey),'ぷりんのお友達');
 assert.equal(normalizeRoyalName('あ'.repeat(30)).length,20);assert.equal(normalizeRoyalName('😀'.repeat(21)),'😀'.repeat(20));assert.equal(normalizeRoyalName('a\u0000b\n'),'ab');
});
test('storage failures keep the page usable without rewriting any old record',()=>{
 const store={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(readRoyalName(store),defaultRoyalName);assert.deepEqual(writeRoyalName('ぽけ',store),{name:'ぽけ',saved:false});
});

test('pudding appears at 30 logins, guardian and legend differ, and no sweet has facial features',()=>{
 assert.equal(royalStatus(30).current.name,'プリンの菓子職人');assert.equal(royalStatus(30).current.motif,'pudding');assert.notEqual(royalStatus(30000).current.motif,royalStatus(50000).current.motif);assert.notEqual(sweetIcon('guardian'),sweetIcon('legend'));
 for(const motif of Object.values(sweetMotifs)){assert.ok(!motif.art.includes('M29 42q3 3 6 0'));assert.ok(!motif.art.includes('cx="26" cy="38"'));assert.ok(!motif.art.includes('cx="38" cy="38"'));assert.ok(!motif.art.includes('#efa0a0'));}
});
