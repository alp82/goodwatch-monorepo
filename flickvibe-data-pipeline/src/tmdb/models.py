from datetime import date, datetime
from enum import Enum

from mongoengine import DateTimeField, StringField, Document, DateField, EnumField


class DumpType(Enum):
    MOVIES = "movie_ids"
    TV_SERIES = "tv_series_ids"


class TmdbDailyDump(Document):
    type = EnumField(DumpType, required=True)
    url = StringField(required=True)
    day = DateField(required=True)
    discovered_at = DateTimeField(required=True, default=datetime.utcnow)
    started_at = DateTimeField()
    finished_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()


class MediaType(Enum):
    MOVIE = "movie"
    TV_SHOW = "tv_show"


class TmdbDailyData(Document):
    tmdb_id = StringField(required=True)
    type = EnumField(MediaType, required=True)
    title = StringField(required=True)
    created_at = DateTimeField(required=True, default=datetime.utcnow)
    updated_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()
