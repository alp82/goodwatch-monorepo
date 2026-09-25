from dataclasses import dataclass, field
from f.dna.models import CoreScores
from typing import Dict, List, Literal, Optional, Tuple

# ---- Constants ----
MEDIA_COLLECTION = "media_fingerprint_v1"
# One point per person, studio and team that search can refer to. Its vector names match
# the media collection's, so a query can read a profile with `lookup_from` and the same
# `using` vector name.
REFERENCE_PROFILES_COLLECTION = "search_reference_profiles"

# Vector names carry their version: a new model or fingerprint gets a new vector next
# to the old one instead of changing it in place.
FINGERPRINT_VECTOR = "fingerprint_v1"
FINGERPRINT_RAW_VECTOR = "fingerprint_v1_raw"
TEXT_EN_VECTOR = "text_en_v1"
TEXT_MULTI_VECTOR = "text_multi_v1"
TERMS_BM25F_VECTOR = "terms_bm25f_v1"

VectorDistance = Literal["Cosine", "Dot", "Euclid"]
VectorDatatype = Literal["float32", "float16", "uint8"]


@dataclass(frozen=True)
class NamedVectorSpec:
    size: int
    distance: VectorDistance = "Cosine"
    on_disk: bool = False  # set True for large vectors if RAM tight
    datatype: VectorDatatype = "float32"
    # Per-vector HNSW override on top of the collection's hnsw_config.
    # {"m": 0} builds no graph, for vectors that are only searched with `exact: true`.
    hnsw_config: Optional[dict] = None


@dataclass(frozen=True)
class SparseVectorSpec:
    # None: the stored weights are scored as they are. "idf" makes Qdrant multiply them by
    # its own per-shard IDF.
    modifier: Optional[Literal["idf"]] = None


@dataclass(frozen=True)
class PayloadIndexSpec:
    field: str
    field_schema: Literal["keyword", "integer", "float", "bool"] = "keyword"
    # For arrays you still declare by element type; Qdrant handles arrays.


@dataclass(frozen=True)
class CollectionSpec:
    name: str
    vectors: Dict[str, NamedVectorSpec]
    sparse_vectors: Dict[str, SparseVectorSpec] = field(default_factory=dict)
    payload_indexes: Tuple[PayloadIndexSpec, ...] = ()
    # Qdrant sharding/replication
    shards: int = 6
    replication_factor: int = 1
    write_consistency_factor: int = 1
    optimizers_config: Optional[dict] = None
    hnsw_config: Optional[dict] = None


def desired_collections() -> List[CollectionSpec]:
    """Every Qdrant collection, as `f/sync/init/qdrant` creates or extends it."""
    return [desired_media_collection(), desired_reference_profiles_collection()]


def desired_media_collection() -> CollectionSpec:
    return CollectionSpec(
        name=MEDIA_COLLECTION,
        vectors={
            # Written by the fingerprint publish (f/sync/copy/vector_data), from the same scores.
            FINGERPRINT_VECTOR: NamedVectorSpec(size=74, distance="Cosine"),
            # The 74 raw 0-10 scores in CoreScores order. Search scores it with a weighted
            # sum whose weights can be negative, where approximate search loses results, so
            # it is only searched exactly and needs no HNSW graph.
            FINGERPRINT_RAW_VECTOR: NamedVectorSpec(size=74, distance="Dot", hnsw_config={"m": 0}),
            # Written by the embed-titles flow. See docs/adr/0002-local-text-embeddings-for-search.md.
            # bge-base-en-v1.5, the text without the title.
            TEXT_EN_VECTOR: NamedVectorSpec(size=768, distance="Cosine", datatype="float16"),
            # multilingual-e5-small, the text with the title.
            TEXT_MULTI_VECTOR: NamedVectorSpec(size=384, distance="Cosine", datatype="float16"),
        },
        sparse_vectors={
            # Each title's saturated, field-weighted BM25F term weights. The query sends IDF
            # times the query term weight, so the dot product is the BM25F score. Qdrant's IDF
            # modifier counts per shard and over all titles, so it stays off.
            TERMS_BM25F_VECTOR: SparseVectorSpec(modifier=None),
        },
        payload_indexes=tuple(desired_payload_indexes()),
        shards=6,
        replication_factor=1,
        write_consistency_factor=1,
        optimizers_config={
            "deleted_threshold": 0.2,
            "vacuum_min_vector_number": 10000,
            # Thresholds are kilobytes of vectors, not points. A 74-float vector is 296 bytes,
            # so 1000 KB is about 3,400 vectors. With the 10,000 KB default no segment of this
            # collection (about 32,000 points per shard) ever reached the threshold, and no
            # HNSW graph was built. Two segments per shard keeps them well above 1000 KB.
            "indexing_threshold": 1000,
            "default_segment_number": 2,
        },
        hnsw_config={
            "m": 16,
            "ef_construct": 200,
            # Same unit. Above this estimated candidate size the planner walks the HNSW graph
            # instead of scanning; the default 10,000 KB exceeded every filtered candidate set.
            "full_scan_threshold": 1000,
        },
    )


def desired_payload_indexes() -> List[PayloadIndexSpec]:
    """
    ONLY index fields you actually filter/sort on.
    Related-title and preview queries filter any of the 74 fingerprint traits.
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
        # Every search excludes adult titles with a must_not clause. Without an index that
        # clause scanned every point and cost about 500 ms per query.
        PayloadIndexSpec("adult", "bool"),
        PayloadIndexSpec("production_method", "keyword"),
        # Related titles and the other recommendation features exclude titles without artwork
        # with is_empty clauses. Without an index, each clause read the whole on-disk payload
        # of every candidate: about 400 ms per call and 200 MB/s of payload reads.
        PayloadIndexSpec("poster_path", "keyword"),
        PayloadIndexSpec("backdrop_path", "keyword"),
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
    idx.extend(PayloadIndexSpec(f"fingerprint_scores_v1.{name}", "integer")
               for name in CoreScores.model_fields)

    return idx


def desired_reference_profiles_collection() -> CollectionSpec:
    """Search reference profiles, rebuilt by the build-search-indexes flow.

    One point per person, studio and team, with the log-vote-weighted, L2-normalized
    centroids of its seed titles' vectors. The ranker scores a reference by the cosine
    to these centroids, and only uses the English text vector for it, also for
    non-English queries. Payload:

    - `kind`: "person", "studio" or "team"
    - `name`: display name
    - `terms`: the top 40 profile terms as [{"term", "weight"}], sorted by weight and
      then by term
    """
    return CollectionSpec(
        name=REFERENCE_PROFILES_COLLECTION,
        vectors={
            FINGERPRINT_VECTOR: NamedVectorSpec(size=74, distance="Cosine"),
            TEXT_EN_VECTOR: NamedVectorSpec(size=768, distance="Cosine", datatype="float16"),
        },
        payload_indexes=(PayloadIndexSpec("kind", "keyword"),),
        # Small: one point per referable person, studio and team.
        shards=1,
    )


def main():
    pass
