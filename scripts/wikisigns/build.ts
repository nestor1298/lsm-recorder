/**
 * build.ts — arma el léxico LSM-Lex 1.0 desde sources.jsonl + _frames/.
 *
 * Salida en data/wikisigns-lsm/:
 *   lexicon.jsonl          una entrada completa por línea (orden por glosa)
 *   index.json             resumen ligero para buscar y listar
 *   tracks/<id>.json.gz    pista cuadro a cuadro (pose, manos, cara)
 *   stats.json             conteos y banderas de calidad
 *
 * Uso: npm run lexicon:build [-- --only-extracted]
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  buildEntry,
  type FramesFile,
  type SourcePage,
} from "../../src/lib/lexicon/derive";
import type { LexiconEntry } from "../../src/lib/lexicon/types";

const ROOT = path.resolve(__dirname, "..", "..");
const DATA = path.join(ROOT, "data", "wikisigns-lsm");
const FRAMES = path.join(DATA, "_frames");
const TRACKS = path.join(DATA, "tracks");

const onlyExtracted = process.argv.includes("--only-extracted");
const generatedAt = new Date().toISOString();

const pages: SourcePage[] = fs
  .readFileSync(path.join(DATA, "sources.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

fs.mkdirSync(TRACKS, { recursive: true });
const entries = new Map<string, LexiconEntry>();
let tracksBytes = 0;

for (const page of pages) {
  for (const video of page.videos) {
    const fp = path.join(FRAMES, `${video.youtube_id}.json`);
    const frames: FramesFile | null = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : null;
    if (!frames && onlyExtracted) continue;
    const { entry, track } = buildEntry({ page, video, frames, generatedAt });
    if (entries.has(entry.id)) continue; // mismo video en dos páginas
    entries.set(entry.id, entry);
    if (track) {
      const gz = zlib.gzipSync(JSON.stringify(track), { level: 9 });
      fs.writeFileSync(path.join(TRACKS, `${entry.id}.json.gz`), gz);
      tracksBytes += gz.length;
    }
  }
}

// Misma glosa sin letra de variante (p. ej. dos videos de AUSTRIA): se
// numeran por file_id para que la glosa identifique una sola seña.
const byGloss = new Map<string, LexiconEntry[]>();
for (const e of entries.values()) {
  if (e.variant) continue;
  byGloss.set(e.gloss, [...(byGloss.get(e.gloss) ?? []), e]);
}
for (const group of byGloss.values()) {
  if (group.length < 2) continue;
  group.sort((a, b) => (a.source.file_id ?? 0) - (b.source.file_id ?? 0));
  group.forEach((e, i) => {
    e.variant = String(i + 1);
    e.gloss = `${e.gloss}(${i + 1})`;
    e.annotation.gloss = e.gloss;
  });
}

const sorted = [...entries.values()].sort(
  (a, b) => a.gloss.localeCompare(b.gloss, "es") || a.id.localeCompare(b.id),
);

fs.writeFileSync(
  path.join(DATA, "lexicon.jsonl"),
  sorted.map((e) => JSON.stringify(e)).join("\n") + "\n",
);

const index = {
  schema: "lsm-lex-index/1.0",
  generated_at: generatedAt,
  source: "https://www.wikisigns.org/list/es/lsm",
  license: "CC BY-SA 4.0 — Wikisigns (wikisigns.org)",
  count: sorted.length,
  entries: sorted.map((e) => ({
    id: e.id,
    gloss: e.gloss,
    spanish: e.spanish,
    synonyms: e.synonyms,
    variant: e.variant,
    language: e.variety.language,
    kind: e.kind,
    youtube_id: e.source.youtube_id,
    structure: e.phonology?.structure ?? null,
    cm: e.phonology?.cm?.id ?? null,
    ub: e.phonology?.ub?.code ?? null,
    two_handed: e.phonology?.bimanual.two_handed ?? null,
    notation: e.notation,
    confidence: e.qa.confidence,
    flags: e.qa.flags,
  })),
};
fs.writeFileSync(path.join(DATA, "index.json"), JSON.stringify(index, null, 1) + "\n");

const count = (pred: (e: LexiconEntry) => boolean) => sorted.filter(pred).length;
const tally = (key: (e: LexiconEntry) => string | number | null | undefined) => {
  const m: Record<string, number> = {};
  for (const e of sorted) {
    const k = String(key(e) ?? "—");
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const flags: Record<string, number> = {};
for (const e of sorted) for (const f of e.qa.flags) flags[f] = (flags[f] ?? 0) + 1;

const stats = {
  generated_at: generatedAt,
  pages: pages.length,
  entries: sorted.length,
  with_phonology: count((e) => e.phonology !== null),
  lsm: count((e) => e.variety.is_lsm),
  two_handed: count((e) => Boolean(e.phonology?.bimanual.two_handed)),
  mean_confidence:
    Math.round((sorted.reduce((s, e) => s + e.qa.confidence, 0) / Math.max(1, sorted.length)) * 1000) / 1000,
  flags,
  by_kind: tally((e) => e.kind),
  by_structure: tally((e) => e.phonology?.structure),
  top_cm: Object.fromEntries(Object.entries(tally((e) => e.phonology?.cm?.id)).slice(0, 15)),
  top_ub: Object.fromEntries(Object.entries(tally((e) => e.phonology?.ub?.code)).slice(0, 15)),
  rnm_head: tally((e) => e.face.rnm.head),
  rnm_eyebrows: tally((e) => e.face.rnm.eyebrows),
  rnm_mouth: tally((e) => e.face.rnm.mouth),
  tracks_mb: Math.round((tracksBytes / 1e6) * 10) / 10,
};
fs.writeFileSync(path.join(DATA, "stats.json"), JSON.stringify(stats, null, 1) + "\n");
console.log(JSON.stringify(stats, null, 1));
