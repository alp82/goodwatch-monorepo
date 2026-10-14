#!/usr/bin/env python3
"""Extract this spike's 500 IDs from 60 dated TMDB public daily exports.

Popularity history is NOT trending history. Store selected rows plus hashes;
discard the large full-catalog downloads. Four bounded workers, resumable, local-only.
Run after collect.py has created catalog.json: python tmdb_history.py
"""
import datetime as dt
import gzip
import hashlib
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor
import requests

from collect import DATA, UA, get, save


def capture_export(task):
    day, kind, prefix, wanted = task
    path = DATA / "tmdb-history" / f"{day}-{kind}.json"
    if path.exists():
        return
    url = f"https://files.tmdb.org/p/exports/{prefix}_ids_{day:%m_%d_%Y}.json.gz"
    with requests.Session() as http:
        http.headers.update({"User-Agent": UA})
        response = get(url, http=http)
    payload = {"date": day.isoformat(), "kind": kind, "url": url, "status": response.status_code, "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(), "rows": []}
    if response.ok:
        payload["sha256_gzip"] = hashlib.sha256(response.content).hexdigest()
        count = 0
        id_pattern = re.compile(rb'"id"\s*:\s*(\d+)')
        for line in gzip.GzipFile(fileobj=io.BytesIO(response.content)):
            count += 1
            match = id_pattern.search(line)
            if match and int(match[1]) in wanted:
                payload["rows"].append(json.loads(line))
        payload["source_row_count"] = count
        payload["missing_ids"] = sorted(wanted - {r["id"] for r in payload["rows"]})
    save(path, payload)
    print(f"TMDB export {day} {kind}: HTTP {response.status_code}, {len(payload['rows'])}/{len(wanted)} selected", flush=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--end", default="2026-10-13")
    args = parser.parse_args()
    end = dt.date.fromisoformat(args.end)
    titles = json.loads((DATA / "catalog.json").read_text())
    tasks = []
    for offset in range(59, -1, -1):
        day = end - dt.timedelta(days=offset)
        for kind, prefix in (("movie", "movie"), ("tv", "tv_series")):
            wanted = {t["tmdb_id"] for t in titles if t["kind"] == kind}
            tasks.append((day, kind, prefix, wanted))
    # TMDB CDN only: max four simultaneous downloads; Wikimedia/WDQS remain sequential.
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(capture_export, tasks))
