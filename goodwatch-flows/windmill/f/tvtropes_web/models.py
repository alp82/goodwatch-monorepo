from typing import Optional
from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    FloatField,
    IntField,
    ListField,
    BooleanField,
    EmbeddedDocument,
    EmbeddedDocumentListField,
)
from pydantic import BaseModel


# Pydantic Models


class Trope(BaseModel):
    name: str
    url: str
    html: str


class TvTropesCrawlResult(BaseModel):
    url: Optional[str]
    tropes: list[Trope]
    rate_limit_reached: bool


# Database Models


class TropeData(EmbeddedDocument):
    name = StringField()
    url = StringField()
    html = StringField()


class BaseTvTropesTags(Document):
    tmdb_id = IntField()
    original_title = StringField()
    popularity = FloatField()
    overview = StringField()

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()
    is_selected = BooleanField(default=False)

    title_variations = ListField(StringField())
    release_year = IntField()
    tvtropes_url = StringField()

    tropes = EmbeddedDocumentListField(TropeData)

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


class TvTropesMovieTags(BaseTvTropesTags):
    pass


class TvTropesTvTags(BaseTvTropesTags):
    pass


def main():
    pass
