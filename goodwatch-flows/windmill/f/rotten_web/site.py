"""Rotten Tomatoes pages, read over plain HTTP (#152).

A series page (`/tv/<slug>`) is server-rendered with:
- `script#media-scorecard-json`: the series Tomatometer and Popcornmeter;
- JSON-LD `TVSeries`: name, `dateCreated` (premiere) and `containsSeason` URLs;
- one `<tile-season href="/tv/<slug>/sNN">` per season, with that season's
  Tomatometer in `slot="critics-score"` (empty when the season has none).
A season page (`/tv/<slug>/sNN`) has the same scorecard for the season, with its
review count and Popcornmeter. A movie page (`/m/<slug>`) has the scorecard and a
JSON-LD `Movie`. `/tv/<slug>/sNN.M` tiles are specials inside season NN, not seasons.
"""
import json
import re
from typing import Optional
from urllib.parse import urljoin, urlsplit

from f.critic_sites.matching import canonical_url, split_year_suffix
from f.critic_sites.pages import ParsedTitle, SeasonListing, SeasonScores, to_float, to_int

BASE = "https://www.rottentomatoes.com"
PATH_PREFIX = {"tv": "/tv/", "movie": "/m/"}
TITLE_PATH = re.compile(r"^/(tv|m)/[^/]+$")
SEASON_PATH = re.compile(r"/s(\d+)$")
SITEMAP_INDEX = f"{BASE}/sitemaps/sitemap.xml"
SITEMAP_SERIES = re.compile(r"<loc>\s*(https://www\.rottentomatoes\.com/sitemaps/tv-series_\d+\.xml)\s*</loc>")
SITEMAP_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>")

CANONICAL = re.compile(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"')
SCORECARD = re.compile(r'<script[^>]*id="media-scorecard-json"[^>]*>(.*?)</script>', re.S)
JSON_LD = re.compile(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
TILE = re.compile(r'<tile-season\b[^>]*\bhref="([^"]+)"[^>]*>(.*?)</tile-season>', re.S)
TILE_CRITICS = re.compile(r'slot="critics-score"[^>]*>\s*(\d+)\s*%')
RELEASE_YEAR = re.compile(r'"releaseYear"\s*:\s*"?(\d{4})')
TITLE_TYPES = {"TVSeries": "tv", "Movie": "movie"}


def fetch_url(url: str) -> str:
    return canonical_url(url)


def is_title_url(url: str, kind: str) -> bool:
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    return (parts.netloc.lower() == "www.rottentomatoes.com" and bool(TITLE_PATH.match(path))
            and path.startswith(PATH_PREFIX[kind]))


def sitemap_title_urls(xml: str) -> set[str]:
    urls = set()
    for loc in SITEMAP_LOC.findall(xml):
        url = canonical_url(loc)
        if is_title_url(url, "tv"):
            urls.add(url)
    return urls


def series_sitemaps(index_xml: str) -> list[str]:
    return SITEMAP_SERIES.findall(index_xml)


def _json(text: str):
    try:
        return json.loads(text, strict=False)
    except ValueError:
        return None


def _json_ld(html: str) -> list[dict]:
    found = []
    for block in JSON_LD.findall(html):
        data = _json(block)
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict):
                found.append(item)
    return found


def _scorecard(html: str) -> Optional[dict]:
    match = SCORECARD.search(html)
    data = _json(match.group(1)) if match else None
    return data if isinstance(data, dict) else None


def _scores(card: dict) -> SeasonScores:
    critics = card.get("criticsScore") or {}
    critic_score = to_float(critics.get("score"))
    critic_count = to_int(critics.get("reviewCount") or critics.get("ratingCount")) if critic_score is not None else None

    audience_all = (card.get("overlay") or {}).get("audienceAll") or {}
    audience = card.get("audienceScore") or {}
    audience_score = to_float(audience_all.get("score"))
    source = audience_all
    if audience_score is None:
        audience_score = to_float(audience.get("score"))
        source = audience
    audience_count = None
    if audience_score is not None:
        liked, not_liked = source.get("likedCount"), source.get("notLikedCount")
        if isinstance(liked, int) and isinstance(not_liked, int) and liked + not_liked > 0:
            audience_count = liked + not_liked
        else:
            audience_count = to_int(source.get("bandedRatingCount"))
    return SeasonScores(critic_score, critic_count, audience_score, audience_count)


def _year(value) -> Optional[int]:
    match = re.match(r"(\d{4})", str(value or ""))
    return int(match.group(1)) if match else None


def _seasons(html: str, show_url: str, ld: Optional[dict]) -> list[SeasonListing]:
    seasons = {}
    for href, body in TILE.findall(html):
        url = canonical_url(urljoin(BASE, href))
        number = SEASON_PATH.search(urlsplit(url).path)
        if not number:
            continue  # s37.2 and the like: specials inside a season
        critics = TILE_CRITICS.search(body)
        seasons[int(number.group(1))] = SeasonListing(
            int(number.group(1)), url, to_float(critics.group(1)) if critics else None)
    if not seasons and ld:
        for season in ld.get("containsSeason") or []:
            url = canonical_url(urljoin(BASE, (season or {}).get("url") or ""))
            number = SEASON_PATH.search(urlsplit(url).path)
            if number and url.startswith(show_url + "/"):
                seasons[int(number.group(1))] = SeasonListing(int(number.group(1)), url)
    return [seasons[number] for number in sorted(seasons)]


def parse_title_page(html: str) -> Optional[ParsedTitle]:
    """None when the page is not a series or movie page, e.g. an interstitial."""
    card = _scorecard(html)
    canonical = CANONICAL.search(html)
    ld = next((item for item in _json_ld(html) if item.get("@type") in TITLE_TYPES), None)
    if card is None or not canonical or not ld:
        return None
    url = canonical_url(canonical.group(1))
    kind = TITLE_TYPES[ld["@type"]]
    title, year_in_title = split_year_suffix(ld.get("name"))
    year = (_year(ld.get("dateCreated")) or _year((ld.get("partOfSeries") or {}).get("startDate"))
            or year_in_title)
    if year is None and kind == "movie":
        release = RELEASE_YEAR.search(html)
        year = int(release.group(1)) if release else None
    scores = _scores(card)
    return ParsedTitle(
        canonical_url=url, kind=kind, title=title, year=year,
        critic_score=scores.critic_score, critic_count=scores.critic_count,
        audience_score=scores.audience_score, audience_count=scores.audience_count,
        seasons=_seasons(html, url, ld) if kind == "tv" else [],
    )


def parse_season_page(html: str, season_number: Optional[int] = None) -> Optional[SeasonScores]:
    card = _scorecard(html)
    if card is None:
        return None
    return _scores(card)


def main():
    pass
