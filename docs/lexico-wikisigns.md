# Léxico LSM de Wikisigns (LSM-Lex 1.0)

Base léxica de la LSM construida desde el diccionario de Wikisigns
(<https://www.wikisigns.org/list/es/lsm>, CC BY-SA 4.0). Cada seña queda
representada con el marco de SignaLab: las matrices de Cruz Aldrete
(LSM-PN 1.1), los huesos y articulaciones del esqueleto de la persona
señante y los rasgos de la cara.

> **Todo es propuesta automática.** Wikisigns solo publica la glosa y un
> video; la fonología la extrae la visión (MediaPipe) con las mismas
> reglas del botón «Sugerir» de `/anotar`. Cada campo lleva
> `provenance: "auto"` y la entrada `qa.status: "auto"`. Visión propone,
> la persona Sorda dispone.

## Licencia y atribución

Los videos y las glosas son de Wikisigns bajo CC BY-SA 4.0. Esta base es
obra derivada: se distribuye con la misma licencia y cada entrada lleva
`source.attribution`, `source.page_url` y `source.video_url`. Los videos
no se redistribuyen (quedan en `_videos/`, fuera de git).

## Archivos (`data/wikisigns-lsm/`)

| Archivo | Qué es |
|---|---|
| `sources.jsonl` | Índice crudo de Wikisigns: una página por línea con sus videos |
| `lexicon.jsonl` | Una entrada LSM-Lex completa por línea, ordenada por glosa |
| `index.json` | Resumen ligero (glosa, CM, UB, notación, confianza) |
| `tracks/<id>.json.gz` | Pista cuadro a cuadro de la seña |
| `stats.json` | Conteos y banderas de calidad |
| `_cache/`, `_videos/`, `_frames/` | Regenerables, fuera de git |

Tipos: `src/lib/lexicon/types.ts`. Derivación (pura, con pruebas):
`src/lib/lexicon/derive.ts`.

## Una entrada

Una entrada = **un video** (las variantes «(A)», «(B)» son entradas
distintas). Id: `wsl-<file_id>` de Wikisigns.

- `gloss`, `spanish`, `variant`, `variety` (`is_lsm: false` para ASL,
  DGS o Señas Internacionales), `kind` (`lexical`, `phrase`,
  `fingerspelling`, `number`).
- `annotation`: la `SignAnnotation` de LSM-PN 1.1 tal cual la abriría
  `/anotar` (segmentos D/M con CM, UB, contacto, lateralidad, OR,
  contorno, plano, dirección, repetición, cejas, boca, cabeza;
  `nondominant` con la relación bimanual). Los tiempos están en ms del
  video de YouTube.
- `notation`: la notación segmental legible, p. ej.
  `M₁[CM=10, UB=Pe/near, OR=(back,up), cont=straight, plano=vertical] · 2M:simetrica`.
- `phonology`: resumen por matriz (CM con sus 3 candidatas, UB, OR,
  movimiento, bimanualidad).
- `skeleton.canonical`: lo que Lexsi haría con las matrices.
  - `hands[]`: rotación por hueso (`LeftHandIndex1` … `LeftHandThumb3`)
    en Euler XYZ (grados) sobre la pose de enlace, calculada con
    `cmEntryToHandPose` y aplicada con la convención de
    `AvatarModel.applyPose`. Lexsi es espejo de quien aprende: `Left*` =
    mano dominante, `Right*` = no dominante.
  - `locations[]`: cada UB con su hueso y offset de `ub_bone_map.ts`.
- `skeleton.observed`: articulaciones medidas en el video, mediana del
  núcleo de la seña.
  - mano: flexión MCP/PIP/DIP por dedo, CMC/MCP/IP del pulgar y
    separación entre dedos (grados, 0 = recto), desde los landmarks 3D.
  - brazo: flexión y abducción del hombro, flexión del codo, desviación
    de la muñeca (grados anatómicos, desde la pose 3D).
- `face`: RNM categórica, los pesos ARKit que la representarían
  (`canonical_blendshapes`), los 52 blendshapes medidos (media y pico),
  el rango de giro de la cabeza y 66 **facemarks** del cuadro central
  (cejas, ojos, iris, nariz, labios, mejillas, mandíbula, frente),
  centrados en el puente nasal y escalados por la distancia entre ojos.
- `qa`: `confidence` (0–1) y banderas.

### Pista (`tracks/<id>.json.gz`)

Por cuadro (≈12 fps): `pose` y `pose_world` (33 puntos MediaPipe),
`dom`/`dom_world` y `nd`/`nd_world` (21 puntos por mano, ya asignados a
dominante/no dominante), `bs` (52 blendshapes en `blendshape_order`),
`fm` (facemarks en `facemark_index`) y `head` (pitch, yaw, roll).
`dom_src`/`nd_src` dicen de dónde salió cada mano: `det` (detector),
`crop` (recorte guiado por la pose) o `interp` (hueco rellenado). Las
manos de la pista van suavizadas con sus vecinos. `window_index` marca la
ventana de la seña.

### Banderas

| Bandera | Significa |
|---|---|
| `sin_video` | No se pudo bajar o leer el video |
| `sin_mano` | No se detectó la mano en ningún cuadro útil |
| `cm_dudosa` | La mejor CM explica mal la mano (puntaje < 0.75) |
| `cm_empate` | Varias CM empatan aun después del desempate por pulgar |
| `cm_2d` | La dominante solo se vio en 2D (RTMW): la CM y la OR salen de puntos sin profundidad |
| `pocos_cuadros` | Menos de 6 cuadros con mano |
| `sin_ub` | No se pudo ubicar la mano en el cuerpo |
| `otra_lengua` | Wikisigns la marca como de otra lengua |
| `dactilologia` | Letra del alfabeto manual |

## Cómo se construye

```bash
python3 -I scripts/wikisigns/crawl.py          # índice (Crawl-delay 10 s: ~7 h)
python3 -I scripts/wikisigns/fetch_videos.py   # videos 360p sin audio (yt-dlp)
.venv-lexicon/bin/python -I scripts/wikisigns/extract.py   # cuadros MediaPipe
.venv-lexicon/bin/python -I scripts/wikisigns/rtmw_hands.py # segunda pasada de manos (RTMW)
npm run lexicon:build                          # lexicon.jsonl, index, tracks
```

Los tres primeros pasos se reanudan donde se quedaron. El entorno de
Python: `python3.12 -m venv .venv-lexicon && .venv-lexicon/bin/pip
install mediapipe opencv-python-headless numpy rtmlib onnxruntime`.

### Recuperación de manos

Auditoría del primer corte (contra las muñecas de la pose, que casi nunca
se pierden): en el 14 % de los cuadros con una muñeca levantada no había
mano, y en el 27 % de los cuadros con las dos muñecas arriba faltaba al
menos una. Causas, en orden: manos chicas (≈40 px a 360p; el detector de
palmas reduce el cuadro entero a 192 px), desenfoque por movimiento,
manos que se tocan o se cruzan y algún falso positivo en la cara.

Arreglos (esquema de cuadros 2):

1. **Recorte guiado por la pose** (`extract.py`): si la pose ve una
   muñeca levantada sin mano cerca, se recorta alrededor de ella (lado
   0.9 anchos de hombro, centrado 0.6 antebrazos adelante), se amplía a
   256 px y se busca otra vez. En 30 videos difíciles bajó la pérdida de
   24 % a 15 % y subió los cuadros con las dos manos de 62 % a 78 %. Bajar
   los videos en 1080p, sin recorte, casi no cambiaba nada (24 % → 24 %).
2. **Limpieza contra la pose** (`cleanHands` en `derive.ts`): cada mano
   se asigna a la muñeca más cercana, se descartan las que quedan a más
   de 0.5 anchos de hombro de las dos (falsos positivos) y las sobrantes,
   y se rellenan huecos de 1–2 cuadros interpolando entre la mano de antes
   y la de después (el 42 % de los cuadros perdidos eran huecos así).
3. **Pistas suavizadas** con los cuadros vecinos.

`video.hand_recovery` cuenta, por entrada, manos recuperadas por recorte,
interpoladas y descartadas, y las que puso RTMW (`rtmw3d`, `rtmw2d`).

#### Segunda pasada con RTMW (`rtmw_hands.py`)

MediaPipe busca cada mano por separado: la pierde cuando se desenfoca,
se encima con la otra o se pone de canto, y con los brazos cruzados su
pose cambia las muñecas de lado. RTMW (OpenMMLab, cuerpo completo de 133
puntos, `rtmw-dw-x-l` 384×288, ONNX en CPU) ve el torso entero y sabe de
qué brazo cuelga cada mano. En los 30 videos más difíciles encontró el
98 % de las manos esperadas (MediaPipe: 53 %); donde los dos discrepaban
sobre el lado de una mano, RTMW tenía razón.

Solo pasan por RTMW los cuadros que lo necesitan (6 856 de 81 335, el
8.4 %; ~25 min en CPU): una muñeca levantada sin mano, o las dos
muñecas arriba juntas o cruzadas. En cada uno:

1. RTMW corre sobre una caja de torso y brazos tomada de la pose.
2. Cada mano de MediaPipe que coincide con una de RTMW recibe su lado
   en `hand_side`; `cleanHands` lo respeta antes que la muñeca más
   cercana (462 manos estaban del lado contrario).
3. Cada mano de RTMW sin pareja se agrega: primero se busca otra vez con
   MediaPipe en un recorte alrededor de ella (`rtmw3d`, 1 647 manos, con
   forma 3D); si no, entran los puntos 2D de RTMW (`rtmw`, 4 364 manos,
   z = 0 y una mano plana a escala de hombros para el esqueleto).

Las manos 2D cuentan para lugar, movimiento y dos manos, pero **no votan
la CM ni la OR** (vistas sin profundidad parecen planas). Si la
dominante solo se vio en 2D, la CM sale de ahí con la bandera `cm_2d`.

**Mano dominante por brazo.** `dominantImageSide` medía el camino de las
manos por mitad de la imagen; con la persona fuera del centro, las dos
manos caían en la misma mitad y un tercio del léxico salía zurdo. Ahora
se mide por brazo (la muñeca de cada mano) y la izquierda solo gana si
recorre 1.5 veces lo de la derecha (en las simétricas quedaba al azar):
zurdas 587 → 39, revisadas a ojo. `pickHands` también usa la muñeca: con
los brazos cruzados manda el hombro, y una mano sola del brazo base ya no
se toma por la dominante.

Efecto en el léxico (1 753 señas con fonología): dos manos 981 → 1 065;
cambió la CM en 582 (319 por la mano dominante corregida, 246 por las
manos de RTMW), la UB en 559 y la palma en 604. En una muestra de las
señas que pasaron a dos manos, 6 de 8 lo son; las otras dos tienen la
mano base en reposo a la altura de la cintura, que RTMW cuenta. Siguen
sin resolverse el reposo bajo y la forma de manos muy borrosas.

### Diferencias con el analizador del navegador

`extract.py` + `derive.ts` usan los mismos modelos, umbrales y muestreo
que `analyze_video.ts` (la pose en su versión *full*, no *lite*) y la
misma `aggregate()`. Encima agregan, para videos de diccionario:

1. **Ventana de la seña**: se quitan el reposo (manos fuera de cuadro),
   la mano recortada por el borde y la subida/bajada desde el reposo.
2. **Suavizado** de landmarks con los cuadros vecinos.
3. **Brazo base fuera de juego** cuando su mano no está en cuadro (si
   no, la mano dominante «tocaba» una muñeca que no se ve).
4. **Desempate de CM por el pulgar**: el puntaje de dedos deja empatadas
   CM como S/A/BOLÍGRAFO; gana la que explica la flexión y oposición
   del pulgar, luego la más frecuente.
5. **Ubicación fina con la malla de la cara**: además de las anclas del
   cuerpo, la cara aporta sien, oreja, cejas, ojo, rabillo, puente y
   punta de nariz, pómulo, mejilla, labios, comisura y mentón, cada una
   del lado correcto (ipsi/contra). Se mide desde el centroide y las
   yemas. A más de 0.3 anchos de hombro de toda ancla, la UB es `EN`
   (espacio neutro, como en `ub_anatomia.ts`).
   - **Mano sobre la cara**: si una yema cae dentro del contorno de la
     cara (mandíbula + frente), solo cuentan las yemas de adentro y las
     anclas de la cara; la oreja y la sien, que están en el borde, no
     compiten. Antes, cualquier mano que llegaba de lado caía en la oreja.
   - **Oreja o sien** se decide por la altura de las yemas (la mediana,
     para que un pulgar suelto no decida): arriba de los ojos es sien,
     entre ojos y boca es oreja, más abajo ninguna.
   - Las anclas del borde (oreja, sien, coronilla) cuentan como «cerca» a
     4/5 de la distancia de las demás.

   Límite: con una sola cámara no se ve si la mano toca la cara o va por
   delante (MANOS, PADRASTRO); esas señas quedan en un punto de la cara.
6. **Lateralidad**, **movimiento de cabeza** y **CM/OR de la mano no
   dominante** (el analizador solo daba la relación bimanual).

Además se corrigió un error en `buildAnchors` (`phon_features.ts`): las
anclas del brazo base (Cut, Abr, Car, Palma) usaban el brazo que seña.
Afecta también a «Sugerir» en `/anotar`.

## Navegador (`/lexico`)

- **`/lexico`**: buscar en español (sin acentos ni signos; primero las
  glosas que empiezan con el texto, luego las que lo contienen y al final
  los sinónimos) y filtrar por lengua, una o dos manos, lugar y «solo con
  video». Página estática: el servidor lee `lexicon.jsonl` al construir y
  manda filas ligeras (`src/lib/lexicon/catalog.ts`, `browse.ts`).
- **`/lexico/sena?id=wsl-…`**: la ficha de una seña.
  - El esqueleto 3D medido en bucle, con pausa y cámara lenta
    (`track3d.ts`, `EsqueletoMP3D` con `encuadre="todo"`): pose, manos
    injertadas en las muñecas y los 66 facemarks de la cara con sus
    trazos (cejas, ojos, nariz, labios, mandíbula). Las piernas se recogen
    en la cadera.
  - Los facemarks vienen en coordenadas de imagen; se pasan a metros con
    la escala del cuadro (ancho de hombros en metros / en píxeles) y se
    anclan en la nariz de la pose. Es una aproximación: la pose y la malla
    de la cara son modelos distintos.
  - Al lado, CM, UB, OR y MV; abajo, dos manos, RNM con los blendshapes
    medidos, los ángulos de dedos y brazo y los huesos del rig.
  - Lexsi no aparece por ahora: el avatar todavía no ejecuta bien estas
    señas. `to_construction.ts` (léxico → matriz de `/learn`) queda listo
    para cuando mejore.
- **Archivos estáticos**: `scripts/wikisigns/publish-tracks.mjs` corre
  antes de `dev` y `build` y escribe `public/lexico/e/<id>.json` (la
  ficha) y `public/lexico/tracks/<id>.json.gz` (la pista). No se
  versionan. Generar 2,144 páginas en el build sumaba ~180 MB al paquete
  del servidor de Amplify; como archivos estáticos el servidor queda en
  ~8 MB.

## Lo que falta validar

Buscar `VALIDAR-LSM` en `src/lib/lexicon/derive.ts`: umbrales de reposo,
lateralidad, cabeza y pulgar, y los pesos ARKit de la RNM. Ninguno lo ha
revisado una persona Sorda ni la lingüista.
