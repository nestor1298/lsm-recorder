/**
 * track3d.ts — la pista de una seña del léxico (tracks/<id>.json.gz) al
 * esqueleto 3D que dibuja EsqueletoMP3D: pose en metros pasada al marco
 * de escena y manos injertadas en sus muñecas, como en analyze_video.
 * Solo la ventana de la seña, con el tiempo desde 0.
 */

import { graftHand, toScene, type P3, type Pose3DFrame, type Pose3DTrack } from "@/lib/vision/pose3d";

type V = number[];

export interface LexiconTrackFrame {
  t: number;
  pose_world?: V[];
  dom_world?: V[];
  nd_world?: V[];
}

export interface LexiconTrack {
  schema: string;
  id: string;
  window_index: [number, number] | null;
  frames: LexiconTrackFrame[];
}

const p3 = (v: V): P3 => ({ x: v[0], y: v[1], z: v[2] });

/** Cadera → rodilla, tobillo, talón y punta del pie de ese lado */
const PIERNAS: [number, number[]][] = [
  [23, [25, 27, 29, 31]],
  [24, [26, 28, 30, 32]],
];

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
  const frames: Pose3DFrame[] = win.map((f) => {
    const pose = f.pose_world!.map((v) => toScene(p3(v)));
    // las piernas casi nunca salen en cuadro (MediaPipe las inventa):
    // se recogen en la cadera para que no se dibujen ni muevan el encuadre
    for (const [hip, leg] of PIERNAS) for (const i of leg) if (pose[i] && pose[hip]) pose[i] = pose[hip];
    const fr: Pose3DFrame = { tMs: f.t - t0, pose };
    if (f.dom_world?.length) fr[domSide] = graftHand(f.dom_world.map((v) => toScene(p3(v))), pose[wrist[domSide]]);
    if (f.nd_world?.length) fr[ndSide] = graftHand(f.nd_world.map((v) => toScene(p3(v))), pose[wrist[ndSide]]);
    return fr;
  });
  return { frames, durationMs: frames.at(-1)?.tMs ?? 0 };
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
