const fs=require('node:fs/promises');const path=require('node:path');
const ranges={volume:[0,100],reverb:[0,100],velocity:[1,127],brightness:[-12,12],'melody-boost':[0,6]};
const choices={tone:['warm','bright','neutral'],dynamics:['fixed','original','simulated'],transpose:['-12','0','12'],room:['concert','studio','dry']};
function sanitize(value={}){
  const result={version:1,controls:{},devices:{},melodyEnabled:value.melodyEnabled===true};
  for(const [key,entry] of Object.entries(value.controls||{})){
    if(key.startsWith('fx-')&&['fx-reverb','fx-compressor','fx-eq','fx-chorus'].includes(key)&&typeof entry==='boolean')result.controls[key]=entry;
    else if(choices[key]?.includes(String(entry)))result.controls[key]=String(entry);
    else if(ranges[key]&&Number.isFinite(Number(entry)))result.controls[key]=String(Math.max(ranges[key][0],Math.min(ranges[key][1],Number(entry))));
  }
  if(typeof value.piano==='string'&&value.piano.length<=80)result.piano=value.piano;
  for(const type of ['midi-in','midi-out','audio-out']){const device=value.devices?.[type];if(device&&typeof device.id==='string'&&typeof device.name==='string')result.devices[type]={id:device.id.slice(0,512),name:device.name.slice(0,512)};}
  if(value.preset&&typeof value.preset.piano==='string'&&['program','bankMSB','bankLSB'].every(k=>Number.isInteger(value.preset[k])&&value.preset[k]>=0&&value.preset[k]<=127))result.preset={piano:value.preset.piano.slice(0,80),program:value.preset.program,bankMSB:value.preset.bankMSB,bankLSB:value.preset.bankLSB};
  return result;
}
class SettingsStore{
  constructor(file){this.file=file;this.queue=Promise.resolve();}
  async load(){await this.queue;try{return sanitize(JSON.parse(await fs.readFile(this.file,'utf8')));}catch(error){if(error.code==='ENOENT')return sanitize();throw new Error('No se pudieron leer los ajustes guardados.');}}
  save(value){const settings=sanitize(value);const task=this.queue.then(async()=>{await fs.mkdir(path.dirname(this.file),{recursive:true});const temporary=this.file+'.next';await fs.writeFile(temporary,JSON.stringify(settings,null,2));await fs.rename(temporary,this.file);return settings;});this.queue=task.catch(()=>{});return task;}
}
module.exports={SettingsStore,sanitize};
