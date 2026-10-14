#!/usr/bin/env python3
"""Pure daily comparisons from local captures. Run: python score.py

No network or production access. Today's attention means each scored UTC day,
not an incomplete current day. Baseline excludes the scored day.
"""
import csv
import datetime as dt
import json
import math
from pathlib import Path
import statistics
import unicodedata

from collect import DATA, ROOT, save

VARIANTS = {
    "pageviews_z": "Pageviews z-score",
    "pageviews_tmdb": "Pageviews + TMDB popularity history (trending proxy)",
    "pageviews_tmdb_netflix": "Pageviews + TMDB popularity + Netflix as published",
    "pageviews_trending_hindsight": "Pageviews + Oct 14 TMDB trending (HINDSIGHT ONLY)",
    "lift": "Pageviews lift ratio",
    "floor_z": "Pageviews z-score, ≥1,000 views and ≥500 extra",
    "floor_lift": "Pageviews lift, ≥1,000 views and ≥500 extra",
    "regularized_z": "Regularized z-score, same volume floor",
}


def normalized(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text).casefold() if c.isalnum())


def baseline(series, day):
    dates = [(day - dt.timedelta(days=i)).isoformat() for i in range(28, 0, -1)]
    values = [series.get(d) for d in dates]
    today = series.get(day.isoformat())
    if today is None or any(v is None for v in values):
        return None  # Never silently turn missing/unloaded observations into zero.
    mean = statistics.mean(values)
    sd = statistics.pstdev(values)
    return {"value": today, "mean": mean, "sd": sd, "delta": today - mean,
            "z": (today - mean) / sd if sd > 0 else None,
            "lift": today / max(mean, 1),
            "regularized_z": (today - mean) / max(sd, math.sqrt(mean), 100, 0.1 * mean)}


def netflix_matches(titles):
    index = {}
    for t in titles:
        for name in {t["title"], t["original_title"]} - {None, ""}:
            index.setdefault((t["kind"], normalized(name)), set()).add(t["key"])
    rows = []
    rejected = []
    for row in csv.DictReader((DATA / "netflix-global.tsv").open(encoding="utf-8-sig"), delimiter="\t"):
        if row["week"] < "2026-07-01":
            continue
        kind = "movie" if "Films" in row["category"] else "tv"
        keys = index.get((kind, normalized(row["show_title"])), set())
        if len(keys) == 1:
            rows.append(dict(row, key=next(iter(keys)), available_from=(dt.date.fromisoformat(row["week"]) + dt.timedelta(days=2)).isoformat(), match_method="exact normalized title + category; unique within cohort; provisional"))
        elif len(keys) > 1:
            rejected.append(dict(row, candidates=sorted(keys)))
    save(DATA / "netflix-matches.json", {"matched": rows, "ambiguous": rejected})
    return rows


def run():
    titles = json.loads((DATA / "titles.json").read_text())
    collection = json.loads((DATA / "collection.json").read_text())
    end = dt.date.fromisoformat(collection["end"])
    pv = {}
    for t in titles:
        path = DATA / "pageviews" / f"{t['key'].replace(':', '-')}.json"
        if path.exists():
            capture = json.loads(path.read_text())
            pv[t["key"]] = {dt.datetime.strptime(r["timestamp"][:8], "%Y%m%d").date().isoformat(): r["views"] for r in capture["payload"].get("items", [])} if capture["status"] == 200 else {}
    tmdb = {}
    for path in sorted((DATA / "tmdb-history").glob("*.json")):
        capture = json.loads(path.read_text())
        for row in capture["rows"]:
            tmdb.setdefault(f"{capture['kind']}:{row['id']}", {})[capture["date"]] = row["popularity"]
    nf = netflix_matches(titles)
    snapshot = json.loads((DATA / "tmdb-snapshot.json").read_text())
    trending = {}
    for kind in ("movie", "tv"):
        for rank, row in enumerate(snapshot["lists"][f"{kind}/day"], start=1):
            trending.setdefault(f"{kind}:{row['id']}", {"rank": rank, "score": 10 * (101 - rank) / 100, "retrieved_at": snapshot["retrieved_at"]})
    source_weeks = {r["week"] for r in csv.DictReader((DATA / "netflix-global.tsv").open(encoding="utf-8-sig"), delimiter="\t")}
    daily = {}
    for offset in range(20, -1, -1):
        day = end - dt.timedelta(days=offset)
        published = [r for r in nf if r["available_from"] <= day.isoformat()]
        latest_week = max((w for w in source_weeks if dt.date.fromisoformat(w) + dt.timedelta(days=2) <= day), default=None)
        published = [r for r in published if r["week"] == latest_week]
        metrics = []
        for t in titles:
            wiki = baseline(pv.get(t["key"], {}), day)
            if wiki is None:
                continue
            popularity = baseline(tmdb.get(t["key"], {}), day)
            nf_rows = [r for r in published if r["key"] == t["key"]]
            nf_score = max((11 - int(r["weekly_rank"]) for r in nf_rows), default=0)
            z = wiki["z"]
            floor = wiki["value"] >= 1000 and wiki["delta"] >= 500
            # TMDB denominator floor avoids numerical explosions from a flat score.
            tmdb_z = (popularity["delta"] / max(popularity["sd"], 0.05 * popularity["mean"], 0.1)) if popularity else None
            positive = lambda x: max(0, min(x, 10))
            scores = {
                "pageviews_z": z,
                "pageviews_tmdb": 0.75 * positive(z) + 0.25 * positive(tmdb_z) if z is not None and tmdb_z is not None else None,
                "pageviews_tmdb_netflix": 0.75 * positive(z) + 0.25 * positive(tmdb_z) + 0.1 * nf_score if z is not None and tmdb_z is not None else None,
                "pageviews_trending_hindsight": 0.8 * positive(z) + 0.2 * trending.get(t["key"], {}).get("score", 0) if z is not None else None,
                "lift": wiki["lift"],
                "floor_z": z if floor else None,
                "floor_lift": wiki["lift"] if floor else None,
                "regularized_z": wiki["regularized_z"] if floor else None,
            }
            metrics.append({"key": t["key"], "title": t["title"], "kind": t["kind"], "article_url": t["article_url"], "wiki": wiki, "tmdb": popularity, "tmdb_z": tmdb_z, "netflix": nf_rows, "trending_hindsight": trending.get(t["key"]), "scores": scores})
        ranked = {}
        for variant in VARIANTS:
            eligible = [r for r in metrics if r["scores"][variant] is not None]
            eligible.sort(key=lambda r: (-r["scores"][variant], -r["wiki"]["value"], r["key"]))
            ranked[variant] = [r["key"] for r in eligible[:20]]
        daily[day.isoformat()] = {"netflix_week_as_published": latest_week, "metrics": metrics, "top20": ranked}
    save(ROOT / "scores.json", {"variants": VARIANTS, "daily": daily})
    days = sorted(daily)[-6:]
    counts = {"catalog": len(titles), "kinds": {kind: sum(t["kind"] == kind for t in titles) for kind in ("movie", "tv")}, "enwiki": sum(bool(t["article_url"]) for t in titles), "pageviews_titles": sum(bool(v) for v in pv.values()), "all_60_days": sum(len(v) == 60 for v in pv.values()), "review_days": days, "netflix_matches": len({r["key"] for r in nf}), "tmdb_history_titles": len(tmdb)}
    save(ROOT / "summary.json", counts)
    with (ROOT / "coverage.csv").open("w", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(["key", "kind", "title", "catalog_popularity", "mapping_status", "article_url", "article_days", "tmdb_export_days", "scored_days", "netflix_recent_match"])
        for t in titles:
            writer.writerow([t["key"], t["kind"], t["title"], t["popularity"], t["mapping_status"], t["article_url"], len(pv.get(t["key"], {})), len(tmdb.get(t["key"], {})), sum(any(r["key"] == t["key"] for r in d["metrics"]) for d in daily.values()), any(r["key"] == t["key"] for r in nf)])
    for day in days:
        bykey = {r["key"]: r for r in daily[day]["metrics"]}
        print(day)
        for variant in VARIANTS:
            print(variant, " | ".join(f"{bykey[k]['title']} ({bykey[k]['scores'][variant]:.2f}; {bykey[k]['wiki']['value']} views)" for k in daily[day]["top20"][variant][:8]))
    print(counts)


if __name__ == "__main__":
    run()
