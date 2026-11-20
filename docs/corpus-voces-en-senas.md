# Corpus VOCES EN SEÑAS (LSM-Corpus 1.0)

Corpus de oraciones en Lengua de Señas Mexicana tomadas del programa
**VOCES EN SEÑAS** de Jalisco TV (canal público de YouTube
[@jaliscotvmx](https://www.youtube.com/@jaliscotvmx), lista
`PLc4hgy6279jENUfnkzDZtVq_k_VCc1eMI`): entrevistas con personas Sordas,
conducción en LSM y subtítulos en español quemados en la imagen.

Cada **enunciado** une:

1. una **oración escrita** (el subtítulo del programa, leído con OCR);
2. **quién la seña**, con un **seudónimo** (nunca su nombre);
3. el **tramo del video** donde se seña;
4. las **señas** en que se corta ese tramo, cada una con su
   **descomposición fonológica** (LSM-PN 1.1: CM, UB, OR, MV, dos manos);
5. una **transliteración** en glosas, con las señas del léxico de
   Wikisigns que más se parecen.

> **Todo es automático y aproximado.** El subtítulo es una traducción al
> español, no una glosa; el corte en señas sale de las pausas de la mano;
> y la glosa es la seña del léxico más parecida, no un reconocimiento. Falta
> que lo revise una persona Sorda. La procedencia de cada campo es «auto».

## Derechos y privacidad

- El programa tiene **todos los derechos reservados** (licencia estándar
  de YouTube). Los videos, los cuadros y la caché se quedan en el equipo
  (`_videos/`, `_frames/`, `_cache/`, fuera de git). En el repositorio van
  solo el código, este documento y las anotaciones derivadas.
- **Seudónimos.** Cada persona se identifica con un número y un nombre de
  planta o animal de México (P01 · Ahuehuete…). Se asignan por parecido de
  cara, calculado en el equipo con InsightFace (ArcFace `w600k_mbf` y
  detector SCRFD, licencia solo para investigación no comercial). **No se
  guardan rostros, vectores de cara ni nombres**: los vectores solo viven
  en memoria mientras se agrupan las personas.
- Los títulos de los episodios traen nombres reales de las personas
  invitadas: el índice (`episodes.json`) no los copia.
- Los rótulos del programa («NOMBRE / CONDUCTORA») dan el **rol**; el
  nombre se descarta al leerlo.
- De la cara se guardan solo los **gestos** (52 blendshapes) y el ángulo de
  la cabeza, nunca la malla de puntos.
- La caracterización de cada persona es **lingüística** (mano dominante,
  ritmo, espacio de señado, lugares y formas que más usa, gestos de la
  cara). No se infieren rasgos físicos ni demográficos (edad, género…). La
  condición auditiva solo se anota si el rótulo del programa la dice
  («ACTOR PROFESIONAL DE TEATRO SORDO»).

## Archivos (`data/voces-en-senas/`)

| Archivo | Qué es |
|---|---|
| `episodes.json` | Episodios: id de YouTube, fecha, duración y enlace (sin títulos) |
| `participantes.json` | Seudónimos, rol por episodio, tiempo en pantalla y caracterización |
| `corpus.jsonl` | Un enunciado por línea (ver abajo) |
| `stats.json` | Conteos y desfases por episodio |
| `_videos/`, `_frames/`, `_cache/` | Locales, fuera de git |

### Un enunciado (`corpus.jsonl`)

```json
{
  "id": "VES-wqqMPIaT1yo-0012",
  "episodio": "wqqMPIaT1yo",
  "oracion": { "texto": "¿Pero cómo te comunicas?", "t0": 109.6, "t1": 112.2 },
  "senante": { "id": "P03", "seudonimo": "Cempasúchil", "rol": "CONDUCTORA" },
  "sena": { "t0": 109.6, "t1": 112.2, "desfase_s": 0 },
  "toma_primer_plano": 0.4,
  "senas": [
    {
      "i": 1, "t0": 109.7, "t1": 110.4,
      "fonologia": {
        "cm": [{ "id": 35, "puntaje": 0.86 }], "ub": "Me", "contacto": "NEAR",
        "palma": "BACK", "dedos": "UP", "contorno": "STRAIGHT", "plano": "VERTICAL",
        "direccion": { "x": 0, "y": 1, "z": 0 }, "repeticion": null,
        "dos_manos": true, "relacion": "SIMETRICA", "plana": 0, "cuadros": 9
      },
      "glosa": null,
      "candidatos": [{ "id": "wsl-…", "glosa": "…", "puntaje": 0.42, "en_oracion": false }],
      "token": "[CM35·Me·straight·2M]"
    }
  ],
  "transliteracion": "[CM35·Me·straight·2M] COMUNICACIÓN"
}
```

- `oracion.t0/t1`: cuándo está el subtítulo en pantalla (s).
- `sena`: el tramo señado, corrido por el **desfase** del episodio (la voz
  de quien interpreta, y con ella el subtítulo, va detrás o delante de las
  manos).
- `toma_primer_plano`: qué parte del tramo se ve a la persona sola en
  cuadro (más fiable que las tomas abiertas).
- `senas[].fonologia`: como en el léxico. `cm` trae las tres formas más
  parecidas con su puntaje; `plana` cuenta cuadros con la mano vista solo
  en 2D.
- `senas[].glosa`: solo si una seña del léxico se parece y su glosa (o un
  sinónimo) **aparece en la oración** con puntaje ≥ 0.5, o se parece mucho
  (≥ 0.75) aunque no aparezca. Si no, `token` es la descripción
  `[CM·UB·contorno·2M]` y los `candidatos` quedan para quien revise.
- `transliteracion`: los tokens en orden; las glosas seguidas iguales se
  juntan con `+` (repetición).

## Cómo se construye

```bash
python3 -I scripts/voces/fetch.py                           # índice y videos (1080p + audio)
.venv-voces/bin/python -I scripts/voces/subtitulos.py       # subtítulos y rótulos (OCR de Apple Vision)
.venv-lexicon/bin/python -I scripts/voces/personas.py       # tomas, caras y seudónimos
.venv-lexicon/bin/python -I scripts/voces/extraer.py --shard 0/3   # pose, manos y gestos (×3 en paralelo)
node scripts/voces/run-build.mjs                            # corpus.jsonl, participantes, stats
```

Entornos: `.venv-voces` (Python 3.12: `ocrmac`, `opencv-python-headless`,
`mlx-whisper` para una transcripción de la voz de respaldo en
`transcribe.py`) y `.venv-lexicon` (el del léxico más `onnxruntime`).

### Pasos

1. **Subtítulos** (`subtitulos.py`). No hay subtítulos en YouTube: van
   quemados abajo al centro, o arriba cuando un rótulo ocupa la parte de
   abajo. Se muestrean 5 cuadros/s y el OCR (Apple Vision, `es-ES`) solo
   corre cuando cambia el texto blanco de esas franjas. Se descartan las
   líneas todas en mayúsculas (el letrero animado «PROGRAMA PARA LA
   COMUNIDAD SORDA» y texto del set) y los pedazos de ese letrero que el
   OCR pega al inicio del subtítulo. Las tarjetas se unen en oraciones por
   la puntuación.
2. **Personas** (`personas.py`). Cortes de cámara (diferencia de
   miniaturas a 10 cuadros/s), caras a 2 cuadros/s con su vector, pistas por
   solapamiento dentro de cada toma, y grupos por parecido de cara en todo el
   corpus (coseno > 0.40; grupos con menos de 20 s en pantalla se
   descartan). El rol es la línea de abajo del rótulo que estaba en pantalla
   cuando la persona salía **sola** en cuadro.
3. **Pose y manos** (`extraer.py`). MediaPipe a 12 cuadros/s: hasta 3
   cuerpos, 3 caras y, por cada muñeca levantada, la mano en un recorte
   ampliado (en tomas abiertas la mano mide ~70 px). Cada cuerpo se liga a
   la pista de cara que contiene su nariz.
4. **Corpus** (`build.ts`, funciones puras en `src/lib/corpus/voces.ts`):
   - actividad de señado por persona (velocidad de las manos levantadas);
   - **desfase** del episodio: el corrimiento (−3 a +3 s) que más
     actividad junta dentro de las oraciones;
   - cada tarjeta del subtítulo va a quien más seña en su tramo; si cambia
     de persona dentro de una oración, la oración se parte;
   - **señas**: cortes en los mínimos de velocidad de la mano dominante;
   - **fonología** con `aggregate()` del léxico (CM y OR solo con manos con
     profundidad; el zigzag se refina como en el léxico; la otra mano cuenta
     solo si se mueve o sube al espacio de señado);
   - **glosas** contra las 1,595 señas de LSM medidas del léxico.

## Lo que falta validar

- Glosas y corte en señas: revisión por personas Sordas.
- El desfase es uno por episodio; si quien interpreta cambia de ritmo, el
  tramo puede correrse.
- Las tomas abiertas dan manos pequeñas: la CM es menos fiable ahí
  (`toma_primer_plano` lo indica).
- Los seudónimos dependen del parecido de cara: conviene revisar que cada
  grupo sea una sola persona (se hizo a ojo en los primeros 6 episodios).
