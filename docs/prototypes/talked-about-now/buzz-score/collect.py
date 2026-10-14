#!/usr/bin/env python3
"""Throwaway #543 collector. SELECT-only Crate; public GETs; local files only.

Run: python collect.py --env /path/to/goodwatch-webapp/.env
Reuses local responses. Delete data/ to collect a fresh independent snapshot.
"""
import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import time
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
UA = "GoodWatchResearch/1.0 (https://goodwatch.app; hello@goodwatch.app) issue-543-buzz-prototype"
HTTP = requests.Session()
HTTP.headers.update({"User-Agent": UA})


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def get(url, http=None, **kwargs):
    # Sequential requests; >=0.5 s AFTER each Wikimedia response (<120/min).
    for attempt in range(4):
        response = (http or HTTP).get(url, timeout=100, **kwargs)
        time.sleep(0.5)
        if response.status_code not in (429, 500, 502, 503, 504):
            return response
        delay = response.headers.get("Retry-After", "")
        try:
            wait = float(delay)
        except ValueError:
            from email.utils import parsedate_to_datetime
            wait = max(0, (parsedate_to_datetime(delay) - dt.datetime.now(dt.timezone.utc)).total_seconds()) if delay else 30 * (attempt + 1)
        print(f"HTTP {response.status_code}; waiting {wait:.0f}s", flush=True)
        time.sleep(wait)
    response.raise_for_status()


def sql(statement, args=None):
    if not statement.lstrip().upper().startswith("SELECT ") or ";" in statement:
        raise ValueError("Only a single SELECT is allowed")
    response = HTTP.post("http://10.0.0.11:4200/_sql", json={"stmt": statement, "args": args or []}, timeout=60)
    response.raise_for_status()
    payload = response.json()
    return [dict(zip(payload["cols"], row)) for row in payload["rows"]]


def catalog():
    path = DATA / "catalog.json"
    if path.exists():
        return json.loads(path.read_text())
    titles = []
    for kind, table, date in (("movie", "movie", "release_date"), ("tv", '"show"', "first_air_date")):
        rows = sql(f"SELECT tmdb_id, title, original_title, popularity, {date} AS release_date FROM doc.{table} WHERE popularity IS NOT NULL ORDER BY popularity DESC, tmdb_id ASC LIMIT 500")
        titles.extend(dict(row, kind=kind, key=f"{kind}:{row['tmdb_id']}") for row in rows)
    titles.sort(key=lambda row: (-row["popularity"], row["key"]))
    titles = titles[:500]  # Shared popularity scale, not an arbitrary 250/250 quota.
    save(path, titles)
    save(DATA / "catalog-provenance.json", {"retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(), "source": "production Crate SELECT", "selection": "500 highest combined catalog popularity; fetch first 500 of each type, merge, take 500"})
    save(DATA / "history-schema.json", sql("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = ? AND (column_name LIKE ? OR table_name LIKE ? OR table_name LIKE ?)", ["doc", "%popularity%", "%history%", "%trend%"]))
    print(f"Catalog: {len(titles)} titles", flush=True)
    return titles


def wikidata(titles):
    for kind, prop in (("movie", "P4947"), ("tv", "P4983")):
        path = DATA / f"wikidata-{kind}.json"
        if path.exists():
            continue
        ids = " ".join(f'"{t["tmdb_id"]}"' for t in titles if t["kind"] == kind)
        query = f'''SELECT ?tmdb ?item ?article WHERE {{
          VALUES ?tmdb {{ {ids} }}
          ?item wdt:{prop} ?tmdb .
          OPTIONAL {{ ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> . }}
        }}'''
        response = get("https://query.wikidata.org/sparql", params={"query": query, "format": "json"}, headers={"Accept": "application/sparql-results+json"})
        response.raise_for_status()
        payload = response.json()  # Reject HTTP 200 truncated JSON.
        save(path, {"query": query, "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(), "bindings": payload["results"]["bindings"]})
        print(f"Wikidata {kind}: {len(payload['results']['bindings'])} matches", flush=True)
        # Respect WDQS processing budget; never overlap exports.
        time.sleep(60)
    matches = {}
    for kind in ("movie", "tv"):
        for row in json.loads((DATA / f"wikidata-{kind}.json").read_text())["bindings"]:
            key = f"{kind}:{row['tmdb']['value']}"
            matches.setdefault(key, []).append({"qid": row["item"]["value"].rsplit("/", 1)[-1], "url": row.get("article", {}).get("value")})
    for t in titles:
        candidates = matches.get(t["key"], [])
        t["wikidata_candidates"] = candidates
        urls = {c["url"] for c in candidates if c["url"]}
        t["article_url"] = next(iter(urls)) if len(urls) == 1 else None
        t["mapping_status"] = "matched" if len(urls) == 1 else "ambiguous" if urls else "no-enwiki"
    save(DATA / "titles.json", titles)


def tmdb(env_path):
    path = DATA / "tmdb-snapshot.json"
    if path.exists():
        return
    env = {}
    if env_path:
        for line in Path(env_path).read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    key = os.environ.get("TMDB_API_KEY") or env.get("TMDB_API_KEY")
    if not key:
        raise RuntimeError("TMDB_API_KEY required; never print the env file")
    payload = {"retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(), "lists": {}}
    for kind in ("movie", "tv"):
        for window in ("day", "week"):
            results = []
            for page in range(1, 6):
                try:
                    response = get(f"https://api.themoviedb.org/3/trending/{kind}/{window}", params={"api_key": key, "page": page})
                except requests.RequestException as exc:
                    raise RuntimeError(f"TMDB transport failed: {type(exc).__name__}") from None
                if not response.ok:
                    raise RuntimeError(f"TMDB HTTP {response.status_code}")  # Don't expose authenticated URL.
                results.extend(response.json()["results"])
            payload["lists"][f"{kind}/{window}"] = results
    payload["retrieved_through"] = dt.datetime.now(dt.timezone.utc).isoformat()
    payload["pagination"] = "first five pages per kind/window; preserve duplicates for audit; ranking uses first observed occurrence"
    save(path, payload)
    print("TMDB: current day/week snapshots only", flush=True)


def netflix():
    path = DATA / "netflix-global.tsv"
    if not path.exists():
        response = get("https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv")
        response.raise_for_status()
        path.write_bytes(response.content)
        save(DATA / "netflix-provenance.json", {"retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(), "sha256": hashlib.sha256(response.content).hexdigest(), "url": response.url})
    rows = list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8-sig")), delimiter="\t"))
    print(f"Netflix: {len(rows)} rows, latest week {max(r['week'] for r in rows)}", flush=True)


def pageviews(titles, end):
    start = end - dt.timedelta(days=59)
    for index, t in enumerate(titles):
        if not t["article_url"]:
            continue
        path = DATA / "pageviews" / f"{t['key'].replace(':', '-')}.json"
        if path.exists():
            continue
        from urllib.parse import unquote
        article = unquote(t["article_url"].split("/wiki/", 1)[-1])
        url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/{quote(article, safe='')}/daily/{start:%Y%m%d}00/{end:%Y%m%d}00"
        response = get(url)
        payload = response.json()
        save(path, {"url": url, "status": response.status_code, "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(), "payload": payload})
        if index % 20 == 0:
            print(f"Pageviews {index+1}/500: {t['title']} HTTP {response.status_code}", flush=True)
    save(DATA / "collection.json", {"start": start.isoformat(), "end": end.isoformat(), "user_agent": UA, "wiki_pause_after_response_seconds": 0.5, "catalog_selection": "top 500 combined movies/shows by catalog TMDB popularity at collection time", "production_operations": "Crate SELECT only; no application server or cache access"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env")
    parser.add_argument("--end", default=(dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)).isoformat())
    args = parser.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    plan_path = DATA / "collection-plan.json"
    if plan_path.exists() and json.loads(plan_path.read_text())["end"] != args.end:
        raise RuntimeError("Existing local capture uses another window; move data/ aside before collecting a fresh snapshot")
    save(plan_path, {"start": (dt.date.fromisoformat(args.end) - dt.timedelta(days=59)).isoformat(), "end": args.end})
    titles = catalog()
    tmdb(args.env)
    netflix()
    wikidata(titles)
    pageviews(titles, dt.date.fromisoformat(args.end))
