from typing import Optional
from mongoengine import (
    DateTimeField,
    DictField,
    StringField,
    Document,
    FloatField,
    IntField,
    ListField,
    BooleanField,
)
from pydantic import BaseModel


# Pydantic Models


class RottenTomatoesCrawlResult(BaseModel):
    url: Optional[str]
    tomato_score_original: Optional[float]
    tomato_score_normalized_percent: Optional[float]
    tomato_score_vote_count: Optional[int]
    audience_score_original: Optional[float]
    audience_score_normalized_percent: Optional[float]
    audience_score_vote_count: Optional[int]
    rate_limit_reached: bool


# Database Models


class BaseRottenTomatoesRating(Document):
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
    rotten_tomatoes_url = StringField()
    # "crawl" (confirmed by f/critic_sites/crawl; on older documents a guess), "wikidata"
    # (filled by f/external_ids/wikidata_backfill, or confirmed by the crawler from Wikidata's
    # URL), "sitemap" (matched by f/critic_sites/directory, not fetched yet) or missing (a
    # legacy guess). The backfill never replaces a URL whose source is not "wikidata".
    url_source = StringField()
    # When the URL's source last confirmed it: the crawler's successful fetch, or the
    # Wikidata export the URL was taken from.
    url_verified_at = DateTimeField()
    # Wikidata's current value for this title, kept even when the stored URL differs.
    wikidata_url = StringField()

    # Crawl state (f/critic_sites/crawl, #152). The crawl queue takes titles whose
    # next_crawl_at has passed. A missing page (not_found_*) or a page that belongs to
    # another title (rejected_*) is skipped until the date.
    next_crawl_at = DateTimeField()
    crawled_at = DateTimeField()
    crawl_status = StringField()  # ok, not_found, rejected or error
    crawl_error = StringField()
    not_found_url = StringField()
    not_found_until = DateTimeField()
    rejected_url = StringField()
    rejected_until = DateTimeField()
    rejected_reason = StringField()  # duplicate, title_mismatch, year_mismatch, imdb_mismatch
    rejected_page = DictField()  # what the rejected page said: title, year, imdb_id

    tomato_score_original = FloatField()
    tomato_score_normalized_percent = FloatField()
    tomato_score_vote_count = IntField()
    audience_score_original = FloatField()
    audience_score_normalized_percent = FloatField()
    audience_score_vote_count = IntField()

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


class RottenTomatoesMovieRating(BaseRottenTomatoesRating):
    pass


class RottenTomatoesTvRating(BaseRottenTomatoesRating):
    pass


def main():
    pass
