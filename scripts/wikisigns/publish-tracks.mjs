/**
 * publish-tracks.mjs — publica el léxico para el navegador de /lexico
 * como archivos estáticos en public/lexico/:
 *
 *   e/<id>.json            la ficha de cada seña (sin facemarks crudos)
 *   tracks/<id>.json.gz    su pista cuadro a cuadro
 *
 * La base de datos vive en data/wikisigns-lsm/ (en git); public/lexico/
 * no se versiona. Corre antes de `next dev` y `next build` y solo
 * escribe lo que falta o cambió. Las fichas van como archivos y no como
 * páginas generadas para no inflar el paquete del servidor (~180 MB).
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const src = path.join(root, "data", "wikisigns-lsm", "tracks");
const dst = path.join(root, "public", "lexico", "tracks");
const fichas = path.join(root, "public", "lexico", "e");
const lexicon = path.join(root, "data", "wikisigns-lsm", "lexicon.jsonl");

/** Escribe solo si cambió, para no tocar fechas en cada arranque */
function escribe(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return false;
  fs.writeFileSync(file, text);
  return true;
}

if (fs.existsSync(lexicon)) {
  fs.mkdirSync(fichas, { recursive: true });
  let n = 0;
  for (const line of fs.readFileSync(lexicon, "utf8").split("\n")) {
    if (!line) continue;
    const e = JSON.parse(line);
    e.face = { ...e.face, facemarks_core: null };
    if (escribe(path.join(fichas, `${e.id}.json`), JSON.stringify(e))) n++;
  }
  console.log(`publish-tracks: ${n} fichas escritas en public/lexico/e`);
}

if (!fs.existsSync(src)) {
  console.log("publish-tracks: no hay pistas en data/wikisigns-lsm/tracks");
  process.exit(0);
}
fs.mkdirSync(dst, { recursive: true });
let copied = 0;
for (const name of fs.readdirSync(src)) {
  if (!name.endsWith(".json.gz")) continue;
  const a = path.join(src, name);
  const b = path.join(dst, name);
  if (fs.existsSync(b) && fs.statSync(b).size === fs.statSync(a).size) continue;
  fs.copyFileSync(a, b);
  copied++;
}
console.log(`publish-tracks: ${copied} pistas copiadas a public/lexico/tracks`);
