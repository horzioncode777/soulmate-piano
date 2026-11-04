import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transformMidi,noteName,melodyGain} from '../src/midi.js';
test('realce desde Do central incluido, con límite de ganancia y apagado neutro',()=>{
  assert.equal(melodyGain(59,true,6),1);assert.equal(melodyGain(60,false,6),1);
  assert.equal(melodyGain(60,true,0),1);assert(Math.abs(melodyGain(60,true,3)-1.4125375446)<1e-8);
  assert.equal(melodyGain(108,true,100),melodyGain(60,true,6));assert.equal(melodyGain(60,true,-3),1);
});
test('note-on con velocidad cero sigue siendo note-off',()=>{
  assert.deepEqual(transformMidi([146,60,0],{mode:'fixed',velocity:100}),[146,60,0]);
});
test('transposición aplica igual a ataque y liberación y conserva canal',()=>{
  assert.deepEqual(transformMidi([145,60,80],{transpose:12}),[145,72,80]);
  assert.deepEqual(transformMidi([129,60,25],{transpose:12}),[129,72,25]);
  assert.equal(transformMidi([144,120,80],{transpose:12}),null);
});
test('teclado sin sensibilidad usa intensidad fija sin alterar pedal',()=>{
  assert.deepEqual(transformMidi([144,60,127],{mode:'fixed',velocity:72}),[144,60,72]);
  assert.deepEqual(transformMidi([176,64,127],{mode:'fixed',velocity:72}),[176,64,127]);
  assert.equal(noteName(60),'Do4');
});
