"""Read-only Letterboxd counts for recurring reports; uses the local Windmill profile.

Run from the repo root with goodwatch-flows/.venv/bin/python. Optional --state-file
stores only count snapshots locally, for deltas; it never changes either database.
"""
import argparse
import contextlib
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import io
import json
from pathlib import Path
import sys
from unittest.mock import patch
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))


def collect(remote):
    from mongoengine import get_db
    from f.db.mongodb import init_mongodb, close_mongodb
    from f.db.cratedb import CrateConnector

    @lru_cache()
    def variable(name):
        request = Request(
            remote["remote"].rstrip("/") + "/api/w/" + remote["workspaceId"] + "/variables/get_value/" + name,
            headers={"Authorization": "Bearer " + remote["token"]},
        )
        with urlopen(request, timeout=30) as response:
            return json.load(response)

    now = datetime.now(timezone.utc)
    cutoff = now.replace(tzinfo=None) - timedelta(hours=2)
    group = {
        "_id": None,
        "queued": {"$sum": 1},
        "attempted": {"$sum": {"$cond": [{"$ne": [{"$ifNull": ["$crawled_at", None]}, None]}, 1, 0]}},
        "scored": {"$sum": {"$cond": [{"$gt": [{"$ifNull": ["$user_score_original", 0]}, 0]}, 1, 0]}},
        "attempted_last_two_hours": {"$sum": {"$cond": [{"$gte": ["$crawled_at", cutoff]}, 1, 0]}},
        "latest_crawl_at": {"$max": "$crawled_at"},
    }
    for status in ("unrated", "error", "blocked", "not_found", "rejected", "unavailable"):
        group[status] = {"$sum": {"$cond": [{"$eq": ["$crawl_status", status]}, 1, 0]}}
    connector = None
    # Shared connection helpers print operational details; the report emits JSON only.
    with patch("wmill.get_variable", side_effect=variable), contextlib.redirect_stdout(io.StringIO()):
        init_mongodb()
        try:
            db = get_db()
            mongo = next(db.letterboxd_movie_rating.aggregate([{"$group": group}]), {})
            mongo.pop("_id", None)
            state = db.critic_site_state.find_one({"_id": "letterboxd"}) or {}
            blocked_until = state.get("blocked_until")
            source_block = ({"until": blocked_until, "reason": state.get("blocked_reason")}
                            if blocked_until and blocked_until > now.replace(tzinfo=None) else None)
            connector = CrateConnector()
            crate = connector.select(
                "SELECT count(*) AS with_url, count(letterboxd_user_score_original) AS scored, "
                "count(letterboxd_user_score_rating_count) AS with_vote_count, "
                "max(letterboxd_ratings_updated_at) AS latest_source_update "
                "FROM movie WHERE letterboxd_url IS NOT NULL"
            )[0]
        finally:
            if connector:
                connector.disconnect()
            close_mongodb()
    return {"checked_at": now.isoformat(), "mongo": mongo, "crate": crate,
            "source_block": source_block, "score_count_gap": mongo.get("scored", 0) - crate["scored"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default="goodwatch")
    parser.add_argument("--state-file", type=Path)
    args = parser.parse_args()
    try:
        remotes = Path.home() / ".config/windmill/remotes.ndjson"
        remote = next(row for row in map(json.loads, remotes.read_text().splitlines())
                      if row.get("name") == args.profile)
        previous = json.loads(args.state_file.read_text()) if args.state_file and args.state_file.exists() else None
        result = collect(remote)
        if previous:
            result["since_previous"] = {"checked_at": previous["checked_at"]}
            for database, fields in (("mongo", ("attempted", "scored", "unrated", "error")),
                                     ("crate", ("with_url", "scored", "with_vote_count"))):
                result["since_previous"][database] = {
                    field: result[database].get(field, 0) - previous[database].get(field, 0) for field in fields}
        output = json.dumps(result, indent=2, default=lambda value: value.isoformat())
        if args.state_file:
            args.state_file.parent.mkdir(parents=True, exist_ok=True)
            temporary = args.state_file.with_name(args.state_file.name + ".tmp")
            temporary.write_text(output + "\n")
            temporary.replace(args.state_file)
        print(output)
    except Exception as error:
        # Credential-bearing client exceptions must not reach a chat/notification.
        print(json.dumps({"error": type(error).__name__, "message": "Count check failed; no new baseline saved."}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
