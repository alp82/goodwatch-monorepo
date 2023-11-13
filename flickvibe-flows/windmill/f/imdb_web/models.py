from mongoengine import DateTimeField, StringField, Document, FloatField, IntField


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
        ],
    }


class ImdbMovieRating(BaseImdbRating):
    pass


class ImdbTvRating(BaseImdbRating):
    pass
