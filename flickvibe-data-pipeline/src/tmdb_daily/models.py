from datetime import date, datetime
from enum import Enum

from mongoengine import DateTimeField, StringField, Document, FloatField, DateField, EnumField, BooleanField, IntField

from src.data_source.models import MediaType


class DumpType(Enum):
    MOVIES = "movie_ids"
    TV_SERIES = "tv_series_ids"


class TmdbDailyDumpAvailability(Document):
    type = EnumField(DumpType, required=True)
    url = StringField(required=True)
    day = DateField(required=True)
    discovered_at = DateTimeField(required=True, default=datetime.utcnow)
    started_at = DateTimeField()
    finished_at = DateTimeField()
    row_count = IntField()
    failed_at = DateTimeField()
    error_message = StringField()


class TmdbDailyDumpData(Document):
    tmdb_id = StringField(required=True)
    type = EnumField(MediaType, required=True)
    original_title = StringField(required=True)
    popularity = FloatField(required=True)
    adult = BooleanField(required=True, default=False)
    video = BooleanField(required=True, default=False)
    created_at = DateTimeField(required=True)
    updated_at = DateTimeField(required=True)

    meta = {
        'indexes': [
            ('tmdb_id', 'type'),
        ]
    }