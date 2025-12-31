from dataclasses import dataclass
from typing import Dict, List, Literal, Optional

from pymilvus import FieldSchema, CollectionSchema, DataType, Collection, utility

MEDIA_COLLECTION = "media"

VectorDistance = Literal["COSINE", "IP", "L2"]  # Milvus metric types


@dataclass(frozen=True)
class VectorFieldSpec:
    dim: int
    metric: VectorDistance = "COSINE"
    field_name: str = ""
    index_type: str = "HNSW"
    index_params: Optional[dict] = None


@dataclass(frozen=True)
class CollectionSpec:
    name: str
    vectors: Dict[str, VectorFieldSpec]  # {field_name: spec}
    shards_num: int = 2
    enable_dynamic: bool = False


def desired_media_collection() -> CollectionSpec:
    return CollectionSpec(
        name=MEDIA_COLLECTION,
        vectors={
            "essence_text_v1": VectorFieldSpec(
                dim=768,
                metric="COSINE",
                field_name="essence_text_v1",
                index_type="HNSW",
                index_params={"M": 16, "efConstruction": 200},
            ),
            "fingerprint_v1": VectorFieldSpec(
                dim=74,
                metric="COSINE",
                field_name="fingerprint_v1",
                index_type="HNSW",
                index_params={"M": 16, "efConstruction": 200},
            ),
        },
        shards_num=2,
        enable_dynamic=False,
    )


def build_collection(schema_spec: CollectionSpec) -> CollectionSchema:
    # ---- Scalar / payload fields ----
    fields = []

    # Primary key (we use your computed varchar id)
    fields.append(
        FieldSchema(
            name="id",
            dtype=DataType.VARCHAR,
            is_primary=True,
            auto_id=False,
            max_length=32,
        )
    )

    # Identity
    fields.append(FieldSchema(name="tmdb_id", dtype=DataType.INT64))
    fields.append(FieldSchema(name="media_type", dtype=DataType.VARCHAR, max_length=16))

    # Titles & paths (arrays of strings)
    fields.append(
        FieldSchema(
            name="title",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=256,
            max_capacity=8,
            nullable=True,
        )
    )
    fields.append(
        FieldSchema(
            name="original_title",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=256,
            max_capacity=8,
            nullable=True,
        )
    )
    fields.append(
        FieldSchema(
            name="poster_path",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=256,
            max_capacity=4,
            nullable=True,
        )
    )
    fields.append(
        FieldSchema(
            name="backdrop_path",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=256,
            max_capacity=4,
            nullable=True,
        )
    )

    # Basic filters
    fields.append(
        FieldSchema(
            name="genres",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=64,
            max_capacity=16,
            nullable=True,
        )
    )
    fields.append(FieldSchema(name="release_year", dtype=DataType.INT64, nullable=True))
    fields.append(
        FieldSchema(name="release_decade", dtype=DataType.INT64, nullable=True)
    )
    fields.append(FieldSchema(name="is_anime", dtype=DataType.BOOL, nullable=True))
    fields.append(
        FieldSchema(
            name="production_method",
            dtype=DataType.VARCHAR,
            max_length=32,
            nullable=True,
        )
    )

    # Scores (floats)
    for fname in [
        "tmdb_user_score_normalized_percent",
        "imdb_user_score_normalized_percent",
        "metacritic_user_score_normalized_percent",
        "metacritic_meta_score_normalized_percent",
        "rotten_tomatoes_audience_score_normalized_percent",
        "rotten_tomatoes_tomato_score_normalized_percent",
        "goodwatch_user_score_normalized_percent",
        "goodwatch_official_score_normalized_percent",
        "goodwatch_overall_score_normalized_percent",
    ]:
        fields.append(FieldSchema(name=fname, dtype=DataType.FLOAT, nullable=True))

    # Counts (ints)
    for fname in [
        "tmdb_user_score_rating_count",
        "imdb_user_score_rating_count",
        "metacritic_user_score_rating_count",
        "metacritic_meta_score_review_count",
        "rotten_tomatoes_audience_score_rating_count",
        "rotten_tomatoes_tomato_score_review_count",
        "goodwatch_user_score_rating_count",
        "goodwatch_official_score_review_count",
        "goodwatch_overall_score_voting_count",
    ]:
        fields.append(FieldSchema(name=fname, dtype=DataType.INT64, nullable=True))

    # Suitability/context (bools)
    for fname in [
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
        fields.append(FieldSchema(name=fname, dtype=DataType.BOOL, nullable=True))

    # Streaming availability: array of "svc_CC" codes
    fields.append(
        FieldSchema(
            name="streaming_availability",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=64,
            max_capacity=64,
            nullable=True,
        )
    )

    # Fingerprint tag bag (array of strings for filtering)
    fields.append(
        FieldSchema(
            name="fingerprint_scores_v1",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=64,
            max_capacity=128,
            nullable=True,
        )
    )

    # Tropes (optional)
    fields.append(
        FieldSchema(
            name="tropes",
            dtype=DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_length=1024,
            max_capacity=2048,
            nullable=True,
        )
    )

    # ---- Vector fields ----
    for vname, vspec in schema_spec.vectors.items():
        fields.append(
            FieldSchema(name=vname, dtype=DataType.FLOAT_VECTOR, dim=vspec.dim)
        )

    schema = CollectionSchema(
        fields=fields,
        description="GoodWatch media: payload + two vector fields",
        enable_dynamic_field=schema_spec.enable_dynamic,
    )
    return schema


def ensure_collection(conn, schema_spec: CollectionSpec):
    name = schema_spec.name
    if not utility.has_collection(name, using=conn.alias):
        schema = build_collection(schema_spec)
        Collection(
            name=name,
            schema=schema,
            using=conn.alias,
            shards_num=schema_spec.shards_num,
        )
        print(f"Created Milvus collection '{name}'")

    # Create vector indexes if missing
    col = Collection(name, using=conn.alias)
    for vname, vspec in schema_spec.vectors.items():
        exist = any(idx.field_name == vname for idx in col.indexes)
        if not exist:
            params = {
                "index_type": vspec.index_type,
                "metric_type": vspec.metric,
                "params": vspec.index_params or {"M": 16, "efConstruction": 200},
            }
            col.create_index(field_name=vname, index_params=params)
            print(f"Created index on '{vname}': {params}")

    # Optional: scalar inverted indexes for text-ish fields frequently filtered
    # Milvus auto-creates default scalar indexes, but explicit ones can help.
    for s in ["media_type", "production_method"]:
        try:
            col.create_index(field_name=s, index_params={"index_type": "INVERTED"})
        except Exception:
            pass

    for arr in ["genres", "streaming_availability", "fingerprint_scores_v1", "tropes"]:
        try:
            col.create_index(field_name=arr, index_params={"index_type": "INVERTED"})
        except Exception:
            pass

    # Load for search
    col.load()
    print(f"Collection '{name}' loaded.")
