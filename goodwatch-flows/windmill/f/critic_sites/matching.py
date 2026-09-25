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
# "Title: Subtitle", "Title - Subtitle": the sites add a season or series name, TMDB a story name.
SUBTITLE_SEPARATOR = re.compile(r"\s*:\s+|\s+[-\u2013\u2014]\s+")
# A shorter head than this ("X: The Series") says too little on its own.
SUBTITLE_MIN_HEAD = 3


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
    # Letters and digits of every script: Japanese, Korean or Cyrillic titles are compared, not dropped.
    return "".join(char for char in title if char.isalnum())


def title_heads(title: Optional[str]) -> set[str]:
    """The normalized title before each subtitle separator: "Sword Art Online" for
    "Sword Art Online: Alicization"."""
    if not title:
        return set()
    heads = set()
    for separator in SUBTITLE_SEPARATOR.finditer(title):
        head = normalize_title(title[:separator.start()])
        if len(head) >= SUBTITLE_MIN_HEAD:
            heads.add(head)
    return heads


def title_matches(page_title: Optional[str], candidates: Iterable[Optional[str]]) -> bool:
    """The page title equals, closely resembles, or is a subtitled form of a candidate
    (either side may carry the subtitle)."""
    page_title = split_year_suffix(page_title)[0]
    page = normalize_title(page_title)
    if not page:
        return False
    page_heads = title_heads(page_title)
    for candidate in candidates:
        other = normalize_title(candidate)
        if not other:
            continue
        if other == page or SequenceMatcher(None, page, other).ratio() >= TITLE_SIMILARITY:
            return True
        if other in page_heads or page in title_heads(candidate):
            return True
    return False


def year_matches(page_year: Optional[int], title_year: Optional[int]) -> Optional[bool]:
    """None when either year is unknown."""
    if not page_year or not title_year:
        return None
    return abs(page_year - title_year) <= YEAR_TOLERANCE


def year_fit(page_year: Optional[int], first_year: Optional[int], last_year: Optional[int]) -> Optional[float]:
    """How well the page year fits the title: 1 within a year of the premiere, 0.5
    elsewhere in a show's run (`first_year`..`last_year`, a year of slack on each side),
    0 outside, None when a year is unknown. Movies have no `last_year`.

    Rotten Tomatoes dates a show by the first season it tracks, or its US or dubbed
    premiere, so a show's page year can fall anywhere in its run."""
    near_premiere = year_matches(page_year, first_year)
    if near_premiere is None:
        return None
    if near_premiere:
        return 1
    if last_year and first_year - YEAR_TOLERANCE <= page_year <= last_year + YEAR_TOLERANCE:
        return 0.5
    return 0


def main():
    pass
