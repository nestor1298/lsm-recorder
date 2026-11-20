/**
 * Arma el corpus VOCES EN SEÑAS (LSM-Corpus 1.0) a partir de:
 *   _cache/subtitulos/<id>.json  oraciones y tarjetas (OCR)
 *   _cache/personas/<id>.json    tomas y pistas de cara con su persona
 *   _frames/<id>.json            pose, manos y gestos por persona
 *   participantes.json           seudónimos y roles
 *   ../wikisigns-lsm/lexicon.jsonl  el léxico, para transliterar
 *
 * Escribe corpus.jsonl (un enunciado por línea), participantes.json (con su
 * caracterización) y stats.json.
 * Uso: node scripts/voces/run-build.mjs
 */

import fs from "node:fs";
import path from "node:path";
import type { RawFrame } from "@/lib/lexicon/derive";
import type { LexiconEntry } from "@/lib/lexicon/types";
import {
  actividad,
  asignar,
  candidatos,
  descriptor,
  estimarDesfase,
  fonologia,
  glosaDe,
  juntarRepetidas,
  ladoDominante,
  raicesDe,
  segmentar,
  seriesPorPersona,
  type Actividad,
  type FramesVoces,
  type LexRef,
  type OracionOCR,
  type Tarjeta,
} from "@/lib/corpus/voces";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const DATA = path.join(ROOT, "data", "voces-en-senas");
const CACHE = path.join(DATA, "_cache");
/** para pruebas: otra carpeta de cuadros y otra de salida */
const FRAMES = process.env.VOCES_FRAMES_DIR ?? path.join(DATA, "_frames");
const SALIDA = process.env.VOCES_SALIDA_DIR ?? DATA;
const leer = <T>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

interface Pista {
  toma: number;
  t0: number;
  t1: number;
  persona: string | null;
}
interface Toma {
  t0: number;
  t1: number;
  tipo: string;
}
interface Participante {
  id: string;
  seudonimo: string;
  rol: string | null;
  condicion: string | null;
  condicion_fuente: string | null;
  en_pantalla_s: number;
  episodios: Record<string, { en_pantalla_s: number; rol: string | null }>;
  caracterizacion?: unknown;
}

// ── léxico ──
const lexico: LexRef[] = fs
  .readFileSync(path.join(ROOT, "data", "wikisigns-lsm", "lexicon.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as LexiconEntry)
  .filter((e) => e.phonology && e.variety.is_lsm)
  .map((e) => ({
    id: e.id,
    gloss: e.gloss,
    spanish: e.spanish,
    synonyms: e.synonyms,
    cm: e.phonology!.cm?.id ?? null,
    ub: e.phonology!.ub?.code ?? null,
    two_handed: e.phonology!.bimanual.two_handed,
    contour: e.phonology!.mov?.contour ?? null,
    palm: e.phonology!.or.palm ?? null,
    fingers: e.phonology!.or.fingers ?? null,
  }));

const part = leer<{ nota: string; participantes: Participante[] }>(path.join(DATA, "participantes.json"));
const porId = new Map(part.participantes.map((p) => [p.id, p]));
const ids = fs
  .readdirSync(FRAMES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5));

// acumulados por persona para caracterizarla
interface Acum {
  ladoVotos: Record<string, number>;
  senaS: number;
  senas: number;
  dos: number;
  ub: Record<string, number>;
  cm: Record<string, number>;
  contorno: Record<string, number>;
  xs: number[];
  ys: number[];
  boca: number[];
  cejas: number[];
  giro: number[];
  cabeceo: number[];
  primerPlanoS: number;
  enunciados: number;
}
const acum = new Map<string, Acum>();
const nuevo = (): Acum => ({
  ladoVotos: {}, senaS: 0, senas: 0, dos: 0, ub: {}, cm: {}, contorno: {}, xs: [], ys: [], boca: [], cejas: [],
  giro: [], cabeceo: [], primerPlanoS: 0, enunciados: 0,
});
const suma = (o: Record<string, number>, k: string | null | undefined, v = 1) => {
  if (k) o[k] = (o[k] ?? 0) + v;
};

const lineas: string[] = [];
const stats = { episodios: 0, oraciones: 0, enunciados: 0, con_senante: 0, senas: 0, con_glosa: 0, glosa_en_oracion: 0, desfases: {} as Record<string, number> };

for (const vid of ids) {
  const fr = leer<FramesVoces>(path.join(FRAMES, vid + ".json"));
  const sub = leer<{ tarjetas: Tarjeta[]; oraciones: OracionOCR[] }>(path.join(CACHE, "subtitulos", vid + ".json"));
  const per = leer<{ tomas: Toma[]; pistas: Pista[] }>(path.join(CACHE, "personas", vid + ".json"));
  const W = fr.video.width;
  const H = fr.video.height;
  const series = seriesPorPersona(fr, (c) => (c.pista !== null && per.pistas[c.pista] ? per.pistas[c.pista].persona : c.persona));
  const acts = new Map<string, Actividad>([...series].map(([p, s]) => [p, actividad(s, W, H)]));
  const desfase = estimarDesfase(sub.oraciones, [...acts.values()]);
  const lado = new Map([...series].map(([p, s]) => [p, ladoDominante(s)]));
  const enunciados = asignar(sub.oraciones, sub.tarjetas, acts, desfase);
  stats.episodios++;
  stats.oraciones += sub.oraciones.length;
  stats.desfases[vid] = desfase;

  enunciados.forEach((u, n) => {
    stats.enunciados++;
    const persona = u.persona ? porId.get(u.persona) : undefined;
    const reg: Record<string, unknown> = {
      id: `VES-${vid}-${String(n + 1).padStart(4, "0")}`,
      episodio: vid,
      oracion: { texto: u.texto, t0: r2(u.t0), t1: r2(u.t1) },
      senante: persona ? { id: persona.id, seudonimo: persona.seudonimo, rol: persona.episodios[vid]?.rol ?? persona.rol } : null,
      sena: u.sena ? { t0: r2(u.sena.t0), t1: r2(u.sena.t1), desfase_s: desfase } : null,
      senas: [],
      transliteracion: null,
    };
    if (u.persona && u.sena) {
      stats.con_senante++;
      const serie = series.get(u.persona) ?? [];
      const ventana = serie.filter((f) => f.t / 1000 >= u.sena!.t0 && f.t / 1000 <= u.sena!.t1);
      const side = lado.get(u.persona) ?? "left";
      const tramos = segmentar(ventana, side, W, H);
      const raices = raicesDe(u.texto);
      const a = acum.get(u.persona) ?? nuevo();
      acum.set(u.persona, a);
      a.enunciados++;
      a.senaS += u.sena.t1 - u.sena.t0;
      suma(a.ladoVotos, side);
      // toma en la que se ve a la persona señando
      const pp = per.tomas.filter((t) => t.tipo === "primer_plano")
        .reduce((s, t) => s + Math.max(0, Math.min(t.t1, u.sena!.t1) - Math.max(t.t0, u.sena!.t0)), 0);
      a.primerPlanoS += pp;
      reg.toma_primer_plano = r2(pp / Math.max(0.01, u.sena.t1 - u.sena.t0));
      const senas = tramos.map((tr, i) => {
        const frames: RawFrame[] = ventana.slice(Math.max(0, tr.i0 - 1), tr.i1 + 2);
        const fon = fonologia(frames, side);
        const cands = candidatos(fon, lexico, raices);
        const glosa = glosaDe(cands);
        stats.senas++;
        if (glosa) stats.con_glosa++;
        if (glosa && cands.find((c) => c.glosa === glosa)?.en_oracion) stats.glosa_en_oracion++;
        a.senas++;
        if (fon.dos_manos) a.dos++;
        suma(a.ub, fon.ub);
        suma(a.cm, fon.cm[0] ? String(fon.cm[0].id) : null);
        suma(a.contorno, fon.contorno ?? "QUIETA");
        return {
          i: i + 1,
          t0: r2(ventana[tr.i0].t / 1000),
          t1: r2(ventana[tr.i1].t / 1000),
          fonologia: fon,
          glosa,
          candidatos: cands,
          token: glosa ?? descriptor(fon),
        };
      });
      reg.senas = senas;
      reg.transliteracion = juntarRepetidas(senas.map((s) => s.token)).join(" ") || null;
      // espacio de señado y cara, en este tramo
      for (const f of ventana) {
        const p = f.pose;
        if (!p) continue;
        const sw = Math.hypot((p[11][0] - p[12][0]) * W, (p[11][1] - p[12][1]) * H);
        if (sw < 5) continue;
        const mx = ((p[11][0] + p[12][0]) / 2) * W;
        const my = ((p[11][1] + p[12][1]) / 2) * H;
        for (const h of f.hands) {
          const cx = ([0, 5, 9, 13, 17].reduce((s, i) => s + h[i][0], 0) / 5) * W;
          const cy = ([0, 5, 9, 13, 17].reduce((s, i) => s + h[i][1], 0) / 5) * H;
          a.xs.push((cx - mx) / sw);
          a.ys.push(-(cy - my) / sw);
        }
        if (f.blendshapes) {
          a.boca.push(f.blendshapes.jawOpen ?? 0);
          a.cejas.push(Math.max(f.blendshapes.browInnerUp ?? 0, f.blendshapes.browDownLeft ?? 0, f.blendshapes.browDownRight ?? 0));
        }
        if (f.head) {
          a.cabeceo.push(f.head[0]);
          a.giro.push(f.head[1]);
        }
      }
    }
    lineas.push(JSON.stringify(reg));
  });
}

// ── caracterización de cada persona ──
const pct = (v: number[], q: number) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};
const desv = (v: number[]) => {
  if (v.length < 2) return 0;
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
};
const top = (o: Record<string, number>, n = 3) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ clave: k, n: v }));

for (const p of part.participantes) {
  const a = acum.get(p.id);
  if (!a) {
    p.caracterizacion = null;
    continue;
  }
  const lado = (a.ladoVotos.left ?? 0) >= (a.ladoVotos.right ?? 0) ? "left" : "right";
  p.caracterizacion = {
    fuente: "automática (visión por computadora); sin rasgos físicos ni demográficos",
    mano_dominante: lado === "left" ? "derecha" : "izquierda",
    enunciados: a.enunciados,
    minutos_senando: r2(a.senaS / 60),
    senas: a.senas,
    senas_por_segundo: r2(a.senas / Math.max(1, a.senaS)),
    dos_manos: r3(a.dos / Math.max(1, a.senas)),
    espacio_de_senado: {
      unidades: "anchos de hombro; origen entre los hombros, y hacia arriba",
      ancho: r2(pct(a.xs, 0.95) - pct(a.xs, 0.05)),
      alto: r2(pct(a.ys, 0.95) - pct(a.ys, 0.05)),
      centro: { x: r2(pct(a.xs, 0.5)), y: r2(pct(a.ys, 0.5)) },
    },
    lugares: top(a.ub),
    formas: top(a.cm),
    contornos: top(a.contorno),
    cara: {
      boca_abierta_p90: r3(pct(a.boca, 0.9)),
      cejas_p90: r3(pct(a.cejas, 0.9)),
      cabeza_movimiento_grados: { giro: r2(desv(a.giro)), cabeceo: r2(desv(a.cabeceo)) },
    },
    en_primer_plano: r3(a.primerPlanoS / Math.max(1, a.senaS)),
  };
}

fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(path.join(SALIDA, "corpus.jsonl"), lineas.join("\n") + "\n");
fs.writeFileSync(path.join(SALIDA, "participantes.json"), JSON.stringify(part, null, 1) + "\n");
fs.writeFileSync(
  path.join(SALIDA, "stats.json"),
  JSON.stringify({ generado: new Date().toISOString(), schema: "lsm-corpus/1.0", lexico_senas: lexico.length, ...stats }, null, 1) + "\n",
);
console.log(JSON.stringify(stats, null, 1));
