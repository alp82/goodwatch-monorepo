# Every 30 minutes: when does TMDB change offers, and how stale is the cached copy?
#  - Event titles due within a few days: the service's offers in every country, read fresh
#    (CloudFront cache bypassed) and cached (the plain URL a production job would use).
#  - Sentinel lists: Netflix US movies and shows from discover, read fresh.
# Appends a record only when something changed. Read-only TMDB GETs.
import datetime
import fcntl
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, STATS, append_jsonl_gz, expired, get, now, offers, stamp

WINDOW_BEFORE, WINDOW_AFTER = 5, 3


def due(events, today):
    lo = (today - datetime.timedelta(days=WINDOW_BEFORE)).isoformat()
    hi = (today + datetime.timedelta(days=WINDOW_AFTER)).isoformat()
    return [e for e in events if lo <= e["date"] <= hi]


def service_offers(e, fresh):
    res = get(f"/{e['media']}/{e['id']}/watch/providers", fresh=fresh)
    pids = {str(p) for p in e["providers"]}
    return sorted(o for o in offers(res) if o.split(":")[1] in pids)


def sentinel(media):
    sort = "title.asc" if media == "movie" else "name.asc"
    base = dict(watch_region="US", with_watch_providers=8, with_watch_monetization_types="flatrate|free|ads",
                include_adult="false", sort_by=sort)
    first = get("/discover/" + media, page=1, **base)
    ids = [x["id"] for x in first["results"]]
    with ThreadPoolExecutor(4) as ex:
        for r in ex.map(lambda p: get("/discover/" + media, page=p, **base)["results"],
                        range(2, min(first["total_pages"], 500) + 1)):
            ids += [x["id"] for x in r]
    return first["total_results"], sorted(set(ids))


def main():
    if expired():
        return
    lock = open(os.path.join(DATA, ".poll.lock"), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    at = stamp()
    state_path = os.path.join(DATA, "poll_state.json")
    state = json.load(open(state_path)) if os.path.exists(state_path) else {}
    events = due(json.load(open(os.path.join(DATA, "events.json"))), now().date())
    jobs = [(e, fresh) for e in events for fresh in (True, False)]
    with ThreadPoolExecutor(6) as ex:
        results = list(ex.map(lambda j: (j, service_offers(*j)), jobs))
    changes = 0
    for (e, fresh), cur in results:
        key = f"{e['media']}:{e['id']}:{'fresh' if fresh else 'cached'}"
        old = state.get(key)
        if old != cur:
            rec = {"at": at, "media": e["media"], "id": e["id"], "fresh": fresh,
                   "added": sorted(set(cur) - set(old or [])), "removed": sorted(set(old or []) - set(cur)),
                   "first": old is None}
            append_jsonl_gz("poll_events.jsonl.gz", rec)
            state[key] = cur
            changes += 1
    for media in ("movie", "tv"):
        total, ids = sentinel(media)
        key = f"sentinel:{media}"
        old = state.get(key)
        if old is None or old["ids"] != ids or old["total"] != total:
            rec = {"at": at, "media": media, "total": total, "n": len(ids),
                   "added": sorted(set(ids) - set(old["ids"] if old else [])),
                   "removed": sorted(set(old["ids"] if old else []) - set(ids)), "first": old is None}
            append_jsonl_gz("sentinel.jsonl.gz", rec)
            state[key] = {"ids": ids, "total": total}
            changes += 1
    tmp = state_path + ".tmp"
    json.dump(state, open(tmp, "w"))
    os.replace(tmp, state_path)
    append_jsonl_gz("poll_runs.jsonl.gz", {"at": at, "events": len(events), "changes": changes, **STATS})
    print(at, "events", len(events), "changes", changes, STATS, flush=True)


if __name__ == "__main__":
    main()
