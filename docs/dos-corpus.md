# Dos corpus en Grabar

Desde septiembre de 2026, `/record` empieza eligiendo a qué corpus va la
sesión. Son dos caminos con la misma cámara, la misma revisión y la misma
subida:

| | LSM Corpus | Corpus para SignaPlay |
| --- | --- | --- |
| Qué se graba | Una seña por cada una de las 101 configuraciones de mano (Cruz Aldrete) | Las 121 señas del nivel preescolar de SignaPlay («El Correo de Lexsi») |
| Cómo se elige | Por nivel de frecuencia (T1–T4) o las 101 | Por ruta (11 unidades, 33 lecciones) o todas |
| Ítem | El número de la CM: `"12"` | La glosa normalizada: `"POR_FAVOR"` |
| Para qué | Corpus de investigación y modo Aprender | Los videos de las lecciones de la app |

El catálogo vive en `src/lib/corpus.ts`. El banco de SignaPlay se genera
desde `SignaPlay-PreK/Resources/signaplay_prek_content.json` (versión 2.0.0)
a `src/lib/signaplay_corpus.json`: id seguro para llaves, glosa, español,
categoría, unidad y lección. `PERRO` está en el banco pero en ninguna
lección; entra al final de «todas las rutas».

## Datos

- Local (`RecordingSession`): `corpus` y, en cada seña, `item_id`. Las
  sesiones anteriores solo traían `cm_id`; `store.ts` las completa al leer
  (`migrateSession`): `item_id = String(cm_id)`, `corpus = "lsm"`.
- Tabla `signalab-corpus`: la grabación sigue en `SESS#{sessionId}` /
  `REC#{itemId}`. Para el LSM Corpus `itemId` es el número de CM, así que
  las llaves anteriores (`REC#12`) no cambian. Se agregan `item_id`,
  `corpus`, `gloss` (SignaPlay) y se conserva `cm_id` (LSM). La sesión
  guarda `corpus` y `task_type: "phonological" | "lexical"`.
- S3: `{userId}/{sessionId}/{itemId}.{webm|mp4|mov}`. El ítem se valida con
  `^[A-Za-z0-9_-]{1,64}$` en el presign y en la confirmación. La
  confirmación acepta cualquiera de las tres extensiones (antes solo
  `.webm`, así que los mp4 subidos no se confirmaban).
- API: `itemId` (string) sustituye a `cmId`; los clientes anteriores que
  manden `cmId` entero siguen funcionando (`leerItemId`). Los ids de
  `/api/recordings/{id}` son `{sessionId}__{itemId}`; por eso ni el ítem ni
  la sesión pueden llevar `__` ni empezar con `_` o `-` (`ITEM_ID_RE`,
  `SESSION_ID_RE`).
- La confirmación no confía en el cliente: el ítem tiene que existir en el
  corpus indicado (CM del inventario o glosa del banco), la glosa y la CM
  se derivan en el servidor, y la llave tiene que existir ya en S3
  (`HeadObject`; si S3 no responde, no se bloquea).

No hay cambios en `infra/`: la tabla es de esquema libre y los índices no
cambian.

## Inicio

`/` ya no es un tablero. Explica el camino (grabar → anotar → corpus →
aprender y jugar), presenta los dos corpus y recuerda que los videos son
de quien los graba.

**Marca «LSM CORPUS»** (`MarcaLSMCorpus`): letras en verde (Access Green)
sobre tarjeta blanca, con la coreografía del diseño «LSM Corpus
Animation» (bucle de 10.4 s): intro en la que cada letra dibuja su
contorno y se rellena → la marca compacta se sostiene y respira → cada
letra se desliza y se estira hacia la marca ancha → la ancha se sostiene
mientras la O se asienta → regreso a la compacta → salida. Las dos
versiones de cada letra (compacta y ancha) vienen de `lsmcorpus.svg`; la
transformación interpola la caja de cada letra y cruza la opacidad. Se
anima con `requestAnimationFrame` escribiendo atributos, se pausa fuera
de pantalla y con `prefers-reduced-motion` queda fija en la compacta. En
tarjetas y listas (`animada={false}`) se muestra la compacta fija.

**Marca SignaPlay** (`MarcaSignaPlay`): el wordmark vectorial de
`signaplay.pdf` («Signa» en #f7931d, «Play» en #fab14b, anchos de letra
variables) aplanado a `signaplay_glifos.ts` con pdftocairo, sobre la
misma tarjeta blanca.
