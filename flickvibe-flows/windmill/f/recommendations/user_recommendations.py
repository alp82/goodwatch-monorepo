# requirements:
# np
# pandas
# weaviate-client>=4.2b0
# wmill

import numpy as np
import pandas as pd
import weaviate
from weaviate.util import generate_uuid5
import wmill

EMBEDDING_DIM = 1536

WeaviateServer = wmill.get_resource("u/Alp/weaviate_server")

weaviate_client = None


def get_user_ratings_df() -> pd.DataFrame:
    user_ratings = [
        {
            "tmdb_id": 603,
            "rating": 97,
        },
        {
            "tmdb_id": 550,
            "rating": 96,
        },
    ]
    user_ratings_df = pd.DataFrame(user_ratings)
    return user_ratings_df


def get_weaviate_client():
    global weaviate_client

    if weaviate_client:
        return weaviate_client

    print("connecting to weaviate server...")
    weaviate_client = weaviate.connect_to_local(
        host=WeaviateServer.get("host"),
        port=WeaviateServer.get("port"),
        grpc_port=WeaviateServer.get("grpc_port"),
        headers=WeaviateServer.get("headers"),
    )
    return weaviate_client


def get_movie_collection():
    weaviate_client = get_weaviate_client()
    movie_collection = weaviate_client.collections.get("Movie")
    return movie_collection


def get_movie_embedding(tmdb_id: int):
    return (
        get_movie_collection()
        .query.fetch_object_by_id(generate_uuid5(tmdb_id), include_vector=True)
        .metadata.vector
    )


def get_user_profile_vector():
    user_ratings_df = get_user_ratings_df()

    # Filter for movies rated by the user
    user_movies = user_ratings_df

    # Initialize an empty array for the aggregated embedding
    aggregated_embedding = np.zeros(EMBEDDING_DIM)

    # Aggregate embeddings
    total_weight = 0
    for _, row in user_movies.iterrows():
        tmdb_id = row["tmdb_id"]
        rating = row["rating"]
        movie_embedding = get_movie_embedding(tmdb_id)

        if movie_embedding is not None:
            # Weight the movie's embedding by the user's rating
            weighted_embedding = np.multiply(movie_embedding, rating)
            aggregated_embedding = np.add(aggregated_embedding, weighted_embedding)
            total_weight += rating

    # Normalize the aggregated embedding
    if total_weight > 0:
        user_profile_vector = np.divide(aggregated_embedding, total_weight)
    else:
        user_profile_vector = aggregated_embedding  # Fallback in case of no ratings

    return user_profile_vector.tolist()


def main(tmdb_ids: list[int] = [13, 122, 129, 155, 278, 424, 550, 603, 680]):
    user_profile_vector = get_user_profile_vector()
    response = get_movie_collection().query.near_vector(
        near_vector=user_profile_vector,
        limit=11,
    )
    movie_source = f"{response.objects[0].properties['original_title']} ({int(response.objects[0].properties.get('release_year'))})"
    recommendations = [
        f"{recommendation.properties['original_title']} ({int(recommendation.properties.get('release_year'))})"
        for recommendation in response.objects[1:]
    ]
    output = f"TOP5 for {movie_source}: {', '.join(recommendations)}"
    print(output)
    return output
