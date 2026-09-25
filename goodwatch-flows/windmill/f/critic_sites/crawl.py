# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Rotten Tomatoes and Metacritic crawls from known URLs, with season critic scores (#152).

One long-running job per site (`main(site=...)`) crawls titles whose URL is known:
Wikidata's (`wikidata_url`), a stored one, or a sitemap match. It never guesses a
slug. Shows go first, then movies, each in popularity order, through their own
queue: `next_crawl_at` on the `*_tv_rating` / `*_movie_rating` documents.

Per title:
1. Try Wikidata's URL, then the stored URL, over plain HTTP (`polite_http`), and
   store the canonical URL after redirects.
2. Verify the page belongs to the title. On Metacritic the page's IMDb id must equal
   the title's effective IMDb id. Otherwise a URL not from Wikidata needs a matching
   title and a year at most one off.
3. A URL several titles hold goes to the one title the page matches; the others lose
   it (reason `duplicate`). One request settles the whole group.
4. Shows: the show page lists every season with its critic score. Season pages add
   RT's review count and Popcornmeter and Metacritic's user score, fetched only for
   seasons with critic reviews, and again only after 80 days or for the latest season.
5. A missing page or a rejected match clears the URL and scores (backed up to
   `_backup_<YYYYMMDD>_critic_urls`) and skips the URL for 90 days. Airing shows come
   back after 7 days, other shows and older movies after 90, recent movies after 14.

Season scores go to `rotten_tomatoes_tv_season_rating` / `metacritic_tv_season_rating`
(one document per show and season) and, per crawled batch, to the Crate
`rotten_tomatoes_season` / `metacritic_season` tables (`f/critic_sites/publish`).
Show and movie scores stay on the rating documents, which `f/sync/copy/all_ratings`
publishes.

A 403, a 429, a bot challenge, or three unexpected pages in a row stop the site's
crawl until a recorded deadline; the unfinished titles wait until then.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

from pymongo import ASCENDING, DESCENDING

from f.critic_sites import polite_http
from f.critic_sites.matching import title_matches, url_key, year_matches
from f.critic_sites.pages import ParsedTitle, SeasonScores
from f.external_ids.imdb_ids import effective_imdb_id
from f.metacritic_web import site as metacritic_site
from f.rotten_web import site as rotten_tomatoes_site

EPOCH = datetime(1970, 1, 1)
LEASE = timedelta(hours=2)
NEGATIVE_CACHE = timedelta(days=90)
ERROR_RETRY = timedelta(days=1)
AIRING_INTERVAL = timedelta(days=7)
ENDED_INTERVAL = timedelta(days=90)
RECENT_MOVIE_INTERVAL = timedelta(days=14)
MOVIE_INTERVAL = timedelta(days=90)
AIRING_WINDOW = timedelta(days=60)
RECENT_MOVIE_WINDOW = timedelta(days=180)
SEASON_PAGE_MAX_AGE = timedelta(days=80)
UNEXPECTED_LIMIT = 3
UNEXPECTED_BLOCK = timedelta(hours=6)
ERROR_LIMIT = 5
# The on-demand crawl in f/priority/crawl_all skips titles crawled more recently.
RECENTLY_CRAWLED = timedelta(days=1)
DETAILS = {"tv": "tmdb_tv_details", "movie": "tmdb_movie_details"}
DETAILS_FIELDS = {"_id": 0, "tmdb_id": 1, "title": 1, "original_title": 1, "first_air_date": 1, "release_date": 1,
                  "in_production": 1, "next_episode_to_air": 1, "last_air_date": 1, "imdb_id": 1,
                  "external_ids.imdb_id": 1, "imdb_id_override": 1}
STATE_FIELDS = ("not_found_url", "not_found_until", "rejected_url", "rejected_until", "rejected_reason",
                "crawl_error", "error_message", "failed_at")


@dataclass(frozen=True)
class SiteConfig:
    key: str
    site: object  # f.rotten_web.site or f.metacritic_web.site
    url_field: str
    critic: str  # field prefix of the critic score
    audience: str  # field prefix of the audience or user score
    audience_scale: float  # to a percent
    crate_table: str

    def collection(self, kind: str) -> str:
        return f"{self.key}_{kind}_rating"

    @property
    def season_collection(self) -> str:
        return f"{self.key}_tv_season_rating"

    def score_fields(self) -> list[str]:
        return [f"{prefix}_{suffix}" for prefix in (self.critic, self.audience)
                for suffix in ("original", "normalized_percent", "vote_count")]

    def scores(self, critic_score, critic_count, audience_score, audience_count) -> dict:
        """Stored score fields; None means the page has no such score."""
        return {
            f"{self.critic}_original": critic_score,
            f"{self.critic}_normalized_percent": critic_score,
            f"{self.critic}_vote_count": critic_count,
            f"{self.audience}_original": audience_score,
            f"{self.audience}_normalized_percent": (round(audience_score * self.audience_scale, 2)
                                                    if audience_score is not None else None),
            f"{self.audience}_vote_count": audience_count,
        }


SITES = {
    "rotten_tomatoes": SiteConfig("rotten_tomatoes", rotten_tomatoes_site, "rotten_tomatoes_url",
                                  "tomato_score", "audience_score", 1.0, "rotten_tomatoes_season"),
    "metacritic": SiteConfig("metacritic", metacritic_site, "metacritic_url",
                             "meta_score", "user_score", 10.0, "metacritic_season"),
}


def backup_collection_name(now: datetime) -> str:
    return f"_backup_{now:%Y%m%d}_critic_urls"


# ===== Indexes and queue =====


def ensure_indexes(db) -> None:
    for conf in SITES.values():
        for kind in DETAILS:
            collection = db[conf.collection(kind)]
            # The queue walks popularity order over the titles that have a crawl date.
            collection.create_index([("popularity", DESCENDING), ("next_crawl_at", ASCENDING)],
                                    name="critic_crawl_queue",
                                    partialFilterExpression={"next_crawl_at": {"$exists": True}})
            # Other titles holding the same URL.
            collection.create_index([(conf.url_field, ASCENDING)], name=f"{conf.url_field}_lookup", sparse=True)
        db[conf.season_collection].create_index([("tmdb_id", ASCENDING), ("season_number", ASCENDING)],
                                                unique=True)


def schedule_known_urls(db, site: str) -> dict:
    """Give every title with a URL but no crawl date one in the past, so it is due."""
    conf = SITES[site]
    counts = {}
    for kind in DETAILS:
        has_url = [{conf.url_field: {"$type": "string", "$gt": ""}}, {"wikidata_url": {"$type": "string", "$gt": ""}}]
        result = db[conf.collection(kind)].update_many({"next_crawl_at": {"$exists": False}, "$or": has_url},
                                                       {"$set": {"next_crawl_at": EPOCH}})
        counts[kind] = result.modified_count
    return counts


def next_titles(db, site: str, kind: str, now: datetime, limit: int, lease: timedelta = LEASE) -> list[dict]:
    """The most popular due titles, leased so no other run takes them."""
    collection = db[SITES[site].collection(kind)]
    due = collection.find({"next_crawl_at": {"$lte": now}, "tmdb_deleted": {"$ne": True}}).sort(
        "popularity", DESCENDING).limit(limit)
    claimed = []
    for doc in list(due):
        if collection.update_one({"_id": doc["_id"], "next_crawl_at": doc["next_crawl_at"]},
                                 {"$set": {"next_crawl_at": now + lease}}).modified_count:
            claimed.append(doc)
    return claimed


# ===== Titles =====


@dataclass
class TitleInfo:
    titles: list
    year: Optional[int]
    imdb_id: Optional[str]
    interval: timedelta


def _date(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, str) and len(value) >= 10:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d")
        except ValueError:
            return None
    return None


def refresh_interval(kind: str, details: dict, now: datetime) -> timedelta:
    if kind == "tv":
        last_air = _date(details.get("last_air_date"))
        airing = (details.get("in_production") or details.get("next_episode_to_air")
                  or (last_air is not None and now - last_air <= AIRING_WINDOW))
        return AIRING_INTERVAL if airing else ENDED_INTERVAL
    released = _date(details.get("release_date"))
    if released is not None and now - released <= RECENT_MOVIE_WINDOW:
        return RECENT_MOVIE_INTERVAL
    return MOVIE_INTERVAL


def load_titles(db, kind: str, docs: list[dict], now: datetime) -> dict[int, TitleInfo]:
    tmdb_ids = [doc["tmdb_id"] for doc in docs]
    details = {row["tmdb_id"]: row for row in db[DETAILS[kind]].find({"tmdb_id": {"$in": tmdb_ids}}, DETAILS_FIELDS)}
    infos = {}
    for doc in docs:
        row = details.get(doc["tmdb_id"], {})
        released = _date(row.get("first_air_date" if kind == "tv" else "release_date"))
        titles = [row.get("title"), row.get("original_title"), doc.get("original_title"),
                  *(doc.get("title_variations") or [])]
        imdb_id, _ = effective_imdb_id(row, kind == "movie")
        infos[doc["tmdb_id"]] = TitleInfo(
            titles=[title for title in titles if title],
            year=released.year if released else doc.get("release_year"),
            imdb_id=imdb_id,
            interval=refresh_interval(kind, row, now),
        )
    return infos


# ===== Crawling =====


@dataclass
class Outcome:
    status: str  # ok, not_found, rejected, error, skipped
    doc: dict
    url: Optional[str] = None
    source: Optional[str] = None
    page: Optional[ParsedTitle] = None
    reason: Optional[str] = None
    seasons: dict = field(default_factory=dict)  # season number -> SeasonScores from season pages
    unexpected: bool = False
    blocked: Optional[polite_http.SiteBlocked] = None


class Context:
    def __init__(self, db, client, site: str, kind: str, now: datetime):
        self.db = db
        self.client = client
        self.conf = SITES[site]
        self.site = site
        self.kind = kind
        self.now = now
        self.collection = db[self.conf.collection(kind)]
        self.pages = {}
        self.requests = 0

    def fetch(self, url: str) -> polite_http.Page:
        if url not in self.pages:
            self.requests += 1
            self.pages[url] = self.client.get(url)
        return self.pages[url]


def candidates(doc: dict, conf: SiteConfig, now: datetime) -> list[tuple[str, str]]:
    """(URL, source) to try, Wikidata's first. URLs in the negative cache are left out."""
    found = []

    def cached(url, field_name, until_name):
        until = doc.get(until_name)
        return doc.get(field_name) and url_key(doc[field_name]) == url_key(url) and until and until > now

    def add(url, source):
        if not isinstance(url, str) or not url.strip():
            return
        if any(url_key(url) == url_key(known) for known, _ in found):
            return
        if cached(url, "not_found_url", "not_found_until") or cached(url, "rejected_url", "rejected_until"):
            return
        found.append((url.strip(), source))

    add(doc.get("wikidata_url"), "wikidata")
    stored_source = doc.get("url_source") or "legacy"
    add(doc.get(conf.url_field), stored_source)
    return found


def assess(conf: SiteConfig, page: ParsedTitle, doc: dict, info: TitleInfo, requested: str):
    """(score, None) when the page may belong to the title, (None, reason) when not."""
    score = 0
    if page.imdb_id and info.imdb_id:
        if page.imdb_id != info.imdb_id:
            return None, "imdb_mismatch"
        score += 4
    wikidata = doc.get("wikidata_url")
    if wikidata and url_key(wikidata) in (url_key(page.canonical_url), url_key(requested)):
        score += 2
    title_ok = title_matches(page.title, info.titles)
    year_ok = year_matches(page.year, info.year)
    if score == 0:
        if not title_ok:
            return None, "title_mismatch"
        if year_ok is False:
            return None, "year_mismatch"
    return score + int(title_ok) + int(bool(year_ok)), None


def holders(ctx: Context, doc: dict, requested: str, page: ParsedTitle) -> list[dict]:
    """Other titles that store this page's URL."""
    variants = {requested, requested.rstrip("/"), page.canonical_url, page.canonical_url + "/",
                ctx.conf.site.fetch_url(page.canonical_url)}
    for url in list(variants):
        variants.add(url.lower())
    return list(ctx.collection.find({ctx.conf.url_field: {"$in": sorted(variants)}, "_id": {"$ne": doc["_id"]},
                                     "tmdb_deleted": {"$ne": True}}))


def season_pages(ctx: Context, tmdb_id: int, page: ParsedTitle, info: TitleInfo) -> tuple[dict, Optional[Exception]]:
    """Season page scores for the seasons with critic reviews, unless fetched recently."""
    if not page.seasons:
        return {}, None
    stored = {doc["season_number"]: doc for doc in ctx.db[ctx.conf.season_collection].find({"tmdb_id": tmdb_id})}
    latest = max(listing.number for listing in page.seasons)
    found = {}
    for listing in page.seasons:
        reviewed = listing.critic_score is not None or bool(listing.critic_count)
        if not reviewed:
            continue
        fetched_at = (stored.get(listing.number) or {}).get("season_page_at")
        fresh = fetched_at is not None and ctx.now - fetched_at < SEASON_PAGE_MAX_AGE
        if fresh and not (listing.number == latest and info.interval == AIRING_INTERVAL):
            continue
        try:
            season_page = ctx.fetch(ctx.conf.site.fetch_url(listing.url))
        except polite_http.SiteBlocked as blocked:
            return found, blocked
        except polite_http.FetchError:
            continue
        if season_page.status != 200:
            continue
        scores = ctx.conf.site.parse_season_page(season_page.text, listing.number)
        if scores is not None:
            found[listing.number] = scores
    return found, None


def crawl_one(ctx: Context, doc: dict, infos: dict) -> list[Outcome]:
    """The outcomes of crawling one title: its own, plus those of other titles
    holding the same URL."""
    info = infos[doc["tmdb_id"]]
    tried = candidates(doc, ctx.conf, ctx.now)
    if not tried:
        return [Outcome("skipped", doc)]
    rejected = None
    for url, source in tried:
        try:
            response = ctx.fetch(ctx.conf.site.fetch_url(url))
        except polite_http.FetchError as error:
            return [Outcome("error", doc, url=url, reason=str(error))]
        if response.status in (404, 410) or (response.status == 200 and not ctx.conf.site.is_title_url(response.url, ctx.kind)):
            continue
        if response.status != 200:
            return [Outcome("error", doc, url=url, reason=f"HTTP {response.status}")]
        page = ctx.conf.site.parse_title_page(response.text)
        if page is None:
            return [Outcome("error", doc, url=url, reason="unexpected page", unexpected=True)]
        if page.kind != ctx.kind:
            continue
        outcomes = decide(ctx, doc, info, url, source, response.url, page)
        if outcomes[0].status == "ok" or outcomes[0].reason == "duplicate" or len(outcomes) > 1:
            return outcomes
        rejected = outcomes[0]
    if rejected:
        return [rejected]
    return [Outcome("not_found", doc, url=tried[0][0])]


def decide(ctx: Context, doc: dict, info: TitleInfo, url: str, source: str, final_url: str,
           page: ParsedTitle) -> list[Outcome]:
    others = holders(ctx, doc, url, page)
    if not others:
        score, reason = assess(ctx.conf, page, doc, info, url)
        if score is None:
            return [Outcome("rejected", doc, url=url, source=source, page=page, reason=reason)]
        return [with_seasons(ctx, Outcome("ok", doc, url=url, source=source, page=page), info)]

    # One page, several titles: it stays with the best match and leaves the others.
    infos = load_titles(ctx.db, ctx.kind, others, ctx.now)
    infos[doc["tmdb_id"]] = info
    group = [doc] + others
    ranked = []
    for member in group:
        score, _ = assess(ctx.conf, page, member, infos[member["tmdb_id"]], url)
        if score is not None:
            ranked.append((score, member.get("popularity") or 0, member))
    winner = max(ranked, key=lambda entry: entry[:2])[2] if ranked else None
    outcomes = []
    for member in group:
        if member is winner:
            member_source = source if member is doc else (member.get("url_source") or "legacy")
            outcomes.append(with_seasons(ctx, Outcome("ok", member, url=url, source=member_source, page=page),
                                         infos[member["tmdb_id"]]))
        else:
            outcomes.append(Outcome("rejected", member, url=url, page=page, reason="duplicate"))
    # The crawled title first, so the caller reads its status from outcomes[0].
    return sorted(outcomes, key=lambda outcome: outcome.doc is not doc)


def with_seasons(ctx: Context, outcome: Outcome, info: TitleInfo) -> Outcome:
    if ctx.kind == "tv":
        outcome.seasons, outcome.blocked = season_pages(ctx, outcome.doc["tmdb_id"], outcome.page, info)
    return outcome


# ===== Storing =====


def backup(ctx: Context, doc: dict, reason: str) -> None:
    fields = [ctx.conf.url_field, "url_source", "url_verified_at", *ctx.conf.score_fields()]
    previous = {name: doc.get(name) for name in fields if doc.get(name) is not None}
    if previous:
        ctx.db[backup_collection_name(ctx.now)].insert_one({
            "collection": ctx.conf.collection(ctx.kind), "doc_id": doc["_id"], "tmdb_id": doc["tmdb_id"],
            "previous": previous, "reason": reason, "run_at": ctx.now})


def store_ok(ctx: Context, outcome: Outcome, info: TitleInfo) -> None:
    doc, page, conf = outcome.doc, outcome.page, ctx.conf
    scores = conf.scores(page.critic_score, page.critic_count, page.audience_score, page.audience_count)
    url_changed = url_key(doc.get(conf.url_field) or "") != url_key(page.canonical_url)
    scores_lost = any(doc.get(name) is not None and value is None for name, value in scores.items())
    if url_changed or scores_lost:
        backup(ctx, doc, "url_changed" if url_changed else "scores_removed")
    set_fields = {name: value for name, value in scores.items() if value is not None}
    set_fields.update({
        conf.url_field: page.canonical_url,
        "url_source": "wikidata" if outcome.source == "wikidata" else "crawl",
        "url_verified_at": ctx.now, "crawled_at": ctx.now, "crawl_status": "ok", "updated_at": ctx.now,
        "next_crawl_at": ctx.now + info.interval, "is_selected": False,
    })
    if conf.key == "metacritic":
        set_fields["imdb_id_verified"] = bool(page.imdb_id and page.imdb_id == info.imdb_id)
    unset = {name: "" for name, value in scores.items() if value is None}
    unset.update({name: "" for name in STATE_FIELDS})
    ctx.collection.update_one({"_id": doc["_id"]}, {"$set": set_fields, "$unset": unset})
    if ctx.kind == "tv":
        store_seasons(ctx, doc["tmdb_id"], page, outcome.seasons)


def store_seasons(ctx: Context, tmdb_id: int, page: ParsedTitle, season_scores: dict) -> None:
    conf = ctx.conf
    seasons = ctx.db[conf.season_collection]
    critic = [f"{conf.critic}_{suffix}" for suffix in ("original", "normalized_percent", "vote_count")]
    for listing in page.seasons:
        scores = season_scores.get(listing.number)
        set_fields = {"url": listing.url, "show_page_at": ctx.now, "updated_at": ctx.now}
        unset = {}
        if scores is not None:
            values = conf.scores(scores.critic_score, scores.critic_count, scores.audience_score,
                                 scores.audience_count)
            set_fields.update({name: value for name, value in values.items() if value is not None})
            unset.update({name: "" for name, value in values.items() if value is None})
            set_fields["season_page_at"] = ctx.now
        elif listing.critic_score is None:
            # The show page says the season has no critic score (any more).
            unset.update({name: "" for name in critic})
        else:
            set_fields[critic[0]] = listing.critic_score
            set_fields[critic[1]] = listing.critic_score
            if listing.critic_count is not None:
                set_fields[critic[2]] = listing.critic_count
        update = {"$set": set_fields, "$setOnInsert": {"created_at": ctx.now}}
        if unset:
            update["$unset"] = unset
        seasons.update_one({"tmdb_id": tmdb_id, "season_number": listing.number}, update, upsert=True)
    seasons.delete_many({"tmdb_id": tmdb_id, "season_number": {"$nin": [listing.number for listing in page.seasons]}})


def store_lost(ctx: Context, outcome: Outcome) -> None:
    """A missing page or a rejected match: clear the URL and the scores."""
    doc, conf = outcome.doc, ctx.conf
    backup(ctx, doc, outcome.status if outcome.status == "not_found" else f"rejected: {outcome.reason}")
    until = ctx.now + NEGATIVE_CACHE
    set_fields = {"crawl_status": outcome.status, "crawled_at": ctx.now, "updated_at": ctx.now,
                  "next_crawl_at": until, "is_selected": False}
    if outcome.status == "not_found":
        set_fields.update({"not_found_url": outcome.url, "not_found_until": until})
    else:
        set_fields.update({"rejected_url": outcome.url, "rejected_until": until, "rejected_reason": outcome.reason})
    unset = {name: "" for name in [conf.url_field, "url_source", "url_verified_at", *conf.score_fields()]}
    ctx.collection.update_one({"_id": doc["_id"]}, {"$set": set_fields, "$unset": unset})
    if ctx.kind == "tv":
        ctx.db[conf.season_collection].delete_many({"tmdb_id": doc["tmdb_id"]})


def store(ctx: Context, outcome: Outcome, infos: dict) -> None:
    doc = outcome.doc
    if outcome.status == "ok":
        info = infos.get(doc["tmdb_id"]) or load_titles(ctx.db, ctx.kind, [doc], ctx.now)[doc["tmdb_id"]]
        store_ok(ctx, outcome, info)
    elif outcome.status in ("not_found", "rejected"):
        store_lost(ctx, outcome)
    elif outcome.status == "error":
        ctx.collection.update_one({"_id": doc["_id"]}, {"$set": {
            "crawl_status": "error", "crawl_error": outcome.reason, "crawled_at": ctx.now,
            "next_crawl_at": ctx.now + ERROR_RETRY, "is_selected": False}})
    elif outcome.status == "skipped":
        waits = [doc.get(name) for name in ("not_found_until", "rejected_until") if doc.get(name)]
        ctx.collection.update_one({"_id": doc["_id"]}, {"$set": {
            "next_crawl_at": max(waits) if waits else ctx.now + NEGATIVE_CACHE}})


def release(ctx: Context, docs: list[dict], until: datetime) -> None:
    ids = [doc["_id"] for doc in docs]
    if ids:
        ctx.collection.update_many({"_id": {"$in": ids}}, {"$set": {"next_crawl_at": until}})


def new_report() -> dict:
    return {"titles": 0, "ok": 0, "not_found": 0, "rejected": 0, "error": 0, "skipped": 0,
            "duplicates_cleared": 0, "with_critic_score": 0, "seasons": 0, "seasons_with_critic_score": 0,
            "requests": 0, "blocked": None, "stopped": None}


def crawl_titles(db, client, site: str, kind: str, docs: list[dict], now: datetime, connector=None,
                 deadline: Optional[datetime] = None, clock=datetime.utcnow) -> dict:
    ctx = Context(db, client, site, kind, now)
    report = new_report()
    infos = load_titles(db, kind, docs, now)
    handled = set()
    unexpected = errors = 0
    crawled_shows = []
    for index, doc in enumerate(docs):
        if doc["_id"] in handled:
            continue
        if deadline and clock() >= deadline:
            release(ctx, [d for d in docs[index:] if d["_id"] not in handled], now)
            report["stopped"] = "time budget"
            break
        try:
            outcomes = crawl_one(ctx, doc, infos)
        except polite_http.SiteBlocked as blocked:
            release(ctx, [d for d in docs[index:] if d["_id"] not in handled], blocked.until)
            report["blocked"] = {"until": blocked.until, "reason": blocked.reason}
            break
        for outcome in outcomes:
            store(ctx, outcome, infos)
            handled.add(outcome.doc["_id"])
            if outcome.status != "skipped":
                report["titles"] += 1
            report[outcome.status] += 1
            if outcome.status == "rejected" and outcome.reason == "duplicate":
                report["duplicates_cleared"] += 1
            if outcome.status == "ok":
                crawled_shows.append(outcome.doc["tmdb_id"])
                report["with_critic_score"] += int(outcome.page.critic_score is not None)
                report["seasons"] += len(outcome.page.seasons)
                report["seasons_with_critic_score"] += sum(
                    1 for listing in outcome.page.seasons if listing.critic_score is not None)
            elif outcome.status in ("not_found", "rejected"):
                crawled_shows.append(outcome.doc["tmdb_id"])
        own = outcomes[0]
        unexpected = unexpected + 1 if own.unexpected else 0
        errors = errors + 1 if own.status == "error" else 0
        rest = [d for d in docs[index + 1:] if d["_id"] not in handled]
        blocked = next((outcome.blocked for outcome in outcomes if outcome.blocked), None)
        if blocked:
            release(ctx, rest, blocked.until)
            report["blocked"] = {"until": blocked.until, "reason": blocked.reason}
            break
        if unexpected >= UNEXPECTED_LIMIT:
            # Pages without the expected data may be a challenge the checks did not recognise.
            until = now + UNEXPECTED_BLOCK
            reason = f"{UNEXPECTED_LIMIT} unexpected pages in a row"
            polite_http.record_block(db, site, until, reason, own.url, 200, now)
            release(ctx, rest, until)
            report["blocked"] = {"until": until, "reason": reason}
            break
        if errors >= ERROR_LIMIT:
            release(ctx, rest, now + timedelta(hours=1))
            report["stopped"] = f"{ERROR_LIMIT} errors in a row"
            break
    report["requests"] = ctx.requests
    if connector is not None and kind == "tv" and crawled_shows:
        from f.critic_sites.publish import publish_seasons
        report["published"] = publish_seasons(db, connector, site, sorted(set(crawled_shows)))
    return report


def merge(total: dict, part: dict) -> None:
    for key, value in part.items():
        if isinstance(value, int) and not isinstance(value, bool):
            total[key] = total.get(key, 0) + value
        elif key == "published" and value:
            merged = total.setdefault("published", {"shows": 0, "rows": 0})
            for name in merged:
                merged[name] += value.get(name, 0)
        elif value is not None:
            total[key] = value


def run(db, client, site: str, max_seconds: float, connector=None, batch_size: int = 25,
        kinds=("tv", "movie"), clock=datetime.utcnow) -> dict:
    """Crawl due titles, shows first, until the time budget is used or nothing is due."""
    started = clock()
    deadline = started + timedelta(seconds=max_seconds)
    total = {**new_report(), "batches": {kind: 0 for kind in kinds}}
    while clock() < deadline:
        batch = None
        for kind in kinds:
            docs = next_titles(db, site, kind, clock(), batch_size)
            if docs:
                batch = (kind, docs)
                break
        if not batch:
            total["stopped"] = "nothing due"
            break
        kind, docs = batch
        report = crawl_titles(db, client, site, kind, docs, clock(), connector=connector, deadline=deadline,
                              clock=clock)
        total["batches"][kind] += 1
        merge(total, report)
        print(f"{site} {kind} batch: {({k: v for k, v in report.items() if v})}", flush=True)
        if report["blocked"] or report["stopped"]:
            break
    total["seconds"] = round((clock() - started).total_seconds(), 1)
    return total


def crawl_one_title(db, client, site: str, kind: str, doc: dict, now: datetime, connector=None) -> dict:
    """Crawl one title now, e.g. for `f/priority/crawl_all`. Titles without a usable URL,
    and titles crawled in the last day, are skipped."""
    if doc.get("tmdb_deleted") or not candidates(doc, SITES[site], now):
        return {**new_report(), "skipped": 1}
    if doc.get("crawled_at") and now - doc["crawled_at"] < RECENTLY_CRAWLED:
        return {**new_report(), "skipped": 1}
    return crawl_titles(db, client, site, kind, [doc], now, connector=connector)


def crawl_by_id(site: str, next_id: dict) -> dict:
    """Windmill entry for the per-title fetch scripts (`next_id`: `id`, `tmdb_id`, `type`)."""
    from bson import ObjectId
    from mongoengine import get_db
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb

    kind = "movie" if next_id.get("type") == "movie" else "tv"
    init_mongodb()
    connector = None
    try:
        db = get_db()
        doc = db[SITES[site].collection(kind)].find_one({"_id": ObjectId(next_id["id"])})
        if doc is None:
            return {"tmdb_id": next_id.get("tmdb_id"), "skipped": "no rating document"}
        now = datetime.utcnow()
        connector = CrateConnector() if kind == "tv" else None
        report = crawl_one_title(db, polite_http.PoliteClient(db, site), site, kind, doc, now, connector)
        report["tmdb_id"] = doc["tmdb_id"]
        if report.get("blocked"):
            print(f"{site} is blocked: {report['blocked']}", flush=True)
        return report
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()


def main(site: str = "rotten_tomatoes", max_minutes: float = 25, batch_size: int = 25,
         kinds: Optional[list] = None):
    """Crawl one site's due shows, then movies, for up to max_minutes."""
    from mongoengine import get_db
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb

    if site not in SITES:
        raise ValueError(f"unknown site {site}")
    init_mongodb()
    db = get_db()
    connector = None
    try:
        until = polite_http.blocked_until(db, site, datetime.utcnow())
        if until:
            print(f"{site} is blocked until {until:%Y-%m-%d %H:%M} UTC; not crawling.", flush=True)
            return {"blocked": {"until": until}, "titles": 0}
        ensure_indexes(db)
        scheduled = schedule_known_urls(db, site)
        print(f"newly scheduled titles with a known URL: {scheduled}", flush=True)
        connector = CrateConnector()
        client = polite_http.PoliteClient(db, site)
        report = run(db, client, site, max_minutes * 60, connector=connector, batch_size=batch_size,
                     kinds=tuple(kinds or ("tv", "movie")))
        report["scheduled"] = scheduled
        report["seconds_per_request"] = round(report["seconds"] / report["requests"], 2) if report["requests"] else None
        print(report, flush=True)
        return report
    finally:
        if connector:
            connector.disconnect()
        close_mongodb()


if __name__ == "__main__":
    main()
