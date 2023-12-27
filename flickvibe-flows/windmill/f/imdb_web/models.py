from typing import Optional
from mongoengine import DateTimeField, StringField, Document, FloatField, IntField
from pydantic import BaseModel


# Pydantic models


class ImdbCrawlResult(BaseModel):
    url: str
    user_score_original: Optional[float]
    user_score_normalized_percent: Optional[float]
    user_score_vote_count: Optional[int]


# Database models


class BaseImdbRating(Document):
    tmdb_id = IntField()
    imdb_id = StringField()
    original_title = StringField()
    popularity = FloatField()

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()

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
        ],
    }


class ImdbMovieRating(BaseImdbRating):
    pass


class ImdbTvRating(BaseImdbRating):
    pass


def main():
    pass
