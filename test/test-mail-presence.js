'use strict';
const assert=require('node:assert/strict');
const {mock}=require('node:test');
const {createMail}=require('../lib/mail');
(async()=>{
 mock.timers.enable({apis:['setInterval','Date'],now:100000});
 const calls=[];
 const mail=createMail({invoke:async action=>{calls.push(action);return {items:[],inbound:[],enabled:false};}});
 try{
  await mail.request('status');
  mock.timers.tick(30000);await new Promise(setImmediate);
  assert.equal(calls.at(-1),'startup','An absent UI must pause rather than tick');
  await mail.request('status');
  for(let i=0;i<6;i++){mock.timers.tick(5000);await mail.request('status');}
  assert(calls.includes('tick'),'A present UI permits the bounded sender tick');
  mail.stop();const count=calls.length;mock.timers.tick(60000);await new Promise(setImmediate);assert.equal(calls.length,count);
  console.log('mail presence: expired window lease pauses and shutdown stops timers');
 }finally{mail.stop();mock.timers.reset();}
})().catch(e=>{console.error(e);process.exitCode=1;});
