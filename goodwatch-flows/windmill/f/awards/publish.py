# extra_requirements:
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Publish only complete canonical generations, leaving the previous generation readable on failure."""

import json

from f.awards.store import record_run
from f.sync.copy.sync_state import utc_now
from f.tvdb.publish import upsert
from f.tvdb.store import exclusive

COMMON = [
    "result_id",
    "generation",
    "program_key",
    "award_name",
    "category_key",
    "category_name",
    "ceremony_key",
    "ceremony_label",
    "ceremony_year",
    "has_win",
    "has_nomination",
    "source_names",
    "reference_urls",
    "coverage_status",
    "totals_available",
    "source_row_count",
]


def local_ids(connector, table, ids):
    ids = sorted(set(ids))
    present = set()
    for offset in range(0, len(ids), 2000):
        present.update(
            r["tmdb_id"]
            for r in connector.select(
                f"SELECT tmdb_id FROM {table} WHERE tmdb_id = ANY(?)",
                (ids[offset : offset + 2000],),
            )
        )
    return present


def run(db, connector):
    state = db.award_state.find_one({"_id": "canonical"}) or {}
    generation = state.get("generation")
    ready = db.award_generations.find_one({"_id": generation, "ready": True})
    if not ready:
        raise ValueError("No complete canonical award generation")
    if ready.get("published_at"):
        return {"generation": generation, "changed": False}
    titles = list(db.award_title_projection.find({"generation": generation}))
    people = list(db.award_person_projection.find({"generation": generation}))
    if len(titles) != ready["title_results"] or len(people) != ready["person_results"]:
        raise ValueError("Incomplete award serving generation")
    work_ids = {
        kind: {r["media_tmdb_id"] for r in titles if r["media_type"] == kind}
        for kind in ["movie", "show"]
    }
    for row in people:
        for work in row.get("works", []):
            if work.get("media_tmdb_id") and work.get("media_type") in work_ids:
                work_ids[work["media_type"]].add(work["media_tmdb_id"])
    existing = {kind: local_ids(connector, kind, ids) for kind, ids in work_ids.items()}
    person_ids = local_ids(connector, "person", [r["person_tmdb_id"] for r in people])
    published_counts = {}
    for table, docs, extra in [
        ("award_title_result", titles, ["media_type", "media_tmdb_id"]),
        (
            "award_person_result",
            people,
            ["person_tmdb_id", "entry_id", "works_json", "portrayals_json"],
        ),
    ]:
        rows = []
        for d in docs:
            if (
                table == "award_title_result"
                and d["media_tmdb_id"] not in existing[d["media_type"]]
            ):
                continue
            if table == "award_person_result":
                if d["person_tmdb_id"] not in person_ids:
                    continue
                works = []
                for w in d.get("works", []):
                    if w.get("media_tmdb_id") and w[
                        "media_tmdb_id"
                    ] not in existing.get(w.get("media_type"), set()):
                        continue
                    works.append(w)
                d["works_json"] = json.dumps(works, ensure_ascii=False)
                d["portrayals_json"] = json.dumps(
                    [
                        p
                        for p in d.get("portrayals", [])
                        if p.get("link_status") == "verified"
                        and p.get("person_tmdb_id") == d["person_tmdb_id"]
                    ],
                    ensure_ascii=False,
                )
            rows.append({k: d.get(k) for k in COMMON + extra})
        upsert(
            connector,
            table,
            rows,
            ["media_tmdb_id", "media_type", "generation", "result_id"]
            if table == "award_title_result"
            else ["generation", "result_id"],
        )
        connector.run("REFRESH TABLE " + table)
        published_counts[table] = len(rows)
    # A single-row pointer flip makes the complete generation visible together.
    upsert(
        connector,
        "award_publication",
        [{"name": "active", "generation": generation, "published_at": utc_now()}],
        ["name"],
    )
    connector.run("REFRESH TABLE award_publication")
    db.award_generations.update_one(
        {"_id": generation}, {"$set": {"published_at": utc_now()}}
    )
    db.award_state.update_one(
        {"_id": "publication-progress"},
        {"$set": {"at": utc_now(), "generation": generation}},
        upsert=True,
    )
    # Retain one previous successful generation for rollback. Source evidence is
    # retained independently; serving generations can be rebuilt from it.
    prior = list(
        db.award_generations.find(
            {"published_at": {"$exists": True}, "pruned_at": {"$exists": False}}
        ).sort("published_at", -1)
    )
    stale = [g["_id"] for g in prior[2:] if g["_id"] != generation]
    for old in stale:
        for table in ["award_title_result", "award_person_result"]:
            connector.run("DELETE FROM " + table + " WHERE generation = ?", (old,))
        for name in [
            "award_entries",
            "award_title_projection",
            "award_person_projection",
        ]:
            db[name].delete_many({"generation": old})
        db.award_generations.update_one(
            {"_id": old}, {"$set": {"pruned_at": utc_now()}}
        )
    return {
        "changed": True,
        "generation": generation,
        "title_results": published_counts["award_title_result"],
        "person_results": published_counts["award_person_result"],
    }


def main():
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    c = None
    try:
        db = get_db()
        with exclusive(db, "awards-canonical", 30):
            c = CrateConnector()
            return record_run(db, "publish", run(db, c))
    finally:
        if c:
            c.disconnect()
        close_mongodb()
