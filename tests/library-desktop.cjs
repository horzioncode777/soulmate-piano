const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const base=path.resolve('test-results');await fs.mkdir(base,{recursive:true});const profile=await fs.mkdtemp(path.join(base,'persistent-profile-'));
  const fixture=path.join(base,'bank-copy-'+Date.now()+'.sf2');await fs.copyFile(process.env.AUREA_TEST_SOUNDFONT||'assets/GeneralUser-GS.sf2',fixture);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const profileArg='--user-data-dir='+profile;
  const launch=()=>electron.launch(process.env.AUREA_EXECUTABLE?{executablePath:process.env.AUREA_EXECUTABLE,args:[profileArg],env}:{args:['.',profileArg],env});
  let app;const peaks=[],errors=[];
  async function open(){app=await launch();const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{const original=AudioContext.prototype.createAnalyser;AudioContext.prototype.createAnalyser=function(){const analyser=original.call(this);window.libraryAnalyser=analyser;return analyser;};});await page.reload();await page.locator('#library-count[data-ready="true"]').waitFor();return page;}
  async function checkAudio(page){await page.locator('#power').focus();await page.keyboard.down('a');await page.locator('[data-note="60"].active').waitFor();await page.waitForTimeout(180);const peak=await page.evaluate(()=>{const data=new Float32Array(window.libraryAnalyser.fftSize);window.libraryAnalyser.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs));});await page.keyboard.up('a');assert(peak>.0001,'Saved piano is silent');peaks.push(peak);}
  try{
    let page=await open();
    await page.locator('#soundfont').setInputFiles(fixture);await page.locator('#piano-name-cancel').click();assert.equal((await page.evaluate(()=>window.pianoLibrary.list())).pianos.length,0);
    await page.waitForFunction(()=>document.querySelector('#soundfont').value==='');
    await page.locator('#soundfont').setInputFiles(fixture);await page.locator('#piano-name').fill('Mi Kawai');await page.locator('#piano-name-save').click();await page.locator('#status').filter({hasText:'Banco cargado'}).waitFor({timeout:60000});
    await page.locator('.saved-card').waitFor();await checkAudio(page);
    await page.getByRole('button',{name:'Renombrar Mi Kawai',exact:true}).click();await page.locator('#piano-name').fill('Kawai de casa');await page.locator('#piano-name-save').click();await page.waitForFunction(()=>document.querySelector('#instrument-name').textContent==='Kawai de casa');
    await fs.unlink(fixture); // Only the test copy is removed; original user samples are untouched.
    await page.locator('[data-piano="kawai"]').click();await page.locator('#load-piano').click();await page.waitForFunction(()=>document.querySelector('#bank-label').textContent.includes('Kawai Upright KW'));
    await page.locator('.saved-card .piano-card').click();await page.waitForFunction(()=>document.querySelector('#bank-label').textContent==='Biblioteca: Kawai de casa');await checkAudio(page);
    await app.close();app=null;
    page=await open();assert.equal(await page.locator('.saved-card').count(),1);assert.match(await page.locator('.saved-card').textContent(),/Kawai de casa/);
    await page.locator('.saved-card .piano-card').click();await page.waitForFunction(()=>document.querySelector('#bank-label').textContent==='Biblioteca: Kawai de casa');await checkAudio(page);
    await page.screenshot({path:'test-results/saved-library.png',fullPage:true});
    await page.getByRole('button',{name:'Eliminar Kawai de casa',exact:true}).click();await page.locator('#piano-delete-cancel').click();assert.equal((await page.evaluate(()=>window.pianoLibrary.list())).pianos.length,1);
    await page.getByRole('button',{name:'Eliminar Kawai de casa',exact:true}).click();await page.locator('#piano-delete-confirm').click();await page.waitForFunction(()=>!document.querySelector('.saved-card'));assert.equal((await page.evaluate(()=>window.pianoLibrary.list())).pianos.length,0);assert.match(await page.locator('#bank-label').textContent(),/Kawai Upright KW/);
    await app.close();app=null;page=await open();assert.equal(await page.locator('.saved-card').count(),0);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({importAndName:'PASS',cancelImport:'PASS',rename:'PASS',switchWithoutLoss:'PASS',restartWithoutSource:'PASS',cancelDelete:'PASS',deletePersists:'PASS',audioPeaks:peaks,errors},null,2));
  }finally{await app?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
