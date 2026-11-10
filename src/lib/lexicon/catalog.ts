/**
 * catalog.ts — lee el léxico de data/wikisigns-lsm/ en el servidor.
 *
 * Solo corre al generar /lexico (estática): el navegador recibe filas
 * ligeras, nunca los 16 MB de lexicon.jsonl. La ficha de cada seña se
 * publica aparte como public/lexico/e/<id>.json (publish-tracks.mjs).
 */

import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { LexiconEntry } from "./types";

const LEXICON = path.join(process.cwd(), "data", "wikisigns-lsm", "lexicon.jsonl");

let cache: LexiconEntry[] | null = null;

export function allEntries(): LexiconEntry[] {
  if (!cache) {
    cache = fs
      .readFileSync(LEXICON, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LexiconEntry);
  }
  return cache;
}

/** Fila de la lista: lo justo para buscar, filtrar y pintar */
export interface LexiconRow {
  id: string;
  gloss: string;
  spanish: string;
  synonyms: string[];
  language: string;
  region: string | null;
  is_lsm: boolean;
  kind: LexiconEntry["kind"];
  has_phonology: boolean;
  cm: number | null;
  ub: string | null;
  ub_region: string | null;
  two_handed: boolean;
  confidence: number;
}

export function lexiconRows(): LexiconRow[] {
  return allEntries().map((e) => ({
    id: e.id,
    gloss: e.gloss,
    spanish: e.spanish,
    synonyms: e.synonyms,
    language: e.variety.language,
    region: e.variety.region,
    is_lsm: e.variety.is_lsm,
    kind: e.kind,
    has_phonology: e.phonology !== null,
    cm: e.phonology?.cm?.id ?? null,
    ub: e.phonology?.ub?.code ?? null,
    ub_region: e.phonology?.ub?.region ?? null,
    two_handed: Boolean(e.phonology?.bimanual.two_handed),
    confidence: e.qa.confidence,
  }));
}
