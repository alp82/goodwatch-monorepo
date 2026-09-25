from typing import Optional
from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    FloatField,
    IntField,
    ListField,
    BooleanField,
)
from pydantic import BaseModel


# Pydantic models


class MetacriticCrawlResult(BaseModel):
    url: Optional[str]
    meta_score_original: Optional[float]
    meta_score_normalized_percent: Optional[float]
    meta_score_vote_count: Optional[int]
    user_score_original: Optional[float]
    user_score_normalized_percent: Optional[float]
    user_score_vote_count: Optional[int]
    rate_limit_reached: bool


# Database models


class BaseMetacriticRating(Document):
    tmdb_id = IntField()
    original_title = StringField()
    popularity = FloatField()

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()
    is_selected = BooleanField(default=False)
    # Copied from the TMDB details flag when TMDB permanently removed the title; missing means not deleted.
    tmdb_deleted = BooleanField(default=False)

    title_variations = ListField(StringField())
    release_year = IntField()
    metacritic_url = StringField()
    # "crawl" (found by the crawler; missing on older documents means the same) or
    # "wikidata" (filled by f/external_ids/wikidata_backfill). A crawled URL is never
    # replaced by Wikidata's.
    url_source = StringField()
    # When the URL's source last confirmed it: the crawler's successful fetch, or the
    # Wikidata export the URL was taken from.
    url_verified_at = DateTimeField()
    # Wikidata's current value for this title, kept even when the stored URL differs.
    wikidata_url = StringField()

    meta_score_original = FloatField()
    meta_score_normalized_percent = FloatField()
    meta_score_vote_count = IntField()
    user_score_original = FloatField()
    user_score_normalized_percent = FloatField()
    user_score_vote_count = IntField()

    meta = {
        "abstract": True,
        "indexes": [
            "tmdb_id",
            "popularity",
            "selected_at",
            "updated_at",
            "is_selected",
            # The completeness queue reads never-selected and stale titles in popularity order.
            ("selected_at", "-popularity"),
            ("-popularity", "selected_at"),
        ],
    }


class MetacriticMovieRating(BaseMetacriticRating):
    pass


class MetacriticTvRating(BaseMetacriticRating):
    pass


def main():
    pass
