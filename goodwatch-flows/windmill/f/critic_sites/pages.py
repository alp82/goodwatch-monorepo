"""What the Rotten Tomatoes and Metacritic parsers read from a page (#152).

Scores are in the site's own scale: RT's Tomatometer and Popcornmeter are percents,
Metacritic's Metascore is 0-100 and its user score 0-10. Season numbers are the
site's own, which normally match TMDB's and IMDb's.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SeasonListing:
    """A season the show page lists, with its critic score when the show page has one."""
    number: int
    url: str
    critic_score: Optional[float] = None
    critic_count: Optional[int] = None


@dataclass
class ParsedTitle:
    canonical_url: str
    kind: str  # "tv" or "movie"
    title: Optional[str] = None
    year: Optional[int] = None
    imdb_id: Optional[str] = None  # Metacritic only
    critic_score: Optional[float] = None
    critic_count: Optional[int] = None
    audience_score: Optional[float] = None
    audience_count: Optional[int] = None
    seasons: list[SeasonListing] = field(default_factory=list)


@dataclass
class SeasonScores:
    critic_score: Optional[float] = None
    critic_count: Optional[int] = None
    audience_score: Optional[float] = None
    audience_count: Optional[int] = None


def to_int(value) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    digits = "".join(char for char in str(value) if char.isdigit())
    return int(digits) if digits else None


def to_float(value) -> Optional[float]:
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def main():
    pass
