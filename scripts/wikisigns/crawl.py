#!/usr/bin/env python3
"""Crawl the Wikisigns LSM dictionary into a source index.

Wikisigns (https://www.wikisigns.org/list/es/lsm, CC BY-SA 4.0) lists each
sign as a page with a Spanish gloss and one or more YouTube videos. No
phonology is written on the site: this script only collects the index
(gloss, page URL, video ids). Phonology comes from the videos later
(extract.py → build.ts).

- Respects robots.txt (Crawl-delay: 10).
- Resumable: every fetched page is cached in _cache/ and skipped next run.
- Output: data/wikisigns-lsm/sources.jsonl, one line per page (slug).

Usage: python3 -I scripts/wikisigns/crawl.py [--limit N]
"""

import argparse
import html
import json
import os
import re
import socket
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://www.wikisigns.org"
LIST = BASE + "/list/es/lsm"
DELAY_S = 10.0  # robots.txt Crawl-delay
UA = "SignaLab-lexicon-crawler/1.0 (research; respects Crawl-delay)"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "data", "wikisigns-lsm")
CACHE = os.path.join(OUT_DIR, "_cache", "pages")
SOURCES = os.path.join(OUT_DIR, "sources.jsonl")

_last_fetch = 0.0

# The site's IPv6 address accepts no connections (SYN never answered), so
# every request stalled before falling back. Resolve IPv4 only.
_getaddrinfo = socket.getaddrinfo
socket.getaddrinfo = lambda host, *a, **k: [  # type: ignore[assignment]
    r for r in _getaddrinfo(host, *a, **k) if r[0] == socket.AF_INET
] or _getaddrinfo(host, *a, **k)


def fetch(url: str, cache_name: str) -> str:
    """GET with on-disk cache and the site's crawl delay."""
    global _last_fetch
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    wait = DELAY_S - (time.time() - _last_fetch)
    if wait > 0:
        time.sleep(wait)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("utf-8", "replace")
            break
        except Exception as e:  # network hiccup: back off, keep the delay
            print(f"  retry {attempt + 1} {url}: {e}", file=sys.stderr)
            time.sleep(DELAY_S * (attempt + 2))
    else:
        raise RuntimeError(f"failed: {url}")
    _last_fetch = time.time()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(body)
    os.replace(tmp, path)
    return body


def cache_key(slug_path: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", urllib.parse.unquote(slug_path))[:180] + ".html"


def list_slugs() -> list[str]:
    """All /es/lsm/<slug> links from the paginated list table, in order."""
    slugs: list[str] = []
    page = 0
    while True:
        url = LIST if page == 0 else f"{LIST}?page={page}"
        h = fetch(url, f"_list_{page}.html")
        table = h[h.find("<table"): h.rfind("</table>")]
        slugs += re.findall(r'<a href="(/es/lsm/[^"]+)">', table)
        if f'href="/list/es/lsm?page={page + 1}"' not in h:
            break
        page += 1
    seen, out = set(), []
    for s in slugs:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


ROW_RE = re.compile(r'<div class="views-row[^"]*">(.*?)(?=<div class="views-row|\Z)', re.S)


def parse_page(h: str) -> list[dict]:
    """Videos in the page's 'videosigns' pane (one row per video)."""
    i = h.find("pane-videosigns-es-lsm")
    if i < 0:
        return []
    pane = h[i: h.find("panel-col-last", i)]
    videos = []
    for row in ROW_RE.findall(pane):
        yt = re.search(r"youtube\.com/embed/([A-Za-z0-9_-]{11})", row)
        if not yt:
            continue
        title = re.search(r"<h1>(.*?)</h1>", row, re.S)
        file_id = re.search(r'id="file-(\d+)"', row)
        vtitle = re.search(r'<a href="/file/\d+">(.*?)</a>', row, re.S)
        avg = re.search(r'average-rating">Average: <span >([\d.]+)', row)
        votes = re.search(r'total-votes">\(<span >(\d+)', row)
        node = re.search(r'<a href="(/lengua-de-se%C3%B1as-mexicana/(\d+))">', row)
        vt = re.sub(r"\s+", " ", html.unescape(vtitle.group(1))).strip() if vtitle else None
        num = re.search(r"(\d+)\s*$", vt or "")
        videos.append({
            "title": html.unescape(title.group(1)).strip() if title else None,
            "youtube_id": yt.group(1),
            "file_id": int(file_id.group(1)) if file_id else None,
            "video_title": vt,
            "wikisigns_number": int(num.group(1)) if num else None,
            "node_id": int(node.group(2)) if node else None,
            "node_url": BASE + node.group(1) if node else None,
            "rating_avg": float(avg.group(1)) if avg else None,
            "rating_votes": int(votes.group(1)) if votes else None,
        })
    return videos


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)

    done = set()
    if os.path.exists(SOURCES):
        with open(SOURCES, encoding="utf-8") as f:
            done = {json.loads(l)["slug_path"] for l in f if l.strip()}

    slugs = list_slugs()
    if args.limit:
        slugs = slugs[: args.limit]
    todo = [s for s in slugs if s not in done]
    print(f"{len(slugs)} pages in list, {len(done)} done, {len(todo)} to fetch", flush=True)

    with open(SOURCES, "a", encoding="utf-8") as out:
        for n, s in enumerate(todo, 1):
            url = BASE + s
            try:
                videos = parse_page(fetch(url, cache_key(s)))
                err = None
            except Exception as e:
                videos, err = [], str(e)
            rec = {
                "slug_path": s,
                "label": urllib.parse.unquote(s[len("/es/lsm/"):]),
                "url": url,
                "videos": videos,
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            if err:
                rec["error"] = err
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out.flush()
            if n % 25 == 0 or n == len(todo):
                print(f"[{n}/{len(todo)}] {rec['label']} → {len(videos)} video(s)", flush=True)


if __name__ == "__main__":
    main()
