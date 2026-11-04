import {WorkletSynthesizer} from '/node_modules/spessasynth_lib/dist/index.js';
import {noteName, transformMidi,melodyGain} from './midi.js';
import {builtins as library} from './builtins.js';
import {releaseGain,pedalReleaseController,fullPedal} from './b290.js';
import {setupRecording} from './recorder.js';
const $ = id => document.getElementById(id);
let ctx, synth, gain, filter, analyser, compressor, midi, starting, ready=false, lastStrike=0;
let bankId='factory', bankCounter=0, demoTimers=[], presets=[];
let savedPianos=[],activeSavedId=null,activeBuiltinId='kawai',pedalValue=0,libraryTask=Promise.resolve();
const attackStates=new Map(),releasedB290=new Map();
const held=new Map(), voices=new Map(), logs=[], keyMap='awsedftgyhujkolp;';
const controls=['tone','volume','reverb','dynamics','velocity','transpose','brightness','room','fx-reverb','fx-compressor','fx-eq','fx-chorus','melody-boost'];
let melodyEnabled=false,hydrated=false,preferences={controls:{},devices:{}},settingsTask=Promise.resolve();
function persist(){
  if(!hydrated||!window.pianoSettings)return settingsTask;
  preferences.controls=Object.fromEntries(controls.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));preferences.melodyEnabled=melodyEnabled;preferences.piano=selectedPiano;
  const snapshot=structuredClone(preferences);settingsTask=window.pianoSettings.save(snapshot);settingsTask.catch(error=>status('No se guardaron los ajustes: '+error.message));return settingsTask;
}
function rememberDevice(id){const option=$(id).selectedOptions[0];preferences.devices[id]={id:$(id).value,name:$(id).value?option?.textContent||'':''};persist();}
function restoreDevice(id,ports){const preference=preferences.devices[id];if(!preference)return '';const connected=Array.from(ports).filter(p=>p.state===undefined||p.state==='connected');return connected.find(p=>p.id===preference.id)?.id||connected.find(p=>preference.name&&p.name===preference.name)?.id||'';}
function renderMelody(){ $('melody-toggle').setAttribute('aria-pressed',String(melodyEnabled));$('melody-toggle').textContent=melodyEnabled?'♪ Melodía derecha: ON':'♪ Melodía derecha';$('keyboard').classList.toggle('melody-enabled',melodyEnabled); }
function status(message, ok=false){$('status').textContent='● '+message;$('status').classList.toggle('ready',ok);}
function report(error){console.error(error);status('Error: '+error.message);}
setupRecording({activate,getContext:()=>ctx,getSource:()=>compressor,report,toast});
function log(text){logs.unshift(new Date().toLocaleTimeString('es-CO')+'  '+text);logs.length=Math.min(logs.length,8);$('events').textContent=logs.join('\n');$('events').style.whiteSpace='pre-line';}
function effects(){
  $('melody-boost-value').textContent='+'+Number($('melody-boost').value)+' dB';
  $('volume-value').textContent=$('volume').value+' %';$('reverb-value').textContent=$('reverb').value+' %';$('velocity-value').textContent=$('velocity').value;
  $('dynamic-hint').textContent=$('dynamics').value==='simulated' ? 'Aproximación por separación temporal entre notas. No mide la fuerza real; un acorde conserva una intensidad común.' : $('dynamics').value==='fixed' ? 'Todas las notas usan la intensidad base. El pedal físico CC64 funciona automáticamente.' : 'La velocidad viene de tu teclado. Si envía siempre el mismo valor, el volumen de las notas será uniforme.';
  $('brightness-value').textContent=(Number($('brightness').value)>0?'+':'')+$('brightness').value+' dB';
  $('room-amount').textContent=$('fx-reverb').checked?$('reverb').value+' %':'OFF';
  for(const knob of document.querySelectorAll('.knob')){const input=$(knob.dataset.for),fraction=(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min));knob.style.setProperty('--angle',(-135+fraction*270)+'deg');knob.style.setProperty('--sweep',(fraction*270)+'deg');}
  if(ready){synth.controllerChange(0,21,library[activeBuiltinId]?.pedalPrograms?127:0);gain.gain.setTargetAtTime(Number($('volume').value)/100*10**((library[activeBuiltinId]?.gainDb||0)/20),ctx.currentTime,.02);filter.gain.setTargetAtTime($('fx-eq').checked?(({warm:-4,bright:4,neutral:0})[$('tone').value]+Number($('brightness').value)):0,ctx.currentTime,.02);synth.controllerChange(0,91,$('fx-reverb').checked?Math.round(Number($('reverb').value)*1.27):0);synth.controllerChange(0,93,$('fx-chorus').checked?35:0);if(library[activeBuiltinId]?.pedalPrograms){synth.controllerChange(1,0,0);synth.controllerChange(1,32,0);synth.programChange(1,2);synth.controllerChange(1,64,0);synth.controllerChange(1,91,$('fx-reverb').checked?Math.round(Number($('reverb').value)*1.27):0);synth.controllerChange(1,93,$('fx-chorus').checked?35:0);}compressor.ratio.setTargetAtTime($('fx-compressor').checked?12:1,ctx.currentTime,.02);compressor.knee.setTargetAtTime($('fx-compressor').checked?6:0,ctx.currentTime,.02);}
  persist();
}
async function activate(){
  await boot;
  if(ready){await ctx.resume();return;}
  if(starting)return starting;
  starting=(async()=>{
    $('power').disabled=true;status('Cargando piano…');
    try {
      ctx=new AudioContext({latencyHint:'interactive'});await ctx.resume();
      await ctx.audioWorklet.addModule('/assets/piano-processor.js');
      synth=new WorkletSynthesizer(ctx,{audioNodeCreators:{worklet:(context,name,options)=>{const node=new AudioWorkletNode(context,name,options);node.addEventListener('processorerror',()=>report(new Error('El motor de audio se detuvo. Reinicia la aplicación.')));return node;}}});synth.setLogLevel(false,true,false);
      filter=ctx.createBiquadFilter();filter.type='highshelf';filter.frequency.value=2200;
      gain=ctx.createGain();gain.gain.value=0.7;
      compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=6;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.15;
      analyser=ctx.createAnalyser();synth.connect(filter);filter.connect(gain);gain.connect(compressor);compressor.connect(analyser);analyser.connect(ctx.destination);
      await synth.isReady;
      let data;const piano=library[selectedPiano];
      if(piano){const response=await fetch(piano.file);if(!response.ok)throw new Error('Falta el banco local. Para Kawai ejecuta npm run setup:piano; para los opcionales consulta docs/BANCOS.md.');data=await response.arrayBuffer();activeBuiltinId=selectedPiano;activeSavedId=null;}
      else {const entry=await window.pianoLibrary.read(selectedPiano);data=entry.data;activeBuiltinId=null;activeSavedId=selectedPiano;}
      await synth.soundBankManager.addSoundBank(data,'factory');bankId='factory';
      $('bank-label').textContent=piano?piano.name+' · Incluido':'Biblioteca: '+savedPianos.find(p=>p.id===selectedPiano).name;
      ready=true;updatePresets();effects();status('Piano listo',true);$('power').classList.add('on');$('power').title='Piano activado';$('power').setAttribute('aria-label','Piano activado');
      $('latency').textContent=`${Math.round(ctx.sampleRate/1000)} kHz · base de audio ≈ ${Math.round(ctx.baseLatency*1000)} ms`;
      await audioDevices();
    }catch(error){ready=false;await ctx?.close();$('power').title='Reintentar audio';throw error;}
    finally{$('power').disabled=false;starting=null;}
  })();return starting;
}
function updatePresets(){
  presets=synth.presetList.filter(p=>!p.isDrum&&!(library[activeBuiltinId]?.pedalPrograms&&p.program!==0));
  $('preset').replaceChildren(...presets.map((p,i)=>new Option(library[activeBuiltinId]?.name||`${p.name} · ${p.bankMSB}:${p.bankLSB}:${p.program}`,i)));
  let piano=presets.findIndex(p=>p.program===0&&p.bankMSB===0&&p.bankLSB===0);if(piano<0)piano=0;
  const previous=preferences.preset;if(previous?.piano===(activeSavedId||activeBuiltinId)){const match=presets.findIndex(p=>p.program===previous.program&&p.bankMSB===previous.bankMSB&&p.bankLSB===previous.bankLSB);if(match>=0)piano=match;}
  $('preset').value=String(piano);choosePreset();
}
function choosePreset(){if(!ready)return;panic();const p=presets[Number($('preset').value)];if(!p)return;synth.controllerChange(0,0,p.bankMSB);synth.controllerChange(0,32,p.bankLSB);synth.programChange(0,p.program);preferences.preset={piano:activeSavedId||activeBuiltinId,program:p.program,bankMSB:p.bankMSB,bankLSB:p.bankLSB};persist();}
function output(){return midi?.outputs.get($('midi-out').value);}
function releaseDamper(note,strike){
  if(!ready||!library[activeBuiltinId]?.pedalPrograms||!strike)return;
  synth.keyModifierManager.addModifier(1,note,{gain:strike.gain*releaseGain(strike.velocity),patch:{bankMSB:0,bankLSB:0,program:2,isGMGSDrum:false}});
  synth.noteOn(1,note,127);synth.noteOff(1,note,{time:ctx.currentTime+.25});
}
function setPedal(down,value=down?127:0){
  pedalValue=value;const b290=library[activeBuiltinId]?.pedalPrograms;
  const sustained=b290?fullPedal(value):down;$('sustain').setAttribute('aria-pressed',String(sustained));$('sustain').querySelector('.pedal-text').textContent=b290&&value>0&&!sustained?'Medio pedal':sustained?'Sostenido':'Libre';
  if(ready){if(b290)synth.controllerChange(0,20,pedalReleaseController(value));synth.controllerChange(0,64,b290?(sustained?127:0):value);}
  if(value<=64){for(const [note,strike] of releasedB290)releaseDamper(note,strike);releasedB290.clear();}
}
function panic(){
  for(const timer of demoTimers)clearTimeout(timer);demoTimers=[];
  if(ready){synth.controllerChange(0,64,0);synth.stopAll(true);}
  const port=output();if(port?.state==='connected')try {for(let ch=0;ch<16;ch++){port.send([176+ch,64,0]);port.send([176+ch,123,0]);port.send([176+ch,120,0]);}}catch(error){log(error.message);}
  held.clear();voices.clear();attackStates.clear();releasedB290.clear();document.querySelectorAll('.key.active').forEach(k=>k.classList.remove('active'));setPedal(false);$('note-label').textContent='88 TECLAS · A0 — C8';
}
function receive(data, source='midi'){
  if(!data?.length)return;
  const command=data[0]&240, channel=data[0]&15, id=`${source}:${channel}:${data[1]}`;
  const on=command===144&&data[2]>0, off=command===128||(command===144&&data[2]===0);
  if(data[0]>=240)return; // System messages and SysEx are not forwarded.
  let message=transformMidi(data,{transpose:Number($('transpose').value),mode:$('dynamics').value==='original'?'original':'fixed',velocity:Number($('velocity').value)});
  if(!message)return;
  if(on){
    if(!ready){status('Activa el piano para escuchar');return;}
    if($('dynamics').value==='simulated'){
      const now=performance.now(),gap=now-lastStrike;
      if(gap>35){receive.simVelocity=Math.max(25,Math.min(120,Number($('velocity').value)+(gap<230?10:gap>800?-12:0)));lastStrike=now;}
      message[2]=receive.simVelocity||Number($('velocity').value);
    }
    if(held.has(id)){const old=held.get(id),count=(voices.get(old)||1)-1;if(count>0)voices.set(old,count);else{voices.delete(old);synth.noteOff(0,old);}}
    releasedB290.delete(message[1]);attackStates.set(message[1],{velocity:message[2],gain:melodyGain(data[1],melodyEnabled,Number($('melody-boost').value))});
    held.set(id,message[1]);voices.set(message[1],(voices.get(message[1])||0)+1);
    synth.keyModifierManager.addModifier(0,message[1],{gain:melodyGain(data[1],melodyEnabled,Number($('melody-boost').value)),...(library[activeBuiltinId]?.pedalPrograms?{patch:{bankMSB:0,bankLSB:0,program:pedalValue>=16?1:0,isGMGSDrum:false}}:{})});
    synth.noteOn(0,message[1],message[2]);document.querySelector(`[data-note="${message[1]}"]`)?.classList.add('active');
    $('note-label').textContent=`${noteName(message[1])} · INTENSIDAD ${message[2]}`;
    log(`${source==='midi'?'MIDI':'LOCAL'}  CH ${channel+1}  ${noteName(message[1])}  ON  ${data[2]} → ${message[2]}`);
  }else if(off){
    const note=held.get(id);if(note===undefined)return;message[1]=note;held.delete(id);
    const count=(voices.get(note)||1)-1;
    if(count>0)voices.set(note,count);else{voices.delete(note);if(ready){synth.noteOff(0,note);const strike=attackStates.get(note);if(library[activeBuiltinId]?.pedalPrograms){if(pedalValue<=64)releaseDamper(note,strike);else releasedB290.set(note,strike);}attackStates.delete(note);}document.querySelector(`[data-note="${note}"]`)?.classList.remove('active');}
    log(`CH ${channel+1}  ${noteName(note)}  OFF`);
  }else if(command===176&&data[1]===64){setPedal(data[2]>=64,data[2]);log(`PEDAL ${data[2]>=64?'ON':'OFF'}`);}
  else if(command===176&&(data[1]===120||data[1]===123)){panic();return;}
  // Lock local piano selection; incoming program/bank changes only go to MIDI output.
  const port=output();if(port?.state==='connected')try{port.send(message);}catch(error){log('Salida MIDI: '+error.message);}
}
async function connectMidi(){
  if(!navigator.requestMIDIAccess){$('midi-status').textContent='MIDI no disponible en este entorno';return;}
  try{if(!midi){midi=await navigator.requestMIDIAccess({sysex:false});midi.onstatechange=()=>{const selected=midi.inputs.get($('midi-in').value);if($('midi-in').value&&(!selected||selected.state!=='connected'))panic();refreshMidi();};}refreshMidi();}catch(error){$('midi-status').textContent='MIDI: '+error.message;}
}
function refreshMidi(){
  for(const [selector, ports, empty] of [['midi-in',midi.inputs,'Selecciona tu piano'],['midi-out',midi.outputs,'Desactivado']]){
    const previous=$(selector).value||restoreDevice(selector,ports.values());$(selector).replaceChildren(new Option(empty,''),...Array.from(ports.values()).filter(p=>p.state==='connected').map(p=>new Option(p.name,p.id)));
    if(ports.get(previous)?.state==='connected')$(selector).value=previous;
  }
  for(const input of midi.inputs.values())input.onmidimessage=e=>{if(input.id===$('midi-in').value)receive(e.data);};
  const selected=midi.inputs.get($('midi-in').value);$('midi-status').textContent=selected?selected.name:'Sin dispositivo seleccionado';updateConnection();
}
async function audioDevices(){
  if(!ctx?.setSinkId)return;
  const selected=$('audio-out').value;
  const devices=await navigator.mediaDevices.enumerateDevices();
  $('audio-out').replaceChildren(new Option('Dispositivo predeterminado',''),...devices.filter(d=>d.kind==='audiooutput'&&d.deviceId!=='default'&&d.deviceId).map((d,i)=>new Option(d.label||`Salida ${i+1}`,d.deviceId)));
  const available=devices.filter(d=>d.kind==='audiooutput'&&d.deviceId!=='default').map(d=>({id:d.deviceId,name:d.label}));
  const target=available.some(d=>d.id===selected)?selected:restoreDevice('audio-out',available);$('audio-out').value=target;
  try{await ctx.setSinkId(target);}catch(error){$('audio-out').value='';log('Salida guardada no disponible: '+error.message);}

}
for(let n=21,white=0;n<=108;n++){
  const black=[1,3,6,8,10].includes(n%12), key=document.createElement('button');
  key.className='key'+(black?' black':'');key.dataset.note=n;key.setAttribute('aria-label',noteName(n));
  if(black){key.style.left=`${white/52*100-.58}%`;key.style.width=(100/52*.6)+'%';}else{white++;if(n%12===0||n===21)key.textContent=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12]+(Math.floor(n/12)-1);}
  key.onpointerdown=async e=>{e.preventDefault();key.setPointerCapture(e.pointerId);try{await activate();if(key.hasPointerCapture(e.pointerId))receive([144,n,85],'pointer'+e.pointerId);}catch(error){report(error);}};
  key.onpointerup=key.onpointercancel=key.onlostpointercapture=e=>receive([128,n,0],'pointer'+e.pointerId);
  $('keyboard').append(key);
}
$('power').onclick=()=>activate().catch(report);
$('melody-toggle').onclick=()=>{melodyEnabled=!melodyEnabled;renderMelody();persist();};
$('demo').onclick=async()=>{try{await activate();panic();[60,64,67,72,71,67,64,60].forEach((note,i)=>{demoTimers.push(setTimeout(()=>receive([144,note,85],'demo'),i*310));demoTimers.push(setTimeout(()=>receive([128,note,0],'demo'),i*310+270));});}catch(error){report(error);}};
$('panic').onclick=panic;$('sustain').onclick=()=>{const down=$('sustain').getAttribute('aria-pressed')!=='true';setPedal(down);output()?.send([176,64,down?127:0]);};
$('refresh').onclick=()=>{panic();Promise.all([connectMidi(),audioDevices()]).catch(report);};
$('midi-in').onchange=()=>{rememberDevice('midi-in');panic();$('midi-status').textContent=midi?.inputs.get($('midi-in').value)?.name||'Sin dispositivo seleccionado';updateConnection();};
let previousOutput='';$('midi-out').onchange=()=>{const next=$('midi-out').value;$('midi-out').value=previousOutput;panic();$('midi-out').value=next;previousOutput=next;rememberDevice('midi-out');};
$('audio-out').onchange=async()=>{try{await activate();await ctx.setSinkId($('audio-out').value);rememberDevice('audio-out');}catch(error){$('audio-out').value='';report(error);}};
$('preset').onchange=choosePreset;
for(const id of controls)$(id).addEventListener('input',()=>{if(['transpose','dynamics'].includes(id))panic();effects();});
$('soundfont').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  if(file.size>512*1024*1024){report(new Error('El banco supera el límite de 512 MB de esta versión'));event.target.value='';return;}
  try{const name=await requestPianoName(file.name.replace(/\.(sf2|sf3|dls)$/i,''));if(name===null)return;await libraryOperation(async()=>{
    if(!window.pianoLibrary)throw new Error('Abre la versión de escritorio para guardar tu biblioteca.');
    await activate();panic();status('Guardando piano…');const data=await file.arrayBuffer(),next='custom'+(++bankCounter);
    await synth.soundBankManager.addSoundBank(data.slice(0),next);
    let entry;try{entry=await window.pianoLibrary.save({name,originalName:file.name,data});}catch(error){await synth.soundBankManager.deleteSoundBank(next);throw error;}
    await synth.soundBankManager.deleteSoundBank(bankId);bankId=next;activeSavedId=entry.id;activeBuiltinId=null;updatePresets();effects();await refreshLibrary();showPiano(entry.id);$('bank-label').textContent='Biblioteca: '+entry.name;status('Banco cargado',true);toast('Piano guardado: '+entry.name);
  });}
  catch(error){report(error);}finally{event.target.value='';}
};
document.addEventListener('keydown',async e=>{if(e.repeat||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.altKey||e.metaKey)return;const index=keyMap.indexOf(e.key.toLowerCase());if(index<0)return;e.preventDefault();try{await activate();if(pcKeys.has(e.code))receive([144,60+index,85],'pc');}catch(error){report(error);}});
const pcKeys=new Set();document.addEventListener('keydown',e=>pcKeys.add(e.code),true);
document.addEventListener('keyup',e=>{pcKeys.delete(e.code);const index=keyMap.indexOf(e.key.toLowerCase());if(index>=0)receive([128,60+index,0],'pc');});
window.addEventListener('blur',()=>{
  pcKeys.clear();for(const [id,note] of Array.from(held)){const source=id.split(':')[0];if(source==='pc'||source.startsWith('pointer'))receive([128,note-Number($('transpose').value),0],source);}
});
function updateConnection(){const selected=midi?.inputs.get($('midi-in').value);$('connection-status').classList.toggle('connected',!!selected&&selected.state==='connected');$('connection-label').textContent=selected?selected.name+' (MIDI)':'Conectar piano (MIDI)';}
function showTab(name){for(const button of document.querySelectorAll('.tab')){const selected=button.dataset.tab===name;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));}for(const panel of document.querySelectorAll('.workspace-panel'))panel.hidden=panel.dataset.panel!==name;}
for(const button of document.querySelectorAll('.tab'))button.onclick=()=>showTab(button.dataset.tab);
for(const button of document.querySelectorAll('.close-panel'))button.onclick=()=>showTab('instrumento');
$('open-room').onclick=()=>showTab('sala');$('open-effects').onclick=()=>showTab('efectos');$('connection-status').onclick=()=>showTab('ajustes');
let toastTimer;
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3400);}
$('save').onclick=async()=>{effects();try{await persist();toast('Ajustes guardados en esta PC.');}catch(error){report(error);}};
$('help-keyboard').onclick=()=>toast('Toca con A W S E D F T G Y H U J K · registro Do4 a Do5.');
let selectedPiano='kawai';
function showPiano(id){
  const entry=savedPianos.find(p=>p.id===id);const piano=entry?{maker:'MI BIBLIOTECA',name:entry.name,type:'Piano personal · '+entry.format,description:'Tu piano, guardado en esta PC. Puedes cambiar de instrumento y volver a él cuando quieras.'}:library[id];if(!piano)return;
  selectedPiano=id;showTab('instrumento');for(const card of document.querySelectorAll('.piano-card')){const selected=card.dataset.piano===id;card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));}
  $('instrument-maker').textContent=piano.maker;$('instrument-name').textContent=piano.name;$('instrument-type').textContent=piano.type;$('instrument-description').textContent=piano.description;
  $('availability').textContent=entry?'Guardado en tu biblioteca':piano.optional?'Banco opcional · requiere instalación local':'Kawai CC0 · piano de referencia';$('load-piano').textContent='Tocar este piano';
  document.querySelector('.stage-image').style.filter=({kawai:'none',steinway:'sepia(.08)',yamaha:'saturate(.75) brightness(1.07)',bosendorfer:'sepia(.2)'})[id]||'none';persist();
}
function selectPiano(id){return savedPianos.some(p=>p.id===id)?loadSavedPiano(id):libraryOperation(()=>loadBuiltinPiano(id));}
for(const card of document.querySelectorAll('.piano-card'))card.onclick=()=>selectPiano(card.dataset.piano).catch(report);
function adjacentPiano(direction){const ids=[...Object.keys(library),...savedPianos.map(p=>p.id)];selectPiano(ids[(ids.indexOf(selectedPiano)+direction+ids.length)%ids.length]).catch(report);}
$('previous-piano').onclick=()=>adjacentPiano(-1);$('next-piano').onclick=()=>adjacentPiano(1);
$('load-piano').onclick=()=>selectPiano(selectedPiano).catch(report);
function roomProfile(value){$('room').value=value;const profile={concert:60,studio:20,dry:0};$('reverb').value=profile[value];$('fx-reverb').checked=value!=='dry';for(const card of document.querySelectorAll('[data-room]'))card.classList.toggle('selected',card.dataset.room===value);effects();}
$('room').addEventListener('change',()=>roomProfile($('room').value));for(const card of document.querySelectorAll('[data-room]'))card.onclick=()=>roomProfile(card.dataset.room);
for(const card of document.querySelectorAll('[data-room]'))card.classList.toggle('selected',card.dataset.room===$('room').value);
for(const knob of document.querySelectorAll('.knob')){
  const input=$(knob.dataset.for);let drag=null;
  input.addEventListener('pointerdown',e=>{e.preventDefault();input.focus();input.setPointerCapture(e.pointerId);drag={y:e.clientY,value:Number(input.value)};});
  input.addEventListener('pointermove',e=>{if(!drag)return;const span=Number(input.max)-Number(input.min);input.value=Math.round(Math.max(Number(input.min),Math.min(Number(input.max),drag.value+(drag.y-e.clientY)*span/130)));input.dispatchEvent(new Event('input',{bubbles:true}));});
  input.addEventListener('lostpointercapture',()=>drag=null);input.addEventListener('pointerup',()=>drag=null);input.addEventListener('pointercancel',()=>drag=null);
  input.addEventListener('wheel',e=>{e.preventDefault();input.value=Number(input.value)+(e.deltaY<0?1:-1);input.dispatchEvent(new Event('input',{bubbles:true}));},{passive:false});
  input.addEventListener('dblclick',()=>{input.value=input.defaultValue;input.dispatchEvent(new Event('input',{bubbles:true}));});
}
function requestPianoName(initial,renaming=false){return new Promise(resolve=>{
  const dialog=$('piano-name-dialog');$('piano-name-title').textContent=renaming?'Renombrar piano':'Guardar piano';$('piano-name-description').textContent=renaming?'Cambia el nombre de este piano en tu biblioteca.':'Guardaremos una copia del banco en esta PC. Podrás cambiar de piano sin perderlo.';$('piano-name-save').textContent=renaming?'Guardar nombre':'Guardar piano';$('piano-name').value=initial.slice(0,80);
  $('piano-name-form').onsubmit=event=>{event.preventDefault();if(!$('piano-name').value.trim()){$('piano-name').setCustomValidity('Escribe un nombre para el piano.');$('piano-name').reportValidity();return;}$('piano-name').setCustomValidity('');dialog.close('save');};
  $('piano-name').oninput=()=>$('piano-name').setCustomValidity('');$('piano-name').setCustomValidity('');$('piano-name-cancel').onclick=()=>dialog.close('cancel');dialog.onclose=()=>resolve(dialog.returnValue==='save'?$('piano-name').value.trim():null);dialog.showModal();$('piano-name').focus();$('piano-name').select();
});}
function confirmDeletePiano(name){return new Promise(resolve=>{const dialog=$('piano-delete-dialog');$('piano-delete-description').textContent='¿Eliminar “'+name+'” de tu biblioteca?';$('piano-delete-cancel').onclick=()=>dialog.close('cancel');$('piano-delete-confirm').onclick=()=>dialog.close('delete');dialog.onclose=()=>resolve(dialog.returnValue==='delete');dialog.showModal();$('piano-delete-cancel').focus();});}
function libraryOperation(operation){const result=libraryTask.then(async()=>{const disable=value=>{for(const button of document.querySelectorAll('.piano-card,.scene-arrow,.card-tools button,#load-piano,#add-piano,#soundfont'))button.disabled=value;};disable(true);try{return await operation();}finally{disable(false);}});libraryTask=result.catch(()=>{});return result;}
async function refreshLibrary(){
  if(!window.pianoLibrary)return;const result=await window.pianoLibrary.list();savedPianos=result.pianos;
  for(const warning of result.warnings)log(warning);
  const container=document.querySelector('.piano-list');for(const card of container.querySelectorAll('.saved-card'))card.remove();
  for(const entry of savedPianos){
    const wrapper=document.createElement('div');wrapper.className='saved-card';wrapper.dataset.libraryId=entry.id;
    const card=document.createElement('button');card.className='piano-card';card.dataset.piano=entry.id;card.setAttribute('aria-pressed',String(selectedPiano===entry.id));card.classList.toggle('selected',selectedPiano===entry.id);card.title=entry.name;
    const thumbnail=document.createElement('div');thumbnail.className='thumbnail custom';const text=document.createElement('div');const name=document.createElement('strong');name.textContent=entry.name;const subtitle=document.createElement('span');subtitle.textContent='Mi biblioteca · '+entry.format;const saved=document.createElement('small');saved.textContent='GUARDADO EN ESTA PC';text.append(name,subtitle,saved);card.append(thumbnail,text);card.onclick=()=>loadSavedPiano(entry.id).catch(report);
    const tools=document.createElement('div');tools.className='card-tools';const rename=document.createElement('button');rename.textContent='✎';rename.title='Renombrar piano';rename.setAttribute('aria-label','Renombrar '+entry.name);rename.onclick=()=>renameSavedPiano(entry).catch(report);const remove=document.createElement('button');remove.textContent='×';remove.title='Eliminar de mi biblioteca';remove.setAttribute('aria-label','Eliminar '+entry.name);remove.onclick=()=>deleteSavedPiano(entry).catch(report);tools.append(rename,remove);wrapper.append(card,tools);container.append(wrapper);
  }
  $('library-count').textContent=String(Object.keys(library).length+savedPianos.length).padStart(2,'0');
  $('library-count').dataset.ready='true';
}
async function loadBuiltinPiano(id){
  const piano=library[id];if(!piano)throw new Error('Piano incluido desconocido');
  await activate();if(activeBuiltinId!==id||activeSavedId){
    panic();status('Cargando '+piano.name+'…');const response=await fetch(piano.file);if(!response.ok)throw new Error('Falta el banco local. Para Kawai ejecuta npm run setup:piano; para los opcionales consulta docs/BANCOS.md.');const next='builtin-'+(++bankCounter);
    await synth.soundBankManager.addSoundBank(await response.arrayBuffer(),next);await synth.soundBankManager.deleteSoundBank(bankId);bankId=next;activeSavedId=null;activeBuiltinId=id;updatePresets();effects();
  }
  showPiano(id);$('bank-label').textContent=piano.name+' · Incluido';status('Piano listo',true);
}
async function loadFactoryPiano(){await loadBuiltinPiano('kawai');}
function loadSavedPiano(id){return libraryOperation(async()=>{await activate();if(activeSavedId!==id){panic();status('Cargando tu piano…');const entry=await window.pianoLibrary.read(id),next='saved-'+(++bankCounter);await synth.soundBankManager.addSoundBank(entry.data,next);await synth.soundBankManager.deleteSoundBank(bankId);bankId=next;activeSavedId=id;activeBuiltinId=null;updatePresets();effects();}showPiano(id);$('bank-label').textContent='Biblioteca: '+savedPianos.find(p=>p.id===id).name;status('Piano listo',true);});}
async function renameSavedPiano(entry){const name=await requestPianoName(entry.name,true);if(name===null)return;await libraryOperation(async()=>{await window.pianoLibrary.rename(entry.id,name);await refreshLibrary();if(selectedPiano===entry.id)showPiano(entry.id);if(activeSavedId===entry.id)$('bank-label').textContent='Biblioteca: '+name;toast('Nombre guardado: '+name);});}
async function deleteSavedPiano(entry){if(!await confirmDeletePiano(entry.name))return;await libraryOperation(async()=>{const wasSelected=selectedPiano===entry.id;if(activeSavedId===entry.id)await loadFactoryPiano();await window.pianoLibrary.remove(entry.id);await refreshLibrary();if(wasSelected)showPiano(activeSavedId||activeBuiltinId||'kawai');toast('Piano eliminado de la biblioteca.');});}
$('add-piano').onclick=()=>$('soundfont').click();

setInterval(()=>{if(ready)$('voice-count').textContent='Voces: '+synth.voiceCount;},150);
const boot=(async()=>{
  try{if(window.pianoSettings)preferences=await window.pianoSettings.load();}catch(error){report(error);}
  preferences.devices||={};preferences.controls||={};
  for(const id of controls)if(preferences.controls[id]!==undefined){if($(id).type==='checkbox')$(id).checked=preferences.controls[id];else $(id).value=preferences.controls[id];}
  melodyEnabled=!!preferences.melodyEnabled;renderMelody();await refreshLibrary();
  const id=library[preferences.piano]||savedPianos.some(p=>p.id===preferences.piano)?preferences.piano:'kawai';showPiano(id);effects();await connectMidi();previousOutput=$('midi-out').value;hydrated=true;
})();boot.catch(report);

