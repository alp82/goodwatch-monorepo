"""The IMDb title id of a TMDB details document.

TMDB is the primary source: `imdb_id` on movies, `external_ids.imdb_id` on shows.
When TMDB has no valid id, the weekly Wikidata backfill (#150) may have stored one
in `imdb_id_override`. A TMDB id always wins over the override.
"""
import re
from typing import Optional

IMDB_TITLE_ID = re.compile(r"tt\d+")


def valid_imdb_id(raw) -> Optional[str]:
    """The IMDb title id in `raw`, or None for anything else (empty, "None", a person id)."""
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    return value if IMDB_TITLE_ID.fullmatch(value) else None


def tmdb_imdb_id(details: dict, is_movie: bool) -> Optional[str]:
    raw = details.get("imdb_id") if is_movie else (details.get("external_ids") or {}).get("imdb_id")
    return valid_imdb_id(raw)


def effective_imdb_id(details: dict, is_movie: bool) -> tuple[Optional[str], Optional[str]]:
    """(IMDb id, "tmdb" | "wikidata") for a TMDB details document, or (None, None)."""
    tmdb_id = tmdb_imdb_id(details, is_movie)
    if tmdb_id:
        return tmdb_id, "tmdb"
    override = valid_imdb_id(details.get("imdb_id_override"))
    if override:
        return override, "wikidata"
    return None, None


def imdb_url(imdb_id: Optional[str]) -> Optional[str]:
    return f"https://www.imdb.com/title/{imdb_id}" if imdb_id else None


def main():
    pass
