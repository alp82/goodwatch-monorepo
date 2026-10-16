"""Read-only Windmill preview: selection plus live TMDB offer additions.

Before deployment, inline f/tmdb_api/recent_releases.py in place of its import
(omit that module's main). Submit as a Python preview, not a deployed script.
Only SELECT/find and TMDB GET are used. Nothing reserves, fetches through the
production writer, publishes, refreshes a table, or creates an index.
"""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock
import time

import requests
import wmill
from mongoengine import get_db

from f.db.cratedb import CrateConnector
from f.db.mongodb import init_mongodb, close_mongodb
from f.sync.copy.tmdb_streaming import availability_key, reconcile_availability
from f.tmdb_api.provider_evidence import validated_results
from f.tmdb_api.recent_releases import select_recheck


def main():
    crate = CrateConnector()
    init_mongodb()
    try:
        now = datetime.now(timezone.utc)
        plan = select_recheck(crate, get_db(), now)
        titles = plan.pop("titles")
        plan.pop("batches")
        existing = defaultdict(list)
        for kind in ("movie", "show"):
            ids = [t["tmdb_id"] for t in titles if t["media_type"] == kind]
            for offset in range(0, len(ids), 200):
                rows = crate.select(
                    "SELECT * FROM streaming_availability WHERE media_type = ? "
                    "AND media_tmdb_id = ANY(?) LIMIT 100001", (kind, ids[offset:offset + 200]),
                )
                if len(rows) > 100000:
                    raise RuntimeError("Offer read exceeded its limit; refusing an incomplete comparison")
                for row in rows:
                    existing[(kind, row["media_tmdb_id"])].append(row)

        api_key = wmill.get_variable("u/Alp/TMDB_API_KEY")
        lock = Lock()
        next_request = 0.0
        request_count = 0

        def fetch(title):
            nonlocal next_request, request_count
            kind, tmdb_id = title["media_type"], title["tmdb_id"]
            url = f"https://api.themoviedb.org/3/{'tv' if kind == 'show' else 'movie'}/{tmdb_id}/watch/providers"
            for attempt in range(3):
                # All workers together start at most ten requests a second.
                with lock:
                    delay = max(0, next_request - time.monotonic())
                    next_request = max(next_request, time.monotonic()) + 0.1
                    request_count += 1
                time.sleep(delay)
                try:
                    response = requests.get(url, params={"api_key": api_key}, timeout=30)
                except requests.RequestException:
                    # Never print requests exceptions: their URLs contain the key.
                    continue
                if response.status_code == 429 or response.status_code >= 500:
                    time.sleep(min(30, 2 ** attempt))
                    continue
                if response.status_code != 200:
                    return {"media_type": kind, "tmdb_id": tmdb_id, "error": f"HTTP {response.status_code}"}
                try:
                    payload = response.json()
                except ValueError:
                    return {"media_type": kind, "tmdb_id": tmdb_id, "error": "Invalid JSON"}
                if payload.get("id") != tmdb_id or validated_results(payload) is None:
                    return {"media_type": kind, "tmdb_id": tmdb_id, "error": "Invalid provider response"}
                prior = existing[(kind, tmdb_id)]
                # Reuse the writer's pure reconciliation; do not call its publication
                # entry point, which takes leases and writes. Scraped offers already
                # in Crate remain in prior; no new scrape is being simulated here.
                rows, _, _ = reconcile_availability(
                    tmdb_id, kind, prior, {"updated_at": now, "watch_providers": payload}, [], {},
                )
                added = set(rows) - {availability_key(row) for row in prior}
                return {
                    "media_type": kind, "tmdb_id": tmdb_id,
                    "existing_offers": len(prior), "added_offers": len(added),
                    "added_subscription_free_ads": sum(key[4] in ("flatrate", "free", "ads") for key in added),
                    "added_countries": len({key[2] for key in added}),
                }
            return {"media_type": kind, "tmdb_id": tmdb_id, "error": "Request retries exhausted"}

        results = []
        with ThreadPoolExecutor(max_workers=8) as pool:
            for result in pool.map(fetch, titles):
                results.append(result)
                if len(results) % 500 == 0:
                    print(f"Compared {len(results)}/{len(titles)} titles", flush=True)
        failures = [r for r in results if "error" in r]
        successful = [r for r in results if "error" not in r]
        return plan | {
            "measured_at": now.isoformat(), "tmdb_requests": request_count,
            "compared": len(successful), "failures": failures,
            "titles_gaining_offers": sum(r["added_offers"] > 0 for r in successful),
            "titles_gaining_first_offers": sum(r["added_offers"] > 0 and not r["existing_offers"] for r in successful),
            "added_offers": sum(r["added_offers"] for r in successful),
            "added_subscription_free_ads": sum(r["added_subscription_free_ads"] for r in successful),
            "by_media_type": {kind: {
                "compared": sum(r["media_type"] == kind for r in successful),
                "titles_gaining_offers": sum(r["media_type"] == kind and r["added_offers"] > 0 for r in successful),
            } for kind in ("movie", "show")},
        }
    finally:
        close_mongodb()
        crate.disconnect()
