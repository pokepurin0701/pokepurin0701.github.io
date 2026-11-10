export const royalNameKey='poke-royal-name-v1';
export const defaultRoyalName='リスナーさん';
export function normalizeRoyalName(value){return Array.from(String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,20).join('');}
export function readRoyalName(store){try{return normalizeRoyalName((store??globalThis.localStorage).getItem(royalNameKey))||defaultRoyalName;}catch{return defaultRoyalName;}}
export function writeRoyalName(value,store){const name=normalizeRoyalName(value)||defaultRoyalName;try{(store??globalThis.localStorage).setItem(royalNameKey,name);return {name,saved:true};}catch{return {name,saved:false};}}
