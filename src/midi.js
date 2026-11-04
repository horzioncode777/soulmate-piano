export const noteName = n => ['Do','Do♯','Re','Re♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si'][n % 12] + (Math.floor(n / 12)-1);
// Split by the physical key, before transposition. Keep velocity layers unchanged.
export function melodyGain(note,enabled,decibels=3){if(!enabled||note<60)return 1;const boost=Number.isFinite(Number(decibels))?Math.max(0,Math.min(6,Number(decibels))):3;return 10**(boost/20);}
export function transformMidi(data, {transpose=0, mode='original', velocity=85, curve=1} = {}) {
  const out = Array.from(data);
  const command = out[0] & 240;
  if (command === 128 || command === 144) {
    const note = out[1] + transpose;
    if(note < 0 || note > 127) return null;
    out[1] = note;
    if(command === 144 && out[2] > 0) out[2] = mode === 'fixed' ? velocity : Math.max(1, Math.min(127, Math.round(127 * (out[2]/127)**curve)));
  }
  return out;
}
