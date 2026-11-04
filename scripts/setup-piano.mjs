import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const destination=path.join(root,'assets/banks/UprightPianoKW.sf2');
const expected='99fb9ec55128876e4e8b2ac77f12090797e34f68dd72291d707650c62ce811ad';
const url='https://github.com/horzioncode777/soulmate-piano/releases/download/soundbanks-v1/UprightPianoKW.sf2';
const digest=data=>createHash('sha256').update(data).digest('hex');

try {
  let existing;
  try {existing=await fs.readFile(destination);} catch(error) {if(error.code!=='ENOENT')throw error;}
  if(existing) {
    if(digest(existing)!==expected)throw new Error('Ya existe un banco diferente. Consérvalo con otro nombre antes de descargar el banco de referencia.');
    console.log('Kawai Upright KW ya está instalado y verificado.');
  } else {
    console.log('Descargando Kawai Upright KW (CC0, aproximadamente 55 MiB)…');
    const response=await fetch(url,{signal:AbortSignal.timeout(180000)});
    if(!response.ok)throw new Error(`La descarga respondió HTTP ${response.status}. Consulta docs/BANCOS.md.`);
    const data=Buffer.from(await response.arrayBuffer());
    if(digest(data)!==expected)throw new Error('La suma SHA-256 no coincide; no se guardó el archivo.');
    await fs.mkdir(path.dirname(destination),{recursive:true});
    await fs.writeFile(destination,data,{flag:'wx'});
    console.log('Kawai Upright KW instalado. SHA-256 verificado.');
  }
} catch(error) {console.error(error.message);process.exitCode=1;}
