"""The counts of the streaming study (/blog/streaming-by-country-2026), from one dated TMDB snapshot.

Pure functions, no network and no database: streaming_study.py reads the titles and the snapshot and calls these.
See docs/launch/streaming-study-proposal.md for the rules and why they were chosen.
"""
import re
from collections import Counter

# A service's tiers and channels count once, by the title page's rule: brandName(getShorterProviderLabel(name)) in
# app/utils/streaming-links.ts. Keep the two in step; test_streaming_study.py has the cases.
SHORTER_LABELS = {
    "Amazon Video": "Prime",
    "Amazon Prime Video": "Prime",
    "Amazon Prime Video with Ads": "Prime",
    "Apple TV Plus": "Apple TV",
}
# Spain's Movistar Plus+ lists its film tier as a service of its own. Chile's and Colombia's MovistarTV is a
# different product and stays apart.
SAME_SERVICE = {"Movistar Plus+ Ficción Total": "Movistar Plus+"}
# How the page names a brand.
DISPLAY_NAMES = {"Prime": "Prime Video", "MovistarTV": "Movistar TV"}
# Listed in 100 or more countries with 1 to 15 of the study's titles; they don't count (owner, 2026-10-19).
EXCLUDED = frozenset({"Bloodstream", "Artify", "Artiflix", "Cultpix"})
# Free with a public library card. Reported apart from free with ads.
LIBRARY = frozenset({"Kanopy", "Hoopla", "Cineasterna", "Filmstriben", "filmfriend", "Beamafilm", "Filmoteket",
                     "Biblioteket", "Libby"})
# The global services for "the widest titles".
BIG = frozenset({"Netflix", "Prime", "Disney+", "HBO Max", "Apple TV", "Paramount+"})
# The 56 larger markets the charts show; the CSV files have every country.
MAJOR = tuple(("US CA MX BR AR CO CL PE VE EC GB IE FR DE AT CH IT ES PT NL BE SE NO DK FI PL CZ HU RO GR BG RS TR "
               "RU UA IN PK JP KR TW HK PH ID TH MY SG AU NZ ZA NG KE EG MA SA AE IL").split())
# The best-rated cut, shown next to the base list.
TOP_CUT = {"movie": 1000, "show": 250}
SUBSCRIPTION = ("flatrate",)
FREE = ("free", "ads")
PAID_ONCE = ("rent", "buy")


def brand(name: str) -> str:
    """The brand a TMDB provider name counts as, such as "Netflix" for "Netflix Standard with Ads"."""
    n = SHORTER_LABELS.get(name.strip(), name.strip())
    n = re.sub(r"\s+(Amazon|Apple TV|Roku Premium)\s+Channel$", "", n, flags=re.I)
    n = re.sub(r"\s+(Roku Premium Channel|Channel)$", "", n, flags=re.I)
    n = re.sub(r"\s+(Standard|Basic)\s+with\s+Ads$", "", n, flags=re.I)
    n = re.sub(r"\s+(Essential|Premium|Basic|Standard)$", "", n, flags=re.I)
    n = re.sub(r"\s+Plus$", "+", n, flags=re.I)
    n = n.strip()
    return SAME_SERVICE.get(n, n)


def display_name(service: str | None) -> str | None:
    return None if service is None else DISPLAY_NAMES.get(service, service)


def analyse(kind: str, titles: list[dict], providers: dict[int, dict | None]) -> dict:
    """Counts for one kind ("movie" or "show").

    titles: rows with tmdb_id, title, year, score, votes, first_country, ranked or not.
    providers: TMDB's watch providers `results` per tmdb_id; None for a title TMDB has deleted, which is left out.
    """
    present = [t for t in titles if providers.get(t["tmdb_id"]) is not None]
    ranked = sorted(present, key=lambda t: (-(t["score"] or 0), -(t["votes"] or 0), t["tmdb_id"]))
    top = {t["tmdb_id"] for t in ranked[:TOP_CUT[kind]]}
    by_country: dict[str, dict] = {}
    per_title: dict[int, dict] = {}

    def country(cc):
        return by_country.setdefault(cc, {"subscription": set(), "free": set(), "library": set(), "paid_once": set(),
                                          "services": {}})

    for t in ranked:
        tid = t["tmdb_id"]
        seen = {"subscription": set(), "free": set(), "library": set(), "paid_once": set(), "big": set(),
                "netflix": set()}
        for cc, offers in (providers[tid] or {}).items():
            c = country(cc)
            for typ in SUBSCRIPTION:
                for offer in offers.get(typ) or []:
                    b = brand(offer["provider_name"])
                    if b in EXCLUDED:
                        continue
                    c["subscription"].add(tid)
                    c["services"].setdefault(b, set()).add(tid)
                    seen["subscription"].add(cc)
                    if b in BIG:
                        seen["big"].add(cc)
                    if b == "Netflix":
                        seen["netflix"].add(cc)
            for typ in FREE:
                for offer in offers.get(typ) or []:
                    b = brand(offer["provider_name"])
                    if b in EXCLUDED:
                        continue
                    group = "library" if b in LIBRARY else "free"
                    c[group].add(tid)
                    seen[group].add(cc)
            if any(offers.get(typ) for typ in PAID_ONCE):
                c["paid_once"].add(tid)
                seen["paid_once"].add(cc)
        per_title[tid] = seen

    countries = []
    for cc in sorted(by_country):
        c = by_country[cc]
        services = sorted(c["services"].items(), key=lambda kv: (-len(kv[1]), kv[0]))
        countries.append({
            "code": cc,
            "subscription": len(c["subscription"]),
            "free_with_ads": len(c["free"]),
            "library": len(c["library"]),
            "rent_or_buy": len(c["paid_once"]),
            "any_way": len(c["subscription"] | c["free"] | c["library"] | c["paid_once"]),
            "biggest_service": display_name(services[0][0]) if services else None,
            "biggest_service_titles": len(services[0][1]) if services else 0,
            "netflix": len(c["services"].get("Netflix", ())),
            "top_subscription": len(c["subscription"] & top),
        })

    netflix_countries = {cc for seen in per_title.values() for cc in seen["netflix"]}
    on_netflix = [seen for seen in per_title.values() if seen["netflix"]]
    title_rows = []
    for t in ranked:
        seen = per_title[t["tmdb_id"]]
        title_rows.append({
            "tmdb_id": t["tmdb_id"], "title": t["title"], "year": t["year"], "first_country": t["first_country"],
            "top": t["tmdb_id"] in top,
            "subscription": len(seen["subscription"]), "netflix": len(seen["netflix"]),
            "big_services": len(seen["big"]), "free_with_ads": len(seen["free"]), "library": len(seen["library"]),
            "rent_or_buy": len(seen["paid_once"]),
            "any_way": len(seen["subscription"] | seen["free"] | seen["library"] | seen["paid_once"]),
            "sub_countries": sorted(seen["subscription"]),
        })
    return {
        "titles": len(present),
        "deleted": len(titles) - len(present),
        "top_cut": len(top),
        "countries": countries,
        "netflix": {
            "countries": len(netflix_countries),
            "titles_somewhere": len(on_netflix),
            "titles_everywhere": sum(1 for seen in on_netflix if len(seen["netflix"]) == len(netflix_countries)),
            "titles_in_one": sum(1 for seen in on_netflix if len(seen["netflix"]) == 1),
        },
        "title_rows": title_rows,
    }


def first_country_share(rows: list[dict], code: str) -> int:
    return sum(1 for r in rows if r["first_country"] == code)


def rank_of(rows: list[dict], key: str, code: str, among=MAJOR) -> tuple[int, int]:
    """(rank, out of) of a country by a count, highest first, among countries with a positive count."""
    ranked = sorted((r for r in rows if r["code"] in among and r[key] > 0), key=lambda r: (-r[key], r["code"]))
    return [r["code"] for r in ranked].index(code) + 1, len(ranked)


def findings(movies: dict, shows: dict, netflix_totals: dict[str, tuple[int, int]], ghibli_ids: set[int]) -> dict:
    """The numbers the post's text names, so the text always matches the data."""
    m = {c["code"]: c for c in movies["countries"]}
    s = {c["code"]: c for c in shows["countries"]}
    rows = movies["title_rows"]
    majors_m = [c for c in movies["countries"] if c["code"] in MAJOR]
    majors_s = [c for c in shows["countries"] if c["code"] in MAJOR]
    nowhere = [r for r in rows if r["subscription"] == 0]
    widest = [r for r in rows if r["big_services"] >= 130]
    ghibli = [r for r in rows if r["tmdb_id"] in ghibli_ids]
    japan = [r for r in rows if r["first_country"] == "JP"]
    nf_movies = sorted(((cc, mv) for cc, (mv, _) in netflix_totals.items() if mv > 0), key=lambda x: (-x[1], x[0]))
    nf_shows = sorted(((cc, tv) for cc, (_, tv) in netflix_totals.items() if tv > 0), key=lambda x: (-x[1], x[0]))
    return {
        "us_first_country": first_country_share(rows, "US"),
        "netflix_us_rank": rank_of(movies["countries"], "netflix", "US"),
        "netflix_biggest_movies": sum(c["biggest_service"] == "Netflix" for c in majors_m),
        "netflix_biggest_shows": sum(c["biggest_service"] == "Netflix" for c in majors_s),
        "majors": len(majors_m),
        "netflix_catalogue_us_rank_movies": [cc for cc, _ in nf_movies].index("US") + 1 if "US" in netflix_totals else None,
        "netflix_catalogue_us_rank_shows": [cc for cc, _ in nf_shows].index("US") + 1 if "US" in netflix_totals else None,
        "netflix_catalogue_countries": len(nf_movies),
        "nowhere": len(nowhere),
        "nowhere_at_all": sum(1 for r in rows if r["any_way"] == 0),
        "nowhere_indian": first_country_share(nowhere, "IN"),
        "indian": first_country_share(rows, "IN"),
        "widest": len(widest),
        "widest_indian": first_country_share(widest, "IN"),
        "ghibli": len(ghibli),
        "ghibli_in_japan": sum("JP" in r["sub_countries"] for r in ghibli),
        "ghibli_netflix_countries": Counter(r["netflix"] for r in ghibli).most_common(1)[0][0] if ghibli else 0,
        "ghibli_in_us": sum("US" in r["sub_countries"] for r in ghibli),
        "japanese": len(japan),
        "japanese_in_japan": sum("JP" in r["sub_countries"] for r in japan),
        "japanese_in_us": sum("US" in r["sub_countries"] for r in japan),
        "shows_us": s.get("US", {}).get("subscription", 0),
        "movies_us": m.get("US", {}).get("subscription", 0),
    }
