// Captures the app's final stereo mix. Its output is silent to avoid doubling playback.
class PianoRecordingProcessor extends AudioWorkletProcessor{
  constructor(){super();this.buffer=new ArrayBuffer(4096*4);this.view=new DataView(this.buffer);this.frames=0;this.recording=true;this.port.onmessage=event=>{if(event.data==='stop'&&this.recording){this.recording=false;this.flush();this.port.postMessage({type:'stopped'});}};}
  flush(){if(!this.frames)return;const data=this.buffer.slice(0,this.frames*4);this.port.postMessage({type:'data',data},[data]);this.frames=0;}
  process(inputs){if(!this.recording)return true;const left=inputs[0]?.[0];if(!left)return true;const right=inputs[0][1]||left;for(let i=0;i<left.length;i++){for(let channel=0;channel<2;channel++){const sample=Math.max(-1,Math.min(1,(channel?right:left)[i]||0));this.view.setInt16(this.frames*4+channel*2,Math.round(sample*(sample<0?32768:32767)),true);}if(++this.frames===4096)this.flush();}return true;}
}
registerProcessor('piano-recording',PianoRecordingProcessor);
