"""Metacritic pages, read over plain HTTP (#152).

Show, season and movie pages carry their data in `script#__NUXT_DATA__`, Nuxt's
devalue payload: one flat JSON array in which objects and arrays hold the indexes
of their members. It has:
- the product: `title`, `slug`, `premiereYear`, `imdbId` and the Metascore
  (`criticScoreSummary`: `score`, `reviewCount`);
- the user score summary (`url` `/tv/<slug>/user-reviews/`, `score` 0-10);
- every season with its own `criticScoreSummary` (season 0 is specials).
A season page (`/tv/<slug>/season-N/`) adds that season's user score summary
(`url` `/tv/<slug>/user-reviews/?season=season-N`). Every URL redirects to the
trailing-slash form, so requests use it; stored URLs have no trailing slash.
"""
import json
import re
from typing import Optional
from urllib.parse import urljoin, urlsplit

from f.critic_sites.matching import canonical_url
from f.critic_sites.pages import ParsedTitle, SeasonListing, SeasonScores, to_float, to_int

BASE = "https://www.metacritic.com"
PATH_PREFIX = {"tv": "/tv/", "movie": "/movie/"}
TITLE_PATH = re.compile(r"^/(tv|movie)/[^/]+$")
SITEMAP_INDEX = f"{BASE}/tvshows.xml"
SITEMAP_FILE = re.compile(r"<loc>\s*(https://www\.metacritic\.com/tvshows/\d+\.xml)\s*</loc>")
SITEMAP_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>")

CANONICAL = re.compile(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"')
NUXT = re.compile(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', re.S)
WRAPPERS = {"Reactive", "ShallowReactive", "Ref", "ShallowRef"}
KINDS = {"show": "tv", "movie": "movie"}


def fetch_url(url: str) -> str:
    return canonical_url(url) + "/"


def is_title_url(url: str, kind: str) -> bool:
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    return (parts.netloc.lower() == "www.metacritic.com" and bool(TITLE_PATH.match(path))
            and path.startswith(PATH_PREFIX[kind]))


def sitemap_title_urls(xml: str) -> set[str]:
    urls = set()
    for loc in SITEMAP_LOC.findall(xml):
        url = canonical_url(loc)
        if is_title_url(url, "tv"):
            urls.add(url)
    return urls


def series_sitemaps(index_xml: str) -> list[str]:
    return SITEMAP_FILE.findall(index_xml)


class Nuxt:
    """Lazy reader for a devalue payload."""

    def __init__(self, data: list):
        self.data = data

    def value(self, index, depth: int = 6):
        if not isinstance(index, int) or isinstance(index, bool) or index < 0 or index >= len(self.data):
            return None  # negative indexes are undefined, NaN and the like
        raw = self.data[index]
        if isinstance(raw, dict):
            if depth <= 0:
                return {}
            return {key: self.value(member, depth - 1) for key, member in raw.items()}
        if isinstance(raw, list):
            if raw and isinstance(raw[0], str):
                if raw[0] in WRAPPERS and len(raw) > 1:
                    return self.value(raw[1], depth)
                if raw[0] == "Date" and len(raw) > 1:
                    return raw[1]
                return None
            if depth <= 0:
                return []
            return [self.value(member, depth - 1) for member in raw]
        return raw

    def objects_with(self, *keys):
        for raw in self.data:
            if isinstance(raw, dict) and all(key in raw for key in keys):
                yield raw

    def field(self, raw: dict, key: str, depth: int = 3):
        return self.value(raw.get(key), depth)


def _nuxt(html: str) -> Optional[Nuxt]:
    match = NUXT.search(html)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except ValueError:
        return None
    return Nuxt(data) if isinstance(data, list) else None


def _product(nuxt: Nuxt) -> Optional[dict]:
    for raw in nuxt.objects_with("imdbId", "criticScoreSummary", "slug"):
        kind = KINDS.get(nuxt.field(raw, "type"))
        if kind:
            return {"kind": kind, "title": nuxt.field(raw, "title"), "slug": nuxt.field(raw, "slug"),
                    "year": to_int(nuxt.field(raw, "premiereYear")), "imdb_id": nuxt.field(raw, "imdbId"),
                    "critic": nuxt.field(raw, "criticScoreSummary") or {}}
    return None


def _summary(nuxt: Nuxt, path: str) -> dict:
    for raw in nuxt.objects_with("score", "reviewCount", "url", "max"):
        if nuxt.field(raw, "url") == path:
            return {key: nuxt.field(raw, key) for key in ("score", "reviewCount", "max")}
    return {}


def _seasons(nuxt: Nuxt) -> list[SeasonListing]:
    seasons = {}
    for raw in nuxt.objects_with("seasonNumber", "criticScoreSummary", "seasonSlug"):
        number = to_int(nuxt.field(raw, "seasonNumber"))
        path = nuxt.field(raw, "url")
        if not number or not isinstance(path, str) or number in seasons:
            continue
        critic = nuxt.field(raw, "criticScoreSummary") or {}
        seasons[number] = SeasonListing(number, canonical_url(urljoin(BASE, path)),
                                        to_float(critic.get("score")), to_int(critic.get("reviewCount")))
    return [seasons[number] for number in sorted(seasons)]


def parse_title_page(html: str) -> Optional[ParsedTitle]:
    nuxt = _nuxt(html)
    product = _product(nuxt) if nuxt else None
    canonical = CANONICAL.search(html)
    if not product or not canonical:
        return None
    kind = product["kind"]
    user = _summary(nuxt, f"{PATH_PREFIX[kind]}{product['slug']}/user-reviews/")
    critic = product["critic"]
    critic_score = to_float(critic.get("score"))
    user_score = to_float(user.get("score"))
    imdb_id = product["imdb_id"] if isinstance(product["imdb_id"], str) and product["imdb_id"] else None
    return ParsedTitle(
        canonical_url=canonical_url(canonical.group(1)), kind=kind, title=product["title"],
        year=product["year"], imdb_id=imdb_id,
        critic_score=critic_score, critic_count=to_int(critic.get("reviewCount")) if critic_score is not None else None,
        audience_score=user_score, audience_count=to_int(user.get("reviewCount")) if user_score is not None else None,
        seasons=_seasons(nuxt) if kind == "tv" else [],
    )


def parse_season_page(html: str, season_number: int) -> Optional[SeasonScores]:
    nuxt = _nuxt(html)
    product = _product(nuxt) if nuxt else None
    if not product:
        return None
    season = next((listing for listing in _seasons(nuxt) if listing.number == season_number), None)
    user = _summary(nuxt, f"/tv/{product['slug']}/user-reviews/?season=season-{season_number}")
    user_score = to_float(user.get("score"))
    return SeasonScores(
        critic_score=season.critic_score if season else None,
        critic_count=season.critic_count if season else None,
        audience_score=user_score,
        audience_count=to_int(user.get("reviewCount")) if user_score is not None else None,
    )


def main():
    pass
