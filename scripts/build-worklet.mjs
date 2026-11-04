// Rebuild the Apache-2.0 SpessaSynth worklet with Piano Pro's pedal-tail hook.
// Dependency sources remain untouched. Inputs are pinned by package-lock.json.
import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';
const map=JSON.parse(fs.readFileSync('node_modules/spessasynth_lib/dist/spessasynth_processor.min.js.map','utf8'));
const root=path.resolve('.work/piano-worklet');
for(let i=0;i<map.sources.length;i++){
  const name=map.sources[i];if(!name.startsWith('../src/'))continue;
  const file=path.join(root,name.slice(3));let source=map.sourcesContent[i];
  if(name.endsWith('/worklet_processor.ts')){
    source=source.replace('private readonly core: WorkletSynthesizerCore;','private readonly core: WorkletSynthesizerCore;\n    private lastPedal = -1;');
    source=source.replace('return this.core.process(inputs, outputs);',`
        const synth = this.core.synthesizer;
        const controllers = synth.midiChannels[0]?.midiControllers;
        if (controllers && controllers[21] > 0) {
            const pedal = controllers[20];
            if (pedal !== this.lastPedal) {
                // Re-anchor at the present attenuation: no jump in amplitude.
                // This also damps already released tails when the pedal rises.
                const release = Math.round(1200 * Math.log2(.8) + 4800 * pedal / 16384);
                for (const voice of (synth as any).synthCore.voices) {
                    if (voice.channel === 0 && voice.isActive && voice.isInRelease) {
                        voice.overrideReleaseVolEnv = release;
                        voice.volEnv.startRelease(voice);
                    }
                }
                this.lastPedal = pedal;
            }
        } else this.lastPedal = -1;
        return this.core.process(inputs, outputs);`);
  }
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);
}
await build({entryPoints:[path.join(root,'src/worklet_processor.ts')],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'assets/piano-processor.js',banner:{js:'/* SpessaSynth 4.3.14 / Apache-2.0. Piano Pro: continuous pedal release hook. See SpessaSynth-LICENSE.txt. */'},nodePaths:[path.resolve('node_modules')]});
fs.copyFileSync('node_modules/spessasynth_lib/LICENSE','assets/SpessaSynth-LICENSE.txt');
console.log('Piano Pro worklet rebuilt.');
