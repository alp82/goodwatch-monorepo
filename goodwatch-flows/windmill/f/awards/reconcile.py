# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Reconcile complete source snapshots and build immutable serving generations."""

from collections import defaultdict
from uuid import uuid4

from f.awards.models import digest, reconcile_observations
from f.awards.registry import PROGRAMS
from f.awards.store import active_observations, indexes, record_run
from f.sync.copy.sync_state import utc_now
from f.tvdb.store import exclusive
from pymongo import UpdateOne

VERSION = 3


def public_observation(o, year):
    if o.get("year") is None or o["year"] < 1888 or o["year"] > year:
        return False
    return not set(o.get("flags", [])) & {"identity_conflict", "unresolved_work"}


def projections(observations, entries, year=None):
    year = year or utc_now().year
    titles, people = {}, {}
    resolved = {o["observation_key"]: e for e in entries for o in e["observations"]}
    # Suppress coarse, contradictory year-only duplicates when the same recipient
    # and work have a fully identified ceremony nearby. This is display withholding,
    # not a claim that the coarse observation identified that exact entry.
    precise = defaultdict(set)
    precise_titles = defaultdict(dict)
    precise_people = defaultdict(dict)
    for e in entries:
        if e["result_status"] == "disputed":
            continue
        for w in e["works"]:
            precise_titles[
                (e["program_key"], e["category_key"], e["year"], w["identity"])
            ][e["ceremony_key"]] = e["result_status"] == "won" or precise_titles[
                (e["program_key"], e["category_key"], e["year"], w["identity"])
            ].get(e["ceremony_key"], False)
        for r in e["recipients"]:
            precise_people[
                (
                    e["program_key"],
                    e["category_key"],
                    e["year"],
                    r["identity"],
                    tuple(
                        sorted(
                            w["identity"]
                            for w in e["works"]
                            if w.get("role") == "recognized_work"
                        )
                    ),
                )
            ][e["ceremony_key"]] = e["result_status"] == "won"
        for r in e["recipients"]:
            for w in e["works"]:
                precise[
                    (e["program_key"], e["category_key"], r["identity"], w["identity"])
                ].add(e["year"])
    for o in observations:
        if not public_observation(o, year):
            continue
        entry = resolved.get(o["observation_key"])
        if entry and entry["result_status"] == "disputed":
            continue
        if not o.get("ceremony_key"):
            dates = set()
            for r in o.get("recipients", []):
                for w in o.get("works", []):
                    dates.update(
                        precise.get(
                            (
                                o["program_key"],
                                o["category_key"],
                                r["identity"],
                                w["identity"],
                            ),
                            set(),
                        )
                    )
            if (
                dates
                and o["year"] not in dates
                and any(abs(o["year"] - y) <= 1 for y in dates if y)
            ):
                continue
        ceremony = o.get("ceremony_key") or "unresolved:" + str(o["year"])
        common = {
            "program_key": o["program_key"],
            "award_name": PROGRAMS[o["program_key"]][0],
            "category_key": o["category_key"],
            "category_name": o["category_name"],
            "ceremony_key": o.get("ceremony_key"),
            "ceremony_label": o.get("ceremony_label"),
            "ceremony_year": str(o["year"]),
            "has_win": False,
            "has_nomination": False,
            "source_names": set(),
            "reference_urls": set(),
            "observation_keys": set(),
            "portrayals": {},
            "coverage_status": "partial",
            "totals_available": False,
        }

        def add(target, key, fields, common=common, observation=o):
            row = target.setdefault(
                key,
                common.copy()
                | fields
                | {
                    "source_names": set(),
                    "reference_urls": set(),
                    "observation_keys": set(),
                    "portrayals": {},
                },
            )
            row["has_win"] |= observation["outcome"] == "won"
            row["has_nomination"] |= observation.get("nomination_status") == "confirmed"
            row["source_names"].add(
                "TVDB" if observation["source"] == "tvdb" else "Wikidata"
            )
            row["reference_urls"].update(observation.get("references", []))
            row["observation_keys"].add(observation["observation_key"])
            for portrayal in observation.get("portrayals", []):
                row["portrayals"][digest(portrayal)] = portrayal

        for w in o.get("works", []):
            if w.get("link_status") != "verified" or not w.get("media_tmdb_id"):
                continue
            known = precise_titles.get(
                (o["program_key"], o["category_key"], o["year"], w["identity"]), {}
            )
            # Redundant year-only highlights add no display fact when one exact
            # ceremony already supports the same result. Their evidence remains
            # unresolved; this does not merge them into an exact entry.
            if (
                not o.get("ceremony_key")
                and len(known) == 1
                and (o["outcome"] != "won" or any(known.values()))
            ):
                continue
            key = digest(
                [
                    w["media_type"],
                    w["media_tmdb_id"],
                    o["program_key"],
                    o["category_key"],
                    ceremony,
                ]
            )
            add(
                titles,
                key,
                {"media_type": w["media_type"], "media_tmdb_id": w["media_tmdb_id"]},
            )
        for r in o.get("recipients", []):
            if (
                r.get("kind") != "person"
                or r.get("link_status") != "verified"
                or not r.get("person_tmdb_id")
            ):
                continue
            known = precise_people.get(
                (
                    o["program_key"],
                    o["category_key"],
                    o["year"],
                    r["identity"],
                    tuple(
                        sorted(
                            w["identity"]
                            for w in o.get("works", [])
                            if w.get("role") == "recognized_work"
                        )
                    ),
                ),
                {},
            )
            if (
                not o.get("ceremony_key")
                and not o.get("portrayals")
                and len(known) == 1
                and (o["outcome"] != "won" or any(known.values()))
            ):
                continue
            # Title observations never create recipients. Only explicit source people reach this projection.
            key = digest(
                [
                    r["person_tmdb_id"],
                    o["program_key"],
                    o["category_key"],
                    ceremony,
                    sorted(
                        w["identity"]
                        for w in o.get("works", [])
                        if w.get("role") == "recognized_work"
                    ),
                ]
            )
            add(
                people,
                key,
                {
                    "person_tmdb_id": r["person_tmdb_id"],
                    "entry_id": entry.get("_id") if entry else None,
                    "works": o.get("works", []),
                },
            )
    for table in [titles, people]:
        for key, row in table.items():
            row["result_id"] = key
            row["source_names"] = sorted(row["source_names"])
            row["reference_urls"] = sorted(row["reference_urls"])[:20]
            row["source_row_count"] = len(row.pop("observation_keys"))
            row["portrayals"] = list(row["portrayals"].values())
    return list(titles.values()), list(people.values())


def bulk_set(collection, docs):
    for offset in range(0, len(docs), 500):
        collection.bulk_write(
            [
                UpdateOne(
                    {"_id": d["_id"]},
                    {"$set": {k: v for k, v in d.items() if k != "_id"}},
                    upsert=True,
                )
                for d in docs[offset : offset + 500]
            ],
            ordered=False,
        )


def run(db, force=False):
    request = db.award_state.find_one({"_id": "reconcile"}) or {}
    scopes = list(db.award_scopes.find({}))
    fingerprint = digest(
        [VERSION, sorted((s["_id"], s["active_revision"]) for s in scopes)]
    )
    previous = db.award_state.find_one({"_id": "canonical"}) or {}
    if previous.get("fingerprint") == fingerprint and not force:
        return {"changed": False, "generation": previous.get("generation")}
    observations = list(active_observations(db, scopes))
    if len(observations) > 500_000:
        raise ValueError("Award reconciliation exceeds its bounded generation size")
    entries, unresolved = reconcile_observations(observations)
    keys = [e["match_key"] for e in entries]
    stored = {
        d["_id"]: d["canonical_id"]
        for d in db.award_source_identities.find(
            {"_id": {"$in": ["entry:" + k for k in keys]}}
        )
    }
    previous_entries = (
        list(
            db.award_entries.find(
                {"generation": previous.get("generation")},
                {"entry_id": 1, "program_key": 1, "observations.observation_key": 1},
            )
        )
        if previous.get("generation")
        else []
    )
    prior_by_observation = defaultdict(set)
    for old in previous_entries:
        for observation in old.get("observations", []):
            prior_by_observation[
                (old["program_key"], observation["observation_key"])
            ].add(old["entry_id"])
    allocations, used, redirects = [], set(), []
    for entry in entries:
        map_key = "entry:" + entry["match_key"]
        inherited = set().union(
            *(
                prior_by_observation.get(
                    (entry["program_key"], o["observation_key"]), set()
                )
                for o in entry["observations"]
            )
        )
        chosen = stored.get(map_key)
        if chosen in used:
            chosen = None
        if not chosen:
            chosen = next(
                (candidate for candidate in sorted(inherited) if candidate not in used),
                str(uuid4()),
            )
        stored[map_key] = chosen
        used.add(chosen)
        allocations.append({"_id": map_key, "canonical_id": chosen, "kind": "entry"})
        redirects.extend((old_id, chosen) for old_id in inherited - {chosen})
    for old_id, chosen in redirects:
        if old_id not in used:
            db.award_entry_redirects.update_one(
                {"_id": old_id},
                {
                    "$set": {
                        "canonical_id": chosen,
                        "reason": "verified_identity_reconciliation",
                        "at": utc_now(),
                    }
                },
                upsert=True,
            )
    bulk_set(db.award_source_identities, allocations)
    generation = str(uuid4())
    for e in entries:
        e["_id"] = stored["entry:" + e["match_key"]]
        e["generation"] = generation
    title_rows, person_rows = projections(observations, entries)
    # Entry revisions are immutable: a failed replacement cannot corrupt the prior generation.
    bulk_set(
        db.award_entries,
        [dict(e, _id=generation + ":" + e["_id"], entry_id=e["_id"]) for e in entries],
    )
    for collection, rows in [
        ("award_title_projection", title_rows),
        ("award_person_projection", person_rows),
    ]:
        bulk_set(
            db[collection],
            [
                dict(r, _id=generation + ":" + r["result_id"], generation=generation)
                for r in rows
            ],
        )
    coverage_updates = []
    for program, category, ceremony in {
        (o["program_key"], o["category_key"], o.get("ceremony_key"))
        for o in observations
    }:
        coverage_updates.append(
            UpdateOne(
                {"_id": digest([program, category, ceremony])},
                {
                    "$setOnInsert": {
                        "program_key": program,
                        "category_key": category,
                        "ceremony_key": ceremony,
                        "entry_slate": "unknown",
                        "recipients": "unknown",
                        "outcomes": "unknown",
                        "evidence": [],
                    }
                },
                upsert=True,
            )
        )
    for offset in range(0, len(coverage_updates), 500):
        db.award_coverage.bulk_write(
            coverage_updates[offset : offset + 500], ordered=False
        )
    report = {
        "changed": True,
        "generation": generation,
        "observations": len(observations),
        "entries": len(entries),
        "unresolved_observations": len(unresolved),
        "title_results": len(title_rows),
        "person_results": len(person_rows),
    }
    db.award_generations.update_one(
        {"_id": generation},
        {
            "$set": report
            | {"created_at": utc_now(), "ready": True, "fingerprint": fingerprint}
        },
        upsert=True,
    )
    db.award_state.update_one(
        {"_id": "canonical"},
        {
            "$set": {
                "generation": generation,
                "fingerprint": fingerprint,
                "source_revisions": [[s["_id"], s["active_revision"]] for s in scopes],
                "at": utc_now(),
            }
        },
        upsert=True,
    )
    db.award_state.update_one(
        {"_id": "reconcile", "requested_at": request.get("requested_at")},
        {"$set": {"pending": False}},
        upsert=False,
    )
    return report


def main(force: bool = False):
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    try:
        db = get_db()
        indexes(db)
        with exclusive(db, "awards-canonical", 30):
            return record_run(db, "reconcile", run(db, force))
    finally:
        close_mongodb()
