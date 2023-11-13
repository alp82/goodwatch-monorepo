# requirements:
# pandas
# psycopg2-binary
# weaviate-client>=4.2b0
# wmill
from typing import TypedDict

import pandas as pd
import weaviate
import weaviate.classes as wvc
from weaviate.util import generate_uuid5
import wmill

WeaviateServer = wmill.get_resource("u/Alp/weaviate_server")

WEAVIATE_BATCH_SIZE = 100


def main(results):
    print("connecting to weaviate server...")
    weaviate_client = weaviate.connect_to_local(
        host=WeaviateServer.get("host"),
        port=WeaviateServer.get("port"),
        grpc_port=WeaviateServer.get("grpc_port"),
        headers=WeaviateServer.get("headers"),
    )

    collection_name = "Movie"

    class DataModel(TypedDict):
        tmdb_id: int
        original_title: str
        release_year: int

    if weaviate_client.collections.exists(name=collection_name):
        movie_collection = weaviate_client.collections.get(collection_name)
    else:
        movie_collection = weaviate_client.collections.create(
            name=collection_name,
            vectorizer_config=wvc.Configure.Vectorizer.text2vec_openai(),
            generative_config=wvc.Configure.Generative.openai(),
            data_model=DataModel,
        )

    print("batch inserting embeddings to weaviate...")
    weaviate_client.batch.configure(batch_size=WEAVIATE_BATCH_SIZE)
    with weaviate_client.batch as batch:
        for result in results:
            movie = result["movie"]
            embedding = result["embedding"]
            batch.add_object(
                collection=collection_name,
                uuid=generate_uuid5(movie["tmdb_id"]),
                properties={
                    "tmdb_id": movie["tmdb_id"],
                    "original_title": movie["original_title"],
                    "release_year": movie["release_year"],
                },
                vector=embedding,
            )

    print("showing recommendation results...")
    outputs = []
    for result in results:
        movie = result["movie"]
        response = movie_collection.query.near_object(
            near_object=generate_uuid5(movie["tmdb_id"]),
            limit=4,
        )
        movie_source = f"{response.objects[0].properties['original_title']} ({int(response.objects[0].properties.get('release_year'))})"
        recommendations = [
            f"{recommendation.properties['original_title']} ({int(recommendation.properties.get('release_year'))})"
            for recommendation in response.objects[1:]
        ]
        output = f"TOP3 for {movie_source}: {', '.join(recommendations)}"
        outputs.append(output)
        print(output)

    return outputs
