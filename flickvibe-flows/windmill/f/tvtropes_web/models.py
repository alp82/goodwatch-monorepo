from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    FloatField,
    IntField,
    ListField,
    EmbeddedDocument,
    EmbeddedDocumentListField,
)


class TropeData(EmbeddedDocument):
    name = StringField()
    url = StringField()
    html = StringField()


class BaseTvTropesTags(Document):
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
    tvtropes_url = StringField()

    tropes = EmbeddedDocumentListField(TropeData)

    meta = {
        "abstract": True,
        "indexes": [
            "tmdb_id",
        ],
    }


class TvTropesMovieTags(BaseTvTropesTags):
    pass


class TvTropesTvTags(BaseTvTropesTags):
    pass


def main():
    pass
