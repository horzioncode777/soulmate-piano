// Converts this FreePats SFZ subset, not arbitrary SFZ instruments.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {BasicSoundBank,BasicPreset,BasicInstrument,BasicSample,GeneratorTypes as G,SampleTypes,SoundBankLoader} from 'spessasynth_core';

const supported=new Set(['ampeg_release','width','lovel','hivel','loop_mode','lokey','hikey','key','pitch_keycenter','loop_start','loop_end','fil_type','cutoff','sample']);
export function regionsFromSfz(text){
  const clean=text.replace(/\/\/[^\r\n]*/g,'');
  let global={},group={};const regions=[];
  for(const match of clean.matchAll(/<(\w+)>([^<]*)/g)){
    const values=Object.fromEntries(Array.from(match[2].matchAll(/(\w+)=([^\s<>]+)/g),m=>[m[1],m[2]]));
    for(const key of Object.keys(values))assert(supported.has(key),'Unsupported SFZ opcode: '+key);
    if(match[1]==='global')global=values;
    else if(match[1]==='group')group=values;
    else if(match[1]==='region')regions.push({...global,...group,...values});
    else throw new Error('Unsupported SFZ header: '+match[1]);
  }
  assert(regions.length>0,'No sample regions');return regions;
}
export function readPcmWave(file){
  const data=fs.readFileSync(file);assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');
  let format,pcm;
  for(let pos=12;pos+8<=data.length;){const name=data.toString('ascii',pos,pos+4),size=data.readUInt32LE(pos+4),start=pos+8;assert(start+size<=data.length,'Truncated WAV');if(name==='fmt ')format=data.subarray(start,start+size);if(name==='data')pcm=data.subarray(start,start+size);pos=start+size+(size%2);}
  assert(format&&pcm,'Missing WAV chunks');const encoding=format.readUInt16LE(0);
  if(encoding===65534){assert(format.length>=40);assert.equal(format.subarray(24,40).toString('hex'),'0100000000001000800000aa00389b71','Only PCM extensible WAV supported');assert.equal(format.readUInt16LE(18),format.readUInt16LE(14),'Unsupported packed valid bits');}
  else assert.equal(encoding,1,'Only uncompressed integer PCM supported');
  const count=format.readUInt16LE(2),rate=format.readUInt32LE(4),align=format.readUInt16LE(12),bits=format.readUInt16LE(14),bytes=bits/8;
  assert([16,24,32].includes(bits));assert([1,2].includes(count));assert.equal(align,count*bytes);assert.equal(pcm.length%align,0);
  const frames=pcm.length/align,channels=Array.from({length:count},()=>new Float32Array(frames));
  for(let frame=0;frame<frames;frame++)for(let channel=0;channel<count;channel++)channels[channel][frame]=pcm.readIntLE(frame*align+channel*bytes,bytes)/2**(bits-1);
  return {channels,rate,frames,bits};
}
export function convertSfz(source,destination){
  const sourceRoot=path.dirname(path.resolve(source));const regions=regionsFromSfz(fs.readFileSync(source,'utf8'));
  const bank=new BasicSoundBank();Object.assign(bank.soundBankInfo,{name:'Upright Piano KW',engineer:'Gonzalo and Roberto / FreePats',copyright:'CC0 1.0 Public Domain Dedication',comment:'Converted from UprightPianoKW-20220221.sfz for Piano Pro. Stereo, two velocity layers. PCM16 conversion from original PCM24 WAV; original files unchanged.',software:'Piano Pro SFZ adapter'});
  const instrument=new BasicInstrument();instrument.name='Upright Piano KW';bank.addInstruments(instrument);
  const preset=new BasicPreset(bank);preset.name='Upright Piano KW';preset.createZone(instrument);bank.addPresets(preset);
  const manifest=[];
  for(const region of regions){
    assert(region.sample);const file=path.resolve(sourceRoot,region.sample.replaceAll('\\','/'));assert(file.startsWith(sourceRoot+path.sep),'Sample escapes source folder');
    const wave=readPcmWave(file),lo=Number(region.key??region.lokey),hi=Number(region.key??region.hikey),root=Number(region.key??region.pitch_keycenter),vLo=Number(region.lovel??0),vHi=Number(region.hivel??127);
    assert(lo>=21&&hi<=108&&lo<=hi&&Number.isInteger(root));assert(vLo>=0&&vHi<=127&&vLo<=vHi);assert.equal(Number(region.width??100),100);
    assert(['no_loop','loop_continuous'].includes(region.loop_mode));const looped=region.loop_mode==='loop_continuous';
    // SFZ loop_end is inclusive; BasicSample.loopEnd is exclusive.
    // https://sfzformat.com/opcodes/loopend/
    const loopStart=looped?Number(region.loop_start):0,loopEnd=looped?Number(region.loop_end)+1:wave.frames;
    assert(loopStart>=0&&loopEnd<=wave.frames&&loopEnd>loopStart,'Invalid loop for '+region.sample);
    const samples=wave.channels.map((audio,index)=>{
      const sample=new BasicSample(path.basename(file,'.wav')+(index===0?'_L':'_R'),wave.rate,root,0,SampleTypes.monoSample,loopStart,loopEnd);sample.setAudioData(audio,wave.rate);bank.addSamples(sample);
      const zone=instrument.createZone(sample);zone.keyRange={min:lo,max:hi};zone.velRange={min:vLo,max:vHi};
      zone.setGenerator(G.sampleModes,looped?1:0);zone.setGenerator(G.overridingRootKey,root);
      zone.setGenerator(G.releaseVolEnv,Math.round(1200*Math.log2(Number(region.ampeg_release))));
      zone.setGenerator(G.pan,wave.channels.length===2?(index===0?-500:500):0);
      if(region.cutoff){assert.equal(region.fil_type,'lpf_2p');zone.setGenerator(G.initialFilterFc,Math.round(1200*Math.log2(Number(region.cutoff)/8.1757989156)));}
      return sample;
    });
    if(samples.length===2)samples[0].setLinkedSample(samples[1],SampleTypes.leftSample);
    manifest.push({sample:region.sample,lo,hi,root,vLo,vHi,frames:wave.frames,rate:wave.rate,bits:wave.bits,loopStart,loopEnd,looped,cutoff:region.cutoff?Number(region.cutoff):null});
  }
  const output=bank.writeSF2({software:'Piano Pro SFZ adapter'});fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,Buffer.from(output));
  const loaded=SoundBankLoader.fromArrayBuffer(output);assert.equal(loaded.presets.length,1);assert.equal(loaded.samples.length,regions.length*2);
  for(let key=21;key<=108;key++)for(const velocity of [1,40,80,81,100,127]){
    const expected=manifest.filter(r=>key>=r.lo&&key<=r.hi&&velocity>=r.vLo&&velocity<=r.vHi);assert.equal(expected.length,1,`SFZ coverage ${key}/${velocity}`);
    const zones=loaded.instruments[0].zones.filter(z=>key>=z.keyRange.min&&key<=z.keyRange.max&&velocity>=z.velRange.min&&velocity<=z.velRange.max);assert.equal(zones.length,2,`SF2 stereo coverage ${key}/${velocity}`);
    assert.equal(loaded.presets[0].getVoiceParameters(key,velocity).length,2,`Playable voices ${key}/${velocity}`);
    for(const zone of zones){assert.equal(zone.sample.originalKey,expected[0].root);assert.equal(zone.sample.loopStart,expected[0].loopStart);assert.equal(zone.sample.loopEnd,expected[0].loopEnd);assert.equal(zone.getGenerator(G.sampleModes,0),expected[0].looped?1:0);}
  }
  const report={name:'Upright Piano KW',source:path.basename(source),regions:regions.length,stereoSamples:loaded.samples.length,keys:88,velocityLayers:[[1,80],[81,127]],sourceBits:24,outputBits:16,sampleRate:44100,bytes:output.byteLength,coverageChecks:88*6,manifest};
  fs.writeFileSync(path.join(path.dirname(destination),'conversion-report.json'),JSON.stringify(report,null,2));return report;
}
if(process.argv[2]){const report=convertSfz(path.resolve(process.argv[2]),path.resolve(process.argv[3]));const {manifest,...summary}=report;console.log(JSON.stringify(summary,null,2));}
