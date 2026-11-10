/**
 * track3d.ts — la pista de una seña del léxico (tracks/<id>.json.gz) al
 * esqueleto 3D que dibuja EsqueletoMP3D: pose en metros pasada al marco
 * de escena, manos injertadas en sus muñecas (como en analyze_video) y
 * los facemarks puestos sobre la cabeza. Solo la ventana de la seña, con
 * el tiempo desde 0.
 *
 * Los facemarks vienen en coordenadas de imagen (0..1). Se pasan a metros
 * con la escala del cuadro (ancho de hombros medido en metros / en
 * píxeles) y se anclan en la nariz de la pose: la punta de la nariz de la
 * malla cae sobre el punto 0 de la pose. Es una aproximación (la pose y la
 * malla son modelos distintos), suficiente para ver cejas, ojos y boca.
 */

import { graftHand, toScene, type P3, type Pose3DFrame, type Pose3DTrack } from "@/lib/vision/pose3d";

type V = number[];

export interface LexiconTrackFrame {
  t: number;
  pose?: V[];
  pose_world?: V[];
  dom_world?: V[];
  nd_world?: V[];
  fm?: V[];
}

export interface LexiconTrack {
  schema: string;
  id: string;
  video?: { width: number; height: number };
  window_index: [number, number] | null;
  facemark_index?: number[];
  frames: LexiconTrackFrame[];
}

const p3 = (v: V): P3 => ({ x: v[0], y: v[1], z: v[2] });

/** Cadera → rodilla, tobillo, talón y punta del pie de ese lado */
const PIERNAS: [number, number[]][] = [
  [23, [25, 27, 29, 31]],
  [24, [26, 28, 30, 32]],
];

/**
 * Trazos de la cara en índices de la malla de MediaPipe (los que guarda
 * extract.py). Los cerrados repiten el primer punto al final.
 */
const TRAZOS_CARA: number[][] = [
  [70, 63, 105, 66, 107], // ceja derecha
  [300, 293, 334, 296, 336], // ceja izquierda
  [33, 160, 158, 133, 153, 144, 33], // ojo derecho
  [263, 387, 385, 362, 380, 373, 263], // ojo izquierdo
  [168, 6, 4, 1], // puente y dorso de la nariz
  [98, 1, 327], // aletas
  [61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, 61], // labios por fuera
  [78, 81, 13, 311, 308, 402, 14, 178, 78], // labios por dentro
  [234, 172, 136, 150, 152, 379, 365, 397, 454], // mandíbula
];

/** Trazos de la cara en índices del arreglo de facemarks de la pista */
export function faceLinesFor(facemarkIndex: number[]): number[][] {
  return TRAZOS_CARA.map((tr) => tr.map((m) => facemarkIndex.indexOf(m))).filter((tr) => tr.every((i) => i >= 0));
}

/** Facemarks de un cuadro en metros, en el marco de imagen de la pose */
export function faceToWorld(
  fm: V[],
  pose: V[],
  poseWorld: V[],
  facemarkIndex: number[],
  W: number,
  H: number,
): P3[] | null {
  const nariz = facemarkIndex.indexOf(1);
  if (nariz < 0 || !fm[nariz] || !pose[11] || !pose[12] || !poseWorld[0]) return null;
  const hombrosPx = Math.hypot((pose[11][0] - pose[12][0]) * W, (pose[11][1] - pose[12][1]) * H);
  const hombrosM = Math.hypot(
    poseWorld[11][0] - poseWorld[12][0],
    poseWorld[11][1] - poseWorld[12][1],
    poseWorld[11][2] - poseWorld[12][2],
  );
  if (hombrosPx < 1 || hombrosM <= 0) return null;
  const s = hombrosM / hombrosPx;
  const a = fm[nariz];
  const o = poseWorld[0];
  // z de la malla va en la misma escala que x (ancho de imagen)
  return fm.map((v) => ({
    x: o[0] + (v[0] - a[0]) * W * s,
    y: o[1] + (v[1] - a[1]) * H * s,
    z: o[2] + (v[2] - a[2]) * W * s,
  }));
}

/**
 * `dominant` es la mano de la persona que seña. Pose3DFrame usa lados de
 * la persona: left = muñeca 15, right = muñeca 16.
 */
export function trackToPose3D(track: LexiconTrack, dominant: "RIGHT" | "LEFT"): Pose3DTrack {
  const [a, b] = track.window_index ?? [0, track.frames.length - 1];
  const win = track.frames.slice(a, b + 1).filter((f) => f.pose_world?.length);
  const t0 = win[0]?.t ?? 0;
  const domSide = dominant === "RIGHT" ? "right" : "left";
  const ndSide = dominant === "RIGHT" ? "left" : "right";
  const wrist = { left: 15, right: 16 } as const;
  const fmi = track.facemark_index ?? [];
  const W = track.video?.width ?? 0;
  const H = track.video?.height ?? 0;
  const frames: Pose3DFrame[] = win.map((f) => {
    const pose = f.pose_world!.map((v) => toScene(p3(v)));
    // las piernas casi nunca salen en cuadro (MediaPipe las inventa):
    // se recogen en la cadera para que no se dibujen ni muevan el encuadre
    for (const [hip, leg] of PIERNAS) for (const i of leg) if (pose[i] && pose[hip]) pose[i] = pose[hip];
    const fr: Pose3DFrame = { tMs: f.t - t0, pose };
    if (f.dom_world?.length) fr[domSide] = graftHand(f.dom_world.map((v) => toScene(p3(v))), pose[wrist[domSide]]);
    if (f.nd_world?.length) fr[ndSide] = graftHand(f.nd_world.map((v) => toScene(p3(v))), pose[wrist[ndSide]]);
    if (f.fm?.length && f.pose && W && H) {
      const face = faceToWorld(f.fm, f.pose, f.pose_world!, fmi, W, H);
      if (face) fr.face = face.map(toScene);
    }
    return fr;
  });
  return {
    frames,
    durationMs: frames.at(-1)?.tMs ?? 0,
    faceLines: fmi.length ? faceLinesFor(fmi) : undefined,
  };
}

/** Descarga y descomprime una pista .json.gz servida como archivo estático */
export async function fetchLexiconTrack(url: string, signal?: AbortSignal): Promise<LexiconTrack> {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error(`pista ${res.status}`);
  // si el servidor ya la descomprimió (Content-Encoding), viene en claro
  const bytes = new Uint8Array(await res.arrayBuffer());
  const gz = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = gz
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
    : new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
