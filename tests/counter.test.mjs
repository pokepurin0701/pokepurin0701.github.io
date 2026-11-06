import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = mkdtempSync(join(tmpdir(), 'poke-counter-test-'));
const mock = `
export const tables = new Map();
export let unknownAfterCommit = false;
export const setUnknown = () => { unknownAfterCommit = true; };
const err = code => Object.assign(new Error(code), {code});
const table = name => { if (!tables.has(name)) tables.set(name,new Map()); return tables.get(name); };
function execute(op, draft) {
  const t = draft.get(op.table) || new Map(); draft.set(op.table,t);
  if (op.type === 'add') return op.records.map(r => {
    if(t.has(r.id)) throw err('AppDatabaseDuplicateId'); t.set(r.id,structuredClone(r)); return r.id;
  });
  return op.records.map(r => {
    if(!t.has(r.id)) throw err('AppDatabaseConditionFailed');
    const old=t.get(r.id); for(const [k,v] of Object.entries(r.record)) old[k]=v?.increment ? (old[k]||0)+v.amount : v;
    t.set(r.id,old); return true;
  });
}
function operation(type,name,records) {
  const op={type,table:name,records};
  return {op,then(resolve,reject){
    try{let result;try{result=execute(op,tables);}catch(e){if(type==='add'&&e.code==='AppDatabaseDuplicateId')result=[null];else throw e;}resolve(result);}catch(e){reject(e);}
  }};
}
export const db = {
  get:async(name,ids)=>ids.map(id=>structuredClone(table(name).get(id)||null)),
  tx:{ add:(name,rs)=>operation('add',name,rs),update:(name,rs)=>operation('update',name,rs) },
  transact:async ops=>{
    const draft=structuredClone(tables); const result=ops.map(o=>execute(o.op,draft));
    tables.clear(); for(const [k,v] of draft)tables.set(k,v);
    if(unknownAfterCommit){unknownAfterCommit=false;throw err('AppDatabaseUnknownOutcome');}return result;
  }
};
export const increment = amount=>({increment:true,amount});
export const isAppDatabaseError = e=>typeof e?.code==='string';
export const json = (body,statusCode=200)=>({body,statusCode});
export const error = (message,statusCode)=>({body:{error:message},statusCode});
export const router = routes=>async event=>routes[event.route][0]({body:event.body});
`;
writeFileSync(join(directory,'sdk.mjs'), mock);
const input=readFileSync(new URL('../server/appdeploy/backend/index.ts', import.meta.url),'utf8');
const source=stripTypeScriptTypes(input).replace("from '@appdeploy/sdk'", "from './sdk.mjs'");
writeFileSync(join(directory,'backend.mjs'),source);
const { handler }=await import(pathToFileURL(join(directory,'backend.mjs')));
const { tables, setUnknown }=await import(pathToFileURL(join(directory,'sdk.mjs')));
const token='a'.repeat(64), other='b'.repeat(64);
const requestId=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const call=(route,body)=>handler({route:'POST /api/'+route,body});

test('shared counter caps daily writes, persists totals and rejects duplicate requests', async()=>{
  tables.clear();
  const before=await call('status',{token});assert.equal(before.body.total,0);
  const first=await call('praise',{token,requestId:requestId(1)});assert.equal(first.body.total,1);
  const duplicate=await call('praise',{token,requestId:requestId(1)});assert.equal(duplicate.body.total,1);
  for(let n=2;n<=12;n++)await call('praise',{token,requestId:requestId(n)});
  const result=await call('status',{token});assert.equal(result.body.total,10);assert.equal(result.body.daily,10);
  await call('praise',{token:other,requestId:requestId(1)});
  const second=await call('status',{token:other});assert.equal(second.body.total,11);assert.equal(second.body.daily,1);
});
test('concurrent new requests atomically reserve different daily slots',async()=>{
  tables.clear();
  await Promise.all(Array.from({length:5},(_,i)=>call('praise',{token,requestId:requestId(i+100)})));
  const result=await call('status',{token});assert.equal(result.body.total,5);assert.equal(result.body.daily,5);
});
test('unknown successful commit is reconciled with its receipt',async()=>{
  tables.clear();setUnknown();
  const result=await call('praise',{token,requestId:requestId(500)});assert.equal(result.statusCode,200);assert.equal(result.body.total,1);
  const retry=await call('praise',{token,requestId:requestId(500)});assert.equal(retry.body.total,1);
});
test('invalid tokens and request IDs cannot write counters',async()=>{
  tables.clear();assert.equal((await call('praise',{token:'wrong',requestId:requestId(1)})).statusCode,400);
  assert.equal((await call('praise',{token,requestId:'wrong'})).statusCode,400);
  assert.equal((await call('status',{token})).body.total,0);
});
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}));
