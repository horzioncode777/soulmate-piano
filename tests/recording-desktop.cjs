const {_electron:electron}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
  fs.mkdirSync('test-results',{recursive:true});const profile=fs.mkdtempSync(path.resolve('test-results/recording-profile-'));const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch(process.env.AUREA_EXECUTABLE?{executablePath:process.env.AUREA_EXECUTABLE,args:['--user-data-dir='+profile],env}:{args:['.','--user-data-dir='+profile],env});
  const destination=path.join(profile,'Mi primera interpretación.wav'),retry=path.join(profile,'Mi segunda toma.wav'),silent=path.join(profile,'Silencio.wav');let completed=false;
  try{
    await app.evaluate(({dialog},files)=>{
      globalThis.recordingSaveResponses=[{canceled:false,filePath:files.destination},{canceled:true},{canceled:false,filePath:files.retry},{canceled:false,filePath:files.silent}];globalThis.recordingDialogs=[];globalThis.recordingMessageResponse=0;globalThis.recordingMessages=[];
      dialog.showSaveDialog=async(_parent,options)=>{globalThis.recordingDialogs.push(options);return globalThis.recordingSaveResponses.shift()||{canceled:true};};
      dialog.showMessageBox=async(_parent,options)=>{globalThis.recordingMessages.push(options);return {response:globalThis.recordingMessageResponse};};
    },{destination,retry,silent});
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    async function start(){await page.locator('#record').click();await page.locator('#record.recording').waitFor({timeout:120000});}
    async function play(){await page.keyboard.down('a');await page.locator('[data-note="60"].active').waitFor();await page.waitForTimeout(350);await page.keyboard.up('a');await page.waitForTimeout(250);}
    async function stop(){await page.locator('#record').click();await page.locator('#record:not([disabled])').waitFor({timeout:15000});}
    function wav(file){const data=fs.readFileSync(file);assert.equal(data.toString('ascii',8,12),'WAVE');assert.equal(data.readUInt16LE(22),2);assert.equal(data.readUInt32LE(40),data.length-44);let peak=0;for(let offset=44;offset<data.length;offset+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(offset))/32768);return {seconds:(data.length-44)/data.readUInt32LE(28),peak,bytes:data.length,rate:data.readUInt32LE(24)};}
    await start();await play();await page.screenshot({path:'test-results/recording-active.png',fullPage:true});await stop();assert.equal(await page.locator('#record').textContent(),'● Grabar');const first=wav(destination);assert(first.peak>.0001,'Saved WAV is silent');assert(first.seconds>.5,'Final audio blocks were lost');
    await start();await play();await stop();assert.equal(await page.locator('#record').textContent(),'Guardar WAV');assert.equal(await page.locator('#discard-recording').isVisible(),true);await page.locator('#record').click();await page.waitForFunction(()=>document.querySelector('#record').textContent==='● Grabar');const second=wav(retry);assert(second.peak>.0001);
    await start();await page.waitForTimeout(180);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await page.waitForTimeout(100);assert.equal(await page.locator('#record').getAttribute('aria-pressed'),'true','Closing without saving did not preserve the take');
    // Make this stop cancel its save, then exercise both discard choices.
    await app.evaluate(()=>globalThis.recordingSaveResponses.unshift({canceled:true}));await stop();await page.locator('#discard-recording').click();assert.equal(await page.locator('#discard-recording').isVisible(),true);await app.evaluate(()=>globalThis.recordingMessageResponse=1);await page.locator('#discard-recording').click();await page.waitForFunction(()=>document.querySelector('#record').textContent==='● Grabar');
    // Recording follows the final master volume rather than recording MIDI or a microphone.
    await page.locator('#volume').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(250);await start();await play();await stop();const muted=wav(silent);assert(muted.peak<.0001,`Recorder bypassed master volume: ${muted.peak}`);
    const dialogs=await app.evaluate(()=>globalThis.recordingDialogs);assert(dialogs.every(d=>d.title==='Guardar grabación de piano'&&d.filters[0].extensions[0]==='wav'));
    assert((await app.evaluate(()=>globalThis.recordingMessages)).some(m=>m.title==='Grabación sin guardar'));
    for(const size of [{width:1536,height:1000},{width:1000,height:740}]){await page.setViewportSize(size);const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,record:document.querySelector('#record').getBoundingClientRect().right}));assert(geometry.scroll<=geometry.width&&geometry.record<=geometry.width,JSON.stringify(geometry));await page.screenshot({path:`test-results/recording-${size.width}.png`,fullPage:true});}
    assert.deepEqual(errors,[]);completed=true;console.log(JSON.stringify({savedWav:first,cancelAndRetry:second,masterVolume:muted,closeProtection:'PASS',discard:'PASS',layout:'PASS',errors},null,2));
  }finally{if(completed)await app.close();else await app.evaluate(({app})=>app.exit());}
})().catch(e=>{console.error(e);process.exitCode=1;});
