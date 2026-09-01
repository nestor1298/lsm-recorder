# Matrices fonológicas de Cruz Aldrete y esqueleto 3D

Este documento describe el modelo de datos extendido (LSM-PN 1.1), la
migración desde 1.0, el marco de coordenadas del esqueleto, cómo
recalibrar las tablas y la correspondencia campo a campo con la notación
de la *Gramática de la Lengua de Señas Mexicana* (Cruz Aldrete, 2008).

## Principio rector

**Las matrices son el contrato. El esqueleto es una función pura de las
matrices.** `poseAtTime(annotation, t_ms)` es la única entrada del
renderer; nada de lo que se dibuja proviene de los landmarks del video.
La extracción automática (MediaPipe) *propone*; la persona Sorda
anotadora *confirma o corrige*; cada campo guarda su procedencia
(`auto` / `humano` / `auto_confirmado`).

## Modelo de datos (LSM-PN 1.1)

`SignAnnotation → PSHRSegment[]` (modelo secuencial Liddell & Johnson
que adopta Cruz Aldrete: Detenciones y Movimientos).

### Correspondencia con las matrices

| Matriz de Cruz Aldrete | Campos en `PSHRSegment` |
|---|---|
| **Segmental** — categoría mayor | `type` (`D`/`M`/`T`), `phase` |
| Segmental — mov. de contorno | `contour_movement` (lin/arc/circ/zig/7) |
| Segmental — mov. local | `local_movement` (ond/cir/rot/rsc/cab/osc-CM/solt/apl/prog/vib/frot) |
| Segmental — dirección | `direction {x,y,z}` en el marco de la persona señante (−1/0/1 por eje) |
| Segmental — repetición | `repetition {count, type: igual/alternada/progresiva}` |
| Segmental — plano | `movement_plane` |
| **Articulatoria** — CM | `cm_id` (inventario de 101), `end_cm_id` (osc-CM/prog) |
| Articulatoria — UB | `location_code` (80 puntos), `contact` (proximidad), `laterality` |
| Articulatoria — OR | `palm_facing`, `finger_pointing`, `forearm_rotation` (neutra/prona/supina) |
| Articulatoria — DI | pendiente (fuera de esta iteración; `direction` cubre el caso más frecuente) |
| **No manual** (básica) | `eyebrows`, `mouth`, `head_movement` |
| **Bimanualidad** | `SignAnnotation.nondominant {relation, cm_id, palm_facing, finger_pointing, location_code}` |
| Procedencia | `provenance` por campo, en segmento y en `nondominant` |

Tipos estructurales: el orden de los segmentos da el esquema (D, M, DM,
MD, DMD, …). El flujo guiado produce M o D-M-D; el modo experto puede
componer cualquier secuencia.

### Migración 1.0 → 1.1

`migrateAnnotation()` (en `store.ts`, aplicada al leer):

- `{two_handed: true, symmetrical: true}` → `nondominant.relation = SIMETRICA`
- `{two_handed: true, symmetrical: false}` → `relation = BASE_PASIVA` con
  `cm_id` ausente (la interfaz lo muestra como "pendiente")
- Los booleanos se conservan como derivados de compatibilidad y el
  export 1.1 los sigue emitiendo.

Las anotaciones viejas abren sin cambios visibles; los campos nuevos
quedan vacíos y sin `provenance`.

## Esqueleto 3D

### Marco de coordenadas

Origen en el esternón; **x** hacia la derecha de la persona señante,
**y** arriba, **z** al frente. Unidades ≈ metros de un torso adulto.
Dimensiones en `SKEL` (`pose_at_time.ts`).

### Capas

1. **Motor puro** (`src/lib/skeleton/`, sin Three.js, 16 pruebas):
   - `cm_kinematics.ts` — CM → ángulos por falange. **Reusa la tabla de
     `src/lib/hand_pose.ts`** (la misma del avatar Lexsi): EXTENDED 0° /
     CURVED 80° / BENT 160° / CLOSED 260°, repartidos MCP 35% · PIP 40%
     · DIP 25%. Para recalibrar, editar `FLEXION_RAD`/`distributeCurl`
     allí (una sola fuente).
   - `ub_anchors.ts` — 80 anclas 3D generadas por proyección afín de las
     coordenadas 2D de la silueta (`ub_inventory.ts`, esternón en
     (100,105), escala 0.0055 m/px) + offset z por región + afinado
     puntual (`OVERRIDES`). Para recalibrar un punto, agregarlo a
     `OVERRIDES`. `// VALIDAR-LSM`: revisar con la lingüista.
   - `or_rotation.ts` — OR → cuaternión (dedos = +Y local, palma = −Z
     local). Combinación imposible → se ortogonaliza y devuelve
     `warning`.
   - `pose_at_time.ts` — segmento activo, D mantiene, M interpola con
     easing; contorno desplaza la trayectoria (ciclos =
     `repetition.count`); IK analítica de dos huesos con el codo
     abajo-afuera; mano no dominante por tipología (espejo / fase π /
     base quieta).
2. **Renderer** (`src/components/esqueleto/EsqueletoLSM.tsx`) — R3F
   procedural, `frameloop="demand"`, tokens de marca en runtime, vista
   frontal/lateral, fallback textual sin WebGL, descripción de pose
   generada de las matrices (aria-label), `prefers-reduced-motion`.

### Sincronía

En `/anotar` y `/annotate` el recuadro escucha el `<video>` (rAF durante
la reproducción) y cualquier cambio del borrador re-posa al instante.
Sin video: scrubber propio + "Ver" en bucle (1× / 0.5×).

## Tablas que requieren validación lingüística

| Tabla | Archivo | Estado |
|---|---|---|
| Anclas UB 3D | `skeleton/ub_anchors.ts` | aproximadas (proyección + overrides) |
| Cinemática CM | `hand_pose.ts` (vía `cm_kinematics.ts`) | calibrada para el avatar; revisar CURVED/BENT |
| CMs TAB (mano base) | `cm_inventory.json` campo `tab_capable` | aproximada por alpha_code B/A/S/1/5/C/O |
| Umbrales de extracción | `vision/phon/phon_features.ts` | primera calibración; ajustar con clips reales |

Buscar `VALIDAR-LSM` en el código para la lista completa.

## Extracción automática (propuestas)

`analyzeSignVideo` muestrea ~12 fps y propone: CM (top-3), UB+contacto,
contorno/plano/dirección/repetición, OR (normal de palma por landmarks
0-5-17; dedos por MCP→TIP), RNM (blendshapes), relación bimanual
(trayectorias de ambas manos) y corte D-M-D (ventanas quietas ≥3 frames
con UB distinta al núcleo). Todo entra al borrador con
`provenance: "auto"` y chip "Sugerido".
