/**
 * panorama.ts — las características del léxico en conjunto, para
 * /lexico/panorama: tamaño, cómo se reparten los parámetros (CM, UB, OR,
 * MV, dos manos, RNM), duración y calidad. Pura: recibe las entradas.
 */

import type { LexiconEntry } from "./types";

export type Conteo<K extends string | number = string> = { clave: K; n: number };

export interface Panorama {
  paginas: number | null;
  entradas: number;
  lsm: number;
  otrasLenguas: number;
  conFonologia: number;
  sinVideo: number;
  frases: number;
  /** solo entradas con fonología */
  medidas: {
    dosManos: number;
    zurdas: number;
    conRepeticion: number;
    confianzaMedia: number;
    duracionMedianaMs: number;
    cuadros: number;
    segundosDeVideo: number;
  };
  cm: { distintas: number; top: (Conteo<number> & { ejemplo: { id: string; gloss: string } })[] };
  ub: { distintas: number; todos: Conteo[]; regiones: Conteo[] };
  palma: Conteo[];
  dedos: Conteo[];
  contorno: Conteo[];
  plano: Conteo[];
  estructura: Conteo[];
  relacion: Conteo[];
  cabeza: Conteo[];
  cejas: Conteo[];
  boca: Conteo[];
  /** histograma de confianza en cajas de 0.05 (de 0.30 a 1.00) */
  confianza: { desde: number; n: number }[];
  /** histograma de duración de la seña en cajas de 250 ms (hasta 4 s) */
  duracion: { desde: number; n: number }[];
  banderas: Conteo[];
  /** manos recuperadas o quitadas por la limpieza (sumadas en todas las señas) */
  manos: { recorte: number; rtmw3d: number; rtmw2d: number; interpoladas: number; descartadas: number };
}

function contar<K extends string | number>(vals: (K | null | undefined)[], sinValor?: K): Conteo<K>[] {
  const m = new Map<K, number>();
  for (const v of vals) {
    const k = v ?? sinValor;
    if (k === undefined || k === null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([clave, n]) => ({ clave, n })).sort((a, b) => b.n - a.n || String(a.clave).localeCompare(String(b.clave)));
}

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function histograma(v: number[], desde: number, hasta: number, paso: number): { desde: number; n: number }[] {
  const cajas = Math.round((hasta - desde) / paso);
  const out = Array.from({ length: cajas }, (_, k) => ({ desde: +(desde + k * paso).toFixed(4), n: 0 }));
  for (const x of v) {
    const k = Math.min(cajas - 1, Math.max(0, Math.floor((x - desde) / paso + 1e-9)));
    out[k].n++;
  }
  return out;
}

export function panorama(entries: LexiconEntry[], paginas: number | null = null): Panorama {
  const med = entries.filter((e) => e.phonology !== null);
  const p = (e: LexiconEntry) => e.phonology!;

  // CM: las más usadas, con la seña de más confianza como ejemplo
  const porCm = new Map<number, LexiconEntry[]>();
  for (const e of med) {
    const id = p(e).cm?.id;
    if (id === undefined) continue;
    porCm.set(id, [...(porCm.get(id) ?? []), e]);
  }
  const cmTop = [...porCm.entries()]
    .map(([clave, es]) => {
      const mejor = es.filter((e) => e.variety.is_lsm).sort((a, b) => b.qa.confidence - a.qa.confidence || a.gloss.localeCompare(b.gloss))[0] ?? es[0];
      return { clave, n: es.length, ejemplo: { id: mejor.id, gloss: mejor.gloss } };
    })
    .sort((a, b) => b.n - a.n || a.clave - b.clave);

  const rec = { recorte: 0, rtmw3d: 0, rtmw2d: 0, interpoladas: 0, descartadas: 0 };
  for (const e of med) {
    const h = e.video.hand_recovery;
    if (!h) continue;
    rec.recorte += h.crop;
    rec.interpoladas += h.interpolated;
    rec.descartadas += h.dropped;
    rec.rtmw3d += h.rtmw3d ?? 0;
    rec.rtmw2d += h.rtmw2d ?? 0;
  }
  const duraciones = med.map((e) => (e.video.window_ms ? e.video.window_ms[1] - e.video.window_ms[0] : NaN)).filter((d) => Number.isFinite(d) && d > 0);

  return {
    paginas,
    entradas: entries.length,
    lsm: entries.filter((e) => e.variety.is_lsm).length,
    otrasLenguas: entries.filter((e) => !e.variety.is_lsm).length,
    conFonologia: med.length,
    sinVideo: entries.filter((e) => e.qa.flags.includes("sin_video")).length,
    frases: entries.filter((e) => e.kind === "phrase").length,
    medidas: {
      dosManos: med.filter((e) => p(e).bimanual.two_handed).length,
      zurdas: med.filter((e) => e.skeleton.dominant_hand === "LEFT").length,
      conRepeticion: med.filter((e) => Boolean(p(e).mov?.repetition)).length,
      confianzaMedia: med.length ? med.reduce((s, e) => s + e.qa.confidence, 0) / med.length : 0,
      duracionMedianaMs: mediana(duraciones),
      cuadros: med.reduce((s, e) => s + (e.video.sampled_frames ?? 0), 0),
      segundosDeVideo: med.reduce((s, e) => s + (e.video.duration_ms ?? 0), 0) / 1000,
    },
    cm: { distintas: porCm.size, top: cmTop },
    ub: {
      distintas: new Set(med.map((e) => p(e).ub?.code).filter(Boolean)).size,
      todos: contar(med.map((e) => p(e).ub?.code)),
      regiones: contar(med.map((e) => (p(e).ub ? (p(e).ub!.code === "EN" ? "NEUTRAL_SPACE" : (p(e).ub!.region ?? "OTRA")) : null))),
    },
    palma: contar(med.map((e) => p(e).or.palm)),
    dedos: contar(med.map((e) => p(e).or.fingers)),
    contorno: contar(med.map((e) => p(e).mov?.contour), "NINGUNO"),
    plano: contar(med.map((e) => p(e).mov?.plane)),
    estructura: contar(med.map((e) => p(e).structure)),
    relacion: contar(med.map((e) => (p(e).bimanual.two_handed ? (p(e).bimanual.relation ?? "OTRA") : "UNA_MANO"))),
    cabeza: contar(med.map((e) => e.face.rnm.head)),
    cejas: contar(med.map((e) => e.face.rnm.eyebrows)),
    boca: contar(med.map((e) => e.face.rnm.mouth)),
    confianza: histograma(med.map((e) => e.qa.confidence), 0.3, 1.0, 0.05),
    duracion: histograma(duraciones, 0, 4000, 250),
    banderas: contar(entries.flatMap((e) => e.qa.flags)),
    manos: rec,
  };
}
