import fs from 'node:fs';
import assert from 'node:assert/strict';
import {SoundBankLoader} from 'spessasynth_core';
import {builtins} from '../src/builtins.js';
for(const [id,piano] of Object.entries(builtins)){
  const data=fs.readFileSync('.'+piano.file);const bank=SoundBankLoader.fromArrayBuffer(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
  const presets=bank.presets.filter(p=>p.program===(id==='bosendorfer'?0:0)&&p.bankMSB===0&&p.bankLSB===0);
  assert(presets.length,`${id}: missing piano preset`);
  const programs=id==='bosendorfer'?[...presets,bank.presets.find(p=>p.program===1)]:presets;
  for(const p of programs)for(let note=21;note<=108;note++)for(const velocity of [1,40,70,85,100,127]){
    assert(p.zones.some(z=>note>=z.keyRange.min&&note<=z.keyRange.max&&velocity>=z.velRange.min&&velocity<=z.velRange.max&&z.instrument.zones.some(i=>note>=i.keyRange.min&&note<=i.keyRange.max&&velocity>=i.velRange.min&&velocity<=i.velRange.max)),`${id}: missing ${note}/${velocity}`);
  }
  console.log(JSON.stringify({id,bytes:data.length,presets:bank.presets.map(p=>p.name),samples:bank.samples.length,info:bank.soundBankInfo,coverage:'88 keys × 6 velocities PASS'}));
}
