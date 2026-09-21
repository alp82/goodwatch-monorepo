#!/usr/bin/env python3
"""Read-only snapshot of the approved >=200k cohort and targeted existing-page audit.

Run from the repository root. Uses goodwatch-webapp/.env for read-only Crate
queries and the existing goodwatch Windmill CLI profile for Mongo credentials.
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone

import requests
from pathlib import Path
from urllib.parse import urlsplit, quote
from collections import defaultdict
from dotenv import dotenv_values
from pymongo import MongoClient

sys.path.insert(0, "goodwatch-flows/windmill")
from f.tvtropes_web.title_variations import title_variations

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
args = parser.parse_args()
out = args.output
out.mkdir(parents=True, exist_ok=True)
if (out / "cohort.json").exists():
    raise SystemExit(
        "Use a new output directory to preserve the earlier cohort and evidence"
    )
c = dotenv_values("goodwatch-webapp/.env")
h = c["CRATE_HOSTS"].split(",")[0].strip()
h = h if "://" in h else "http://" + h
if urlsplit(h).port is None:
    h += ":" + c.get("CRATE_PORT", "4200")


def query(sql, args=None):
    r = requests.post(
        h + "/_sql",
        auth=(c.get("CRATE_USER", "crate"), c.get("CRATE_PASS", "")),
        json={"stmt": sql, "args": args or []},
        timeout=60,
    )
    r.raise_for_status()
    d = r.json()
    return [dict(zip(d["cols"], row)) for row in d["rows"]]


profile = next(
    json.loads(l)
    for l in (Path.home() / ".config/windmill/remotes.ndjson").read_text().splitlines()
    if json.loads(l)["name"] == "goodwatch"
)


def variable(name):
    r = requests.get(
        profile["remote"].rstrip("/")
        + "/api/w/"
        + profile["workspaceId"]
        + "/variables/get_value/u/Alp/"
        + name,
        headers={"Authorization": "Bearer " + profile["token"]},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


m = {k: variable("MONGODB_" + k) for k in ["USER", "PASS", "HOSTS", "DB", "RS"]}
client = MongoClient(
    "mongodb://"
    + quote(m["USER"], safe="")
    + ":"
    + quote(m["PASS"], safe="")
    + "@"
    + m["HOSTS"]
    + "/"
    + m["DB"]
    + "?replicaSet="
    + m["RS"],
    serverSelectionTimeoutMS=20000,
)
db = client[m["DB"]]
cohort = []
audit = []
totals = {}
all_rows = []
source_index = {}
for media, collection in [
    ("movie", "tv_tropes_movie_tags"),
    ("show", "tv_tropes_tv_tags"),
]:
    rows = query(
        f'SELECT tmdb_id, title, original_title, release_year, goodwatch_overall_score_voting_count AS votes, array_length(tropes, 1) AS before_trope_count FROM "{media}" WHERE goodwatch_overall_score_voting_count >= 200000 ORDER BY goodwatch_overall_score_voting_count DESC, tmdb_id'
    )
    sources = list(
        db[collection].aggregate(
            [
                {"$match": {"tmdb_id": {"$in": [r["tmdb_id"] for r in rows]}}},
                {
                    "$project": {
                        "_id": 0,
                        "tmdb_id": 1,
                        "original_title": 1,
                        "title_variations": 1,
                        "release_year": 1,
                        "tvtropes_url": 1,
                        "updated_at": 1,
                        "failed_at": 1,
                        "error_message": 1,
                        "source_trope_count": {"$size": {"$ifNull": ["$tropes", []]}},
                    }
                },
            ]
        )
    )
    source_by_id = {r["tmdb_id"]: r for r in sources}
    for row in rows:
        source = source_by_id.get(row["tmdb_id"], {})
        source_index[(media, row["tmdb_id"])] = source
        row.update(
            media_type=media,
            before_url=source.get("tvtropes_url"),
            source_trope_count=source.get("source_trope_count", 0),
            source_release_year=source.get("release_year"),
            title_variations=title_variations(
                [
                    row["title"],
                    row["original_title"],
                    *source.get("title_variations", []),
                ]
            ),
        )
        all_rows.append(row)
        if not row["before_trope_count"]:
            cohort.append(row)
    totals[media] = {
        "total": len(rows),
        "missing": sum(not r["before_trope_count"] for r in rows),
    }
urls = defaultdict(list)
for row in all_rows:
    if row["before_url"] and row["before_trope_count"]:
        urls[row["before_url"]].append((row["media_type"], row["tmdb_id"]))
for row in all_rows:
    if not row["before_trope_count"]:
        continue
    reasons = []
    url = row["before_url"] or ""
    if "/Main/" in url or "/Franchise/" in url:
        reasons.append("non-individual-work namespace")
    if (row["media_type"] == "movie" and "/Series/" in url) or (
        row["media_type"] == "show" and "/Film/" in url
    ):
        reasons.append("opposite media namespace")
    match = re.search(r"((?:19|20)\d{2})$", url)
    if (
        match
        and row["release_year"]
        and int(match[1]) != row["release_year"]
        and match[1] not in row["title"]
    ):
        reasons.append("URL year differs from catalog year")
    if len(urls[url]) > 1:
        reasons.append("source URL shared by multiple catalog identities")
    if reasons:
        source = source_index[(row["media_type"], row["tmdb_id"])]
        audit.append(
            dict(
                row,
                suspicion=reasons,
                shared_by=urls[url],
                source_updated_at=source.get("updated_at"),
                source_failed_at=source.get("failed_at"),
            )
        )
cohort.sort(key=lambda r: (-r["votes"], r["media_type"], r["tmdb_id"]))
(out / "cohort.json").write_text(
    json.dumps(cohort, indent=2, ensure_ascii=False, default=str) + "\n"
)
(out / "suspicious-existing.json").write_text(
    json.dumps(audit, indent=2, ensure_ascii=False, default=str) + "\n"
)
summary = {
    "captured_at": datetime.now(timezone.utc).isoformat(),
    "counts": totals,
    "cohort": len(cohort),
    "already_present_in_mongo": sum(r["source_trope_count"] > 0 for r in cohort),
    "suspicious_existing": len(audit),
    "confirmed_mismatches": 0,
    "changes": 0,
}
(out / "cohort-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
client.close()
