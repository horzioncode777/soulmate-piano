const {_electron:electron}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
  fs.mkdirSync('test-results',{recursive:true});const profile=fs.mkdtempSync(path.resolve('test-results/builtins-profile-'));const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const launch=()=>electron.launch(process.env.AUREA_EXECUTABLE?{executablePath:process.env.AUREA_EXECUTABLE,args:['--user-data-dir='+profile],env}:{args:['.','--user-data-dir='+profile],env});
  let app;const errors=[],results=[];
  async function open(){app=await launch();const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{
    const create=AudioContext.prototype.createAnalyser;AudioContext.prototype.createAnalyser=function(){const analyser=create.call(this);window.bankAnalyser=analyser;return analyser;};
    const input={id:'test',name:'Test MIDI',state:'connected'};window.bankMidi=input;Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>({inputs:new Map([['test',input]]),outputs:new Map()})});
  });await page.reload();await page.locator('#library-count[data-ready="true"]').waitFor();return page;}
  async function select(page,id){await page.locator(`[data-piano="${id}"]`).click();await page.locator('#load-piano:not([disabled])').waitFor({timeout:120000});assert.equal(await page.locator('.piano-card.selected').getAttribute('data-piano'),id);assert.match(await page.locator('#availability').textContent(),/Incluido/);}
  try{
    let page=await open();
    assert.deepEqual(await page.locator('.piano-card').evaluateAll(cards=>cards.map(c=>c.dataset.piano)),['kawai','steinway','yamaha','bosendorfer']);assert.equal(await page.locator('.card-tools').count(),0);
    await select(page,'kawai');await page.locator('[data-tab="ajustes"]').click();await page.selectOption('#midi-in','test');await page.locator('[data-tab="instrumento"]').click();
    await page.evaluate(async()=>{const {WorkletSynthesizer}=await import('/node_modules/spessasynth_lib/dist/index.js');const on=WorkletSynthesizer.prototype.noteOn;window.bankCalls=[];WorkletSynthesizer.prototype.noteOn=function(ch,n,v,...args){window.bankCalls.push({channel:ch,note:n,velocity:v,modifier:this.keyModifierManager.getModifier(ch,n)});return on.call(this,ch,n,v,...args);};});
    for(const id of ['kawai','steinway','yamaha','bosendorfer']){
      await select(page,id);const peaks=[];
      for(const note of [21,36,60,84,108]){
        await page.locator('#panic').click();await page.waitForTimeout(70);
        const peak=await page.evaluate(async note=>{window.bankMidi.onmidimessage({data:[144,note,95]});let peak=0;for(let i=0;i<45;i++){const data=new Float32Array(window.bankAnalyser.fftSize);window.bankAnalyser.getFloatTimeDomainData(data);peak=Math.max(peak,...data.map(Math.abs));await new Promise(r=>setTimeout(r,6));}window.bankMidi.onmidimessage({data:[128,note,0]});return peak;},note);
        assert(peak>.00001,`${id} note ${note} silent: ${peak}`);peaks.push({note,peak});
      }
      results.push({id,presets:await page.locator('#preset option').allTextContents(),peaks});
    }
    await page.locator('#panic').click();await page.locator('#melody-toggle').click();
    for(const pedal of [0,127]){await page.evaluate(pedal=>{window.bankMidi.onmidimessage({data:[176,64,pedal]});window.bankMidi.onmidimessage({data:[144,60,95]});window.bankMidi.onmidimessage({data:[128,60,0]});},pedal);const call=await page.evaluate(()=>window.bankCalls.filter(c=>c.channel===0).at(-1));assert.equal(call.modifier.patch.program,pedal?1:0);assert.equal(call.velocity,85);assert(Math.abs(call.modifier.gain-10**(3/20))<1e-8);}
    await page.locator('#panic').click();await select(page,'yamaha');await page.evaluate(()=>window.bankMidi.onmidimessage({data:[144,60,95]}));assert.equal((await page.evaluate(()=>window.bankCalls.filter(c=>c.channel===0).at(-1))).modifier.patch.program,-1,'B290 patch leaked to another bank');await page.locator('#panic').click();
    await page.screenshot({path:'test-results/included-four.png',fullPage:true});await app.close();app=null;
    page=await open();assert.equal(await page.locator('.piano-card').count(),4);await select(page,'bosendorfer');assert.equal(await page.locator('#preset option').count(),1);await page.locator('#demo').click();await page.waitForTimeout(200);const peak=await page.evaluate(()=>{const data=new Float32Array(window.bankAnalyser.fftSize);window.bankAnalyser.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs));});assert(peak>.00001,'Reopened B290 silent');await page.locator('#panic').click();
    assert.deepEqual(errors,[]);console.log(JSON.stringify({fourFixedBanks:'PASS',restart:'PASS',B290PedalPrograms:'PASS',melodyPreserved:'PASS',results,errors},null,2));
  }finally{await app?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
