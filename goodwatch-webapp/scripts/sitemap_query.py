"""The statement that picks the titles for the detail sitemaps. Kept apart from the generator so that it can be
tested without a database."""
from typing import Literal

# A small site gets little crawl budget, so the sitemap lists only the titles
# most likely to be searched. Raise these once Google indexes most of them.
TITLE_LIMIT = {
    "movie": 700,
    "show": 300,
}

# A title page answers 200 exactly when its row exists, so every listed URL works on the day of the run.
# TMDB deletes ids (duplicates that it merges), and the pipeline then removes the row: six of the 1,000 URLs
# listed on 2026-09-25 answered 404 nine days later. Two things keep that share low:
# - Run the generator regularly. A sitemap is a snapshot, and only a new run drops deleted titles.
# - List only titles whose TMDB details were read recently. A row that the pipeline can no longer refresh is a
#   candidate for deletion, and it stays out. Every title that qualified on 2026-10-04 was read within 14 days.
DETAILS_MAX_AGE_DAYS = 30

FILTER_CONDITION = ("goodwatch_overall_score_voting_count > 5000 "
                    "AND goodwatch_overall_score_normalized_percent > 30 "
                    "AND release_year IS NOT NULL "
                    "AND poster_path IS NOT NULL "
                    f"AND tmdb_details_updated_at > now() - INTERVAL '{DETAILS_MAX_AGE_DAYS} days'")


def detail_query(table_name: Literal["movie", "show"]) -> str:
    """lastmod reflects changes to what the page shows: TMDB details and the fingerprint."""
    if table_name not in TITLE_LIMIT:
        raise ValueError(f"Unknown table: {table_name}")
    return (
        f"SELECT tmdb_id, title, original_title, tmdb_details_updated_at, dna_updated_at "
        f"FROM {table_name} "
        f"WHERE {FILTER_CONDITION} "
        f"ORDER BY popularity DESC, tmdb_id ASC "
        f"LIMIT {TITLE_LIMIT[table_name]}"
    )
