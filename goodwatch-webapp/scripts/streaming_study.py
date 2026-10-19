"""Builds the data of the streaming study (/blog/streaming-by-country-2026) from a fresh, read-only snapshot.

    TMDB_API_KEY=... python3 streaming_study.py --crate-env path/to/.env

1. Reads the titles from CrateDB: every movie and show with at least 50,000 IMDb votes, first released at least
   180 days ago (one read-only query each).
2. Reads TMDB's watch providers for every title, and Netflix's catalogue totals per country (about 5,700 GET
   requests, about 5 minutes). Nothing is written anywhere but the files below.
3. Writes the page's data file and the two CSV files (CC BY 4.0).

The raw snapshot stays in --cache-dir, outside the repository: TMDB's terms limit caching to six months, and it is
JustWatch's offer data. Only counts go into the repository.
"""
import argparse
import base64
import csv
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from streaming_study_analysis import MAJOR, analyse, findings

SCRIPT_DIR = Path(__file__).resolve().parent
SLUG = "streaming-by-country-2026"
DATA_FILE = SCRIPT_DIR / f"../app/content/blog/{SLUG}/data.json"
# Not under public/blog: a folder there makes /blog a directory, and the static file server redirects it to /blog/.
PUBLIC_DIR = SCRIPT_DIR / f"../public/downloads/{SLUG}"
CSV_COUNTRIES = "goodwatch-streaming-by-country-2026.csv"
CSV_TITLES = "goodwatch-streaming-by-title-2026.csv"
TMDB = "https://api.themoviedb.org/3"
NETFLIX = "8|1796"  # Netflix and Netflix Standard with Ads
# Studio Ghibli's films in the list, by TMDB id.
GHIBLI = {81, 128, 129, 4935, 8392, 10515, 11621, 12429, 15370, 16859, 37797, 51739, 83389, 149870, 149871, 242828,
          508883}
# The one Ghibli film in the list licensed apart from the others (its rights are with the publisher Shinchosha):
# Grave of the Fireflies, on Netflix in Japan since July 2025.
GHIBLI_APART = {12477}
# The name a reader knows, where the catalogue keeps another one. Links still use the catalogue's title.
TITLE_NAMES = {81: "Nausicaä of the Valley of the Wind"}
# Countries whose names are long in the charts.
SHORT_NAMES = {"US": "United States", "GB": "United Kingdom", "AE": "UAE", "HK": "Hong Kong",
               "BA": "Bosnia and Herzegovina", "TC": "Turks and Caicos"}

ELIGIBLE = ("imdb_user_score_rating_count >= 50000 AND goodwatch_overall_score_normalized_percent IS NOT NULL "
            "AND (adult = false OR adult IS NULL) AND poster_path IS NOT NULL")
NOT_SHOWS = " ".join(f"AND NOT coalesce('{g}' = ANY(genres), false)" for g in ("Talk", "News", "Soap", "Reality"))
QUERIES = {
    "movie": ("SELECT tmdb_id, title, release_year, goodwatch_overall_score_normalized_percent, "
              "goodwatch_overall_score_voting_count, production_country_codes FROM movie "
              f"WHERE {ELIGIBLE} AND status = 'Released' AND release_date <= now() - INTERVAL '180 days' LIMIT 100000"),
    "show": ("SELECT tmdb_id, title, release_year, goodwatch_overall_score_normalized_percent, "
             "goodwatch_overall_score_voting_count, origin_country_codes FROM show "
             f"WHERE {ELIGIBLE} AND first_air_date <= now() - INTERVAL '180 days' {NOT_SHOWS} LIMIT 100000"),
}


def read_env(path: Path | None) -> dict:
    env = dict(os.environ)
    if path and path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return env


def crate_select(env: dict, statement: str) -> list[list]:
    """One read-only statement over Crate's HTTP endpoint."""
    if not statement.lstrip().upper().startswith("SELECT"):
        raise ValueError("The study only reads")
    host = env["CRATE_HOSTS"].split(",")[0].strip()
    request = urllib.request.Request(f"http://{host}:{env.get('CRATE_PORT') or '4200'}/_sql",
                                     data=json.dumps({"stmt": statement}).encode(),
                                     headers={"Content-Type": "application/json"})
    if env.get("CRATE_USER"):
        token = base64.b64encode(f"{env['CRATE_USER']}:{env.get('CRATE_PASS', '')}".encode()).decode()
        request.add_header("Authorization", f"Basic {token}")
    return json.load(urllib.request.urlopen(request, timeout=300))["rows"]


def read_titles(env: dict) -> dict[str, list[dict]]:
    out = {}
    for kind, statement in QUERIES.items():
        out[kind] = [{"tmdb_id": r[0], "title": r[1], "year": r[2], "score": r[3], "votes": r[4],
                      "first_country": (r[5] or [None])[0]} for r in crate_select(env, statement)]
    return out


class Tmdb:
    def __init__(self, key: str):
        self.key = key

    def get(self, path: str, **params):
        # An unknown parameter skips the CDN's cache, which can be hours old.
        query = urllib.parse.urlencode({**params, "api_key": self.key, "cb": f"{time.time():.3f}"})
        for attempt in range(6):
            try:
                return json.load(urllib.request.urlopen(f"{TMDB}{path}?{query}", timeout=30))
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    return None
                time.sleep(2 ** attempt)
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                time.sleep(2 ** attempt)
        raise RuntimeError(f"TMDB kept failing for {path}")


def read_snapshot(tmdb: Tmdb, titles: dict[str, list[dict]]) -> dict:
    snapshot = {"read_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    for kind, api in (("movie", "movie"), ("show", "tv")):
        ids = [t["tmdb_id"] for t in titles[kind]]

        def providers(tmdb_id):
            found = tmdb.get(f"/{api}/{tmdb_id}/watch/providers")
            return tmdb_id, None if found is None else found.get("results", {})

        with ThreadPoolExecutor(6) as pool:
            snapshot[kind] = dict(pool.map(providers, ids))
        print(f"{kind}: {len(ids)} titles read", file=sys.stderr)
    return snapshot


def netflix_countries(snapshot: dict) -> list[str]:
    return sorted({cc for kind in ("movie", "show") for r in snapshot[kind].values() if r
                   for cc, offers in r.items() for o in offers.get("flatrate") or []
                   if o.get("provider_id") in (8, 1796)})


def read_netflix_totals(tmdb: Tmdb, countries: list[str]) -> dict[str, tuple[int, int]]:
    def totals(cc):
        counts = []
        for api in ("movie", "tv"):
            found = tmdb.get(f"/discover/{api}", watch_region=cc, with_watch_providers=NETFLIX,
                             with_watch_monetization_types="flatrate", include_adult="false")
            counts.append(found["total_results"])
        return cc, tuple(counts)

    with ThreadPoolExecutor(4) as pool:
        return dict(pool.map(totals, countries))


def country_names(codes: list[str]) -> dict[str, str]:
    """English names from the runtime the page is rendered with, so the data and the page agree."""
    script = ("const n=new Intl.DisplayNames(['en'],{type:'region'});"
              "console.log(JSON.stringify(Object.fromEntries(process.argv.slice(1).map(c=>[c,n.of(c)]))))")
    names = json.loads(subprocess.run(["node", "-e", script, *codes], check=True, capture_output=True,
                                      text=True).stdout)
    return {code: SHORT_NAMES.get(code, names.get(code, code)) for code in codes}


def build(titles: dict, snapshot: dict, netflix_totals: dict) -> tuple[dict, list[list], list[list]]:
    movies = analyse("movie", titles["movie"], {int(k): v for k, v in snapshot["movie"].items()})
    shows = analyse("show", titles["show"], {int(k): v for k, v in snapshot["show"].items()})
    date = snapshot["read_at"][:10]
    codes = sorted({c["code"] for c in movies["countries"]} | {c["code"] for c in shows["countries"]})
    names = country_names(codes)
    m = {c["code"]: c for c in movies["countries"]}
    s = {c["code"]: c for c in shows["countries"]}
    # The page ships its data file in the post's script, so it keeps only what the page shows. The CSV files have it all.
    keep = ("subscription", "free_with_ads", "library", "biggest_service", "biggest_service_titles", "netflix",
            "top_subscription")
    full = [{
        "code": cc, "name": names[cc], "major": cc in MAJOR,
        "movies": m.get(cc), "shows": s.get(cc),
        "netflix_catalogue": dict(zip(("movies", "shows"), netflix_totals[cc])) if cc in netflix_totals else None,
    } for cc in codes]
    countries = [c | {"movies": {k: c["movies"][k] for k in keep} if c["movies"] else None,
                      "shows": {k: c["shows"][k] for k in keep} if c["shows"] else None} for c in full]

    def title_ref(row, kind):
        return {"tmdb_id": row["tmdb_id"], "kind": kind, "title": row["title"],
                "name": TITLE_NAMES.get(row["tmdb_id"], row["title"]), "year": row["year"]}

    rows = movies["title_rows"]
    data = {
        "slug": SLUG,
        "snapshot": {"read_at": snapshot["read_at"], "date": date},
        "movies": {k: movies[k] for k in ("titles", "deleted", "top_cut", "netflix")},
        "shows": {k: shows[k] for k in ("titles", "deleted", "top_cut", "netflix")},
        "countries": countries,
        "findings": findings(movies, shows, netflix_totals, GHIBLI),
        "lists": {
            "ghibli": [title_ref(r, "movie") | {"countries": r["subscription"], "netflix": r["netflix"]}
                       for r in rows if r["tmdb_id"] in GHIBLI],
            "ghibli_apart": [title_ref(r, "movie") | {"countries": r["subscription"], "netflix": r["netflix"],
                                                      "in_japan": "JP" in r["sub_countries"]}
                             for r in rows if r["tmdb_id"] in GHIBLI_APART],
            "nowhere": [title_ref(r, "movie") | {"first_country": r["first_country"]}
                        for r in rows if r["subscription"] == 0][:12],
            "widest_best_rated": [title_ref(r, "movie") | {"countries": r["big_services"]}
                                  for r in sorted((r for r in rows if r["top"]),
                                                  key=lambda r: (-r["big_services"], rows.index(r)))[:4]],
            "nowhere_indian": [title_ref(r, "movie") for r in rows
                               if r["subscription"] == 0 and r["first_country"] == "IN"],
        },
        "csv": {"base": f"/downloads/{SLUG}", "countries": CSV_COUNTRIES, "titles": CSV_TITLES},
    }

    head = ["country_code", "country", "movies_in_study", "movies_on_subscription", "movies_free_with_ads",
            "movies_with_library_card", "movies_to_rent_or_buy", "movies_any_way", "biggest_movie_service",
            "biggest_movie_service_movies", "movies_on_netflix", "best_rated_1000_on_subscription", "shows_in_study",
            "shows_on_subscription", "shows_free_with_ads", "shows_with_library_card", "shows_to_rent_or_buy",
            "biggest_show_service", "biggest_show_service_shows", "shows_on_netflix", "netflix_catalogue_movies",
            "netflix_catalogue_shows", "snapshot_date"]
    by_country = [head]
    for c in sorted(full, key=lambda c: c["name"]):
        mv, sh, nf = c["movies"] or {}, c["shows"] or {}, c["netflix_catalogue"] or {}
        by_country.append([c["code"], c["name"], movies["titles"], mv.get("subscription", 0), mv.get("free_with_ads", 0),
                           mv.get("library", 0), mv.get("rent_or_buy", 0), mv.get("any_way", 0),
                           mv.get("biggest_service") or "", mv.get("biggest_service_titles", 0), mv.get("netflix", 0),
                           mv.get("top_subscription", 0), shows["titles"], sh.get("subscription", 0),
                           sh.get("free_with_ads", 0), sh.get("library", 0), sh.get("rent_or_buy", 0),
                           sh.get("biggest_service") or "", sh.get("biggest_service_titles", 0), sh.get("netflix", 0),
                           nf.get("movies", ""), nf.get("shows", ""), date])
    by_title = [["tmdb_id", "type", "title", "year", "countries_on_subscription", "countries_on_netflix",
                 "countries_free_with_ads", "countries_with_library_card", "countries_to_rent_or_buy",
                 "countries_any_way", "snapshot_date"]]
    for kind, result in (("movie", movies), ("show", shows)):
        for r in sorted(result["title_rows"], key=lambda r: (r["title"], r["tmdb_id"])):
            by_title.append([r["tmdb_id"], kind, r["title"], r["year"], r["subscription"], r["netflix"],
                             r["free_with_ads"], r["library"], r["rent_or_buy"], r["any_way"], date])
    return data, by_country, by_title


def write_csv(path: Path, rows: list[list]):
    with open(path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--crate-env", type=Path, default=SCRIPT_DIR / ".env",
                        help="A .env file with CRATE_HOSTS, CRATE_PORT, CRATE_USER and CRATE_PASS")
    parser.add_argument("--tmdb-env", type=Path, default=SCRIPT_DIR / "../.env",
                        help="A .env file with TMDB_API_KEY, when it isn't in the environment")
    parser.add_argument("--cache-dir", type=Path,
                        default=Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "goodwatch-streaming-study")
    parser.add_argument("--reuse", action="store_true", help="Build from the last snapshot in --cache-dir")
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    raw = args.cache_dir / "study-snapshot.json"
    if args.reuse:
        saved = json.loads(raw.read_text())
        titles, snapshot, totals = saved["titles"], saved["snapshot"], {k: tuple(v) for k, v in saved["netflix"].items()}
    else:
        crate_env = read_env(args.crate_env)
        tmdb_key = read_env(args.tmdb_env).get("TMDB_API_KEY")
        if not tmdb_key:
            sys.exit("TMDB_API_KEY is missing")
        titles = read_titles(crate_env)
        print(f"titles: {len(titles['movie'])} movies, {len(titles['show'])} shows", file=sys.stderr)
        tmdb = Tmdb(tmdb_key)
        snapshot = read_snapshot(tmdb, titles)
        totals = read_netflix_totals(tmdb, netflix_countries(snapshot))
        raw.write_text(json.dumps({"titles": titles, "snapshot": snapshot, "netflix": totals}))
    data, by_country, by_title = build(titles, snapshot, totals)
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    write_csv(PUBLIC_DIR / CSV_COUNTRIES, by_country)
    write_csv(PUBLIC_DIR / CSV_TITLES, by_title)
    print(json.dumps({"snapshot": data["snapshot"], "movies": data["movies"]["titles"],
                      "shows": data["shows"]["titles"], "findings": data["findings"]}, indent=1))


if __name__ == "__main__":
    main()
