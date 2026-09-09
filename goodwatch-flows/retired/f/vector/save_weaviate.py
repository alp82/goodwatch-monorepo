# requirements:
# pandas
# psycopg2-binary
# weaviate-client
# wmill
from typing import Literal, Optional, Union

import pandas as pd
import weaviate
from weaviate.classes.config import Configure, Property, DataType
from weaviate.classes.query import MetadataQuery
from weaviate.util import generate_uuid5
import wmill

from f.db.postgres import init_postgres

WeaviateServer = wmill.get_resource("u/Alp/WEAVIATE_SERVER")
WEAVIATE_BATCH_SIZE = 100
LOG_BATCH_SIZE = 1000
COLLECTION_NAME = Union[Literal["movies"], Literal["tv"]]


def get_medias_df(collection_name: COLLECTION_NAME, tmdb_ids: Optional[list[str]] = None) -> pd.DataFrame:
    # Validate the collection_name to prevent SQL injection
    valid_tables = ["movies", "tv"]
    if collection_name not in valid_tables:
        raise ValueError(f"Invalid collection name: {collection_name}")
    table_name = collection_name

    pg = init_postgres()
    base_query = f"""
    SELECT
        m.tmdb_id,
        m.title,
        m.release_year,
        m.genres,
        m.dna
    FROM
        {table_name} m
    WHERE
        m.dna <> '{{}}'::jsonb
    """

    params = {}
    if tmdb_ids is not None:
        base_query += " AND m.tmdb_id = ANY(%(tmdb_ids)s)"
        params['tmdb_ids'] = [int(tmdb_id) for tmdb_id in tmdb_ids]

    base_query += " ORDER BY m.popularity DESC"

    df = pd.read_sql_query(base_query, pg, params=params)
    pg.close()

    def parse_dna(dna):
        keys = {
            "Sub-Genres": "subgenre",
            "Mood/Attitudes": "mood",
            "Memorable Moments": "moment",
            "Plot": "plot",
            "Target Audience": "audience",
            "Place": "place",
            "Time/Period": "time",
            "Pacing": "pacing",
            "Narrative Structure": "narrative",
            "Dialog Style": "dialog",
            "Score and Sound Design": "sound",
            "Character Archetypes": "character",
            "Visual Style": "visual",
            "Cinematic Techniques": "cinematic",
            "Costume and Set Design": "costume",
            "Key Objects/Props": "props",
            "Flag": "flag",
        }
        parsed = {
            new_key: [str(item) for item in dna.get(old_key, []) if item]
            for old_key, new_key in keys.items()
        }
        return parsed

    # Parse the DNA column
    dna_parsed = df["dna"].apply(parse_dna)

    # Convert the parsed DNA into a DataFrame
    dna_df = dna_parsed.apply(pd.Series)

    # Overwrite the 'dna' field in the original DataFrame
    # df["dna"] = dna_df.to_dict(orient="records")
    df["dna"] = dna_df.apply(
        lambda row: [str(item) for category in row for item in category], axis=1
    )

    # Concatenate the original DataFrame with the parsed DNA DataFrame
    medias_df = pd.concat([df, dna_df], axis=1)

    # Rename columns to match the desired structure
    medias_df.rename(columns={"genres": "genre"}, inplace=True)

    # Display the final DataFrame
    return medias_df


def get_or_create_collection(client: weaviate.Client, name: str) -> weaviate.Collection:
    # TODO don't delete collection
    #client.collections.delete(name)

    if client.collections.exists(name=name):
        collection = client.collections.get(name)
    else:
        collection = client.collections.create(
            name=name,
            vectorizer_config=[
                Configure.NamedVectors.text2vec_transformers(
                    name="dna_vector",
                    source_properties=["dna"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="genre_vector",
                    source_properties=["genre", "subgenre"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="mood_vector",
                    source_properties=["mood"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="plot_vector",
                    source_properties=["moment", "plot"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="audience_vector",
                    source_properties=["audience"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="place_vector",
                    source_properties=["place"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="time_vector",
                    source_properties=["time"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="narration_vector",
                    source_properties=["pacing", "narrative", "dialog"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="sound_vector",
                    source_properties=["sound"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="character_vector",
                    source_properties=["character"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="visual_vector",
                    source_properties=["visual", "cinematic"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="props_vector",
                    source_properties=["costume", "props"],
                ),
                Configure.NamedVectors.text2vec_transformers(
                    name="flag_vector",
                    source_properties=["flag"],
                ),
            ],
            properties=[
                Property(
                    name="tmdb_id", data_type=DataType.INT, skip_vectorization=True
                ),
                Property(
                    name="title", data_type=DataType.TEXT, skip_vectorization=True
                ),
                Property(
                    name="release_year", data_type=DataType.INT, skip_vectorization=True
                ),
                Property(name="dna", data_type=DataType.TEXT_ARRAY),
                Property(name="genre", data_type=DataType.TEXT_ARRAY),
                Property(name="subgenre", data_type=DataType.TEXT_ARRAY),
                Property(name="mood", data_type=DataType.TEXT_ARRAY),
                Property(name="moment", data_type=DataType.TEXT_ARRAY),
                Property(name="plot", data_type=DataType.TEXT_ARRAY),
                Property(name="audience", data_type=DataType.TEXT_ARRAY),
                Property(name="place", data_type=DataType.TEXT_ARRAY),
                Property(name="time", data_type=DataType.TEXT_ARRAY),
                Property(name="pacing", data_type=DataType.TEXT_ARRAY),
                Property(name="narrative", data_type=DataType.TEXT_ARRAY),
                Property(name="dialog", data_type=DataType.TEXT_ARRAY),
                Property(name="sound", data_type=DataType.TEXT_ARRAY),
                Property(name="character", data_type=DataType.TEXT_ARRAY),
                Property(name="visual", data_type=DataType.TEXT_ARRAY),
                Property(name="cinematic", data_type=DataType.TEXT_ARRAY),
                Property(name="costume", data_type=DataType.TEXT_ARRAY),
                Property(name="props", data_type=DataType.TEXT_ARRAY),
                Property(name="flag", data_type=DataType.TEXT_ARRAY),
            ],
        )

    return collection


def store_vectors(
    collection_name: COLLECTION_NAME, collection: weaviate.Collection, df: pd.DataFrame
) -> dict:
    records = df.to_dict(orient="records")
    with collection.batch.dynamic() as batch:
        for idx, record in enumerate(records):
            if idx % LOG_BATCH_SIZE == 0:
                print(
                    f"Processing {collection_name} {idx+1} to {min(idx+LOG_BATCH_SIZE, len(records))}"
                )

            batch.add_object(
                uuid=generate_uuid5(f"{collection_name}_{record['tmdb_id']}"),
                properties=record,
            )

    return {
        "elapsed_seconds": collection.batch.results.objs.elapsed_seconds,
        #"errors": collection.batch.results.objs.errors,
        "failed_objects": list(collection.batch.failed_objects),
        "has_errors": collection.batch.results.objs.has_errors,
        # "result_objects": list(collection.batch.results.objs.all_responses),
    }


def main(collection_name: COLLECTION_NAME, tmdb_ids: Optional[list[str]] = None):
    print("Attempting to connect to Weaviate server...")
    weaviate_client = weaviate.connect_to_custom(
        http_host=WeaviateServer.get("host"),
        http_port=WeaviateServer.get("port"),
        http_secure=False,
        grpc_host=WeaviateServer.get("host"),
        grpc_port=WeaviateServer.get("grpc_port"),
        grpc_secure=False,
        # auth_credentials=AuthApiKey(os.getenv("WEAVIATE_API_KEY")),
    )
    print("Connected to Weaviate")

    collection = get_or_create_collection(
        client=weaviate_client,
        name=collection_name,
    )

    medias_df = get_medias_df(collection_name=collection_name, tmdb_ids=tmdb_ids)
    pd.set_option("display.max_columns", None)
    print(medias_df)

    result = store_vectors(
        collection_name=collection_name,
        collection=collection,
        df=medias_df,
    )

    weaviate_client.close()
    return result
