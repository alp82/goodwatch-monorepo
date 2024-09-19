from typing import Optional, Literal
from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    EmbeddedDocument,
    FloatField,
    IntField,
    BooleanField,
    EmbeddedDocumentListField,
)
from pydantic import BaseModel


# Pydantic Models


StreamType = (
    Literal["flatrate"]
    | Literal["free"]
    | Literal["ads"]
    | Literal["rent"]
    | Literal["buy"]
)


class StreamingLink(BaseModel):
    stream_url: Optional[str]
    stream_type: Optional[StreamType]
    provider_name: Optional[str]
    price_dollar: Optional[float]
    quality: Optional[str]


class TmdbStreamingCrawlResult(BaseModel):
    url: Optional[str]
    country_code: Optional[str]
    streaming_links: Optional[list[StreamingLink]]
    rate_limit_reached: bool


# Database Models


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
    is_selected = BooleanField(default=False)

    country_code = StringField()
    streaming_links = EmbeddedDocumentListField(StreamingLinkDoc)
    count_expected = IntField()
    count_available = IntField()
    rate_limit_reached: bool

    meta = {
        "abstract": True,
        "indexes": [
            "tmdb_id",
            "tmdb_watch_url",
            "popularity",
            "country_code",
            "selected_at",
            "updated_at",
            "is_selected",
            "count_expected",
            "count_available",
        ],
    }


class TmdbMovieProviders(BaseTmdbProviders):
    pass


class TmdbTvProviders(BaseTmdbProviders):
    pass


def main():
    pass
