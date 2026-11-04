const {_electron:electron}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
  fs.mkdirSync('test-results',{recursive:true});const profile=fs.mkdtempSync(path.resolve('test-results/b290-profile-'));const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch(process.env.AUREA_EXECUTABLE?{executablePath:process.env.AUREA_EXECUTABLE,args:['--user-data-dir='+profile],env}:{args:['.','--user-data-dir='+profile],env});
  try{const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{const create=AudioContext.prototype.createAnalyser;AudioContext.prototype.createAnalyser=function(){return window.boseAnalyser=create.call(this);};const input={id:'test',name:'Test',state:'connected'};window.boseMidi=input;Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>({inputs:new Map([['test',input]]),outputs:new Map()})});});await page.reload();
    await page.locator('[data-piano="bosendorfer"]').click();await page.locator('#load-piano:not([disabled])').waitFor({timeout:120000});
    await page.locator('[data-tab="ajustes"]').click();await page.selectOption('#midi-in','test');await page.locator('#fx-reverb').uncheck();await page.locator('#fx-compressor').uncheck();await page.locator('#fx-chorus').uncheck();
    await page.evaluate(async()=>{const {WorkletSynthesizer}=await import('/node_modules/spessasynth_lib/dist/index.js');const on=WorkletSynthesizer.prototype.noteOn;window.rtdCalls=[];window.rtdOnly=false;window.suppressRtd=false;WorkletSynthesizer.prototype.noteOn=function(ch,n,v,...args){if(ch===1)window.rtdCalls.push({note:n,velocity:v,modifier:this.keyModifierManager.getModifier(ch,n)});if((ch===0&&window.rtdOnly)||(ch===1&&window.suppressRtd))return;return on.call(this,ch,n,v,...args);};});
    const send=data=>page.evaluate(data=>window.boseMidi.onmidimessage({data}),data);
    const peak=()=>page.evaluate(async()=>{let peak=0;for(let i=0;i<100;i++){const data=new Float32Array(window.boseAnalyser.fftSize);window.boseAnalyser.getFloatTimeDomainData(data);peak=Math.max(peak,...data.map(Math.abs));await new Promise(r=>setTimeout(r,5));}return peak;});
    // Isolate the recorded release samples from the main piano's decay.
    await page.evaluate(()=>window.rtdOnly=true);await send([144,60,95]);await send([128,60,0]);await page.waitForTimeout(40);const releasePeak=await peak();assert(releasePeak>.000001,'Recorded release samples are silent');
    await page.locator('#panic').click();await page.waitForTimeout(80);const count=await page.evaluate(()=>window.rtdCalls.length);await send([176,64,127]);await send([144,60,95]);await send([128,60,0]);assert.equal(await page.evaluate(()=>window.rtdCalls.length),count);await send([176,64,0]);assert.equal(await page.evaluate(()=>window.rtdCalls.length),count+1,'Pedal-up did not trigger deferred damper');
    await page.evaluate(()=>{window.rtdOnly=false;window.suppressRtd=true;});
    async function tail(pedal,raise=false){await page.locator('#panic').click();await page.waitForTimeout(80);await send([176,64,pedal]);await send([144,60,95]);await page.waitForTimeout(150);await send([128,60,0]);await page.waitForTimeout(150);if(raise)await send([176,64,0]);await page.waitForTimeout(250);return peak();}
    const up=await tail(0),half=await tail(64),redamped=await tail(64,true);assert(half>up*2,`Half-pedal release unchanged: ${up}/${half}`);assert(redamped<half*.8,`Pedal-up did not damp an existing tail: ${half}/${redamped}`);
    await page.locator('#panic').click();assert.deepEqual(errors,[]);console.log(JSON.stringify({recordedReleasePeak:releasePeak,deferredRelease:'PASS',upTail:up,halfTail:half,redampedTail:redamped,continuousRelease:'PASS',errors},null,2));
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
