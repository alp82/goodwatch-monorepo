from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    EmbeddedDocument,
    FloatField,
    IntField,
    EmbeddedDocumentListField,
)


class StreamingLinkDoc(EmbeddedDocument):
    stream_url = StringField()
    stream_type = StringField()
    provider_name = StringField()
    price_dollar = FloatField()
    quality = StringField()


class BaseTmdbProviders(Document):
    tmdb_id = IntField()
    tmdb_watch_url = StringField()
    original_title = StringField()
    popularity = FloatField()

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()

    country_code = StringField()
    streaming_links = EmbeddedDocumentListField(StreamingLinkDoc)
    rate_limit_reached: bool

    meta = {
        "abstract": True,
        "indexes": [
            "tmdb_id",
            "tmdb_watch_url",
        ],
    }


class TmdbMovieProviders(BaseTmdbProviders):
    pass


class TmdbTvProviders(BaseTmdbProviders):
    pass


if __name__ == "__main__":
    pass
