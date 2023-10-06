from enum import Enum

from mongoengine import Document, EnumField


class MediaType(Enum):
    MOVIE = "movie"
    TV = "tv"


class DataSourceType(Enum):
    TMDB_API = "tmdb_api"
    IMDB_WEB = "imdb_web"
    METACRITIC_WEB = "metacritic_web"
    ROTTEN_TOMATOES_WEB = "rotten_tomatoes_web"
    TV_TROPES_WEB = "tv_tropes_web"


class DataSourceStatus(Document):
    data_source_type = EnumField(DataSourceType, required=True)
    media_type = EnumField(MediaType, required=True)
