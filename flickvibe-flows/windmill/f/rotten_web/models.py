from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    FloatField,
    IntField,
    ListField,
)


class BaseRottenTomatoesRating(Document):
    tmdb_id = IntField()
    original_title = StringField()
    popularity = FloatField()

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()

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
        ],
    }


class RottenTomatoesMovieRating(BaseRottenTomatoesRating):
    pass


class RottenTomatoesTvRating(BaseRottenTomatoesRating):
    pass


def main():
    pass
