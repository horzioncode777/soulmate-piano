import {createRequire} from 'node:module';import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {pedalCurve,pedalReleaseController,releaseGain,fullPedal} from '../src/b290.js';
const {SettingsStore}=createRequire(import.meta.url)('../desktop/settings-store.cjs');
test('ajustes sobreviven a una nueva instancia y las escrituras mantienen el orden',async()=>{
  await fs.mkdir('test-results',{recursive:true});const directory=await fs.mkdtemp(path.resolve('test-results/settings-'));const file=path.join(directory,'settings.json');const store=new SettingsStore(file);
  await Promise.all([store.save({controls:{volume:'15'}}),store.save({controls:{volume:'37',brightness:'7','melody-boost':'4','fx-eq':false},piano:'yamaha',melodyEnabled:true,devices:{'midi-in':{id:'piano',name:'Mi piano'}},preset:{piano:'yamaha',program:0,bankMSB:0,bankLSB:0}})]);
  const restored=await new SettingsStore(file).load();assert.equal(restored.controls.volume,'37');assert.equal(restored.controls['fx-eq'],false);assert.equal(restored.piano,'yamaha');assert.equal(restored.devices['midi-in'].id,'piano');assert.equal(restored.melodyEnabled,true);assert.equal(restored.preset.program,0);
  await store.save({controls:{volume:'999',brightness:'bad',tone:'unknown'},devices:{'midi-in':{id:123}}});const bounded=await store.load();assert.deepEqual(bounded.controls,{volume:'100'});assert.deepEqual(bounded.devices,{});
  await fs.unlink(file);await fs.rmdir(directory);
});
test('curva de pedal B290 y ganancia de liberación conservan puntos originales',()=>{
  assert.equal(pedalCurve(32),0);assert.equal(pedalCurve(64),.3);assert.equal(pedalCurve(72),.4);assert.equal(pedalCurve(73),1);assert.equal(fullPedal(72),false);assert.equal(fullPedal(73),true);assert.equal(pedalReleaseController(127),127);
  assert.equal(releaseGain(40),.01);assert.equal(releaseGain(80),.1);assert.equal(releaseGain(127),1);assert(pedalCurve(50)>pedalCurve(42));
});
