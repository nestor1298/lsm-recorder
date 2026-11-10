#!/bin/zsh
# Corre todo el léxico de punta a punta y se reanuda donde se quedó:
# índice (crawl.py, ~7 h por el Crawl-delay) → videos → cuadros → build.
# Mientras el índice avanza, baja y extrae lo nuevo cada 2 minutos.
#
# Uso: nohup scripts/wikisigns/pipeline.sh > data/wikisigns-lsm/_cache/pipeline.log 2>&1 &
set -u
cd "$(dirname "$0")/../.."
DATA=data/wikisigns-lsm
PY=.venv-lexicon/bin/python
mkdir -p $DATA/_cache

if ! pgrep -f "wikisigns/crawl.py" > /dev/null; then
  python3 -I scripts/wikisigns/crawl.py >> $DATA/_cache/crawl.log 2>&1 &
fi

pass() {
  python3 -I scripts/wikisigns/fetch_videos.py >> $DATA/_cache/fetch.log 2>&1
  $PY -I scripts/wikisigns/extract.py 2>&1 | grep -vE "^(W0000|I0000|INFO|WARNING)" >> $DATA/_cache/extract.log
}

while pgrep -f "wikisigns/crawl.py" > /dev/null; do
  pass
  echo "$(date -u +%FT%TZ) páginas=$(wc -l < $DATA/sources.jsonl) videos=$(ls $DATA/_videos | wc -l) cuadros=$(ls $DATA/_frames | wc -l)"
  sleep 120
done

# último pase (y uno más para reintentar fallas de red de YouTube)
pass
pass
echo "$(date -u +%FT%TZ) índice completo; armando el léxico"
node scripts/wikisigns/run-build.mjs > $DATA/_cache/build.log 2>&1
echo "$(date -u +%FT%TZ) listo: $(wc -l < $DATA/lexicon.jsonl) entradas"
