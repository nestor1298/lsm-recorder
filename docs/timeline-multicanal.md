# Línea de tiempo multicanal

Cómo se lee y se edita una anotación LSM-PN en `/annotate`: canales
apilados, zoom y desplazamiento continuos, y edición de fronteras al
milisegundo.

## Principio rector

**Los canales son proyecciones de `PSHRSegment[]`, no pistas
independientes.** La representación canónica sigue siendo LSM-PN: una
secuencia de segmentos D/M, cada uno con sus tres matrices. Cada canal
*lee* una dimensión de esa secuencia y la dibuja como tramos de valor;
**las fronteras temporales se editan en un solo lugar** —el canal
maestro— y todos los demás se redibujan a partir de ahí.

Un modelo donde cada canal tuviera sus propias fronteras rompería el
contrato de la notación y volvería inderivable `buildNotacion`.

## Modelo de vista

`src/lib/timeline/viewport.ts` (capa pura, con pruebas):

```ts
type Viewport = { startMs: number; msPerPx: number }
// endMs = startMs + widthPx * msPerPx
```

| Función | Qué hace |
|---|---|
| `fit(bounds, widthPx)` | El clip completo con 2 % de margen a cada lado |
| `zoomAt(view, factor, anchorPx, …)` | Zoom que **conserva el instante bajo el ancla** |
| `panBy(view, deltaPx, …)` | Desplazamiento, sin inercia ni rebote |
| `zoomToRange(a, b, w, pad, …)` | Encuadra un segmento (doble clic) |
| `clampView` | Encaja en el dominio y en el rango de zoom |
| `tickStepMs` / `ticks` / `formatTick` | Regla adaptativa 1-2-5 × 10ⁿ, ≥ 60 px entre etiquetas |
| `snapMs` | Ajuste magnético con umbral en píxeles |

### Tope de zoom (constante calibrable)

El encargo fijaba 2 ms/px como acercamiento máximo (≈ 16 px por cuadro a
30 fps). **En clips cortos ese tope es inalcanzable**: una seña de 900 ms
en 800 px ya cabe a 1,17 ms/px, así que un tope literal dejaría el rango
de zoom vacío. El tope efectivo es:

```
min(MIN_MS_PER_PX, fit / MAX_ZOOM_FACTOR)
```

2 ms/px en clips largos —donde el tope importa— y siempre al menos 8
aumentos sobre `fit` en clips cortos. Todas las constantes de
interacción viven en `src/lib/timeline/constants.ts`.

## Matriz de gestos

| Entrada | Gesto | Resultado |
|---|---|---|
| Táctil (iPad) | Dos punteros | Zoom por distancia **y** desplazamiento por centroide, en el mismo gesto continuo |
| Táctil | Un puntero sobre la regla | Mueve la aguja |
| Táctil / mouse | Un puntero sobre una frontera | La arrastra (área efectiva de 24 px en táctil, 10 px en puntero fino) |
| Trackpad | Pellizco (`wheel` con `ctrlKey`) | Zoom anclado al cursor |
| Trackpad | Dos dedos horizontal (`deltaX`) | Desplazamiento |
| Mouse | Rueda con ⌘ o Ctrl | Zoom anclado |
| Mouse | Rueda sola | Desplazamiento en el tiempo |
| Cualquiera | Doble clic en un tramo | `zoomToRange` a ese segmento con 10 % de margen |
| Teclado | `+` `−` | Zoom sobre la aguja |
| Teclado | `0` / `⇧0` | Ajustar al clip / al segmento seleccionado |
| Teclado | `←` `→` / `⇧←` `⇧→` | Aguja un cuadro / diez cuadros |
| Teclado | `Inicio` `Fin` | Extremos del clip |
| Arrastre | `⌥` sostenido | Desactiva el ajuste magnético |

`touch-action: none` se aplica **solo** a los lienzos de la línea de
tiempo, para que la página siga desplazándose fuera de ella. Los
listeners de `wheel` se registran con `{ passive: false }` y llaman
`preventDefault()`: sin eso el navegador hace zoom de la página entera.

## Proyección de `PSHRSegment[]` a canales

`src/lib/timeline/channels.ts`. Para cada canal, `valorDe(canal, seg)`
devuelve `{ key, label, aria, data }` o `undefined`.

- **`undefined` es un hueco**: ese segmento no anota esa dimensión. Se
  dibuja como carril con textura diagonal tenue, distinto de un valor
  vacío o "neutral" (boca neutral, por ejemplo, también es hueco).
- **Los contiguos con la misma `key` se fusionan** en un solo tramo, y
  las fronteras internas quedan como divisorias tenues. Es lo que
  permite leer «la forma de la mano no cambia en toda la seña, lo que
  cambia es el lugar».
- Un valor con `provenance = "auto"` lleva el chip «Sugerido»; el tramo
  fusionado solo es «auto» si **todos** sus segmentos lo son.

| Canal | Lee | Editable |
|---|---|---|
| Segmentos (maestro) | `type`, `phase` | Fronteras y selección |
| Forma de la mano | `cm_id`, `end_cm_id` | Selección |
| Lugar | `location_code`, `contact` | Selección |
| Orientación | `palm_facing`, `finger_pointing`, `forearm_rotation` (sub-filas palma/dedos) | Selección |
| Movimiento | `contour_movement`, `direction`, `repetition`, `local_movement` (solo segmentos M) | Selección |
| Rasgos no manuales | `eyebrows`, `mouth`, `head_movement` (tres sub-filas) | Selección |
| Mano base | `annotation.nondominant` | Selección |

### Cómo agregar un canal

1. Agrega su `id` a `CanalId` y su entrada a `CANAL_ES` en
   `anotar_labels.ts` (nombre para la comunidad + término técnico).
2. Añade el caso a `valorDe()`: devuelve `undefined` donde no aplique.
3. Decláralo en `CANALES` (con `subfilas` si lleva).
4. Si necesita glifo propio, extiende `ContenidoTramo` en
   `TimelineMulticanal.tsx`.
5. Agrega su valor por defecto a `PREFS_POR_DEFECTO.canales`.

## Edición de fronteras

Solo en el canal maestro (`src/lib/timeline/boundaries.ts`):

- La frontera entre dos segmentos contiguos **es una sola**: moverla
  ajusta a ambos. Segmentos separados se redimensionan sin arrastrar al
  vecino.
- Nunca se produce duración menor a un cuadro, cruce ni duración
  negativa.
- **Ajuste magnético** (6 px) hacia: la aguja, las marcas de cuadro
  (solo cuando son visibles), los extremos del clip y los puntos de
  cambio de valor de los demás canales.
- Durante el arrastre se previsualiza moviendo los bloques en el DOM y
  se muestra el milisegundo exacto y la duración resultante de ambos
  segmentos. **La escritura ocurre al soltar**, una sola vez.

## Rendimiento

Durante un gesto no se re-renderiza React: se transforma la capa
`[data-capa]` de cada canal (`translateX` + `scaleX`, ver
`transformacionCapa`) dentro de un `requestAnimationFrame`, y el estado
de vista se hace *commit* al soltar. La regla se dibuja en un solo
`<canvas>` (no un nodo por marca) y hay un único `ResizeObserver`.

## Accesibilidad

- Cada canal es `role="group"` con `aria-label`; cada tramo es un botón
  con etiqueta generada desde las matrices: *«Segmentos, 0 a 200
  milisegundos, detención, fase preparación»*.
- `Tab` entre canales, `←` `→` entre tramos de un canal (el evento no
  propaga, para no mover la aguja al mismo tiempo).
- **El zoom no es la única forma de llegar a un segmento**:
  `ListaSegmentos` ofrece la misma selección en texto, navegable con
  flechas. Quien no pueda hacer un pellizco anota igual.
- Los atajos están en la interfaz (botón «Atajos»), no solo aquí.
- Tipo y fase se distinguen por forma y patrón de borde además de por
  color; cada canal lleva su etiqueta fija.

## Nota para el futuro: alcance propio de los RNM

Los rasgos no manuales son la única dimensión que lingüísticamente
quiere **alcance temporal propio**: una ceja levantada puede abarcar
varias señas. Cuando llegue ese *temporal scoping*, el canal 6 será el
primero en volverse independiente de la secuencia D/M.

La configuración ya lo contempla: cada `CanalDef` tiene
`independentScope: boolean`, hoy `false` en todos y **sin usar**. No se
implementa en esta iteración.
