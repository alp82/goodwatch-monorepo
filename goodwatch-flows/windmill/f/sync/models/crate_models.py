from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

from f.dna.models import CoreScores

MediaType = Union[Literal["movie"], Literal["show"]]


# Age Certifications


class AgeCertification(BaseModel):
    certification_code: str = Field(..., description="The certification rating code.")
    country_code: str = Field(
        ..., description="The ISO 3166-1 country code (e.g., 'AU', 'US')."
    )
    media_type: MediaType = Field(
        ...,
        description="The type of media this certification applies to ('movie' or 'show').",
    )
    meaning: str = Field(
        ..., description="A description of what the certification means."
    )
    order_default: int = Field(
        ...,
        description="An integer representing the order or level of the certification.",
    )


# Countries


class Country(BaseModel):
    country_code: str = Field(
        ..., description="The ISO 3166-1 code for the country (e.g., 'AD', 'AE')."
    )
    english_name: str = Field(..., description="The English name of the country.")


# Jobs & Departments


class Job(BaseModel):
    job_title: str = Field(
        ..., description="The title of the job (e.g., 'Actor', 'Director')."
    )
    department_name: str = Field(..., description="The name of the department.")


# Languages


class Language(BaseModel):
    language_code: str = Field(
        ..., description="The ISO 3166-1 code for the language (e.g., 'AD', 'AE')."
    )
    english_name: str = Field(..., description="The English name of the language.")
    native_name: str = Field(..., description="The native name of the language.")


# Timezones


class Timezone(BaseModel):
    country_code: str = Field(
        ..., description="The ISO 3166-1 code for the timezone (e.g., 'AD', 'AE')."
    )
    zones: list[str] = Field(
        ...,
        description="A list of timezone strings for the country (e.g., ['Europe/Andorra']).",
    )


# Genres


class Genre(BaseModel):
    tmdb_id: int
    media_type: MediaType
    name: str


# Streaming Services


class StreamingService(BaseModel):
    tmdb_id: int
    media_type: MediaType
    name: str
    logo_path: Optional[str] = None
    order_default: int
    order_by_country: dict[str, int]


# ============================
# ===== Movies and Shows =====
# ============================

# media


class MediaBase(BaseModel):
    """Base model for movies and shows."""

    tmdb_id: int

    # Title information
    title: Optional[str] = None
    original_title: Optional[str] = None
    tagline: Optional[str] = None
    synopsis: Optional[str] = None

    # Metadata
    popularity: Optional[float] = None
    status: Optional[str] = None
    adult: Optional[bool] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    release_year: Optional[int] = None
    budget: Optional[int] = None
    revenue: Optional[int] = None
    age_certifications: Optional[list[str]] = None

    # Tags
    genres: Optional[list[str]] = None
    keywords: Optional[list[str]] = None
    tropes: Optional[list[str]] = None

    # Social media
    homepage: Optional[str] = None
    imdb_id: Optional[str] = None
    wikidata_id: Optional[str] = None
    facebook_id: Optional[str] = None
    instagram_id: Optional[str] = None
    twitter_id: Optional[str] = None

    # Production info
    production_company_ids: Optional[list[int]] = None
    production_country_codes: Optional[list[str]] = None
    origin_country_codes: Optional[list[str]] = None
    original_language_code: Optional[str] = None
    spoken_language_codes: Optional[list[str]] = None
    is_anime: Optional[bool] = None
    production_method: Optional[Literal["Live-Action", "Animation", "Mixed-Media"]] = (
        None
    )
    animation_style: Optional[
        Literal[
            "2D Traditional", "3D CGI", "Stop-Motion", "Rotoscoping", "Anime", "Other"
        ]
    ] = None

    # Score fields
    tmdb_url: Optional[str] = None
    tmdb_user_score_original: Optional[float] = None
    tmdb_user_score_normalized_percent: Optional[float] = None
    tmdb_user_score_rating_count: Optional[int] = None

    imdb_url: Optional[str] = None
    imdb_user_score_original: Optional[float] = None
    imdb_user_score_normalized_percent: Optional[float] = None
    imdb_user_score_rating_count: Optional[int] = None

    metacritic_url: Optional[str] = None
    metacritic_user_score_original: Optional[float] = None
    metacritic_user_score_normalized_percent: Optional[float] = None
    metacritic_user_score_rating_count: Optional[int] = None
    metacritic_meta_score_original: Optional[float] = None
    metacritic_meta_score_normalized_percent: Optional[float] = None
    metacritic_meta_score_review_count: Optional[int] = None

    rotten_tomatoes_url: Optional[str] = None
    rotten_tomatoes_audience_score_original: Optional[float] = None
    rotten_tomatoes_audience_score_normalized_percent: Optional[float] = None
    rotten_tomatoes_audience_score_rating_count: Optional[int] = None
    rotten_tomatoes_tomato_score_original: Optional[float] = None
    rotten_tomatoes_tomato_score_normalized_percent: Optional[float] = None
    rotten_tomatoes_tomato_score_review_count: Optional[int] = None

    goodwatch_user_score_normalized_percent: Optional[float] = None
    goodwatch_user_score_rating_count: Optional[int] = None
    goodwatch_official_score_normalized_percent: Optional[float] = None
    goodwatch_official_score_review_count: Optional[int] = None
    goodwatch_overall_score_normalized_percent: Optional[float] = None
    goodwatch_overall_score_voting_count: Optional[int] = None

    # Streaming fields
    streaming_country_codes: Optional[list[str]] = None
    streaming_service_ids: Optional[list[int]] = None
    streaming_availabilities: Optional[list[str]] = None

    # Similarity & Recommendation fields
    tmdb_recommendation_ids: Optional[list[int]] = None
    tmdb_similar_ids: Optional[list[int]] = None

    essence_text: Optional[str] = None
    essence_tags: Optional[list[str]] = None
    fingerprint_scores: Optional[CoreScores] = None
    fingerprint_highlight_keys: Optional[list[str]] = None
    content_advisories: Optional[list[str]] = None

    suitability_solo_watch: Optional[bool] = None
    suitability_date_night: Optional[bool] = None
    suitability_group_party: Optional[bool] = None
    suitability_family: Optional[bool] = None
    suitability_partner: Optional[bool] = None
    suitability_friends: Optional[bool] = None
    suitability_kids: Optional[bool] = None
    suitability_teens: Optional[bool] = None
    suitability_adults: Optional[bool] = None
    suitability_intergenerational: Optional[bool] = None
    suitability_public_viewing_safe: Optional[bool] = None

    context_is_thought_provoking: Optional[bool] = None
    context_is_pure_escapism: Optional[bool] = None
    context_is_background_friendly: Optional[bool] = None
    context_is_comfort_watch: Optional[bool] = None
    context_is_binge_friendly: Optional[bool] = None
    context_is_drop_in_friendly: Optional[bool] = None

    # Metadata timestamps (Unix timestamps)
    tmdb_details_created_at: Optional[float] = None
    tmdb_details_updated_at: Optional[float] = None
    tmdb_providers_created_at: Optional[float] = None
    tmdb_providers_updated_at: Optional[float] = None
    imdb_ratings_created_at: Optional[float] = None
    imdb_ratings_updated_at: Optional[float] = None
    metacritic_ratings_created_at: Optional[float] = None
    metacritic_ratings_updated_at: Optional[float] = None
    rotten_tomatoes_ratings_created_at: Optional[float] = None
    rotten_tomatoes_ratings_updated_at: Optional[float] = None
    tvtropes_tags_created_at: Optional[float] = None
    tvtropes_tags_updated_at: Optional[float] = None
    dna_created_at: Optional[float] = None
    dna_updated_at: Optional[float] = None


class Movie(MediaBase):
    release_date: Optional[float] = None  # Unix timestamp
    movie_series_id: Optional[int] = None
    runtime: Optional[int] = None


class Show(MediaBase):
    first_air_date: Optional[float] = None  # Unix timestamp
    last_air_date: Optional[float] = None  # Unix timestamp
    number_of_seasons: Optional[int] = None
    number_of_episodes: Optional[int] = None
    episode_runtime: Optional[list[int]] = None
    in_production: Optional[bool] = None
    network_ids: Optional[list[int]] = None


class MovieSeries(BaseModel):
    tmdb_id: int
    name: str
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None


class Season(BaseModel):
    tmdb_id: int
    show_id: int
    name: str
    season_number: int
    air_date: Optional[float] = None  # Unix timestamp
    episode_count: Optional[int] = None
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    vote_average: Optional[float] = None


# metadata


class Image(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    image_type: str  # 'posters', 'backdrops', etc.
    url_path: str
    language_code: Optional[str] = None
    aspect_ratio: float
    width: int
    height: int
    tmdb_vote_average: Optional[float] = 0
    tmdb_vote_count: Optional[int] = 0


class Video(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    tmdb_id: str
    video_type: str  # 'teasers', 'trailers', etc.
    site: str
    site_key: str
    language_code: Optional[str] = None
    country_code: Optional[str] = None
    name: Optional[str] = None
    size: Optional[int] = None
    official: Optional[bool] = None
    published_at: Optional[float] = None  # Unix timestamp


class Trope(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    name: str
    url: Optional[str] = None
    content: Optional[str] = None


class AlternativeTitle(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    country_code: str
    title: str


class Translation(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    language_code: str
    country_code: str
    name: Optional[str] = None
    english_name: Optional[str] = None
    title: Optional[str] = None
    overview: Optional[str] = None
    tagline: Optional[str] = None
    homepage: Optional[str] = None
    runtime: Optional[int] = None


class ReleaseEvent(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    country_code: str
    release_type: int
    release_date: Optional[float]  # Unix timestamp
    certification: Optional[str]
    note: Optional[str] = None
    descriptors: list[str] = Field(default_factory=list)


class ProductionCompany(BaseModel):
    tmdb_id: int
    name: str
    logo_path: Optional[str] = None
    origin_country: Optional[str] = None


class Network(BaseModel):
    tmdb_id: int
    name: str
    logo_path: Optional[str] = None
    origin_country: Optional[str] = None


class Person(BaseModel):
    tmdb_id: int
    name: str
    original_name: Optional[str] = None
    profile_path: Optional[str] = None
    popularity: Optional[float] = None
    adult: Optional[bool] = None
    gender: Optional[int] = None
    known_for_department: Optional[str] = None


class PersonAppearedIn(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    person_tmdb_id: int
    credit_id: Optional[str] = None
    character: Optional[str] = None
    order_default: Optional[int] = None
    episode_count_character: Optional[int] = None
    episode_count_total: Optional[int] = None


class PersonWorkedOn(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    person_tmdb_id: int
    credit_id: Optional[str] = None
    job: Optional[str] = None
    department: Optional[str] = None
    episode_count_job: Optional[int] = None
    episode_count_total: Optional[int] = None


class StreamingAvailability(BaseModel):
    media_tmdb_id: int
    media_type: MediaType
    country_code: str
    streaming_type: str
    streaming_service_id: int
    display_priority: Optional[int] = None
    tmdb_link: Optional[str] = None
    stream_url: Optional[str] = None
    price_dollar: Optional[float] = None
    quality: Optional[str] = None


# ============================
# ===== User Data Models =====
# ============================


class UserSetting(BaseModel):
    user_id: str
    key: str
    value: Optional[str] = None
    created_at: Optional[float]
    updated_at: Optional[float]


class UserSkipped(BaseModel):
    user_id: str
    tmdb_id: int
    media_type: MediaType
    created_at: Optional[float]
    updated_at: Optional[float]


class UserWishlist(BaseModel):
    user_id: str
    tmdb_id: int
    media_type: MediaType
    created_at: Optional[float]
    updated_at: Optional[float]


class UserScore(BaseModel):
    user_id: str
    tmdb_id: int
    media_type: MediaType
    score: Optional[int] = None
    review: Optional[str] = None
    created_at: Optional[float]
    updated_at: Optional[float]


class UserFavorite(BaseModel):
    user_id: str
    tmdb_id: int
    media_type: MediaType
    created_at: Optional[float]
    updated_at: Optional[float]


class UserWatchHistory(BaseModel):
    user_id: str
    tmdb_id: int
    media_type: MediaType

    # Multi-watch list (UTC unix seconds)
    watched_at_list: list[float] = Field(default_factory=list)

    # “Current watch” state (nullable)
    progress_percent: Optional[float] = None
    progress_seconds: Optional[int] = None
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    ingest_source: Optional[str] = None

    # Convenience denorms (UTC unix seconds)
    first_watched_at: Optional[float] = None
    last_watched_at: Optional[float] = None
    watch_count: Optional[int] = None

    created_at: Optional[float]
    updated_at: Optional[float]


def main():
    pass
