import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

let failed=false;
for(const directory of ['src','desktop','scripts','tests']) {
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    if(!entry.isFile()||!['.js','.mjs','.cjs'].includes(path.extname(entry.name)))continue;
    const file=path.join(directory,entry.name);
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0){console.error(result.stderr);failed=true;}
  }
}
for(const file of ['src/index.html','src/style.css','assets/concert-panorama.png','assets/soulmate-icon.ico','assets/SpessaSynth-LICENSE.txt','assets/banks/Kawai-CC0.txt']) {
  if(!fs.existsSync(file)){console.error('Falta '+file);failed=true;}
}
if(failed)process.exitCode=1;
else console.log('Sintaxis y recursos del proyecto correctos.');
