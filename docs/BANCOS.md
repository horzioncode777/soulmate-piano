# Bancos de sonido

## Piano de referencia

Después de `npm ci`, ejecuta `npm run setup:piano`. Descarga la conversión SF2 de Upright Piano KW desde la publicación `soundbanks-v1` de este repositorio y comprueba su SHA-256 antes de guardarla. No reemplaza un archivo diferente que ya exista.

- Archivo: `assets/banks/UprightPianoKW.sf2`.
- SHA-256: `99fb9ec55128876e4e8b2ac77f12090797e34f68dd72291d707650c62ce811ad`.
- Origen: [FreePats, Upright Piano KW](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html).
- Licencia: CC0 1.0; copia en `assets/banks/Kawai-CC0.txt`.

Los bancos grandes se distribuyen como recursos de una publicación, separados del historial de código. La aplicación no necesita Internet después de preparar sus recursos.

## Colección personal opcional

El código conserva los adaptadores de los otros tres instrumentos. Para usarlos en tu copia personal necesitas obtener los bancos con autorización y colocarlos en estas rutas:

| Instrumento | Ruta |
| --- | --- |
| Abbey Steinway D v1.9 | `assets/banks/Abbey-Steinway-D-v1.9.sf2` |
| Yamaha CFX Grand | `assets/banks/Yamaha-CFX-Grand.sf2` |
| B290 Lite adaptado | `assets/banks/B290-Lite.sf3` |

Para adaptar tu descarga personal del B290 necesitas Python 3.12, SoundFile y las herramientas originales de `scripts/prepare-b290.py` y `scripts/build-b290.mjs`. Es un proceso de desarrollo independiente de la instalación normal. No subas las muestras ni el resultado a GitHub sin permiso de su titular.

Puedes importar otros SF2/SF3/DLS desde **Sonido → Añadir y guardar banco**. Las copias quedan en los datos locales de la aplicación, fuera del repositorio.

Las pruebas avanzadas de la colección completa requieren los cuatro bancos. Las pruebas históricas de importación pueden usar GeneralUser GS en `assets/GeneralUser-GS.sf2` o la ruta indicada por `AUREA_TEST_SOUNDFONT`. No se distribuye ese banco de pruebas.

Consulta [los avisos de terceros](../THIRD_PARTY_NOTICES.md) antes de compartir recursos o instaladores.
