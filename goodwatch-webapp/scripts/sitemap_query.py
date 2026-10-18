"""Eligible title pool and deterministic ranking. Cohort retention: sitemap_selection.py."""
from typing import Literal

TITLE_LIMIT = {"movie": 700, "show": 300}
CORE_LIMIT = {"movie": 630, "show": 270}
DETAILS_MAX_AGE_DAYS = 30
FILTER_CONDITION = ("goodwatch_overall_score_voting_count > 5000 "
                    "AND goodwatch_overall_score_normalized_percent >= 60 "
                    "AND release_year IS NOT NULL AND poster_path IS NOT NULL "
                    "AND synopsis IS NOT NULL AND trim(synopsis) <> '' "
                    "AND (adult = false OR adult IS NULL) "
                    f"AND tmdb_details_updated_at > now() - INTERVAL '{DETAILS_MAX_AGE_DAYS} days'")


def detail_query(table_name: Literal["movie", "show"]) -> str:
    """Read the full eligible pool so retained titles need not remain highly ranked."""
    if table_name not in TITLE_LIMIT:
        raise ValueError(f"Unknown table: {table_name}")
    if table_name == 'movie':
        extra = "release_date IS NOT NULL AND release_date <= now() AND status = 'Released'"
    else:
        extra = ("first_air_date IS NOT NULL AND first_air_date <= now() "
                 "AND NOT coalesce('Talk' = ANY(genres), false) "
                 "AND NOT coalesce('News' = ANY(genres), false) "
                 "AND NOT coalesce('Soap' = ANY(genres), false) "
                 "AND NOT coalesce('Reality' = ANY(genres), false) "
                 "AND NOT (coalesce('Kids' = ANY(genres), false) AND coalesce(number_of_episodes, 0) >= 300)")
    return (
        "SELECT tmdb_id, title, original_title, tmdb_details_updated_at, dna_updated_at, "
        "goodwatch_overall_score_voting_count, popularity "
        f"FROM {table_name} WHERE {FILTER_CONDITION} AND {extra} "
        "ORDER BY goodwatch_overall_score_voting_count DESC, tmdb_id ASC"
    )
