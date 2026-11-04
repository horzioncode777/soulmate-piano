# Upright Piano KW para Soulmate

Banco canónico incluido en la app: `assets/banks/UprightPianoKW.sf2` (desde la raíz del proyecto). La copia duplicada de esta carpeta se retiró durante la limpieza.

En Piano Pro 0.2.1 o posterior: abre **Sonido → Cargar banco SF2 / SF3 / DLS** y selecciona este SF2. El nombre del instrumento aparecerá en el selector superior. Pulsa **Escuchar una prueba** o toca tu teclado MIDI. No hace falta reconstruir ni instalar la app.

El instrumento procede de los archivos locales `UprightPianoKW-SFZ-20220221`, grabados de un piano vertical Kawai. Grabación de Gonzalo y Roberto; edición de Roberto; proyecto FreePats. No es un piano de cola Steinway ni Yamaha. La documentación y licencia CC0 originales se incluyen junto al archivo convertido.

Esta es una copia de compatibilidad SF2: los WAV estéreo originales PCM24/44,1 kHz se convierten a PCM16/44,1 kHz. Conserva los 66 archivos muestreados, 132 canales de muestra enlazados, los rangos de las 88 teclas, la afinación central, los puntos de bucle y las dos capas de intensidad. La envolvente de liberación de 0,6 segundos y los filtros de paso bajo se trasladan a los parámetros equivalentes SF2; las curvas y la respuesta entre motores pueden diferir. No es una conversión idéntica bit a bit. Los archivos originales no se modifican.

Capas: velocidad 1–80 suave y 81–127 fuerte. Como tu teclado envía velocidad fija, usa **Dinámica → Intensidad fija** y compara **Intensidad 60** con **Intensidad 100**. El modo experimental puede variar la intensidad, pero no mide la fuerza real de los dedos.

Desde Piano Pro 0.3.0, al importarlo escribe su nombre y pulsa Guardar piano. Quedará disponible en la biblioteca al cambiar de instrumento y al reiniciar la app.

`conversion-report.json` contiene el mapa y los resultados estructurales. Se verificó cobertura de 88 notas en seis intensidades (528 combinaciones). La prueba de escritorio también comprueba señal de audio con este banco en ambas capas.

Conversión reproducible desde la raíz del proyecto:

```powershell
node scripts/convert-upright-kw.mjs "C:\Users\Horizon\Documents\UprightPianoKW-SFZ-20220221\UprightPianoKW-20220221.sfz" "assets/banks/UprightPianoKW.sf2"
```

El adaptador solo implementa el subconjunto SFZ utilizado por este instrumento; no es un importador SFZ general. Convención de bucle inclusivo de SFZ: https://sfzformat.com/opcodes/loopend/.

