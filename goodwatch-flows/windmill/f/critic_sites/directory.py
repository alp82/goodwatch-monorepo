# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Weekly sitemap directory for the Rotten Tomatoes and Metacritic show crawls (#152).

Downloads the site's series sitemaps (RT `tv-series_*.xml`, about 25k series;
Metacritic `tvshows/N.xml`, about 7k shows) and gives the most popular shows that
have neither a stored nor a Wikidata URL the one directory URL their title slug
matches: `url_source: "sitemap"`, due at once. The crawl then verifies the match
(title and year, or the IMDb id on Metacritic) before it keeps it. A URL another
title holds, or that several titles match, is left alone.

Shows with no URL from any source are not on the site as far as GoodWatch knows;
the crawl never requests anything for them. Afterwards every title with a URL but
no crawl date is scheduled (`crawl.schedule_known_urls`), which picks up the URLs
the Wikidata backfill filled.
"""
from collections import Counter
from datetime import datetime

from f.critic_sites import crawl
from f.critic_sites.matching import url_key

TOP_SHOWS = 20_000


def directory_urls(client, site: str) -> set:
    module = crawl.SITES[site].site
    index = client.get(module.SITEMAP_INDEX)
    if index.status != 200:
        raise RuntimeError(f"{site} sitemap index answered HTTP {index.status}")
    urls = set()
    for sitemap_url in module.series_sitemaps(index.text):
        page = client.get(sitemap_url)
        if page.status != 200:
            raise RuntimeError(f"{site} sitemap {sitemap_url} answered HTTP {page.status}")
        urls |= module.sitemap_title_urls(page.text)
    return urls


def slug_candidates(site: str, variations: list, year) -> list[str]:
    """Year-suffixed slugs first: RT and Metacritic add the year to tell same-named shows apart."""
    plain, dated = [], []
    for variation in variations or []:
        if not variation:
            continue
        forms = {variation, variation.replace("_", "-"), variation.replace("-", "_")} if site == "rotten_tomatoes" \
            else {variation.replace("_", "-")}
        for form in sorted(forms):
            plain.append(form)
            if year:
                dated.extend([f"{form}_{year}", f"{form}-{year}"] if site == "rotten_tomatoes" else [f"{form}-{year}"])
    return list(dict.fromkeys(dated + plain))


def match_directory(db, site: str, urls: set, now: datetime, top: int = TOP_SHOWS, dry_run: bool = False) -> dict:
    conf = crawl.SITES[site]
    collection = db[conf.collection("tv")]
    base = conf.site.BASE + conf.site.PATH_PREFIX["tv"]
    directory = {url_key(url): url for url in urls}
    report = {"directory_urls": len(directory), "considered": 0, "matched": 0, "no_match": 0,
              "claimed_by_other_title": 0}

    owners = Counter(url_key(doc[conf.url_field]) for doc in collection.find(
        {conf.url_field: {"$type": "string", "$gt": ""}}, {conf.url_field: 1}))
    proposals = {}
    top_docs = collection.find({"tmdb_deleted": {"$ne": True}},
                               {"tmdb_id": 1, "title_variations": 1, "release_year": 1, conf.url_field: 1,
                                "wikidata_url": 1, "not_found_until": 1, "rejected_until": 1}
                               ).sort("popularity", -1).limit(top)
    for doc in top_docs:
        if doc.get(conf.url_field) or doc.get("wikidata_url"):
            continue
        if any(doc.get(name) and doc[name] > now for name in ("not_found_until", "rejected_until")):
            continue  # the crawl found the page missing or another title's: wait for the date
        report["considered"] += 1
        match = next((directory[url_key(base + slug)] for slug in slug_candidates(site, doc.get("title_variations"),
                                                                                    doc.get("release_year"))
                      if url_key(base + slug) in directory), None)
        if match:
            proposals[doc["_id"]] = match
        else:
            report["no_match"] += 1

    wanted = Counter(url_key(url) for url in proposals.values())
    for doc_id, url in proposals.items():
        if owners[url_key(url)] or wanted[url_key(url)] > 1:
            report["claimed_by_other_title"] += 1
            continue
        report["matched"] += 1
        if not dry_run:
            collection.update_one({"_id": doc_id, conf.url_field: {"$in": [None, ""]}}, {"$set": {
                conf.url_field: url, "url_source": "sitemap", "url_verified_at": now, "next_crawl_at": crawl.EPOCH}})
    return report


def main(site: str = "rotten_tomatoes", top: int = TOP_SHOWS, dry_run: bool = False):
    from mongoengine import get_db
    from f.critic_sites import polite_http
    from f.db.mongodb import close_mongodb, init_mongodb

    init_mongodb()
    try:
        db = get_db()
        now = datetime.utcnow()
        client = polite_http.PoliteClient(db, site)
        urls = directory_urls(client, site)
        # Windmill may pass whole numbers as floats; pymongo's limit needs an int.
        report = match_directory(db, site, urls, now, top=int(top), dry_run=dry_run)
        if not dry_run:
            crawl.ensure_indexes(db)
            report["scheduled"] = crawl.schedule_known_urls(db, site)
        report["requests"] = client.requests
        print(report, flush=True)
        return report
    finally:
        close_mongodb()
