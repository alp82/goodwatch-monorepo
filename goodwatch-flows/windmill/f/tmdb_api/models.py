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
    DynamicField,
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
    iso_3166_1 = StringField()
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
    cast = DictField()
    crew = DictField()
    id = IntField()
    first_air_date = DateField()
    genre_ids = ListField(IntField())
    media_type = StringField()
    name = StringField()
    origin_country = ListField(StringField())
    original_language = StringField()
    original_name = StringField()
    original_title = StringField()
    overview = StringField()
    popularity = FloatField()
    poster_path = StringField()
    release_date = DateField()
    softcore = BooleanField(default=False)
    title = StringField()
    video = BooleanField()
    vote_average = FloatField()
    vote_count = IntField()


class RecommendationsMovie(EmbeddedDocument):
    results = EmbeddedDocumentListField(MovieResult)
    page = IntField()
    total_pages = IntField()
    total_results = IntField()
    keywords = ListField(StringField())
    cast = DictField()
    crew = DictField()
    wikidata_id = StringField()
    freebase_id = StringField()
    freebase_mid = StringField()
    tvdb_id = StringField()
    tvrage_id = StringField()


class TvResult(EmbeddedDocument):
    adult = BooleanField(default=False)
    backdrop_path = StringField()
    cast = DictField()
    crew = DictField()
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
    softcore = BooleanField(default=False)
    title = StringField()
    vote_average = FloatField()
    vote_count = IntField()


class RecommendationsTv(EmbeddedDocument):
    results = EmbeddedDocumentListField(TvResult)
    page = IntField()
    total_pages = IntField()
    total_results = IntField()
    keywords = ListField(StringField())
    cast = DictField()
    crew = DictField()
    wikidata_id = StringField()
    freebase_id = StringField()
    freebase_mid = StringField()
    tvdb_id = StringField()
    tvrage_id = StringField()


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
    keywords = ListField(StringField())
    page = IntField()
    total_pages = IntField()
    total_results = IntField()


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
    results = DynamicField(field=EmbeddedDocumentField(ProviderData))
    page = IntField()
    total_pages = IntField()
    total_results = IntField()


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
    adult = BooleanField()
    backdrop_path = StringField()
    belongs_to_collection = EmbeddedDocumentField(BelongsToCollection)
    budget = IntField()
    cast = EmbeddedDocumentListField(CastItemMovie)
    crew = EmbeddedDocumentListField(CrewItemMovie)
    genres = EmbeddedDocumentListField(Genre)
    homepage = StringField()
    imdb_id = StringField()
    origin_country = StringField()
    original_language = StringField()
    original_title = StringField()
    overview = StringField()
    popularity = IntField()
    poster_path = StringField()
    posters = DictField()
    production_companies = EmbeddedDocumentListField(ProductionCompany)
    production_countries = EmbeddedDocumentListField(ProductionCountry)
    release_date = EmbeddedDocumentField(ReleaseDate)
    revenue = IntField()
    runtime = IntField()
    spoken_languages = EmbeddedDocumentListField(SpokenLanguage)
    status = StringField()
    tagline = StringField()
    title = StringField()
    video = EmbeddedDocumentField(Video)
    vote_average = FloatField()
    vote_count = IntField()


class CreditsTv(EmbeddedDocument):
    cast = EmbeddedDocumentListField(CastItemTv)
    crew = EmbeddedDocumentListField(CrewItemTv)


class CreatedBy(EmbeddedDocument):
    id = IntField()
    credit_id = StringField()
    name = StringField()
    original_name = StringField()
    gender = IntField()
    profile_path = StringField()
    
    
# =================
# Details documents
# =================


class BaseTmdbDetails(Document):
    watch_providers_check = DictField()
    watch_providers_attempted_at = DateTimeField()
    watch_providers_error = StringField()
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
    is_selected = BooleanField(default=False)
    # Set when TMDB permanently removed the title; a missing field means not deleted.
    tmdb_deleted = BooleanField(default=False)
    tmdb_deleted_at = DateTimeField()
    # IMDb id from Wikidata when TMDB has none; written only by f/external_ids/wikidata_backfill.
    # TMDB's own id always wins (f/external_ids/imdb_ids.effective_imdb_id).
    imdb_id_override = StringField()
    imdb_id_override_source = StringField()
    imdb_id_override_at = DateTimeField()

    meta = {
        "abstract": True,
        "indexes": [
            "tmdb_id",
            "popularity",
            "selected_at",
            "updated_at",
            "is_selected",
            ("updated_at", "tmdb_id"),
            # The completeness queue reads never-selected and stale titles in popularity order.
            ("selected_at", "-popularity"),
            ("-popularity", "selected_at"),
            # Partial: the sync looks up every flagged title on each run.
            {"fields": ["tmdb_deleted"], "partialFilterExpression": {"tmdb_deleted": True}},
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

    # Crawl state of the episode catalog (f/tmdb_api/tmdb_fetch_episodes_from_api), written
    # with $set only. A missing episodes_due_at means the episodes were never fetched.
    episodes_due_at = DateTimeField()
    episodes_selected_at = DateTimeField()
    # Last fetch that left the season documents usable, including "TMDB lists no season".
    episodes_updated_at = DateTimeField()
    # Every listed season was fetched, so the Crate copy may mark missing episodes removed.
    episodes_complete = BooleanField()
    episodes_failed_at = DateTimeField()
    episodes_error = StringField()
    # Last time TMDB's change feed named the show.
    episodes_changed_at = DateTimeField()

    meta = {
        "indexes": [
            "external_ids.imdb_id",
            # The episode queue reads the shows that are due, longest due first.
            "episodes_due_at",
            # Covers the Crate copy's read of the shows fetched since its checkpoint.
            ("episodes_updated_at", "tmdb_id", "episodes_complete"),
        ],
    }


class TmdbTvSeasonDetails(Document):
    """One season of a show with its episodes, as TMDB lists them (episode catalog).

    Written by f/tmdb_api/tmdb_fetch_episodes_from_api/fetch through pymongo. Each
    episode is TMDB's episode object without crew and guest_stars.
    """

    # The show's TMDB id.
    tmdb_id = IntField(required=True)
    season_number = IntField(required=True)
    # TMDB's season id, from the show's seasons[]; the appended season carries none.
    season_id = IntField()
    name = StringField()
    air_date = StringField()
    overview = StringField()
    poster_path = StringField()
    vote_average = FloatField()
    episodes = ListField(DictField())

    created_at = DateTimeField()
    updated_at = DateTimeField()

    meta = {
        "collection": "tmdb_tv_season_details",
        "indexes": [
            {"fields": ["tmdb_id", "season_number"], "unique": True},
        ],
    }


def main():
    pass
