"""Letterboxd movie identity and aggregate ratings from public page JSON-LD."""
import json
import math
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urlsplit


def movie_url(raw):
    if not isinstance(raw, str):
        return None
    parts = urlsplit(raw)
    if (parts.scheme == "https" and parts.netloc == "letterboxd.com"
            and re.fullmatch(r"/film/[^/]+/?", parts.path)):
        return "https://letterboxd.com" + parts.path.rstrip("/") + "/"
    return None


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.scripts, self.links = [], []
        self.canonical = None
        self.og_url = None
        self.lid = None
        self.script = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self.script = []
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "link" and "canonical" in attrs.get("rel", "").split():
            self.canonical = movie_url(attrs.get("href"))
        if tag == "meta" and attrs.get("property") == "og:url":
            self.og_url = movie_url(attrs.get("content"))
        if tag == "meta" and attrs.get("name") == "production:identifier":
            try:
                identifier = json.loads(attrs.get("content", ""))
                if identifier.get("type") == "film" and re.fullmatch(r"[A-Za-z0-9]+", identifier.get("lid", "")):
                    self.lid = identifier["lid"]
            except (ValueError, AttributeError, TypeError):
                pass

    def handle_data(self, data):
        if self.script is not None:
            self.script.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.scripts.append("".join(self.script))
            self.script = None


def nodes(value):
    if isinstance(value, list):
        for item in value:
            yield from nodes(item)
    elif isinstance(value, dict):
        yield value
        yield from nodes(value.get("@graph"))


@dataclass(frozen=True)
class MovieRating:
    url: str
    score: float | None
    votes: int | None
    lid: str | None


def parse(html: str, final_url: str, tmdb_id: int, imdb_id: str | None) -> MovieRating:
    """Require one Movie node, canonical agreement and exact external identity.

    A verified movie without aggregateRating has no published score. Malformed
    aggregates are errors, so a markup change never deletes a last good score.
    """
    final = movie_url(final_url)
    doc = Document(html)
    if not final or (doc.canonical or doc.og_url) != final:
        raise ValueError("not a canonical Letterboxd movie page")
    imdb, tmdb, lids = set(), set(), set()
    for link in doc.links:
        parts = urlsplit(link)
        if parts.hostname in ("imdb.com", "www.imdb.com"):
            match = re.fullmatch(r"/title/(tt\d+)(?:/maindetails)?/?", parts.path)
            if match:
                imdb.add(match[1])
        if parts.hostname in ("themoviedb.org", "www.themoviedb.org"):
            match = re.fullmatch(r"/(movie|tv)/(\d+)(?:-[^/]*)?/?", parts.path)
            if match:
                tmdb.add((match[1], int(match[2])))
        if parts.hostname == "boxd.it" and re.fullmatch(r"/[A-Za-z0-9]+/?", parts.path):
            lids.add(parts.path.strip("/"))
    # A TV entry with the same numeric TMDB id is a different work.
    if tmdb and tmdb != {("movie", tmdb_id)}:
        raise IdentityMismatch("TMDB identity mismatch")
    if imdb_id and imdb and imdb != {imdb_id}:
        raise IdentityMismatch("IMDb identity mismatch")
    if ("movie", tmdb_id) not in tmdb and not (imdb_id and imdb == {imdb_id}):
        raise IdentityMismatch("no matching external identity")
    movies = []
    for script in doc.scripts:
        clean = re.sub(r"^\s*/\*\s*<!\[CDATA\[\s*\*/", "", script)
        clean = re.sub(r"/\*\s*\]\]>\s*\*/\s*$", "", clean)
        for node in nodes(json.loads(clean)):
            types = node.get("@type", [])
            if "Movie" in ([types] if isinstance(types, str) else types):
                movies.append(node)
    if len(movies) != 1 or movie_url(movies[0].get("url")) != final:
        raise ValueError("expected one matching Movie JSON-LD node")
    aggregate = movies[0].get("aggregateRating")
    score = votes = None
    if aggregate is not None:
        if not isinstance(aggregate, dict):
            raise ValueError("invalid aggregateRating")
        if any(isinstance(aggregate.get(key), bool) for key in ("ratingValue", "ratingCount", "bestRating", "worstRating")):
            raise ValueError("invalid numeric rating")
        score = float(aggregate["ratingValue"])
        count = float(aggregate["ratingCount"])
        best, worst = float(aggregate["bestRating"]), float(aggregate["worstRating"])
        if not (math.isfinite(score) and worst == 0.5 and best == 5 and 0.5 <= score <= 5
                and math.isfinite(count) and count.is_integer() and 0 < count <= 2**53):
            raise ValueError("invalid rating scale, score or count")
        votes = int(count)
    return MovieRating(final, score, votes, doc.lid or (next(iter(lids)) if len(lids) == 1 else None))


class IdentityMismatch(ValueError):
    pass


def main():
    pass
