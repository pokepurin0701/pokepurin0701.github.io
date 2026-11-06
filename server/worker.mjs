import {applyAction,initial} from '../assets/poke-core.mjs';
const allowed=new Set(['visit','praise','job','mood','rules','logo','night','title','command','resume']);
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),site=env.SITE_ORIGIN;
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':site,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!site||origin!==site)return new Response('Forbidden',{status:403});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(new URL(request.url).pathname!=='/api/play'||request.method!=='POST')return send({error:'Not found'},404);
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!/^[a-f0-9]{64}$/.test(token))return send({error:'Invalid transfer code'},401);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const id=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 try{
  if(Number(request.headers.get('Content-Length'))>2048)return send({error:'Too large'},413);
  const reader=request.body?.getReader();if(!reader)return send({error:'Missing body'},400);let bytes=0,chunks=[];while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2048){await reader.cancel();return send({error:'Too large'},413);}chunks.push(value);}const buffer=new Uint8Array(bytes);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}const action=JSON.parse(new TextDecoder().decode(buffer));
  if(!action||!allowed.has(action.type))return send({error:'Invalid action'},400);
  // Runtime time is authoritative: clients cannot submit a day, count or replacement state.
  const now=new Date();
  let row=await env.DB.prepare('SELECT state, version, contribution FROM players WHERE id = ?').bind(id).first();
  if(!row){if(action.type==='resume')return send({error:'Unknown transfer code'},404);if(action.type!=='visit')return send({error:'Visit first'},409);await env.DB.prepare('INSERT OR IGNORE INTO players (id, state, version, contribution) VALUES (?, ?, 0, 0)').bind(id,JSON.stringify(initial())).run();}
  let state;
  for(let attempt=0;attempt<5;attempt++){
   row=await env.DB.prepare('SELECT state, version, contribution FROM players WHERE id = ?').bind(id).first();
   const previous=JSON.parse(row.state);state=applyAction(previous,action,now);
   let contribution=row.contribution;
   if(action.type==='praise'&&state.dailyPraises>(previous.praiseDay===state.praiseDay?previous.dailyPraises:0))contribution++;
   if(action.type==='resume')break;
   const result=await env.DB.prepare('UPDATE players SET state = ?, version = version + 1, contribution = ? WHERE id = ? AND version = ?').bind(JSON.stringify(state),contribution,id,row.version).run();
   if(result.meta.changes)break;
   if(attempt===4)return send({error:'Busy, retry'},409);
  }
  const aggregate=await env.DB.prepare('SELECT COALESCE(SUM(contribution), 0) AS total FROM players').first();
  return send({state,total:aggregate.total});
 }catch(error){console.error('Poke API failure',error?.name);return send({error:'Request failed'},500);}
}};
