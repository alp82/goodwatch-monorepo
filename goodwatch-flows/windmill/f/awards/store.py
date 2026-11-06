# extra_requirements:
# pymongo
# mongoengine
# wmill

"""Versioned source snapshots and independent normalization/reconciliation checkpoints."""

import json
import zlib
from datetime import timedelta
from uuid import uuid4

from f.awards.models import digest
from f.sync.copy.sync_state import utc_now
from pymongo import ReturnDocument, UpdateOne

NORMALIZER_VERSION = 2


def indexes(db):
    db.award_observations.create_index([("scope_id", 1), ("revision", 1)])
    db.award_entries.create_index([("generation", 1), ("program_key", 1)])
    db.award_entries.create_index("recipients.person_tmdb_id")
    db.award_entries.create_index("works.media_tmdb_id")
    db.award_title_projection.create_index("generation")
    db.award_person_projection.create_index("generation")
    db.award_source_identities.create_index("canonical_id")
    db.award_wikidata_queue.create_index([("due_at", 1), ("priority", -1)])
    db.award_runs.create_index("at", expireAfterSeconds=90 * 86400)


def canonical_id(db, kind, key):
    return db.award_source_identities.find_one_and_update(
        {"_id": f"{kind}:{key}"},
        {
            "$setOnInsert": {
                "kind": kind,
                "canonical_id": str(uuid4()),
                "created_at": utc_now(),
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )["canonical_id"]


def save_raw(db, source, raw):
    key = digest(raw)
    if db.award_raw_snapshots.find_one({"_id": key}, {"_id": 1}):
        return key
    encoded = zlib.compress(
        json.dumps(raw, sort_keys=True, ensure_ascii=False, default=str).encode()
    )
    chunks = []
    for offset in range(0, len(encoded), 512_000):
        chunk = key + ":" + str(offset)
        db.award_raw_chunks.update_one(
            {"_id": chunk},
            {"$setOnInsert": {"data": encoded[offset : offset + 512_000]}},
            upsert=True,
        )
        chunks.append(chunk)
    db.award_raw_snapshots.update_one(
        {"_id": key},
        {
            "$setOnInsert": {
                "source": source,
                "encoding": "zlib-json",
                "chunks": chunks,
                "fetched_at": utc_now(),
            }
        },
        upsert=True,
    )
    return key


def load_raw(db, key):
    manifest = db.award_raw_snapshots.find_one({"_id": key})
    if not manifest or manifest["encoding"] != "zlib-json":
        raise ValueError("Missing award source snapshot")
    chunks = [db.award_raw_chunks.find_one({"_id": k}) for k in manifest["chunks"]]
    if any(c is None for c in chunks):
        raise ValueError("Incomplete award source snapshot")
    value = json.loads(zlib.decompress(b"".join(c["data"] for c in chunks)))
    if digest(value) != key:
        raise ValueError("Corrupt award source snapshot")
    return value


def save_scope(db, source, scope, observations, raw=None, source_revision=None):
    """Commit one complete source scope only after all versioned observations exist."""
    rows = [o.to_dict() if hasattr(o, "to_dict") else o for o in observations]
    rows.sort(key=lambda row: row["record_id"])
    scope_id = f"{source}:{scope}"
    revision = digest(
        [
            NORMALIZER_VERSION,
            source_revision,
            rows,
            digest(raw) if raw is not None else None,
        ]
    )
    previous = db.award_scopes.find_one({"_id": scope_id}) or {}
    if previous.get("active_revision") == revision:
        return {"changed": False, "observations": len(rows)}
    raw_ref = save_raw(db, source, raw) if raw is not None else None
    ops = []
    for row in rows:
        key = f"{source}:{row['record_id']}"
        doc = row | {
            "scope_id": scope_id,
            "observation_key": key,
            "revision": revision,
            "raw_ref": row.get("raw_ref") or raw_ref,
        }
        ops.append(
            UpdateOne(
                {"_id": digest([scope_id, key, revision])}, {"$set": doc}, upsert=True
            )
        )
    for offset in range(0, len(ops), 500):
        db.award_observations.bulk_write(ops[offset : offset + 500], ordered=False)
    db.award_scopes.update_one(
        {"_id": scope_id},
        {
            "$set": {
                "source": source,
                "active_revision": revision,
                "observation_count": len(rows),
                "normalized_at": utc_now(),
                "normalizer_version": NORMALIZER_VERSION,
            }
        },
        upsert=True,
    )
    db.award_state.update_one(
        {"_id": "reconcile"},
        {"$set": {"pending": True, "requested_at": utc_now()}},
        upsert=True,
    )
    return {"changed": True, "observations": len(rows)}


def active_observations(db, scopes=None):
    for scope in scopes if scopes is not None else db.award_scopes.find({}):
        yield from db.award_observations.find(
            {"scope_id": scope["_id"], "revision": scope["active_revision"]}
        )


def record_run(db, job, report):
    now = utc_now()
    db.award_runs.insert_one({"job": job, "at": now, **report})
    db.award_state.update_one(
        {"_id": "run:" + job}, {"$set": {"at": now, "report": report}}, upsert=True
    )
    return report


def enqueue(db, qid, kind, priority=0):
    db.award_wikidata_queue.update_one(
        {"_id": qid},
        {
            "$set": {"kind": kind},
            "$setOnInsert": {
                "due_at": utc_now() - timedelta(days=1),
                "priority": priority,
            },
        },
        upsert=True,
    )


def main():
    """Shared durable source state."""
