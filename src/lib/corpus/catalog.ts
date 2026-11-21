/**
 * catalog.ts — lee el corpus VOCES EN SEÑAS de data/voces-en-senas/ en
 * el servidor. Solo corre al generar /corpus (estática): el navegador
 * recibe filas ligeras, nunca los 10 MB de corpus.jsonl.
 */

import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  episodiosNumerados,
  filasDe,
  personasDe,
  type EpisodioFila,
  type EpisodioIndice,
  type FilaEnunciado,
  type ParticipanteCorpus,
  type PersonaFila,
  type RegistroCorpus,
} from "./explorar";

const DIR = path.join(process.cwd(), "data", "voces-en-senas");
const lee = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as T;

export interface EstadisticasCorpus {
  episodios: number;
  oraciones: number;
  enunciados: number;
  con_senante: number;
  senas: number;
  con_glosa: number;
  nombres_tapados: number;
}

export interface CorpusPagina {
  programa: { nombre: string; canal: string; lista: string };
  stats: EstadisticasCorpus;
  duracion_s: number;
  episodios: EpisodioFila[];
  personas: PersonaFila[];
  filas: FilaEnunciado[];
}

export function corpusPagina(): CorpusPagina {
  const registros = fs
    .readFileSync(path.join(DIR, "corpus.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RegistroCorpus);
  const idx = lee<{ program: string; channel: string; playlist: string; episodes: EpisodioIndice[] }>("episodes.json");
  const episodios = episodiosNumerados(idx.episodes);
  return {
    programa: { nombre: idx.program, canal: idx.channel, lista: idx.playlist },
    stats: lee<EstadisticasCorpus>("stats.json"),
    duracion_s: idx.episodes.reduce((s, e) => s + e.duration_s, 0),
    episodios,
    personas: personasDe(lee<{ participantes: ParticipanteCorpus[] }>("participantes.json").participantes),
    filas: filasDe(registros, episodios),
  };
}
