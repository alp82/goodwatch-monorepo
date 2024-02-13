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

    title_variations = ListField(StringField())
    release_year = IntField()
    rotten_tomatoes_url = StringField()

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
        ],
    }


class RottenTomatoesMovieRating(BaseRottenTomatoesRating):
    pass


class RottenTomatoesTvRating(BaseRottenTomatoesRating):
    pass


def main():
    pass
