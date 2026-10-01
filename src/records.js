// Shared experiment records. The server trusts nothing from the page: every field is checked and rebuilt here.
const RULES=['single','pooled','colored'],TIMINGS=['random','spread'];
const int=(value,min,max,label)=>{if(!Number.isInteger(value)||value<min||value>max)throw new Error('Invalid '+label);return value;};
const text=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('Invalid '+label);return value.trim();};

export const recordKey=record=>[record.arsId,record.rule,record.timing,record.dwell,record.seed,record.minShared].join('-');

export function validateRecord(input,now=new Date()){
 if(!input||typeof input!=='object')throw new Error('Invalid record');
 if(!/^\d{5}$/.test(input.arsId??''))throw new Error('Invalid arsId');
 if(!RULES.includes(input.rule))throw new Error('Invalid rule');
 if(!TIMINGS.includes(input.timing))throw new Error('Invalid timing');
 const served=int(input.served,0,100000,'served');
 const record={
  savedAt:now.toISOString(),arsId:input.arsId,stopName:text(input.stopName,40,'stopName'),rule:input.rule,timing:input.timing,
  dwell:int(input.dwell,5,120,'dwell'),seed:int(input.seed,1,9999,'seed'),minShared:int(input.minShared,1,10,'minShared'),
  berths:int(input.berths,1,16,'berths'),hours:int(input.hours,1,24,'hours'),served,waited:int(input.waited,0,served,'waited'),
  totalWait:int(input.totalWait,0,10000000,'totalWait'),maxQueue:int(input.maxQueue,0,served,'maxQueue'),
  linkedShare:input.linkedShare===null?null:int(input.linkedShare,0,100,'linkedShare'),
  by:typeof input.by==='string'?input.by.trim().slice(0,20):''
 };
 return {key:recordKey(record),record};
}
