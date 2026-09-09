# windmill: python3
from typing import Iterable, List, Dict
from psycopg2.extras import DictCursor

from f.db.postgres import init_postgres
from f.db.cratedb import CrateConnector

from f.sync.models.crate_models import (
    UserSetting,
    UserSkipped,
    UserWishlist,
    UserScore,
    UserFavorite,
    UserWatchHistory,
)

BATCH_SIZE_SIMPLE = 5000
BATCH_SIZE_UPSERT = 5000


def _chunks(it: List, size: int) -> Iterable[List]:
    for i in range(0, len(it), size):
        yield it[i : i + size]


def copy_user_favorite(pg, crate: CrateConnector) -> Dict:
    print("Copying user favorites...")
    cur = pg.cursor(cursor_factory=DictCursor)
    cur.execute("""
        SELECT DISTINCT
            user_id,
            tmdb_id,
            CASE WHEN media_type='tv' THEN 'show' ELSE media_type END AS media_type,
            EXTRACT(EPOCH FROM updated_at AT TIME ZONE 'UTC')::double precision AS updated_at
        FROM user_favorites
        WHERE tmdb_id IS NOT NULL AND media_type IS NOT NULL
    """)
    rows = cur.fetchall()
    models = []
    for row in rows:
        favorite = UserFavorite(
            user_id=row["user_id"],
            tmdb_id=row["tmdb_id"],
            media_type=row["media_type"],
            created_at=row["updated_at"],
            updated_at=row["updated_at"],
        )
        models.append(favorite)

    total_received, total_upserted = len(models), 0
    for batch in _chunks(models, BATCH_SIZE_UPSERT):
        res = crate.upsert_many(
            "user_favorite",
            batch,
            conflict_columns=["user_id", "tmdb_id", "media_type"],
        )
        total_upserted += res.get("rows_upserted", res.get("rowcount", 0))
    cur.close()
    return {"records_received": total_received, "rows_upserted": total_upserted}


def copy_user_score(pg, crate: CrateConnector) -> Dict:
    print("Copying user scores...")
    cur = pg.cursor(cursor_factory=DictCursor)
    cur.execute("""
        SELECT
            user_id,
            tmdb_id,
            CASE WHEN media_type='tv' THEN 'show' ELSE media_type END AS media_type,
            score,
            review,
            EXTRACT(EPOCH FROM updated_at AT TIME ZONE 'UTC')::double precision AS updated_at
        FROM user_scores
        WHERE tmdb_id IS NOT NULL AND media_type IS NOT NULL
    """)
    rows = cur.fetchall()
    models = []
    for row in rows:
        score = UserScore(
            user_id=row["user_id"],
            tmdb_id=row["tmdb_id"],
            media_type=row["media_type"],
            score=row["score"],
            review=row["review"],
            created_at=row["updated_at"],
            updated_at=row["updated_at"],
        )
        models.append(score)

    total_received, total_upserted = len(models), 0
    for batch in _chunks(models, BATCH_SIZE_UPSERT):
        res = crate.upsert_many(
            "user_score", batch, conflict_columns=["user_id", "tmdb_id", "media_type"]
        )
        total_upserted += res.get("rows_upserted", res.get("rowcount", 0))
    cur.close()
    return {"records_received": total_received, "rows_upserted": total_upserted}


def copy_user_setting(pg, crate: CrateConnector) -> Dict:
    """
    Deduplicate by newest created_at per (user_id, key).
    """
    print("Copying user settings (deduplicated by latest created_at)...")
    cur = pg.cursor(cursor_factory=DictCursor)
    cur.execute("""
        SELECT user_id, key, value,
               EXTRACT(EPOCH FROM created_at AT TIME ZONE 'UTC')::double precision AS created_at,
               EXTRACT(EPOCH FROM updated_at AT TIME ZONE 'UTC')::double precision AS updated_at
        FROM (
          SELECT
              user_id, key, value, created_at, updated_at,
              ROW_NUMBER() OVER (PARTITION BY user_id, key ORDER BY created_at DESC) AS rn
          FROM user_settings
        ) t
        WHERE rn = 1
    """)
    rows = cur.fetchall()
    models = []
    for row in rows:
        setting = UserSetting(
            user_id=row["user_id"],
            key=row["key"],
            value=row["value"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        models.append(setting)

    total_received, total_upserted = len(models), 0
    for batch in _chunks(models, BATCH_SIZE_UPSERT):
        res = crate.upsert_many(
            "user_setting", batch, conflict_columns=["user_id", "key"]
        )
        total_upserted += res.get("rows_upserted", res.get("rowcount", 0))
    cur.close()
    return {"records_received": total_received, "rows_upserted": total_upserted}


def copy_user_skipped(pg, crate: CrateConnector) -> Dict:
    print("Copying user skipped...")
    cur = pg.cursor(cursor_factory=DictCursor)
    cur.execute("""
        SELECT DISTINCT
            user_id,
            tmdb_id,
            CASE WHEN media_type='tv' THEN 'show' ELSE media_type END AS media_type,
            EXTRACT(EPOCH FROM updated_at AT TIME ZONE 'UTC')::double precision AS updated_at
        FROM user_skipped
        WHERE tmdb_id IS NOT NULL AND media_type IS NOT NULL
    """)
    rows = cur.fetchall()
    models = []
    for row in rows:
        skipped = UserSkipped(
            user_id=row["user_id"],
            tmdb_id=row["tmdb_id"],
            media_type=row["media_type"],
            created_at=row["updated_at"],
            updated_at=row["updated_at"],
        )
        models.append(skipped)

    total_received, total_upserted = len(models), 0
    for batch in _chunks(models, BATCH_SIZE_UPSERT):
        res = crate.upsert_many(
            "user_skipped", batch, conflict_columns=["user_id", "tmdb_id", "media_type"]
        )
        total_upserted += res.get("rows_upserted", res.get("rowcount", 0))
    cur.close()
    return {"records_received": total_received, "rows_upserted": total_upserted}


def copy_user_wishlist(pg, crate: CrateConnector) -> Dict:
    print("Copying user wishlist...")
    cur = pg.cursor(cursor_factory=DictCursor)
    cur.execute("""
        SELECT DISTINCT
            user_id,
            tmdb_id,
            CASE WHEN media_type='tv' THEN 'show' ELSE media_type END AS media_type,
            EXTRACT(EPOCH FROM updated_at AT TIME ZONE 'UTC')::double precision AS updated_at
        FROM user_wishlist
        WHERE tmdb_id IS NOT NULL AND media_type IS NOT NULL
    """)
    rows = cur.fetchall()
    models = []
    for row in rows:
        wishlist = UserWishlist(
            user_id=row["user_id"],
            tmdb_id=row["tmdb_id"],
            media_type=row["media_type"],
            created_at=row["updated_at"],
            updated_at=row["updated_at"],
        )
        models.append(wishlist)

    total_received, total_upserted = len(models), 0
    for batch in _chunks(models, BATCH_SIZE_UPSERT):
        res = crate.upsert_many(
            "user_wishlist",
            batch,
            conflict_columns=["user_id", "tmdb_id", "media_type"],
        )
        total_upserted += res.get("rows_upserted", res.get("rowcount", 0))
    cur.close()
    return {"records_received": total_received, "rows_upserted": total_upserted}


def copy_user_watch_history(pg, crate: CrateConnector) -> Dict:
    """
    No aggregation. One row per (user_id, tmdb_id, media_type).
    Build watched_at_list as a single-element array when present.
    """
    print("Copying user watch history (1:1, no aggregation)…")
    cur = pg.cursor(cursor_factory=DictCursor)
    cur.execute("""
        SELECT
            user_id,
            tmdb_id,
            CASE WHEN media_type='tv' THEN 'show' ELSE media_type END AS media_type,
            EXTRACT(EPOCH FROM updated_at AT TIME ZONE 'UTC')::double precision AS updated_at
        FROM user_watch_history
        WHERE tmdb_id IS NOT NULL AND media_type IS NOT NULL
    """)

    total_received = 0
    total_upserted = 0
    buffer: List[UserWatchHistory] = []

    while True:
        rows = cur.fetchmany(BATCH_SIZE_SIMPLE)
        if not rows:
            break

        for row in rows:
            updated_at = row["updated_at"]
            watch_count = 1
            watched_list = [updated_at] if updated_at is not None else []
            watch_history = UserWatchHistory(
                user_id=row["user_id"],
                tmdb_id=row["tmdb_id"],
                media_type=row["media_type"],
                watched_at_list=watched_list,
                first_watched_at=updated_at,
                last_watched_at=updated_at,
                watch_count=watch_count,
                progress_percent=None,
                progress_seconds=None,
                season_number=None,
                episode_number=None,
                ingest_source=None,
                created_at=row["updated_at"],
                updated_at=row["updated_at"],
            )
            buffer.append(watch_history)

        total_received += len(rows)

        for batch in _chunks(buffer, BATCH_SIZE_UPSERT):
            res = crate.upsert_many(
                table="user_watch_history",
                records=batch,
                conflict_columns=["user_id", "tmdb_id", "media_type"],
            )
            total_upserted += res.get("rows_upserted", res.get("rowcount", 0))
        buffer.clear()

    cur.close()
    return {"records_received": total_received, "rows_upserted": total_upserted}


def main():
    pg = init_postgres()
    crate = CrateConnector()
    try:
        results = {}
        results["user_favorite"] = copy_user_favorite(pg, crate)
        results["user_score"] = copy_user_score(pg, crate)
        results["user_setting"] = copy_user_setting(pg, crate)
        results["user_skipped"] = copy_user_skipped(pg, crate)
        results["user_wishlist"] = copy_user_wishlist(pg, crate)
        results["user_watch_history"] = copy_user_watch_history(pg, crate)

        print("\n=== Migration Summary ===")
        for table, stats in results.items():
            print(
                f"{table:>20s}: received={stats['records_received']}, upserted={stats['rows_upserted']}"
            )
        return results
    finally:
        try:
            crate.disconnect()
        except Exception:
            pass
        try:
            pg.close()
        except Exception:
            pass
