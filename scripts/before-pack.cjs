const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');

module.exports=async()=>{
  const file=path.resolve(__dirname,'../assets/banks/UprightPianoKW.sf2');
  if(!fs.existsSync(file))throw new Error('Falta el piano de referencia. Ejecuta npm run setup:piano.');
  const hash=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(hash!=='99fb9ec55128876e4e8b2ac77f12090797e34f68dd72291d707650c62ce811ad')throw new Error('El banco Kawai no coincide con la versión de referencia.');
};
