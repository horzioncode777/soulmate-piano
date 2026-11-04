import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs/promises';import path from 'node:path';
const {RecordingStore}=createRequire(import.meta.url)('../desktop/recording-store.cjs');
test('grabación WAV conserva orden, cabecera, audio y borrador ante errores de guardado',async()=>{
  await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/recording-'));const store=new RecordingStore(path.join(root,'drafts'));const {id}=await store.start(10,48000);
  assert.throws(()=>store.append(20,id,Buffer.alloc(4)),/no disponible/);await assert.rejects(store.start(10,48000),/anterior/);
  const first=Buffer.from([0,0,255,127,0,128,0,0]),second=Buffer.from([1,0,2,0]);await Promise.all([store.append(10,id,first),store.append(10,id,second)]);
  assert.throws(()=>store.append(10,id,Buffer.alloc(3)),/inválido/);await assert.rejects(store.save(10,id,path.join(root,'too-early.wav')),/Detén/);
  const info=await store.finish(10,id);assert.equal(info.bytes,12);await assert.rejects(store.save(10,id,path.join(root,'missing','take.wav')));assert.equal(store.hasPending(10),true);
  const target=path.join(root,'Mi interpretación.wav');await store.save(10,id,target);const data=await fs.readFile(target);assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');assert.equal(data.readUInt16LE(22),2);assert.equal(data.readUInt32LE(24),48000);assert.equal(data.readUInt16LE(34),16);assert.equal(data.readUInt32LE(40),12);assert.equal(data.readUInt32LE(4),data.length-8);assert.deepEqual(data.subarray(44),Buffer.concat([first,second]));assert.equal(store.hasPending(10),false);assert.deepEqual(await fs.readdir(path.join(root,'drafts')),[]);
  const next=await store.start(10,44100);await store.append(10,next.id,Buffer.alloc(8));await store.discard(10,next.id);assert.equal(store.hasPending(10),false);await fs.unlink(target);await fs.rmdir(path.join(root,'drafts'));await fs.rmdir(root);
});
