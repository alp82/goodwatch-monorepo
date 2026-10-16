# Build data/events.json: titles with a known real day on a service.
#  - Netflix US arrivals and departures announced by date (data/netflix_us_schedule.tsv).
#  - Originals: shows by network and movies by studio that premiere 2026-10-01 to 2026-11-15.
# Run once; rerun to refresh the premiere dates.
import json
import os
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, get

LO, HI = "2026-10-01", "2026-11-15"
NETWORKS = {213: "Netflix", 2739: "Disney+", 2552: "Apple TV", 1024: "Prime Video", 3186: "HBO Max",
            453: "Hulu", 4330: "Paramount+", 3353: "Peacock"}
STUDIOS = {"178464|198834|185004": "Netflix", "210099": "Prime Video", "194232": "Apple TV", "158691": "HBO Max"}
# The TMDB provider ids that count as the service, per network name.
PROVIDERS = {"Netflix": [8, 1796], "Disney+": [337], "Apple TV": [350], "Prime Video": [9, 2100],
             "HBO Max": [1899, 384], "Hulu": [15], "Paramount+": [2303, 2616, 531], "Peacock": [386, 387]}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s.replace("&", "and")).strip()


def match(row):
    date, kind, media, year, title = row
    params = {"query": title}
    if year:
        params["primary_release_year" if media == "movie" else "first_air_date_year"] = year
    res = (get("/search/" + media, fresh=False, **params) or {}).get("results", [])
    if not res and year:  # years in the schedule are sometimes off by one
        res = (get("/search/" + media, fresh=False, query=title) or {}).get("results", [])
    exact = [r for r in res if norm(r.get("title") or r.get("name")) == norm(title)]
    pick = (exact or res[:1] or [None])[0]
    if not pick:
        return None
    return {"id": pick["id"], "media": media, "title": title, "kind": kind, "date": date, "region": "US",
            "service": "Netflix", "providers": PROVIDERS["Netflix"], "source": "whats-on-netflix",
            "exact_title": bool(exact)}


def schedule():
    rows = []
    for line in open(os.path.join(DATA, "netflix_us_schedule.tsv")):
        if line.startswith("#") or not line.strip():
            continue
        rows.append(line.rstrip("\n").split("\t"))
    with ThreadPoolExecutor(6) as ex:
        return [e for e in ex.map(match, rows) if e]


def premieres():
    out = []
    for net, name in NETWORKS.items():
        page = 1
        while True:
            r = get("/discover/tv", fresh=False, with_networks=net, page=page,
                    **{"first_air_date.gte": LO, "first_air_date.lte": HI})
            for x in r["results"]:
                out.append({"id": x["id"], "media": "tv", "title": x["name"], "kind": "premiere",
                            "date": x["first_air_date"], "region": None, "service": name,
                            "providers": PROVIDERS[name], "source": "tmdb first_air_date"})
            if page >= r["total_pages"]:
                break
            page += 1
    for companies, name in STUDIOS.items():
        page = 1
        while True:
            r = get("/discover/movie", fresh=False, with_companies=companies, page=page,
                    with_release_type="4", **{"release_date.gte": LO, "release_date.lte": HI})
            for x in r["results"]:
                out.append({"id": x["id"], "media": "movie", "title": x["title"], "kind": "premiere",
                            "date": None, "region": None, "service": name, "providers": PROVIDERS[name],
                            "source": "tmdb digital release"})
            if page >= r["total_pages"] or page >= 5:
                break
            page += 1

    def digital_date(e):
        # A movie's premiere on the service is its earliest digital (type 4) release.
        if e["media"] != "movie":
            return e
        rd = get(f"/movie/{e['id']}/release_dates", fresh=False) or {"results": []}
        days = sorted(d["release_date"][:10] for c in rd["results"] for d in c["release_dates"] if d["type"] == 4)
        e["date"] = days[0] if days else None
        return e

    with ThreadPoolExecutor(6) as ex:
        out = list(ex.map(digital_date, out))
    return [e for e in out if e["date"] and LO <= e["date"] <= HI]


if __name__ == "__main__":
    ev = schedule() + premieres()
    seen, uniq = set(), []
    for e in ev:
        k = (e["media"], e["id"], e["kind"], e["date"])
        if k not in seen:
            seen.add(k)
            uniq.append(e)
    json.dump(uniq, open(os.path.join(DATA, "events.json"), "w"), indent=0)
    by = {}
    for e in uniq:
        by[(e["kind"], e["media"])] = by.get((e["kind"], e["media"]), 0) + 1
    print(len(uniq), by)
    print("inexact title matches:", [e["title"] for e in uniq if e.get("exact_title") is False])
