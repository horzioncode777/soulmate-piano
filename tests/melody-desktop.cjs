const {_electron:electron}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
  fs.mkdirSync('test-results',{recursive:true});const profile=fs.mkdtempSync(path.resolve('test-results/melody-profile-'));const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const profileArg='--user-data-dir='+profile;
  const app=await electron.launch(process.env.AUREA_EXECUTABLE?{executablePath:process.env.AUREA_EXECUTABLE,args:[profileArg],env}:{args:['.',profileArg],env});
  try{const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{const original=AudioContext.prototype.createAnalyser;AudioContext.prototype.createAnalyser=function(){const analyser=original.call(this);window.melodyAnalyser=analyser;return analyser;};const input={id:'piano',name:'Piano de prueba',state:'connected'};window.melodyInput=input;Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>({inputs:new Map([['piano',input]]),outputs:new Map()})});});
    await page.reload();await page.locator('#power').click();await page.locator('#status').filter({hasText:'Piano listo'}).waitFor({timeout:60000});
    await page.evaluate(async()=>{const {WorkletSynthesizer}=await import('/node_modules/spessasynth_lib/dist/index.js');const original=WorkletSynthesizer.prototype.noteOn;window.melodyCalls=[];WorkletSynthesizer.prototype.noteOn=function(channel,note,velocity,...options){window.melodyCalls.push({note,velocity,gain:this.keyModifierManager.getModifier(channel,note)?.gain});return original.call(this,channel,note,velocity,...options);};});
    await page.locator('[data-tab="ajustes"]').click();await page.selectOption('#midi-in','piano');
    await page.locator('#fx-reverb').uncheck();await page.locator('#fx-compressor').uncheck();await page.locator('#fx-chorus').uncheck();
    async function play(note){await page.locator('#panic').click();await page.waitForTimeout(100);return page.evaluate(async note=>{window.melodyInput.onmidimessage({data:[144,note,95]});let peak=0;for(let index=0;index<55;index++){const values=new Float32Array(window.melodyAnalyser.fftSize);window.melodyAnalyser.getFloatTimeDomainData(values);peak=Math.max(peak,...values.map(Math.abs));await new Promise(resolve=>setTimeout(resolve,5));}window.melodyInput.onmidimessage({data:[128,note,0]});return peak;},note);}
    const leftBefore=await play(59),rightBefore=await play(60);await page.locator('#melody-toggle').click();const leftAfter=await play(59),rightAfter=await play(60);
    assert(leftBefore>.0001&&rightBefore>.0001);assert(Math.abs(leftAfter/leftBefore-1)<.08,'Left-hand gain changed');assert(rightAfter/rightBefore>1.3&&rightAfter/rightBefore<1.52,'Right-hand gain not applied');
    let calls=await page.evaluate(()=>window.melodyCalls);assert.equal(calls[2].gain,1);assert(Math.abs(calls[3].gain-10**(3/20))<1e-8);assert(calls.every(call=>call.velocity===85),'Velocity layer changed');
    await page.locator('[data-tab="sonido"]').click();await page.selectOption('#transpose','-12');await play(60);calls=await page.evaluate(()=>window.melodyCalls);assert.equal(calls.at(-1).note,48);assert(Math.abs(calls.at(-1).gain-10**(3/20))<1e-8,'Physical central-C split lost during transpose');
    await page.locator('#melody-toggle').click();await play(60);calls=await page.evaluate(()=>window.melodyCalls);assert.equal(calls.at(-1).gain,1);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({leftRatio:leftAfter/leftBefore,rightRatio:rightAfter/rightBefore,boundary:'PASS',velocityUnchanged:'PASS',transpose:'PASS',off:'PASS',errors},null,2));
  }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
