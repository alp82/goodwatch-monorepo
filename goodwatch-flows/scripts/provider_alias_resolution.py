"""Reversible retirement primitives for verified movie aliases.

The operator must archive complete source/publication/user snapshots, deploy
canonicalizing readers/writers, and drain affected publishers before deletion.
This module deliberately has no automatic production entrypoint.
"""

from copy import deepcopy
from datetime import datetime

from f.data_source.title_identity import RETIRED_MOVIE_IDS

MOVIE_COLLECTIONS = (
    "tmdb_movie_details", "imdb_movie_rating", "metacritic_movie_rating",
    "rotten_tomatoes_movie_rating", "tv_tropes_movie_tags", "genome_movie",
    "dna_movie", "tmdb_movie_providers",
)
MOVIE_CHILD_TABLES = (
    "alternative_title", "media_image", "media_video", "release_event",
    "streaming_availability", "person_appeared_in", "person_worked_on",
    "translation", "trope",
)
USER_TABLES = (
    "user_favorite", "user_score", "user_skipped", "user_watch_history", "user_wishlist",
)


def retired_validator(existing: dict) -> dict:
    """Intersect the existing validator; never replace its identity constraints."""
    deny = {"tmdb_id": {"$nin": sorted(RETIRED_MOVIE_IDS)}}
    if existing == deny or deny in existing.get("$and", []):
        return deepcopy(existing)
    return {"$and": [deepcopy(existing), deny]} if existing else deny


def transfer_demand(db, alias: int, outstanding: int) -> dict:
    """Apply only untransferred demand, recording its amount in the SAME row.

    Caller fences the alias queue row and archives its demand/acknowledgment.
    Canonical enqueues may continue: OCC retries preserve them. On a lost
    response rerun with the same outstanding total. Never clear or acknowledge
    the alias row until the returned ledger has been read back successfully.
    """
    canonical = RETIRED_MOVIE_IDS[alias]
    if isinstance(outstanding, bool) or not isinstance(outstanding, int) or outstanding < 0:
        raise ValueError("Invalid outstanding demand")
    db.run(
        """INSERT INTO crawl_priority
           (media_type, tmdb_id, demand, acknowledged_demand, claimed_demand, created_at, updated_at)
           VALUES ('movie', ?, 0, 0, 0, current_timestamp, current_timestamp)
           ON CONFLICT (media_type, tmdb_id) DO NOTHING""", (canonical,),
    )
    for _ in range(16):
        row = db.select(
            """SELECT demand, acknowledged_demand, alias_demand_transfers, _seq_no, _primary_term
               FROM crawl_priority WHERE media_type = 'movie' AND tmdb_id = ?""", (canonical,),
        )[0]
        ledger = dict(row.get("alias_demand_transfers") or {})
        previous = ledger.get(str(alias), 0)
        if not isinstance(previous, int) or previous < 0 or previous > outstanding:
            raise RuntimeError("Alias demand ledger conflicts with the archived source")
        if str(alias) in ledger and previous == outstanding:
            return {"alias": alias, "canonical": canonical, "transferred": previous}
        ledger[str(alias)] = outstanding
        db.run(
            """UPDATE crawl_priority SET demand = demand + ?, alias_demand_transfers = ?,
               updated_at = current_timestamp
               WHERE media_type = 'movie' AND tmdb_id = ? AND _seq_no = ? AND _primary_term = ?""",
            (outstanding - previous, ledger, canonical, row["_seq_no"], row["_primary_term"]),
        )
        # Always reread, even after a successful update, before deleting sources.
    raise RuntimeError("Concurrent queue changes prevented alias demand transfer")


def resolve_tombstone(db, alias: int, archive_path: str, archive_hash: str):
    """Retain all quarantine provenance; expose a resolved, permanent tombstone."""
    canonical = RETIRED_MOVIE_IDS[alias]
    result = db.provider_identity_unresolved.update_one(
        {"_id": f"movie:{alias}", "media": "movie", "tmdb_id": alias,
         "status": {"$in": ["unresolved", "resolved_alias"]}},
        {"$set": {"status": "resolved_alias", "canonical_tmdb_id": canonical,
                  "resolution_reason": "TMDB alias 404; canonical ID and IMDb identity verified",
                  "resolution_archive_path": archive_path, "resolution_archive_hash": archive_hash,
                  "resolved_at": datetime.utcnow()}},
    )
    if result.matched_count != 1:
        raise RuntimeError("Original quarantine tombstone missing")
