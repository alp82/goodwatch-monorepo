from dataclasses import dataclass
from typing import Dict, List, Literal, Optional

# ---- Constants ----
MEDIA_COLLECTION = "media"

VectorDistance = Literal["Cosine", "Dot", "Euclid"]


@dataclass(frozen=True)
class NamedVectorSpec:
    size: int
    distance: VectorDistance = "Cosine"
    on_disk: bool = False  # set True for large vectors if RAM tight
    # You can extend with quantization if desired (e.g., Product, Scalar)
    # quantization: Optional[dict] = None


@dataclass(frozen=True)
class CollectionSpec:
    name: str
    vectors: Dict[str, NamedVectorSpec]
    # Qdrant sharding/replication
    shards: int = 6
    replication_factor: int = 1
    write_consistency_factor: int = 1
    optimizers_config: Optional[dict] = None
    hnsw_config: Optional[dict] = None


@dataclass(frozen=True)
class PayloadIndexSpec:
    field: str
    field_schema: Literal["keyword", "integer", "float", "bool"] = "keyword"
    # For arrays you still declare by element type; Qdrant handles arrays.


def desired_media_collection() -> CollectionSpec:
    return CollectionSpec(
        name=MEDIA_COLLECTION,
        vectors={
            "essence_text_v1": NamedVectorSpec(
                size=768, distance="Cosine", on_disk=False
            ),
            "fingerprint_v1": NamedVectorSpec(
                size=74, distance="Cosine", on_disk=False
            ),
        },
        shards=6,
        replication_factor=1,
        write_consistency_factor=1,
        optimizers_config={
            # Reasonable safe defaults; tune later if needed
            "deleted_threshold": 0.2,
            "vacuum_min_vector_number": 10000,
        },
        hnsw_config={
            "m": 16,
            "ef_construct": 200,
            "full_scan_threshold": 10000,
        },
    )


def desired_payload_indexes() -> List[PayloadIndexSpec]:
    """
    ONLY index fields you actually filter/sort on.
    Fingerprint dimensions are present in payload but not indexed by default.
    Add specific ones below if you will filter on them.
    """
    idx: List[PayloadIndexSpec] = []

    # Core identity / common filters
    idx += [
        PayloadIndexSpec("tmdb_id", "integer"),
        PayloadIndexSpec("media_type", "keyword"),
        PayloadIndexSpec("title", "keyword"),
        PayloadIndexSpec("original_title", "keyword"),
        PayloadIndexSpec("genres", "keyword"),
        PayloadIndexSpec("release_year", "integer"),
        PayloadIndexSpec("release_decade", "integer"),
        PayloadIndexSpec("is_anime", "bool"),
        PayloadIndexSpec("production_method", "keyword"),
    ]

    # Suitability flags (booleans)
    for flag in [
        "suitability_solo_watch",
        "suitability_date_night",
        "suitability_group_party",
        "suitability_family",
        "suitability_partner",
        "suitability_friends",
        "suitability_kids",
        "suitability_teens",
        "suitability_adults",
        "suitability_intergenerational",
        "suitability_public_viewing_safe",
        "context_is_thought_provoking",
        "context_is_pure_escapism",
        "context_is_background_friendly",
        "context_is_comfort_watch",
        "context_is_binge_friendly",
        "context_is_drop_in_friendly",
    ]:
        idx.append(PayloadIndexSpec(flag, "bool"))

    # Scores you likely filter or threshold by
    score_float_fields = [
        "tmdb_user_score_normalized_percent",
        "imdb_user_score_normalized_percent",
        "metacritic_user_score_normalized_percent",
        "metacritic_meta_score_normalized_percent",
        "rotten_tomatoes_audience_score_normalized_percent",
        "rotten_tomatoes_tomato_score_normalized_percent",
        "goodwatch_user_score_normalized_percent",
        "goodwatch_official_score_normalized_percent",
        "goodwatch_overall_score_normalized_percent",
    ]
    for f in score_float_fields:
        idx.append(PayloadIndexSpec(f, "float"))

    # Voting/review counts (ints)
    count_fields = [
        "tmdb_user_score_rating_count",
        "imdb_user_score_rating_count",
        "metacritic_user_score_rating_count",
        "metacritic_meta_score_review_count",
        "rotten_tomatoes_audience_score_rating_count",
        "rotten_tomatoes_tomato_score_review_count",
        "goodwatch_user_score_rating_count",
        "goodwatch_official_score_review_count",
        "goodwatch_overall_score_voting_count",
    ]
    for f in count_fields:
        idx.append(PayloadIndexSpec(f, "integer"))

    # Streaming availability filters
    idx.append(PayloadIndexSpec("streaming_availability", "keyword"))

    # Fingerprint scores
    idx.append(PayloadIndexSpec("fingerprint_scores_v1", "keyword"))

    return idx


def main():
    pass
