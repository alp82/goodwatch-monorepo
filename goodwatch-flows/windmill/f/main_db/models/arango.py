from typing import Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator

from f.dna.models import CoreScores

MediaType = Union[Literal["movie"], Literal["show"]]


# =======================
# ===== Base Models =====
# =======================


class BaseArangoModel(BaseModel):
    doc_key: str = Field(alias="_key", exclude=False)


class Edge(BaseArangoModel):
    """Flexible edge model for ArangoDB edges."""
    #doc_key: Optional[str] = Field(alias="_key", exclude=False)
    doc_from: str = Field(alias="_from", exclude=False)
    doc_to: str = Field(alias="_to", exclude=False)

    @field_validator('doc_from', 'doc_to', mode='before')
    @classmethod
    def _transform_slashes_in_keys(cls, v: str) -> str:
        """
        Validates and transforms an ID string.
        Ensures a mandatory first '/', keeps it, and replaces subsequent '/' with '_'.
        """
        first_slash_index = v.find('/')
        if first_slash_index == -1:
            raise ValueError(
                "Field must be a document ID containing a '/' (e.g., 'collection/key')."
            )

        prefix = v[:first_slash_index + 1]
        suffix = v[first_slash_index + 1:]
        transformed_suffix = suffix.replace('/', '_')
        return prefix + transformed_suffix
    
    @model_validator(mode='before')
    def _generate_deterministic_edge_key(self) -> 'Edge':
        """
        Generates a deterministic _key for the edge if not already provided.
        The key is based on the sanitized _from and _to document IDs.
        """
        if self.get("_key") is None:
            from_part_for_key = self["_from"].replace('/', '_')
            to_part_for_key = self["_to"].replace('/', '_')
            self["_key"] = f"{from_part_for_key}__{to_part_for_key}"
        return self

    class Config:
        extra = "allow" 
    

# Age Certifications

class AgeCertification(BaseArangoModel):
    country_code: str = Field(..., description="The ISO 3166-1 country code (e.g., 'AU', 'US').")
    media_type: MediaType = Field(..., description="The type of media this certification applies to ('movie' or 'show').")
    code: str = Field(..., description="The certification rating code.")
    meaning: str = Field(..., description="A description of what the certification means.")
    order: int = Field(..., description="An integer representing the order or level of the certification.")


# Countries

class Country(BaseArangoModel):
    country_code: str = Field(..., description="The ISO 3166-1 code for the country (e.g., 'AD', 'AE').")
    english_name: str = Field(..., description="The English name of the country.")


# Languages

class Language(BaseArangoModel):
    doc_key: str = Field(
        alias="_key",
        exclude=False,
    )
    language_code: str = Field(..., description="The ISO 3166-1 code for the language (e.g., 'AD', 'AE').")
    english_name: str = Field(..., description="The English name of the language.")
    native_name: str = Field(..., description="The native name of the language.")


# Timezones

class Timezone(BaseArangoModel):
    doc_key: str = Field(
        alias="_key",
        exclude=False,
    )
    country_code: str = Field(..., description="The ISO 3166-1 code for the timezone (e.g., 'AD', 'AE').")
    zones: list[str] = Field(..., description="A list of timezone strings for the country (e.g., ['Europe/Andorra']).")


# Genres

class Genre(BaseArangoModel):
    tmdb_id: int
    name: str
    media_type: str


# Streaming Services

class StreamingService(BaseArangoModel):
    tmdb_id: int
    name: str
    logo_path: Optional[str] = None
    order: int
    order_by_country: dict[str, int]


# Jobs & Departments

class Department(BaseArangoModel):
    name: str = Field(..., description="The name of the department.")


class Job(BaseArangoModel):
    title: str = Field(..., description="The title of the job (e.g., 'Actor', 'Director').")


# ============================
# ===== Movies and Shows =====
# ============================

# media

class MediaBase(BaseArangoModel):
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
    production_method: Optional[Literal['Live-Action', 'Animation', 'Mixed-Media']] = None
    animation_style: Optional[Literal['2D Traditional', '3D CGI', 'Stop-Motion', 'Rotoscoping', 'Anime', 'Other']] = None

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

    vector_essence_text: Optional[list[float]] = None
    vector_fingerprint: Optional[list[float]] = None

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
    release_date: Optional[float] = None # Unix timestamp
    runtime: Optional[int] = None


class Show(MediaBase):
    first_air_date: Optional[float] = None # Unix timestamp
    last_air_date: Optional[float] = None # Unix timestamp
    number_of_seasons: Optional[int] = None
    number_of_episodes: Optional[int] = None
    episode_runtime: Optional[list[int]] = None


class MovieSeries(BaseArangoModel):
    tmdb_id: int
    name: str
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None


class Season(BaseArangoModel):
    tmdb_id: int
    show_key: str
    name: str
    season_number: int
    air_date: Optional[float] = None # Unix timestamp
    episode_count: Optional[int] = None
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    vote_average: Optional[float] = None


# metadata

class Image(BaseArangoModel):
    image_type: str # 'posters', 'backdrops', etc.
    url_path: str
    aspect_ratio: float
    width: int
    height: int
    tmdb_vote_average: Optional[float] = 0
    tmdb_vote_count: Optional[int] = 0


class Video(BaseArangoModel):
    tmdb_id: str
    video_type: str # 'teasers', 'trailers', etc.
    site: str
    site_key: str
    name: Optional[str] = None
    size: Optional[int] = None
    official: Optional[bool] = None
    language: Optional[str] = None
    country: Optional[str] = None
    published_at: Optional[float] = None # Unix timestamp


class Trope(BaseArangoModel):
    name: str
    url: Optional[str] = None


class EssenceTag(BaseArangoModel):
    name: str


class ContentAdvisory(BaseArangoModel):
    name: str


class AlternativeTitle(BaseArangoModel):
    title: str
    country: str


class Translation(BaseArangoModel):
    language: str
    country: str
    name: Optional[str] = None
    english_name: Optional[str] = None
    title: Optional[str] = None
    overview: Optional[str] = None
    tagline: Optional[str] = None
    homepage: Optional[str] = None
    runtime: Optional[int] = None


class ReleaseEvent(BaseArangoModel):
    country: str
    release_type: int
    release_date: Optional[float] # Unix timestamp
    certification: Optional[str]
    note: Optional[str] = None
    descriptors: list[str] = Field(default_factory=list)


class ProductionCompany(BaseArangoModel):
    tmdb_id: int
    name: str
    logo_path: Optional[str] = None
    origin_country: Optional[str] = None


class Network(BaseArangoModel):
    tmdb_id: int
    name: str
    logo_path: Optional[str] = None
    origin_country: Optional[str] = None


class Person(BaseArangoModel):
    tmdb_id: int
    name: str
    original_name: Optional[str] = None
    profile_path: Optional[str] = None
    popularity: Optional[float] = None
    adult: Optional[bool] = None
    gender: Optional[int] = None
    known_for_department: Optional[str] = None


class Score(BaseArangoModel):
    source: str
    score_type: str
    url: Optional[str] = None
    value_original: Optional[float] = None
    value_percent: Optional[float] = None
    rating_count: Optional[int] = None
    refreshed_at: Optional[float]


class StreamingAvailability(BaseArangoModel):
    country_code: str
    streaming_type: str
    streaming_service_id: int
    display_priority: Optional[int] = None
    tmdb_link: Optional[str] = None
    stream_url: Optional[str] = None
    price_dollar: Optional[float] = None
    quality: Optional[str] = None


def main():
    pass
