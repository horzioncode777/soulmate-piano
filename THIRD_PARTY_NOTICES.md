# Recursos de terceros

| Recurso | Uso y condiciones |
| --- | --- |
| SpessaSynth 4.3.14 | Motor de síntesis, Apache-2.0. Licencia en `assets/SpessaSynth-LICENSE.txt`. El worklet incorpora una adaptación de Soulmate para las colas de sonido del medio pedal. Se reconstruye desde las dependencias con `npm run build:audio`. |
| Upright Piano KW | Grabación de Gonzalo y Roberto; edición de Roberto, proyecto FreePats. CC0 1.0. Conversión local a SF2 estéreo de dos capas. Licencia en `assets/banks/Kawai-CC0.txt` y documentación en `banks/UprightPianoKW/`. |
| Electron, electron-builder, esbuild y Playwright | Dependencias de ejecución, empaquetado y pruebas. Las versiones resueltas y dependencias transitivas están en `package-lock.json`; cada paquete conserva su licencia original. |

Los nombres Kawai, Steinway, Yamaha y Bösendorfer identifican instrumentos o bancos de terceros. No implican afiliación, certificación ni respaldo de sus fabricantes.

## Bancos opcionales

El código conserva la integración de Abbey Steinway D, Yamaha CFX y B290 Lite. Sus archivos de muestras no se distribuyen en este repositorio ni en la edición pública del instalador. Cada usuario debe obtenerlos de sus autores y respetar sus condiciones. La adaptación de un formato no concede derechos de redistribución.

- Abbey Steinway D v1.9: procedencia documentada en [SoundFonts4U](https://huggingface.co/datasets/projectlosangeles/soundfonts4u). El espejo declara CC BY-NC-SA 4.0; debe comprobarse la autorización del archivo concreto antes de redistribuirlo.
- Yamaha CFX: Soundsource Studios, [ficha original](https://www.polyphone.io/en/soundfonts/pianos/513-yamaha-cfx-studio-grand-v2). La copia personal no se publica.
- B290 Lite: Dore Mark / The Experience Pianos, [instrumento original](https://www.pianobook.co.uk/packs/the-experience-austrian-concert-b290/). Las [condiciones de Pianobook](https://www.pianobook.co.uk/terms-conditions/) restringen la redistribución de muestras y derivados fuera de su plataforma. Se incluyen las herramientas de adaptación, sin muestras ni definición SFZ original.
- GeneralUser GS: banco de pruebas opcional, no distribuido. Su licencia de referencia se conserva en `assets/GeneralUser-LICENSE.txt`.

La imagen de escenario es una ilustración de la aplicación; no es una fotografía ni una representación certificada de un modelo de piano.
