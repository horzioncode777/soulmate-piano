const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BYTES=512*1024*1024;
function validName(value){if(typeof value!=='string')throw new Error('Escribe un nombre para el piano.');const name=value.trim();if(!name||name.length>80||/[\x00-\x1f\x7f]/.test(name))throw new Error('El nombre debe tener entre 1 y 80 caracteres.');return name;}
class LibraryStore{
  constructor(root){this.root=path.resolve(root);this.queue=Promise.resolve();}
  run(operation){const result=this.queue.then(async()=>{await fs.mkdir(this.root,{recursive:true});return operation();});this.queue=result.catch(()=>{});return result;}
  directory(id){if(!ID.test(id))throw new Error('Identificador de piano inválido.');const directory=path.resolve(this.root,id);if(path.dirname(directory)!==this.root)throw new Error('Ruta de piano inválida.');return directory;}
  async metadata(id){const directory=this.directory(id);const metadata=JSON.parse(await fs.readFile(path.join(directory,'piano.json'),'utf8'));if(metadata.id!==id||typeof metadata.createdAt!=='string'||!Number.isFinite(Date.parse(metadata.createdAt))||!['SF2','SF3','DLS'].includes(metadata.format))throw new Error('Registro de piano inválido.');validName(metadata.name);return metadata;}
  list(){return this.run(async()=>{const pianos=[],warnings=[];for(const item of await fs.readdir(this.root,{withFileTypes:true})){if(!item.isDirectory()||!ID.test(item.name))continue;try{const metadata=await this.metadata(item.name);await fs.access(path.join(this.directory(item.name),'soundbank.bin'));pianos.push(metadata);}catch{warnings.push('No se pudo leer un piano guardado: '+item.name);}}pianos.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));return {pianos,warnings};});}
  save({name,originalName,data}){return this.run(async()=>{
    name=validName(name);const extension=path.extname(String(originalName)).toLowerCase();if(!['.sf2','.sf3','.dls'].includes(extension))throw new Error('Formato de banco no compatible.');
    if(!(data instanceof ArrayBuffer)&&!ArrayBuffer.isView(data))throw new Error('El banco no contiene datos válidos.');
    const buffer=data instanceof ArrayBuffer?Buffer.from(data):Buffer.from(data.buffer,data.byteOffset,data.byteLength);
    if(buffer.length<12||buffer.length>MAX_BYTES||buffer.toString('ascii',0,4)!=='RIFF'||!['sfbk','DLS '].includes(buffer.toString('ascii',8,12)))throw new Error('El archivo no es un banco válido o supera 512 MB.');
    const id=randomUUID(),directory=this.directory(id),staging=path.join(this.root,'.pending-'+id);
    const metadata={id,name,originalName:path.basename(String(originalName)),format:extension.slice(1).toUpperCase(),bytes:buffer.length,createdAt:new Date().toISOString(),version:1};
    try{await fs.mkdir(staging);await fs.writeFile(path.join(staging,'soundbank.bin'),buffer,{flag:'wx'});await fs.writeFile(path.join(staging,'piano.json'),JSON.stringify(metadata,null,2),{flag:'wx'});await fs.rename(staging,directory);}catch(error){if(path.dirname(path.resolve(staging))===this.root)await fs.rm(staging,{recursive:true,force:true});throw error;}
    return metadata;
  });}
  read(id){return this.run(async()=>{const metadata=await this.metadata(id),buffer=await fs.readFile(path.join(this.directory(id),'soundbank.bin'));return {metadata,data:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)};});}
  rename(id,name){return this.run(async()=>{name=validName(name);const metadata={...await this.metadata(id),name};const directory=this.directory(id),temporary=path.join(directory,'piano.next.json');await fs.writeFile(temporary,JSON.stringify(metadata,null,2));await fs.rename(temporary,path.join(directory,'piano.json'));return metadata;});}
  remove(id){return this.run(async()=>{const directory=this.directory(id);await this.metadata(id);const trash=path.resolve(this.root,'.deleted-'+id);if(path.dirname(directory)!==this.root||path.dirname(trash)!==this.root)throw new Error('Ruta de eliminación inválida.');await fs.rename(directory,trash);await fs.rm(trash,{recursive:true,force:true});return {id};});}
}
module.exports={LibraryStore,validName};
