# extra_requirements:
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Publish source-owned TVDB tables. A revision is acknowledged only after the whole scope succeeds."""

import hashlib
import json
from datetime import timedelta

from f.sync.copy.sync_state import utc_now
from f.tvdb.ids import checked_id, tmdb_id


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
        tmdb = tmdb_id(person.get("tmdb_id"))
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


def nomination_rows(db, doc, connector=None, links=None):
    from f.tvdb.links import NominationLinks

    links = links or NominationLinks(db, doc["nominees"], connector)
    rows = []
    for n in doc["nominees"]:
        kind, tvdb, tmdb, title_status = links.title(n)
        recipient = links.recipient(n, kind, tvdb, tmdb)
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
                "media_tmdb_id": tmdb,
                "title_link_status": title_status,
                "tvdb_title_id": tvdb,
                "tvdb_episode_id": (n.get("episode") or {}).get("id"),
                **recipient,
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
    from f.tvdb.award_quality import annotate

    return annotate(rows)


class ScopeError(ValueError):
    pass


def validate_rows(table, rows):
    """Validate a complete scope before writing any of its rows."""
    from f.sync.models.crate_schemas import SCHEMAS

    spec = SCHEMAS[table]
    for row in rows:
        for name, kind in spec["columns"].items():
            value = row.get(name)
            if value is None:
                if name in spec["primary_key"]:
                    raise ScopeError(f"Missing {name}")
                continue
            if kind in ("INTEGER", "BIGINT"):
                parsed = checked_id(
                    value, 2**31 - 1 if kind == "INTEGER" else 2**63 - 1
                )
                if parsed is None:
                    raise ScopeError(f"Invalid {name}")
                row[name] = parsed
        if row.get("media_type") not in (None, "movie", "show"):
            raise ScopeError("Invalid media type")


def data_error(error):
    if isinstance(error, (ScopeError, ValueError, TypeError, KeyError, AttributeError)):
        return True
    from crate.client.exceptions import ProgrammingError

    return isinstance(error, ProgrammingError) and any(
        text in str(error)
        for text in ("Cannot cast value", "ColumnValidationException")
    )


def quarantine(col, doc, error, now, result):
    # A concurrent source refresh must not inherit the old revision's quarantine.
    failures = doc.get("publish_failures", 0) + 1
    retry = now + timedelta(minutes=min(360, 15 * 2 ** min(failures - 1, 5)))
    col.update_one(
        {"_id": doc["_id"], "updated_at": doc["updated_at"]},
        {
            "$set": {
                "publish_error": {
                    "type": type(error).__name__,
                    "at": now,
                    "reason": str(error)
                    if isinstance(error, ScopeError)
                    else "source data rejected by database",
                },
                "publish_retry_at": retry,
                "publish_failures": failures,
            }
        },
    )
    result["failed_scopes"] += 1
    if len(result["failures"]) < 10:
        result["failures"].append(
            {
                "collection": col.name,
                "id": str(doc["_id"]),
                "type": type(error).__name__,
            }
        )


def write_scopes(connector, table, col, scopes, keys, scope_sql, now, result, counter):
    """Keep healthy batches fast, bisect only deterministic bad-data failures."""
    if not scopes:
        return
    try:
        upsert(connector, table, [row for _, _, rows in scopes for row in rows], keys)
        connector.run(f"REFRESH TABLE {table}")
        connector.run_many(
            f"DELETE FROM {table} WHERE {scope_sql} AND revision != ?",
            [list(params) + [doc["updated_at"]] for doc, params, _ in scopes],
        )
    except Exception as error:
        if not data_error(error):
            raise  # An outage/schema/programming failure must stay visible, not quarantine all titles.
        if len(scopes) == 1:
            quarantine(col, scopes[0][0], error, now, result)
        else:
            middle = len(scopes) // 2
            write_scopes(
                connector,
                table,
                col,
                scopes[:middle],
                keys,
                scope_sql,
                now,
                result,
                counter,
            )
            write_scopes(
                connector,
                table,
                col,
                scopes[middle:],
                keys,
                scope_sql,
                now,
                result,
                counter,
            )
        return
    for doc, _, rows in scopes:
        col.update_one(
            {"_id": doc["_id"], "updated_at": doc["updated_at"]},
            {
                "$set": {"published_at": doc["updated_at"], "publish_pending": False},
                "$unset": {
                    "publish_retry_at": "",
                    "publish_error": "",
                    "publish_failures": "",
                },
            },
        )
        result[counter] += 1
        result["rows"] += len(rows)
    col.database.tvdb_state.update_one(
        {"_id": "publication-progress:" + col.name}, {"$set": {"at": now}}, upsert=True
    )


def _publish(db, connector, limit=100):
    now = utc_now()
    result = {
        "titles": 0,
        "categories": 0,
        "rows": 0,
        "failed_scopes": 0,
        "failures": [],
        "system_errors": [],
    }
    for name, table, counter in [
        ("tvdb_titles", "tvdb_character", "titles"),
        ("tvdb_categories", "tvdb_nomination", "categories"),
    ]:
        if name == 'tvdb_categories' and (db.award_state.find_one({'_id':'legacy-publication'}) or {}).get('disabled'):
            continue
        col = db[name]
        query = {
            "publish_pending": True,
            "$or": [
                {"publish_retry_at": {"$exists": False}},
                {"publish_retry_at": {"$lte": now}},
            ],
        }
        scopes, seen = {}, {}
        try:
            for doc in col.find(query).sort("updated_at", 1).limit(limit):
                if doc["_id"] in seen and seen[doc["_id"]] >= doc["updated_at"]:
                    continue
                seen[doc["_id"]] = doc["updated_at"]
                try:
                    if name == "tvdb_titles":
                        if (
                            "characters" not in doc
                            or tmdb_id(doc.get("tmdb_id")) is None
                        ):
                            raise ScopeError("Incomplete or invalid local title scope")
                        rows = role_rows(db, connector, doc)
                        keys = ["media_type", "media_tmdb_id", "tvdb_character_id"]
                        scope_sql, params = (
                            "media_type = ? AND media_tmdb_id = ?",
                            (doc["media_type"], doc["tmdb_id"]),
                        )
                    else:
                        if "nominees" not in doc:
                            raise ScopeError("Incomplete nomination scope")
                        rows = nomination_rows(db, doc, connector)
                        keys = ["category_id", "nominee_id"]
                        scope_sql, params = "category_id = ?", (doc["_id"],)
                    validate_rows(table, rows)
                    # Mongo can yield an indexed document twice when its sort key changes.
                    # Reconcile each scope only once, using its newest observed snapshot.
                    previous = scopes.get(doc["_id"])
                    if (
                        previous is None
                        or previous[0]["updated_at"] <= doc["updated_at"]
                    ):
                        scopes[doc["_id"]] = (doc, params, rows)
                except Exception as error:
                    if not data_error(error):
                        raise
                    scopes.pop(doc["_id"], None)
                    quarantine(col, doc, error, now, result)
            if scopes:
                write_scopes(
                    connector,
                    table,
                    col,
                    list(scopes.values()),
                    keys,
                    scope_sql,
                    now,
                    result,
                    counter,
                )
        except Exception as error:  # noqa: BLE001 -- table boundary records failures and continues the independent table
            result["system_errors"].append(
                {"table": table, "type": type(error).__name__}
            )
    if result["titles"] or result["categories"]:
        db.tvdb_state.update_one(
            {"_id": "publication-progress"}, {"$set": {"at": now}}, upsert=True
        )
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
    from f.tvdb.store import record_run
    from mongoengine import get_db

    if not 1 <= limit <= 10000:
        raise ValueError("Invalid publication limit")
    init_mongodb()
    connector = None
    try:
        db = get_db()
        connector = CrateConnector()
        report = record_run(db, "publish", publish(db, connector, limit))
        if report.get("system_errors") or report.get("failed_scopes"):
            raise RuntimeError(
                "TVDB publication incomplete; see run:publish metrics and quarantined scopes"
            )
        return report
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()
