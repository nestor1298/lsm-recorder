#!/usr/bin/env python3
"""Download the YouTube videos listed in sources.jsonl (360p, no audio).

Resumable: yt-dlp's --download-archive skips videos already fetched.
Videos land in data/wikisigns-lsm/_videos/<youtube_id>.mp4 (not committed).

Usage: python3 -I scripts/wikisigns/fetch_videos.py [--limit N]
"""

import argparse
import json
import os
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "wikisigns-lsm")
VIDEOS = os.path.join(DATA, "_videos")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    os.makedirs(VIDEOS, exist_ok=True)

    ids: list[str] = []
    with open(os.path.join(DATA, "sources.jsonl"), encoding="utf-8") as f:
        for line in f:
            for v in json.loads(line).get("videos", []):
                if v["youtube_id"] not in ids:
                    ids.append(v["youtube_id"])
    if args.limit:
        ids = ids[: args.limit]
    todo = [i for i in ids if not os.path.exists(os.path.join(VIDEOS, i + ".mp4"))]
    print(f"{len(ids)} videos listed, {len(todo)} to download", flush=True)
    if not todo:
        return
    batch = os.path.join(DATA, "_cache", "yt_batch.txt")
    with open(batch, "w") as f:
        f.write("\n".join(f"https://www.youtube.com/watch?v={i}" for i in todo) + "\n")
    subprocess.run([
        "yt-dlp", "--no-warnings", "--no-progress", "--ignore-errors",
        "-f", "134/bv*[height<=360][ext=mp4]/b[height<=360][ext=mp4]/b",
        "-o", os.path.join(VIDEOS, "%(id)s.%(ext)s"),
        "--download-archive", os.path.join(DATA, "_cache", "yt_archive.txt"),
        "--sleep-requests", "1", "--sleep-interval", "1", "--max-sleep-interval", "3",
        "-a", batch,
    ], check=False)


if __name__ == "__main__":
    main()
