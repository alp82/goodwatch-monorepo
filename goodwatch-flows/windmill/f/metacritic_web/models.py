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

    title_variations = ListField(StringField())
    release_year = IntField()
    metacritic_url = StringField()

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
        ],
    }


class MetacriticMovieRating(BaseMetacriticRating):
    pass


class MetacriticTvRating(BaseMetacriticRating):
    pass


def main():
    pass
