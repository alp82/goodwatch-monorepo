# extra_requirements:
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Publish source-owned TVDB tables. A revision is acknowledged only after the whole scope succeeds."""

import hashlib
import json

from f.tvdb.crawl import checked_id


def upsert(connector, table, rows, keys):
    if not rows:
        return
    columns = list(rows[0])
    assignments = ", ".join(f"{c} = excluded.{c}" for c in columns if c not in keys)
    sql = (
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)}) "
        f"ON CONFLICT ({', '.join(keys)}) DO UPDATE SET {assignments}"
    )
    for offset in range(0, len(rows), 500):
        connector.run_many(
            sql, [[r[c] for c in columns] for r in rows[offset : offset + 500]]
        )


def exact_credit(credits, person, name):
    if not person or not isinstance(name, str) or not name.strip():
        return None
    norm = lambda s: " ".join((s or "").casefold().split())
    hits = [
        c["credit_id"]
        for c in credits
        if c["person_tmdb_id"] == person and norm(c.get("character")) == norm(name)
    ]
    return hits[0] if len(hits) == 1 else None


def role_rows(db, connector, doc):
    credits = connector.select(
        "SELECT person_tmdb_id, character, credit_id FROM person_appeared_in "
        "WHERE media_type = ? AND media_tmdb_id = ?",
        (doc["media_type"], doc["tmdb_id"]),
    )
    people = {
        r["_id"]: r
        for r in db.tvdb_entities.find(
            {
                "_id": {
                    "$in": [
                        f"person:{c['peopleId']}" for c in doc.get("characters") or []
                    ]
                },
                "status": "ok",
            }
        )
    }
    rows = []
    for c in doc.get("characters") or []:
        person = people.get(f"person:{c['peopleId']}", {})
        tmdb = person.get("tmdb_id")
        rows.append(
            {
                "media_type": doc["media_type"],
                "media_tmdb_id": doc["tmdb_id"],
                "tvdb_character_id": c["id"],
                "tvdb_title_id": doc["tvdb_id"],
                "tvdb_person_id": c["peopleId"],
                "person_tmdb_id": tmdb,
                "credit_id": exact_credit(credits, tmdb, c.get("name")),
                "character_name": c.get("name"),
                "person_name": c.get("personName"),
                "image_url": c.get("image") or None,
                "actor_image_url": c.get("personImgURL") or None,
                "source_url": c.get("url"),
                "source_fetched_at": doc.get("fetched_at"),
                "revision": doc["updated_at"],
            }
        )
    return rows


def nomination_rows(db, doc):
    entity_keys = [
        f"{kind}:{n[field]['id']}"
        for n in doc["nominees"]
        for field, kind in [("movie", "movie"), ("series", "show")]
        if isinstance(n.get(field), dict) and n[field].get("id")
    ]
    entities = {
        r["_id"]: r
        for r in db.tvdb_entities.find({"_id": {"$in": entity_keys}, "status": "ok"})
    }
    local_keys = [
        f"{r['kind']}:{r['tmdb_id']}" for r in entities.values() if r.get("tmdb_id")
    ]
    local_titles = {
        r["_id"]
        for r in db.tvdb_titles.find(
            {"_id": {"$in": local_keys}, "tmdb_deleted": {"$ne": True}}, {"_id": 1}
        )
    }
    rows = []
    for n in doc["nominees"]:
        kind, title = next(
            (
                (kind, n[field])
                for field, kind in [("movie", "movie"), ("series", "show")]
                if isinstance(n.get(field), dict)
            ),
            (None, {}),
        )
        tvdb = checked_id(title.get("id"))
        mapped = entities.get(f"{kind}:{tvdb}", {})
        tmdb = mapped.get("tmdb_id")
        local = f"{kind}:{tmdb}" in local_titles
        character = n.get("character") or {}
        signature = [
            doc["_id"],
            n.get("year"),
            kind,
            tvdb,
            (n.get("episode") or {}).get("id"),
            character.get("id"),
            n.get("name"),
            n.get("details"),
            n["isWinner"],
        ]
        rows.append(
            {
                "category_id": doc["_id"],
                "nominee_id": n["id"],
                "award_id": doc["award_id"],
                "award_name": doc["award_name"],
                "category_name": doc["name"],
                "ceremony_year": str(n.get("year") or ""),
                "is_winner": n["isWinner"],
                "media_type": kind,
                "media_tmdb_id": tmdb if local else None,
                "tvdb_title_id": tvdb,
                "tvdb_episode_id": (n.get("episode") or {}).get("id"),
                "tvdb_character_id": character.get("id"),
                "recipient_name": n.get("name") or character.get("personName"),
                "details": n.get("details"),
                "dedupe_key": hashlib.sha256(
                    json.dumps(signature).encode()
                ).hexdigest(),
                "raw_json": json.dumps(n, ensure_ascii=False),
                "source_fetched_at": doc.get("fetched_at"),
                "revision": doc["updated_at"],
            }
        )
    return rows


def _publish(db, connector, limit=100):
    result = {"titles": 0, "categories": 0, "rows": 0}
    for name, table, counter in [
        ("tvdb_titles", "tvdb_character", "titles"),
        ("tvdb_categories", "tvdb_nomination", "categories"),
    ]:
        col = db[name]
        query = {"publish_pending": True}
        pending, all_rows = [], []
        for doc in col.find(query).sort("updated_at", 1).limit(limit):
            if name == "tvdb_titles":
                if "characters" not in doc:
                    continue
                rows = role_rows(db, connector, doc)
                keys = ["media_type", "media_tmdb_id", "tvdb_character_id"]
                scope = "media_type = ? AND media_tmdb_id = ?"
                params = (doc["media_type"], doc["tmdb_id"])
            else:
                if "nominees" not in doc:
                    continue
                rows = nomination_rows(db, doc)
                keys, scope, params = (
                    ["category_id", "nominee_id"],
                    "category_id = ?",
                    (doc["_id"],),
                )
            pending.append((doc, params))
            all_rows.extend(rows)
        if not pending:
            continue
        upsert(connector, table, all_rows, keys)
        # One refresh per table and batch, rather than one per title/category.
        connector.run(f"REFRESH TABLE {table}")
        delete_sql = f"DELETE FROM {table} WHERE {scope} AND revision != ?"
        connector.run_many(
            delete_sql, [list(params) + [doc["updated_at"]] for doc, params in pending]
        )
        for doc, _ in pending:
            col.update_one(
                {"_id": doc["_id"], "updated_at": doc["updated_at"]},
                {"$set": {"published_at": doc["updated_at"], "publish_pending": False}},
            )
        result[counter] += len(pending)
        result["rows"] += len(all_rows)
    return result


def publish(db, connector, limit=100):
    from f.tvdb.store import Busy, exclusive

    try:
        with exclusive(db, "publish", 30):
            return _publish(db, connector, limit)
    except Busy:
        return {"skipped": "another TVDB publisher holds the lease"}


def main(limit: int = 1000):
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb
    from mongoengine import get_db

    if not 1 <= limit <= 10000:
        raise ValueError("Invalid publication limit")
    init_mongodb()
    connector = None
    try:
        db = get_db()
        connector = CrateConnector()
        return publish(db, connector, limit)
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
