/**
 * publish.mjs — publica el detalle del corpus VOCES EN SEÑAS para /corpus
 * como archivos estáticos en public/corpus/e/<episodio>.json: por cada
 * enunciado, sus señas con la fonología, la glosa y las candidatas.
 *
 * El corpus vive en data/voces-en-senas/ (en git); public/corpus/ no se
 * versiona. Corre antes de `next dev` y `next build` y solo escribe lo que
 * cambió.
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const corpus = path.join(root, "data", "voces-en-senas", "corpus.jsonl");
const dst = path.join(root, "public", "corpus", "e");

if (!fs.existsSync(corpus)) {
  console.log("publish-corpus: no hay data/voces-en-senas/corpus.jsonl");
  process.exit(0);
}

const porEpisodio = new Map();
for (const line of fs.readFileSync(corpus, "utf8").split("\n")) {
  if (!line) continue;
  const r = JSON.parse(line);
  if (!porEpisodio.has(r.episodio)) porEpisodio.set(r.episodio, {});
  porEpisodio.get(r.episodio)[r.id] = r.senas;
}

fs.mkdirSync(dst, { recursive: true });
let n = 0;
for (const [ep, detalle] of porEpisodio) {
  const file = path.join(dst, `${ep}.json`);
  const text = JSON.stringify(detalle);
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) continue;
  fs.writeFileSync(file, text);
  n++;
}
console.log(`publish-corpus: ${n} episodios escritos en public/corpus/e`);
