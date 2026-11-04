import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const {configurePortable}=createRequire(import.meta.url)('../desktop/portable-mode.cjs');
test('modo portátil usa rutas relativas de la memoria y respeta perfiles explícitos',()=>{
  fs.mkdirSync('test-results',{recursive:true});const root=fs.mkdtempSync(path.resolve('test-results/portable-')),executable=path.join(root,'Aplicacion');fs.mkdirSync(executable);fs.writeFileSync(path.join(executable,'soulmate-portable.json'),'{}');const paths={userData:path.join(root,'Perfil-de-prueba')};const oldTemp=process.env.TEMP,oldTmp=process.env.TMP;
  const app={isPackaged:true,commandLine:{getSwitchValue:()=>'',hasSwitch:()=>false},setPath:(key,value)=>paths[key]=value,getPath:key=>paths[key],setAppLogsPath:value=>paths.logs=value};
  try{const portable=configurePortable(app,executable);assert.equal(portable.root,root);assert.equal(paths.userData,path.join(root,'Datos'));assert.equal(paths.sessionData,paths.userData);assert.equal(paths.temp,path.join(root,'Temporal'));assert.equal(portable.recordings,path.join(root,'Grabaciones'));app.commandLine.hasSwitch=()=>true;paths.userData=path.join(root,'Perfil-de-prueba');configurePortable(app,executable);assert.equal(paths.sessionData,paths.userData);assert.equal(paths.logs,path.join(paths.userData,'Logs'));}
  finally{if(oldTemp===undefined)delete process.env.TEMP;else process.env.TEMP=oldTemp;if(oldTmp===undefined)delete process.env.TMP;else process.env.TMP=oldTmp;}
});
