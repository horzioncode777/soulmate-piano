// Reproduce persistence and focus behavior without touching the user's profile.
const {_electron:electron}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
  fs.mkdirSync('test-results',{recursive:true});const profile=fs.mkdtempSync(path.resolve('test-results/audit-profile-'));const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app;
  const launch=()=>electron.launch(process.env.AUREA_EXECUTABLE?{executablePath:process.env.AUREA_EXECUTABLE,args:['--user-data-dir='+profile],env}:{args:['.','--user-data-dir='+profile],env});
  async function open(){app=await launch();const page=await app.firstWindow();await page.addInitScript(()=>{
    const input={id:'audit-piano',name:'Audit piano',state:'connected'};window.auditInput=input;window.auditAccess={inputs:new Map([[input.id,input]]),outputs:new Map()};Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>window.auditAccess});
    navigator.mediaDevices.enumerateDevices=async()=>[{kind:'audiooutput',deviceId:'default',label:'Predeterminada'},{kind:'audiooutput',deviceId:'audit-speakers',label:'Altavoces de prueba'}];AudioContext.prototype.setSinkId=async function(id){window.auditSink=id;};
  });await page.reload();await page.locator('#library-count[data-ready="true"]').waitFor();return page;}
  async function snapshot(page){return page.evaluate(()=>({origin:location.origin,volume:document.querySelector('#volume').value,brightness:document.querySelector('#brightness').value,boost:document.querySelector('#melody-boost').value,melody:document.querySelector('#melody-toggle').getAttribute('aria-pressed'),midi:document.querySelector('#midi-in').value,piano:document.querySelector('.piano-card.selected').dataset.piano,settings:localStorage.getItem('aurea.settings')}));}
  try{
    let page=await open();await page.locator('[data-piano="yamaha"]').click();await page.locator('#load-piano:not([disabled])').waitFor({timeout:120000});
    await page.locator('[data-tab="ajustes"]').click();await page.selectOption('#midi-in','audit-piano');await page.selectOption('#audio-out','audit-speakers');
    await page.evaluate(()=>{window.auditInput.state='disconnected';window.auditAccess.onstatechange();});assert.equal(await page.locator('#midi-in').inputValue(),'');await page.evaluate(()=>{window.auditInput.state='connected';window.auditAccess.onstatechange();});assert.equal(await page.locator('#midi-in').inputValue(),'audit-piano');
    await page.evaluate(()=>{for(const [id,value] of [['volume','37'],['brightness','7'],['melody-boost','4']]){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}});
    await page.locator('#melody-toggle').click();await page.locator('#save').click();
    await page.evaluate(()=>window.auditInput.onmidimessage({data:[144,60,95]}));await page.locator('[data-note="60"].active').waitFor();
    const activeBeforeBlur=await page.locator('.key.active').count();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const activeAfterBlur=await page.locator('.key.active').count();
    assert.equal(activeBeforeBlur,1);assert.equal(activeAfterBlur,1,'Changing focus cut the physical MIDI note');
    await page.evaluate(()=>window.auditInput.onmidimessage({data:[128,60,0]}));await page.locator('#power').focus();await page.keyboard.down('a');await page.locator('[data-note="60"].active').waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('.key.active').count(),0,'PC note stuck on blur');await page.keyboard.up('a');
    await page.evaluate(()=>window.auditInput.onmidimessage({data:[176,64,127]}));await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#sustain').getAttribute('aria-pressed'),'true','Physical pedal released on blur');await page.locator('#panic').click();
    const palette=await page.locator('#tone option').evaluateAll(options=>options.map(o=>({background:getComputedStyle(o).backgroundColor,color:getComputedStyle(o).color})));assert(palette.every(p=>['rgb(23, 27, 30)','rgb(89, 71, 44)'].includes(p.background)&&['rgb(242, 233, 220)','rgb(255, 243, 216)'].includes(p.color)));assert.equal(await page.locator('#tone').evaluate(el=>getComputedStyle(el).colorScheme),'dark');
    const before=await snapshot(page);await app.close();app=null;page=await open();const after=await snapshot(page);
    for(const key of ['volume','brightness','boost','melody','midi','piano'])assert.equal(after[key],before[key],key+' lost after restart');
    await page.locator('#power').click();await page.locator('#status').filter({hasText:'Piano listo'}).waitFor({timeout:120000});assert.match(await page.locator('#bank-label').textContent(),/Yamaha/);await page.waitForFunction(()=>window.auditSink==='audit-speakers');
    await page.locator('[data-tab="sonido"]').click();await page.screenshot({path:'test-results/fixed-sound-panel.png',fullPage:true});
    await page.locator('#tone').click();await page.screenshot({path:'test-results/fixed-dropdown.png',fullPage:true});await page.keyboard.press('Escape');
    const report={before,after,findings:{volumeLost:before.volume!==after.volume,brightnessLost:before.brightness!==after.brightness,melodyAmountLost:before.boost!==after.boost,midiNotRestored:before.midi!==after.midi,pianoNotRestored:before.piano!==after.piano,melodyOffOnRestart:after.melody==='false',activeBeforeBlur,activeAfterBlur}};
    fs.writeFileSync('test-results/audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
