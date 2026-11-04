export function setupRecording({activate,getContext,getSource,report,toast}){
  const button=document.getElementById('record'),discard=document.getElementById('discard-recording'),timer=document.getElementById('record-time');
  let state='idle',id,node,context,started=0,interval,writes=Promise.resolve(),failure=null,stopped;
  function render(){const recording=state==='recording';button.textContent=({idle:'● Grabar',starting:'Preparando…',recording:'■ Detener',stopping:'Deteniendo…',saving:'Guardando…',pending:'Guardar WAV'})[state];button.title=recording?'Detener y guardar la grabación':state==='pending'?'Elegir nombre y carpeta para guardar el WAV':'Grabar el audio del piano en WAV';button.classList.toggle('recording',recording);button.setAttribute('aria-pressed',String(recording));button.disabled=['starting','stopping','saving'].includes(state);discard.hidden=state!=='pending';}
  function clock(){const seconds=Math.max(0,Math.floor(context.currentTime-started));timer.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
  function disconnect(){clearInterval(interval);if(node){getSource()?.disconnect(node);node.disconnect();node.port.close();node=null;}}
  async function save(){state='saving';render();try{const result=await window.pianoRecording.save(id);if(result.canceled){state='pending';toast('Grabación conservada. Pulsa Guardar WAV para intentarlo de nuevo.');}else{state='idle';id=null;timer.textContent='00:00';toast('Grabación guardada: '+result.path);}}catch(error){state='pending';report(error);toast('No se pudo guardar. La toma sigue disponible; prueba otro nombre o carpeta.');}finally{render();}}
  async function stop(){state='stopping';render();const acknowledgment=new Promise(resolve=>{const timeout=setTimeout(()=>{failure||=new Error('Se recuperó la grabación hasta el último bloque disponible.');resolve();},5000);stopped=()=>{clearTimeout(timeout);resolve();};});node.port.postMessage('stop');await acknowledgment;disconnect();await writes;await window.pianoRecording.finish(id);state='pending';render();if(failure)report(failure);await save();}
  button.onclick=async()=>{
    try{
      if(state==='pending'){await save();return;}
      if(state==='recording'){await stop();return;}
      if(state!=='idle')return;
      state='starting';render();await activate();context=getContext();await context.audioWorklet.addModule('/src/recording-processor.js');const take=await window.pianoRecording.start(context.sampleRate);id=take.id;writes=Promise.resolve();failure=null;
      node=new AudioWorkletNode(context,'piano-recording',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'});
      function interrupted(error){const first=!failure;failure=error;report(error);if(first&&state==='recording')queueMicrotask(()=>button.click());}
      node.port.onmessage=event=>{if(event.data.type==='data'){const data=event.data.data;writes=writes.then(()=>window.pianoRecording.append(id,data)).catch(interrupted);}else if(event.data.type==='stopped')stopped?.();};
      node.addEventListener('processorerror',()=>interrupted(new Error('La grabación de audio se interrumpió.')));getSource().connect(node);node.connect(context.destination);started=context.currentTime;state='recording';clock();interval=setInterval(clock,250);render();
    }catch(error){disconnect();if(id){await writes;await window.pianoRecording.finish(id).catch(()=>{});state='pending';}else state='idle';render();report(error);}
  };
  discard.onclick=async()=>{if(state!=='pending')return;try{const result=await window.pianoRecording.discard(id);if(!result.canceled){id=null;state='idle';timer.textContent='00:00';render();toast('Grabación descartada.');}}catch(error){report(error);}};
  render();
}
