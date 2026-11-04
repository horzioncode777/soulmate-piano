const fs=require('node:fs/promises');const path=require('node:path');const {randomUUID}=require('node:crypto');
const MAX_DATA=0xffffffff-36;
function wavHeader(rate,bytes){const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+bytes,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(bytes,40);return header;}
class RecordingStore{
  constructor(root){this.root=path.resolve(root);this.takes=new Map();}
  get(owner,id){const take=this.takes.get(id);if(!take||take.owner!==owner)throw new Error('Grabación no disponible.');return take;}
  hasPending(owner){return [...this.takes.values()].some(t=>t.owner===owner);}
  async start(owner,rate){
    if(!Number.isInteger(rate)||rate<8000||rate>192000)throw new Error('Frecuencia de grabación inválida.');
    if(this.hasPending(owner))throw new Error('Guarda o descarta la grabación anterior.');
    await fs.mkdir(this.root,{recursive:true});const id=randomUUID(),file=path.join(this.root,'take-'+id+'.wav');const handle=await fs.open(file,'wx');
    const take={id,owner,rate,file,handle,bytes:0,finished:false,queue:Promise.resolve(),error:null};this.takes.set(id,take);
    try{await handle.write(wavHeader(rate,0),0,44,0);}catch(error){await this.discard(owner,id);throw error;}
    return {id,sampleRate:rate};
  }
  run(take,operation,recover=false){const task=take.queue.then(async()=>{if(take.error&&!recover)throw take.error;return operation();});take.queue=task.catch(error=>{take.error=error;});return task;}
  append(owner,id,data){const take=this.get(owner,id);if(!(data instanceof ArrayBuffer)&&!ArrayBuffer.isView(data))throw new Error('Audio inválido.');const buffer=data instanceof ArrayBuffer?Buffer.from(data):Buffer.from(data.buffer,data.byteOffset,data.byteLength);if(!buffer.length||buffer.length>1024*1024||buffer.length%4)throw new Error('Bloque de audio inválido.');return this.run(take,async()=>{if(take.finished)throw new Error('La grabación ya está detenida.');if(take.bytes+buffer.length>MAX_DATA)throw new Error('Se alcanzó el tamaño máximo de un archivo WAV. Detén y guarda la grabación.');let offset=0;while(offset<buffer.length){const result=await take.handle.write(buffer,offset,buffer.length-offset,44+take.bytes+offset);if(!result.bytesWritten)throw new Error('No se pudo escribir el audio.');offset+=result.bytesWritten;}take.bytes+=buffer.length;return {bytes:take.bytes};});}
  finish(owner,id){const take=this.get(owner,id);return this.run(take,async()=>{if(!take.finished){await take.handle.write(wavHeader(take.rate,take.bytes),0,44,0);await take.handle.sync();await take.handle.close();take.handle=null;take.finished=true;}take.error=null;return {bytes:take.bytes,seconds:take.bytes/(take.rate*4),sampleRate:take.rate};},true);}
  async save(owner,id,destination){const take=this.get(owner,id);await take.queue;if(take.error)throw take.error;if(!take.finished)throw new Error('Detén la grabación antes de guardarla.');const target=path.resolve(destination);if(target.toLowerCase()===take.file.toLowerCase())throw new Error('Elige una ubicación distinta de la copia temporal.');if(path.extname(target).toLowerCase()!=='.wav')throw new Error('Guarda la grabación con extensión .wav.');const staging=path.join(path.dirname(target),'.piano-recording-'+randomUUID()+'.tmp');try{await fs.copyFile(take.file,staging);await fs.rename(staging,target);}catch(error){await fs.unlink(staging).catch(()=>{});throw error;}await fs.unlink(take.file).catch(()=>{});this.takes.delete(id);return {path:target,bytes:take.bytes+44};}
  async discard(owner,id){const take=this.get(owner,id);await take.queue;await take.handle?.close();await fs.unlink(take.file);this.takes.delete(id);}
  async discardOwner(owner){for(const take of [...this.takes.values()])if(take.owner===owner)await this.discard(owner,take.id);}
}
module.exports={RecordingStore,wavHeader};
