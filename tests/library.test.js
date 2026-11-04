import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {LibraryStore}=createRequire(import.meta.url)('../desktop/library-store.cjs');
test('biblioteca copia datos, conserva nombres entre reinicios y borra solo el piano elegido',async()=>{
  const base=path.resolve('test-results');await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'store-'));let store=new LibraryStore(root);
  const data=new Uint8Array(20);data.set(Buffer.from('RIFF'));data.set(Buffer.from('sfbk'),8);
  const first=await store.save({name:' Mi Kawai ',originalName:'kw.sf2',data});const second=await store.save({name:'Otro piano',originalName:'other.sf2',data});data[15]=99;
  store=new LibraryStore(root);assert.equal((await store.list()).pianos.length,2);assert.equal((await store.read(first.id)).metadata.name,'Mi Kawai');assert.equal(new Uint8Array((await store.read(first.id)).data)[15],0);
  await store.rename(first.id,'Kawai personal');store=new LibraryStore(root);assert.equal((await store.read(first.id)).metadata.name,'Kawai personal');
  await assert.rejects(()=>store.rename(first.id,'  '));await assert.rejects(()=>store.read('../escape'));await assert.rejects(()=>store.remove('../escape'));
  await store.remove(first.id);assert.deepEqual((await store.list()).pianos.map(p=>p.id),[second.id]);assert.equal((await store.read(second.id)).metadata.name,'Otro piano');
  await assert.rejects(()=>store.save({name:'Roto',originalName:'bad.sf2',data:new Uint8Array(20)}));assert.equal((await store.list()).pianos.length,1);
  await fs.writeFile(path.join(root,second.id,'piano.json'),'bad json');const result=await store.list();assert.equal(result.warnings.length,1);assert.equal(result.pianos.length,0);assert.equal((await fs.stat(path.join(root,second.id,'soundbank.bin'))).size,20);
});
