#!/usr/bin/env python3
"""Builds the measurement's input files.

    build-inputs.py <captures dir> <sitemaps dir> <out dir>

<captures dir> holds the search arena captures of the branch proto/search-simplify
(docs/prototypes/search-arena/data/captures/*.json). <sitemaps dir> is goodwatch-webapp/public/sitemaps.

Writes into <out dir>:
- readings.json: reading text (lowercased, whitespace collapsed, as readingText() in search.server.ts) to the
  recorded pair of Jev readings. The measurement build serves these instead of a paid call.
- queries-all.json: the captured search texts, in file order.
- titles.json: movie page paths from the sitemap, shuffled with a fixed seed. Each run takes a fresh slice, so
  every title page miss has a cold data cache.

readings.json and queries-all.json hold search texts of a test set, not of visitors. They aren't committed.
"""
import glob
import json
import random
import re
import sys
import unicodedata

captures, sitemaps, out = sys.argv[1:4]


def reading_text(text):
    text = unicodedata.normalize("NFC", text).strip()
    return unicodedata.normalize("NFC", re.sub(r"\s+", " ", text).lower())


readings, queries = {}, []
for path in sorted(glob.glob(f"{captures}/*.json")):
    capture = json.load(open(path))
    raw = (capture.get("reading") or {}).get("raw")
    if not raw or len(raw) != 2:
        continue
    readings[reading_text(capture["query"])] = raw
    queries.append(capture["query"])
json.dump(readings, open(f"{out}/readings.json", "w"))
json.dump(queries, open(f"{out}/queries-all.json", "w"), ensure_ascii=False)

paths = set()
for path in sorted(glob.glob(f"{sitemaps}/sitemap_movie_detail_*.xml")):
    for loc in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", open(path).read()):
        match = re.search(r"https?://[^/]+(/movie/[^?#]+)$", loc)
        if match:
            paths.add(match.group(1))
titles = sorted(paths)
random.Random(390).shuffle(titles)
json.dump(titles[:40000], open(f"{out}/titles.json", "w"))
print(json.dumps({"readings": len(readings), "queries": len(queries), "titles": min(len(titles), 40000)}))
