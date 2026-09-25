"""URL, title and year comparison for the Rotten Tomatoes and Metacritic crawlers (#152)."""
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Iterable, Optional
from urllib.parse import urlsplit

# A guessed URL often lands on a same-named title; the year tells them apart.
YEAR_TOLERANCE = 1
TITLE_SIMILARITY = 0.8
TRAILING_ARTICLE = re.compile(r"^(.*),\s*(the|a|an)$", re.IGNORECASE)
YEAR_SUFFIX = re.compile(r"\s*\((\d{4})\)\s*$")


def canonical_url(url: str) -> str:
    """https, lower-case host, no query, fragment or trailing slash."""
    parts = urlsplit(url.strip())
    path = parts.path.rstrip("/")
    return f"https://{parts.netloc.lower()}{path}"


def url_key(url: str) -> str:
    return canonical_url(url).lower()


def split_year_suffix(title: Optional[str]) -> tuple[Optional[str], Optional[int]]:
    """("Oppenheimer", 2023) for "Oppenheimer (2023)"."""
    if not title:
        return title, None
    match = YEAR_SUFFIX.search(title)
    if not match:
        return title.strip(), None
    return title[:match.start()].strip(), int(match.group(1))


def normalize_title(title: Optional[str]) -> str:
    if not title:
        return ""
    title = unicodedata.normalize("NFKD", title)
    title = "".join(char for char in title if not unicodedata.combining(char))
    title = title.replace("_", " ").strip()
    article = TRAILING_ARTICLE.match(title)
    if article:
        title = f"{article.group(2)} {article.group(1)}"
    title = title.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]", "", title)


def title_matches(page_title: Optional[str], candidates: Iterable[Optional[str]]) -> bool:
    page = normalize_title(split_year_suffix(page_title)[0])
    if not page:
        return False
    for candidate in candidates:
        other = normalize_title(candidate)
        if not other:
            continue
        if other == page or SequenceMatcher(None, page, other).ratio() >= TITLE_SIMILARITY:
            return True
    return False


def year_matches(page_year: Optional[int], title_year: Optional[int]) -> Optional[bool]:
    """None when either year is unknown."""
    if not page_year or not title_year:
        return None
    return abs(page_year - title_year) <= YEAR_TOLERANCE


def main():
    pass
