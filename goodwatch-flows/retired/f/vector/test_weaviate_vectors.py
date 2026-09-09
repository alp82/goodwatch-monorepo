# requirements:
# pandas
# psycopg2-binary
# weaviate-client
# wmill
import pandas as pd
import weaviate
from weaviate.classes.config import Configure, Property, DataType
from weaviate.classes.query import MetadataQuery
from weaviate.util import generate_uuid5
import wmill

from f.db.postgres import init_postgres

WeaviateServer = wmill.get_resource("u/Alp/WEAVIATE_SERVER")
WEAVIATE_BATCH_SIZE = 100


def get_movies_df() -> pd.DataFrame:
    pg = init_postgres()
    sql_query = """
    SELECT
        m.tmdb_id,
        m.title,
        m.release_year,
        m.genres,
        m.dna
    FROM
        movies m
    WHERE
        m.dna <> '{}'::jsonb
    ORDER BY
        m.popularity DESC
    LIMIT
        10000;
    """
    df = pd.read_sql_query(sql_query, pg)
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
        parsed = {new_key: dna.get(old_key, []) for old_key, new_key in keys.items()}
        return parsed

    # Parse the DNA column
    dna_parsed = df["dna"].apply(parse_dna)

    # Convert the parsed DNA into a DataFrame
    dna_df = dna_parsed.apply(pd.Series)

    # Overwrite the 'dna' field in the original DataFrame
    #df["dna"] = dna_df.to_dict(orient="records")
    df["dna"] = dna_df.apply(lambda row: [item for category in row for item in category], axis=1)

    # Concatenate the original DataFrame with the parsed DNA DataFrame
    movies_df = pd.concat([df, dna_df], axis=1)

    # Rename columns to match the desired structure
    movies_df.rename(columns={"genres": "genre"}, inplace=True)

    # Display the final DataFrame
    print(movies_df)
    return movies_df


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


def store_vectors(collection: weaviate.Collection, df: pd.DataFrame):
    records = df.to_dict(orient="records")
    with collection.batch.dynamic() as batch:
        for record in records:
            batch.add_object(
                uuid=generate_uuid5(f"movie_{record['tmdb_id']}"),
                properties=record,
            )

    for item in collection.batch.failed_objects:
        print(item)

    # for item in collection.iterator():
    #    print(item.uuid, item.properties)


def query_vectors(collection: weaviate.Collection):
    queries_and_vectors = [
        ("funny animals", "character_vector"),
        ("funny animals", "dna_vector"),
        ("revenge", "plot_vector"),
        ("dark and gritty", "mood_vector"),
        ("witty and romantic", "narration_vector"),
        ("in outer space", "place_vector"),
        ("ancient rome", "time_vector"),
        ("intense violence", "flag_vector"),
        ("funny car chase animation", "dna_vector"),
        ("black and white car chases", "dna_vector"),
        ("space fantasy with huge tables", "dna_vector"),
        ("eventful dinner", "dna_vector"),
        ("virtual reality fight CGI", "dna_vector"),
    ]

    for query, vector_name in queries_and_vectors:
        response = collection.query.near_text(
            query=query,
            target_vector=vector_name,
            limit=3,
            return_metadata=MetadataQuery(distance=True),
        )

        print("---------------------")
        print(query)
        for o in response.objects:
            print(
                f"\t{o.properties['title']} ({o.properties['release_year']}) - {o.metadata.distance}"
            )


def query_combined_vectors(
    collection: weaviate.Collection, queries_and_vectors: list[tuple[str, str]]
):
    # Function to perform a near_text query
    def execute_near_text(query, vector_name):
        return collection.query.near_text(
            query=query,
            target_vector=vector_name,
            limit=1000,
            return_metadata=MetadataQuery(distance=True),
        )

    # Perform the queries and collect results
    results = []
    for query, vector_name in queries_and_vectors:
        response = execute_near_text(query, vector_name)
        for result in response.objects:
            tmdb_id = result.properties["tmdb_id"]
            title = result.properties["title"]
            release_year = result.properties["release_year"]
            distance = result.metadata.distance
            results.append((tmdb_id, title, release_year, query, distance))

    # Convert results to DataFrame
    df = pd.DataFrame(
        results, columns=["tmdb_id", "title", "release_year", "query", "distance"]
    )

    # Pivot the DataFrame to combine distances for the same tmdb_id
    df_pivot = df.pivot_table(
        index=["tmdb_id", "title", "release_year"], columns="query", values="distance"
    )

    # Fill missing values with a high distance (e.g., 1.0)
    df_pivot = df_pivot.fillna(1.0)

    # Calculate combined score (mean of distances)
    df_pivot["combined_score"] = df_pivot.mean(axis=1)

    # Sort by combined score
    df_pivot = df_pivot.sort_values(by="combined_score")

    # Get top 3 results
    top_results = df_pivot.head(5)
    print(f"Top 5 for {queries_and_vectors}:")
    print(top_results)


def process_data():
    weaviate_client = weaviate.connect_to_custom(
        http_host=WeaviateServer.get("host"),
        http_port=WeaviateServer.get("port"),
        http_secure=False,
        grpc_host=WeaviateServer.get("host"),
        grpc_port=WeaviateServer.get("grpc_port"),
        grpc_secure=False,
        # auth_credentials=AuthApiKey(os.getenv("WEAVIATE_API_KEY")),
    )

    collection_name = "Tv"
    collection = get_or_create_collection(
        client=weaviate_client,
        name=collection_name,
    )

    aggregation = collection.aggregate.over_all(total_count=True)
    print(aggregation.total_count)
    return

    """
    movies_df = get_movies_df()
    store_vectors(
        collection=collection,
        df=movies_df,
    )
    """

    query_vectors(collection=collection)

    queries_and_vectors = [
        ("funny", "mood_vector"),
        ("violent", "flag_vector"),
        ("revenge", "plot_vector"),
    ]
    query_combined_vectors(
        collection=collection, queries_and_vectors=queries_and_vectors
    )

    queries_and_vectors = [
        ("sad", "mood_vector"),
        ("colorful", "visual_vector"),
        ("kid protagonist", "character_vector"),
    ]
    query_combined_vectors(
        collection=collection, queries_and_vectors=queries_and_vectors
    )

    queries_and_vectors = [
        ("virtual reality", "plot_vector"),
        ("fight", "plot_vector"),
        ("CGI", "visual_vector"),
    ]
    query_combined_vectors(
        collection=collection, queries_and_vectors=queries_and_vectors
    )

    weaviate_client.close()


def main():
    process_data()
