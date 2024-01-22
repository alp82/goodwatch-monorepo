from mongoengine import (
    DateField,
    DateTimeField,
    StringField,
    Document,
    FloatField,
    BooleanField,
    IntField,
    EmbeddedDocument,
    EmbeddedDocumentField,
    EmbeddedDocumentListField,
    ListField,
    DictField,
)


# Collections
# -----------


class BelongsToCollection(EmbeddedDocument):
    id = IntField()
    name = StringField()
    poster_path = StringField()
    backdrop_path = StringField()


# Genres
# ------


class Genre(EmbeddedDocument):
    id = IntField()
    name = StringField()


# Production companies
# --------------------


class ProductionCompany(EmbeddedDocument):
    id = IntField()
    logo_path = StringField()
    name = StringField()
    origin_country = StringField()


# Production countries
# --------------------


class ProductionCountry(EmbeddedDocument):
    iso_3166_1 = StringField()
    name = StringField()


# Spoken languages
# ----------------


class SpokenLanguage(EmbeddedDocument):
    english_name = StringField()
    iso_639_1 = StringField()
    name = StringField()


# Alternative titles
# ------------------


class AlternativeTitle(EmbeddedDocument):
    iso_3166_1 = StringField()
    title = StringField()
    type = StringField()


# Credits
# -------


class BasePerson(EmbeddedDocument):
    adult = BooleanField()
    gender = IntField()
    id = IntField()
    known_for_department = StringField()
    name = StringField()
    original_name = StringField()
    popularity = FloatField()
    profile_path = StringField()

    meta = {
        "abstract": True,
    }


class Role(EmbeddedDocument):
    credit_id = StringField()
    character = StringField()
    episode_count = IntField()


class Job(EmbeddedDocument):
    credit_id = StringField()
    job = StringField()
    episode_count = IntField()


class CastItemMovie(BasePerson):
    cast_id = IntField()
    character = StringField()
    credit_id = StringField()
    order = IntField()


class CrewItemMovie(BasePerson):
    credit_id = StringField()
    department = StringField()
    job = StringField()


class CastItemTv(BasePerson):
    roles = EmbeddedDocumentListField(Role)
    total_episode_count = IntField()
    order = IntField()


class CrewItemTv(BasePerson):
    jobs = EmbeddedDocumentListField(Job)
    total_episode_count = IntField()
    department = StringField()


class CreditsMovie(EmbeddedDocument):
    cast = EmbeddedDocumentListField(CastItemMovie)
    crew = EmbeddedDocumentListField(CrewItemMovie)


class CreditsTv(EmbeddedDocument):
    cast = EmbeddedDocumentListField(CastItemTv)
    crew = EmbeddedDocumentListField(CrewItemTv)


class CreatedBy(EmbeddedDocument):
    id = IntField()
    credit_id = StringField()
    name = StringField()
    gender = IntField()
    profile_path = StringField()


# Content Ratings
# ---------------


class ContentRating(EmbeddedDocument):
    descriptors = ListField(StringField())
    iso_3166_1 = StringField()
    rating = StringField()


# External Ids
# ------------


class ExternalIds(EmbeddedDocument):
    imdb_id = StringField()
    freebase_mid = StringField()
    freebase_id = StringField()
    tvdb_id = IntField()
    tvrage_id = IntField()
    wikidata_id = StringField()
    facebook_id = StringField()
    instagram_id = StringField()
    twitter_id = StringField()


# Images
# ------


class Image(EmbeddedDocument):
    aspect_ratio = FloatField()
    height = IntField()
    iso_639_1 = StringField()
    file_path = StringField()
    vote_average = FloatField()
    vote_count = IntField()
    width = IntField()


class Images(EmbeddedDocument):
    backdrops = EmbeddedDocumentListField(Image)
    logos = EmbeddedDocumentListField(Image)
    posters = EmbeddedDocumentListField(Image)


# Keywords
# --------


class Keyword(EmbeddedDocument):
    id = IntField()
    name = StringField()


# Networks
# --------


class Network(EmbeddedDocument):
    id = IntField()
    logo_path = StringField()
    name = StringField()
    origin_country = StringField()


# Recommendations
# --------------


class MovieResult(EmbeddedDocument):
    adult = BooleanField(default=False)
    backdrop_path = StringField()
    id = IntField()
    genre_ids = ListField(IntField())
    media_type = StringField()
    original_language = StringField()
    original_title = StringField()
    overview = StringField()
    popularity = FloatField()
    poster_path = StringField()
    release_date = DateField()
    title = StringField()
    video = BooleanField()
    vote_average = FloatField()
    vote_count = IntField()


class RecommendationsMovie(EmbeddedDocument):
    page = IntField()
    results = EmbeddedDocumentListField(MovieResult)
    total_pages = IntField()
    total_results = IntField()


class TvResult(EmbeddedDocument):
    adult = BooleanField(default=False)
    backdrop_path = StringField()
    id = IntField()
    first_air_date = DateField()
    genre_ids = ListField(IntField())
    media_type = StringField()
    origin_country = ListField(StringField())
    original_language = StringField()
    original_title = StringField()
    overview = StringField()
    popularity = FloatField()
    poster_path = StringField()
    title = StringField()
    vote_average = FloatField()
    vote_count = IntField()


class RecommendationsTv(EmbeddedDocument):
    page = IntField()
    results = EmbeddedDocumentListField(TvResult)
    total_pages = IntField()
    total_results = IntField()


# Release Dates
# -------------


class ReleaseDate(EmbeddedDocument):
    certification = StringField()
    descriptors = ListField(StringField())
    iso_639_1 = StringField()
    note = StringField()
    release_date = DateField()
    type = IntField()


class ReleaseDatesResult(EmbeddedDocument):
    iso_3166_1 = StringField()
    release_dates = EmbeddedDocumentListField(ReleaseDate)


class ReleaseDates(EmbeddedDocument):
    results = EmbeddedDocumentListField(ReleaseDatesResult)


# Seasons
# -------


class EpisodeToAir(EmbeddedDocument):
    air_date = DateField()
    episode_number = IntField()
    episode_type = StringField()
    id = IntField()
    overview = StringField()
    production_code = StringField()
    runtime = IntField()
    season_number = IntField()
    show_id = IntField()
    still_path = StringField()
    title = StringField()
    vote_average = FloatField()
    vote_count = IntField()


class Season(EmbeddedDocument):
    air_date = StringField()
    episode_count = IntField()
    id = IntField()
    name = StringField()
    overview = StringField()
    poster_path = StringField()
    season_number = IntField()
    vote_average = FloatField()


# Translations
# ------------


class TranslationData(EmbeddedDocument):
    homepage = StringField()
    overview = StringField()
    runtime = IntField()
    tagline = StringField()
    title = StringField()


class Translation(EmbeddedDocument):
    iso_3166_1 = StringField()
    iso_639_1 = StringField()
    name = StringField()
    english_name = StringField()
    data = EmbeddedDocumentField(TranslationData)


# Videos
# ------


class Video(EmbeddedDocument):
    iso_639_1 = StringField()
    iso_3166_1 = StringField()
    name = StringField()
    key = StringField()
    site = StringField()
    size = IntField()
    type = StringField()
    official = BooleanField()
    published_at = StringField()
    id = StringField()


# Watch Providers
# ---------------


class Provider(EmbeddedDocument):
    logo_path = StringField()
    provider_id = IntField()
    provider_name = StringField()
    display_priority = IntField()


class ProviderData(EmbeddedDocument):
    link = StringField()
    fast = EmbeddedDocumentListField(Provider)
    flatrate_and_buy = EmbeddedDocumentListField(Provider)
    flatrate = EmbeddedDocumentListField(Provider)
    buy = EmbeddedDocumentListField(Provider)
    rent = EmbeddedDocumentListField(Provider)
    ads = EmbeddedDocumentListField(Provider)
    free = EmbeddedDocumentListField(Provider)


class WatchProviders(EmbeddedDocument):
    results = DictField(field=EmbeddedDocumentField(ProviderData))


# =================
# Details documents
# =================


class BaseTmdbDetails(Document):
    tmdb_id = IntField()
    original_title = StringField()
    popularity = FloatField()
    adult = BooleanField(default=False)
    video = BooleanField(default=False)

    created_at = DateTimeField()
    updated_at = DateTimeField()
    selected_at = DateTimeField()
    failed_at = DateTimeField()
    error_message = StringField()

    meta = {
        "abstract": True,
        "indexes": [
            "tmdb_id",
        ],
    }


class TmdbMovieDetails(BaseTmdbDetails):
    backdrop_path = StringField()
    belongs_to_collection = EmbeddedDocumentField(BelongsToCollection)
    budget = IntField()
    genres = EmbeddedDocumentListField(Genre)
    homepage = StringField()
    imdb_id = StringField()
    original_language = StringField()
    overview = StringField()
    poster_path = StringField()
    production_companies = EmbeddedDocumentListField(ProductionCompany)
    production_countries = EmbeddedDocumentListField(ProductionCountry)
    release_date = DateField()
    revenue = IntField()
    runtime = IntField()
    spoken_languages = EmbeddedDocumentListField(SpokenLanguage)
    status = StringField()
    tagline = StringField()
    title = StringField()
    vote_average = FloatField()
    vote_count = IntField()
    alternative_titles = EmbeddedDocumentListField(AlternativeTitle)
    credits = EmbeddedDocumentField(CreditsMovie)
    images = EmbeddedDocumentField(Images)
    keywords = EmbeddedDocumentListField(Keyword)
    recommendations = EmbeddedDocumentField(RecommendationsMovie)
    release_dates = EmbeddedDocumentField(ReleaseDates)
    similar = EmbeddedDocumentField(RecommendationsMovie)
    translations = EmbeddedDocumentListField(Translation)
    videos = EmbeddedDocumentListField(Video)
    watch_providers = EmbeddedDocumentField(WatchProviders)

    meta = {
        "indexes": [
            "imdb_id",
            "popularity",
            "selected_at",
            "updated_at",
        ],
    }


class TmdbTvDetails(BaseTmdbDetails):
    backdrop_path = StringField()
    created_by = EmbeddedDocumentListField(CreatedBy)
    episode_run_time = ListField(IntField())
    first_air_date = DateField()
    genres = EmbeddedDocumentListField(Genre)
    homepage = StringField()
    in_production = BooleanField()
    languages = ListField(StringField())
    last_air_date = DateField()
    last_episode_to_air = EmbeddedDocumentField(EpisodeToAir)
    next_episode_to_air = EmbeddedDocumentField(EpisodeToAir)
    networks = EmbeddedDocumentListField(Network)
    number_of_episodes = IntField()
    number_of_seasons = IntField()
    origin_country = ListField(StringField())
    original_language = StringField()
    overview = StringField()
    poster_path = StringField()
    production_companies = EmbeddedDocumentListField(ProductionCompany)
    production_countries = EmbeddedDocumentListField(ProductionCountry)
    seasons = EmbeddedDocumentListField(Season)
    spoken_languages = EmbeddedDocumentListField(SpokenLanguage)
    status = StringField()
    tagline = StringField()
    title = StringField()
    type = StringField()
    vote_average = FloatField()
    vote_count = IntField()
    aggregate_credits = EmbeddedDocumentField(CreditsTv)
    alternative_titles = EmbeddedDocumentListField(AlternativeTitle)
    content_ratings = EmbeddedDocumentListField(ContentRating)
    external_ids = EmbeddedDocumentField(ExternalIds)
    images = EmbeddedDocumentField(Images)
    keywords = EmbeddedDocumentListField(Keyword)
    recommendations = EmbeddedDocumentField(RecommendationsTv)
    similar = EmbeddedDocumentField(RecommendationsTv)
    translations = EmbeddedDocumentListField(Translation)
    videos = EmbeddedDocumentListField(Video)
    watch_providers = EmbeddedDocumentField(WatchProviders)

    meta = {
        "indexes": [
            "external_ids.imdb_id",
            "popularity",
            "selected_at",
            "updated_at",
        ],
    }

def main():
    pass
