# extra_requirements:
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Replay complete saved TVDB snapshots without confusing source rows with award entries."""

from f.awards.models import Observation, digest, nomination_year
from f.awards.registry import TVDB_PROGRAMS, Registry
from f.awards.store import NORMALIZER_VERSION, indexes, record_run, save_scope
from f.tvdb.links import NominationLinks
from f.tvdb.publish import nomination_rows
from f.tvdb.store import exclusive


def convert(db, registry, category, row):
    program = TVDB_PROGRAMS.get(category["award_id"])
    if program is None:
        raise ValueError("Unknown TVDB award program; explicit mapping required")
    if program in {"bafta", "critics"}:
        program += ".tv" if row.get("media_type") == "show" else ".film"
    mapped = registry.category("tvdb", category["_id"], program, category["name"])
    year = nomination_year(row.get("ceremony_year"))
    flags = list(row.get("quality_flags") or [])
    works, recipients = [], []
    if row.get("title_link_status") == "verified":
        works.append(
            {
                "identity": f"{row['media_type']}:{row['media_tmdb_id']}",
                "kind": row["media_type"],
                "media_type": row["media_type"],
                "media_tmdb_id": row["media_tmdb_id"],
                "role": "recognized_work",
                "link_status": "verified",
            }
        )
    else:
        flags.append("unresolved_work")
    if row.get("person_tmdb_id") and row.get("actor_link_status") == "verified":
        recipients.append(
            {
                "identity": f"person:{row['person_tmdb_id']}",
                "kind": "person",
                "person_tmdb_id": row["person_tmdb_id"],
                "link_status": "verified",
            }
        )
    # TVDB's year has no edition identity. Resolve only through an unambiguous,
    # explicitly indexed ceremony, not a synthesized title/category/year key.
    ceremonies = registry.ceremonies.get((program, year), []) if year else []
    ceremony = ceremonies[0] if len(ceremonies) == 1 else {}
    if not ceremony:
        flags.append("unresolved_ceremony")
    if mapped["entry_basis"] == "song":
        for work in works:
            work["role"] = "context_title"
    return Observation(
        source="tvdb",
        record_id=f"{category['_id']}:{row['nominee_id']}",
        program_key=program,
        category_key=mapped["key"],
        category_name=mapped["name"],
        year=year,
        outcome="won" if row["is_winner"] else "unknown",
        ceremony_key=ceremony.get("key"),
        ceremony_label=ceremony.get("label"),
        ceremony_date=ceremony.get("date"),
        recipients=recipients,
        works=works,
        recipient_set_status="partial" if recipients else "unknown",
        entry_basis=mapped["entry_basis"],
        portrayals=[
            {
                "tvdb_character_id": row["tvdb_character_id"],
                "credit_id": row.get("credit_id"),
                "person_tmdb_id": row.get("person_tmdb_id"),
                "media_type": row.get("media_type"),
                "media_tmdb_id": row.get("media_tmdb_id"),
                "link_status": row.get("character_link_status"),
            }
        ]
        if row.get("tvdb_character_id")
        else [],
        references=["https://thetvdb.com/"],
        flags=flags,
        source_category_id=str(category["_id"]),
    )


def run(db, connector, limit=1000):
    registry = Registry(db)
    ceremony_version = digest(
        sorted(
            (d["_id"], d.get("award_year"), d.get("date"))
            for d in db.award_ceremonies.find({"active": {"$ne": False}})
        )
    )
    prior = {
        d["_id"]: d.get("source_revision")
        for d in db.award_scopes.find({"source": "tvdb"}, {"source_revision": 1})
    }
    changed = []
    for header in db.tvdb_categories.find(
        {"nominees": {"$exists": True}}, {"updated_at": 1}
    ).sort("_id", 1):
        revision = [str(header.get("updated_at")), NORMALIZER_VERSION, ceremony_version]
        if prior.get("tvdb:" + str(header["_id"])) != revision:
            changed.append(header["_id"])
    docs = list(
        db.tvdb_categories.find({"_id": {"$in": changed[:limit]}}).sort("_id", 1)
    )
    report = {
        "categories": 0,
        "observations": 0,
        "changed": 0,
        "remaining": max(0, len(changed) - limit),
    }
    if not docs:
        return report
    links = NominationLinks(db, [n for d in docs for n in d["nominees"]], connector)
    for doc in docs:
        revision = [str(doc.get("updated_at")), NORMALIZER_VERSION, ceremony_version]
        scope = db.award_scopes.find_one({"_id": f"tvdb:{doc['_id']}"}) or {}
        if scope.get("source_revision") == revision:
            continue
        rows = nomination_rows(db, doc, connector, links)
        observations = [convert(db, registry, doc, row) for row in rows]
        result = save_scope(
            db,
            "tvdb",
            str(doc["_id"]),
            observations,
            raw={
                "award_id": doc["award_id"],
                "award_name": doc["award_name"],
                "category_name": doc["name"],
                "nominees": doc["nominees"],
            },
            source_revision=revision,
        )
        db.award_scopes.update_one(
            {"_id": f"tvdb:{doc['_id']}"}, {"$set": {"source_revision": revision}}
        )
        report["categories"] += 1
        report["observations"] += result["observations"]
        report["changed"] += result["changed"]
    return report


def main(limit: int = 1000):
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    init_mongodb()
    connector = None
    try:
        db = get_db()
        indexes(db)
        with exclusive(db, "awards-tvdb", 30):
            connector = CrateConnector()
            return record_run(db, "tvdb", run(db, connector, limit))
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
