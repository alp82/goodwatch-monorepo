from typing import List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, Field

from f.dna.models import CoreScores

MediaType = Union[Literal["movie"], Literal["show"]]

# ---- Vectors ----

class MediaVectors(BaseModel):
    """Named vectors stored in Qdrant."""
    essence_text_v1: List[float] = Field(default_factory=list, description="768-d semantic text embedding.")
    fingerprint_v1: List[float] = Field(default_factory=list, description="74-d GoodWatch fingerprint embedding.")

# ---- Scores & counts ----

class NormalizedScores(BaseModel):
    """All normalized percent score fields used for filtering/sorting thresholds."""
    tmdb_user_score_normalized_percent: Optional[float] = None
    imdb_user_score_normalized_percent: Optional[float] = None
    metacritic_user_score_normalized_percent: Optional[float] = None
    metacritic_meta_score_normalized_percent: Optional[float] = None
    rotten_tomatoes_audience_score_normalized_percent: Optional[float] = None
    rotten_tomatoes_tomato_score_normalized_percent: Optional[float] = None
    goodwatch_user_score_normalized_percent: Optional[float] = None
    goodwatch_official_score_normalized_percent: Optional[float] = None
    goodwatch_overall_score_normalized_percent: Optional[float] = None


class VoteCounts(BaseModel):
    """All rating/review/vote counts kept as integers for filtering thresholds."""
    tmdb_user_score_rating_count: Optional[int] = None
    imdb_user_score_rating_count: Optional[int] = None
    metacritic_user_score_rating_count: Optional[int] = None
    metacritic_meta_score_review_count: Optional[int] = None
    rotten_tomatoes_audience_score_rating_count: Optional[int] = None
    rotten_tomatoes_tomato_score_review_count: Optional[int] = None
    goodwatch_user_score_rating_count: Optional[int] = None
    goodwatch_official_score_review_count: Optional[int] = None
    goodwatch_overall_score_voting_count: Optional[int] = None

# ---- Streaming ----

class StreamingInfo(BaseModel):
    """
    Streaming representation optimized for both human readability and fast filters.

    - streaming_pairs: list of (service, country) tuples, e.g. [("Netflix","DE"), ("Prime","US")]
    - streaming_pair_codes: flattened strings for fast keyword index filtering, e.g. ["Netflix#DE","Prime#US"]
    """
    streaming_pairs: Optional[List[Tuple[str, str]]] = None
    streaming_pair_codes: Optional[List[str]] = None

# ---- Suitability & context flags ----

class SuitabilityContext(BaseModel):
    # Suitability
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

    # Viewing context
    context_is_thought_provoking: Optional[bool] = None
    context_is_pure_escapism: Optional[bool] = None
    context_is_background_friendly: Optional[bool] = None
    context_is_comfort_watch: Optional[bool] = None
    context_is_binge_friendly: Optional[bool] = None
    context_is_drop_in_friendly: Optional[bool] = None

# ---- Core payload ----

class QdrantMediaPayload(BaseModel):
    """
    Minimal, denormalized payload we actually keep in Qdrant for filtering
    and reranking. Everything else (long texts, credits, translations, etc.)
    stays in Crate and is joined in your API layer.
    """
    # Identity
    tmdb_id: int
    media_type: MediaType

    # Lightweight filterable metadata
    title: Optional[List[str]] = None
    original_title: Optional[List[str]] = None
    poster_path: List[str] = None
    backdrop_path: List[str] = None

    genres: Optional[List[str]] = None
    release_year: Optional[int] = None
    release_decade: Optional[int] = Field(default=None, description="Computed decade bucket, e.g., 1990 for 1995.")
    is_anime: Optional[bool] = None
    production_method: Optional[Literal["Live-Action", "Animation", "Mixed-Media"]] = None

    # Scores & counts
    # (Flattened into the payload for indexing — see qdrant_models.desired_payload_indexes)
    # Kept grouped here for clarity; you can unpack while building dicts.
    # Example: payload.tmdb_user_score_normalized_percent directly exists after .model_dump()
    # because Pydantic flattens fields from submodels by default only if we do it manually.
    # We therefore repeat these in the main payload for a 1:1 schema with indices.
    tmdb_user_score_normalized_percent: Optional[float] = None
    imdb_user_score_normalized_percent: Optional[float] = None
    metacritic_user_score_normalized_percent: Optional[float] = None
    metacritic_meta_score_normalized_percent: Optional[float] = None
    rotten_tomatoes_audience_score_normalized_percent: Optional[float] = None
    rotten_tomatoes_tomato_score_normalized_percent: Optional[float] = None
    goodwatch_user_score_normalized_percent: Optional[float] = None
    goodwatch_official_score_normalized_percent: Optional[float] = None
    goodwatch_overall_score_normalized_percent: Optional[float] = None

    tmdb_user_score_rating_count: Optional[int] = None
    imdb_user_score_rating_count: Optional[int] = None
    metacritic_user_score_rating_count: Optional[int] = None
    metacritic_meta_score_review_count: Optional[int] = None
    rotten_tomatoes_audience_score_rating_count: Optional[int] = None
    rotten_tomatoes_tomato_score_review_count: Optional[int] = None
    goodwatch_user_score_rating_count: Optional[int] = None
    goodwatch_official_score_review_count: Optional[int] = None
    goodwatch_overall_score_voting_count: Optional[int] = None

    # Fingerprint scores
    fingerprint_v1: Optional[CoreScores] = Field(default=None, description="Full GoodWatch fingerprint (structured).")

    # Suitability/context
    # (Kept flat in payload so they can be indexed individually)
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

    # Streaming as tuples + fast codes
    streaming_pairs: Optional[List[Tuple[str, str]]] = None
    streaming_pair_codes: Optional[List[str]] = None

# ---- Full point wrapper ----

MOVIE_BASE = 1_000_000_000_000
SHOW_BASE  = 2_000_000_000_000

class QdrantMediaPoint(BaseModel):
    """
    A single Qdrant point: id + payload + named vectors.
    """
    id: str = Field(..., description='Stable point id, e.g. "movie:603"')
    payload: QdrantMediaPayload
    vectors: MediaVectors

    @staticmethod
    def make_point_id(media_type: str, tmdb_id: int) -> int:
        """Return unsigned 64-bit int ID for Qdrant."""
        tid = int(tmdb_id)
        if tid < 0:
            raise ValueError("tmdb_id must be non-negative")
        if media_type == "movie":
            pid = MOVIE_BASE + tid
        elif media_type == "show":
            pid = SHOW_BASE + tid
        else:
            raise ValueError(f"unknown media_type: {media_type}")
        # sanity: ensure within u64
        if pid > 18_446_744_073_709_551_615:
            raise OverflowError("point id exceeds u64")
        return pid

    @staticmethod
    def parse_point_id(pid: int) -> tuple[str, int]:
        """Optional: reverse mapping for debugging."""
        if pid >= SHOW_BASE:
            return "show", pid - SHOW_BASE
        return "movie", pid - MOVIE_BASE


def main():
    pass
