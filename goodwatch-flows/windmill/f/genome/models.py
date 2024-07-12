from mongoengine import (
    DateTimeField,
    StringField,
    Document,
    ListField,
    DictField,
    IntField,
    FloatField,
    BooleanField,
)


# Database models

class BaseGenome(Document):
    tmdb_id = IntField()
    original_title = StringField()
    release_year = IntField()
    popularity = FloatField()
    trope_names = ListField()

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()
    is_selected = BooleanField(default=False)

    dna = DictField()

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


class GenomeMovie(BaseGenome):
    pass


class GenomeTv(BaseGenome):
    pass


def main():
    pass
