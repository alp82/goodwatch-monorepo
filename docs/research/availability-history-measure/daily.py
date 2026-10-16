# Once a day: read the 60 panel lists from discover the way a daily list job would, and check
# every change against the per-title offers, to tell real arrivals and drops from fetch errors.
#  - Each list is read fresh, twice: sorted by title and by date. Lists over 10,000 titles are
#    read in date spans. A list is complete when the union matches total_results.
#  - Each title that appeared or vanished since the previous day is rechecked with one
#    /watch/providers request (fresh). Real = the per-title offers agree with the list change.
#  - Titles that vanished on an earlier day and are back today are recorded as returns.
# Read-only TMDB GETs. Writes only to this measurement's data directory.
import fcntl
import gzip
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, STATS, TYPES, expired, get, now, offers, stamp

DATE = {"movie": "primary_release_date", "tv": "first_air_date"}
SORTS = {"movie": ("title.asc", "primary_release_date.desc"), "tv": ("name.asc", "first_air_date.desc")}
SPANS = ([(None, "1979-12-31")] + [(f"{y}-01-01", f"{y + 4}-12-31") for y in range(1980, 2015, 5)]
         + [(f"{y}-01-01", f"{y}-12-31") for y in range(2015, 2027)] + [("2027-01-01", None)])


def pages(item, sort, extra):
    base = dict(watch_region=item["reg"], with_watch_providers=item["pid"],
                with_watch_monetization_types="flatrate|free|ads", include_adult="false", sort_by=sort, **extra)
    first = get("/discover/" + item["media"], page=1, **base)
    ids = [x["id"] for x in first["results"]]
    for p in range(2, min(first["total_pages"], 500) + 1):
        ids += [x["id"] for x in get("/discover/" + item["media"], page=p, **base)["results"]]
    return set(ids), first["total_results"]


def read_list(item):
    by_sort, total = {}, 0
    spans = SPANS if item["total"] > 10000 else [(None, None)]
    for sort in SORTS[item["media"]]:
        ids, tot = set(), 0
        for lo, hi in spans:
            extra = {}
            if lo:
                extra[DATE[item["media"]] + ".gte"] = lo
            if hi:
                extra[DATE[item["media"]] + ".lte"] = hi
            i, t = pages(item, sort, extra)
            ids |= i
            tot += t
        by_sort[sort] = ids
        total = max(total, tot)
    a, b = by_sort.values()
    union = a | b
    return {"reg": item["reg"], "media": item["media"], "pid": item["pid"], "name": item["name"],
            "total": total, "ids": sorted(union), "missing_a": sorted(union - a), "missing_b": sorted(union - b)}


def key(l):
    return f"{l['reg']}:{l['media']}:{l['pid']}"


def has_offer(res, reg, pid):
    return any(o.startswith(f"{reg}:{pid}:") for o in offers(res, reg))


def main():
    if expired():
        return
    lock = open(os.path.join(DATA, ".daily.lock"), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    started = stamp()
    day = now().date().isoformat()
    panel = json.load(open(os.path.join(DATA, "panel.json")))
    with ThreadPoolExecutor(6) as ex:
        lists = list(ex.map(read_list, panel))
    list_requests = STATS["requests"]
    snap_path = os.path.join(DATA, f"daily-snap-{day}.json.gz")
    snaps = sorted(f for f in os.listdir(DATA) if f.startswith("daily-snap-") and f < os.path.basename(snap_path))
    with gzip.open(snap_path, "wt") as f:
        json.dump({"at": started, "lists": lists}, f)
    report = {"day": day, "started": started, "list_requests": list_requests, "lists": [], "returns": []}
    for l in lists:
        report["lists"].append({"key": key(l), "total": l["total"], "seen": len(l["ids"]),
                                "complete": len(l["ids"]) == l["total"],
                                "missing_title_sort": len(l["missing_a"]), "missing_date_sort": len(l["missing_b"])})
    if snaps:
        prev = json.load(gzip.open(os.path.join(DATA, snaps[-1]), "rt"))
        prev_by = {key(l): set(l["ids"]) for l in prev["lists"]}
        cands = []
        for l in lists:
            old, cur = prev_by.get(key(l), set()), set(l["ids"])
            cands += [(l, i, "appeared") for i in cur - old] + [(l, i, "vanished") for i in old - cur]
        # Titles that vanished (confirmed) on an earlier day and are listed again today.
        gone = {}
        for f in sorted(os.listdir(DATA)):
            if f.startswith("daily-report-") and f < f"daily-report-{day}.json":
                for c in json.load(open(os.path.join(DATA, f))).get("changes", []):
                    k2 = (c["list"], c["id"])
                    if c["kind"] == "vanished" and c["real"]:
                        gone[k2] = c["day"]
                    elif c["kind"] == "appeared" and c["real"]:
                        gone.pop(k2, None)
        cur_by = {key(l): set(l["ids"]) for l in lists}
        report["returns"] = [{"list": k2[0], "id": k2[1], "vanished_on": d} for k2, d in gone.items()
                             if k2[1] in cur_by.get(k2[0], set())]
        titles = sorted({(l["media"], i) for l, i, _ in cands})

        def check(t):
            return t, get(f"/{t[0]}/{t[1]}/watch/providers")

        with ThreadPoolExecutor(6) as ex:
            res = dict(ex.map(check, titles))
        report["changes"] = []
        for l, i, kind in cands:
            listed = has_offer(res[(l["media"], i)], l["reg"], l["pid"])
            report["changes"].append({"day": day, "list": key(l), "id": i, "kind": kind,
                                      "real": listed if kind == "appeared" else not listed})
        report["previous"] = prev["at"]
    report.update({"finished": stamp(), **STATS})
    json.dump(report, open(os.path.join(DATA, f"daily-report-{day}.json"), "w"))
    ch = report.get("changes", [])
    print(started, "lists", len(lists), "incomplete", sum(not x["complete"] for x in report["lists"]),
          "changes", len(ch), "real", sum(c["real"] for c in ch), "returns", len(report["returns"]), STATS, flush=True)


if __name__ == "__main__":
    main()
