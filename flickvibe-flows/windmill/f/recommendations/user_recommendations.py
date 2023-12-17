# requirements:
# np
# pandas
# psycopg2-binary
# weaviate-client>=4.3b2
# wmill

import numpy as np
import pandas as pd
import weaviate
from weaviate.util import generate_uuid5
import wmill

from f.db.postgres import init_postgres

EMBEDDING_DIM = 1536

WeaviateServer = wmill.get_resource("u/Alp/weaviate_server")
weaviate_client = None


def get_movie_ratings_df() -> pd.DataFrame:
    pg = init_postgres()
    sql_query = """
        SELECT tmdb_id, aggregated_overall_score_normalized_percent as rating
        FROM movies
        ORDER BY popularity DESC
        LIMIT 1000;
    """
    df = pd.read_sql_query(sql_query, pg)
    pg.close()
    return df


def get_user_ratings_df() -> pd.DataFrame:
    user_ratings = [
        {
            # Fight Club
            "tmdb_id": 550,
            "rating": 96,
        },
        {
            # Matrix
            "tmdb_id": 603,
            "rating": 97,
        },
        {
            # Matrix 2
            "tmdb_id": 604,
            "rating": 66,
        },
        {
            # Matrix 3
            "tmdb_id": 605,
            "rating": 54,
        },
        {
            # LOTR 1
            "tmdb_id": 120,
            "rating": 90,
        },
        {
            # LOTR 2
            "tmdb_id": 121,
            "rating": 85,
        },
        {
            # LOTR 3
            "tmdb_id": 122,
            "rating": 89,
        },
        {
            # Hobbit
            "tmdb_id": 49051,
            "rating": 73,
        },
        {
            # Hobbit 2
            "tmdb_id": 57158,
            "rating": 77,
        },
        {
            # Hobbit 3
            "tmdb_id": 122917,
            "rating": 70,
        },
        {
            # Shawnshank Redemption
            "tmdb_id": 278,
            "rating": 87,
        },
        {
            # Indy 1
            "tmdb_id": 85,
            "rating": 81,
        },
        {
            # Indy 2
            "tmdb_id": 87,
            "rating": 82,
        },
        {
            # Indy 3
            "tmdb_id": 89,
            "rating": 88,
        },
        {
            # Indy 4
            "tmdb_id": 217,
            "rating": 45,
        },
        {
            # Austin Powers 3
            "tmdb_id": 818,
            "rating": 72,
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
    return get_movie_collection().query.fetch_object_by_id(
        generate_uuid5(tmdb_id), include_vector=True
    )


def get_user_profile_vector():
    movie_ratings_df = get_movie_ratings_df()
    user_ratings_df = get_user_ratings_df()

    # Create a set of user-rated movie IDs for quick lookup
    user_rated_movie_ids = set(user_ratings_df["tmdb_id"])

    # Initialize an empty array for the aggregated embedding
    aggregated_embedding = np.zeros(EMBEDDING_DIM)
    total_weight = 0

    # Iterate over all movies and adjust scores based on user rating
    for _, movie_row in movie_ratings_df.iterrows():
        tmdb_id = movie_row["tmdb_id"]
        movie_rating = movie_row["rating"]
        movie_embedding = get_movie_embedding(tmdb_id)

        if movie_embedding is not None:
            if tmdb_id in user_rated_movie_ids:
                # Movie is user-rated
                user_rating = user_ratings_df[user_ratings_df["tmdb_id"] == tmdb_id][
                    "rating"
                ].iloc[0]
                rating = user_rating
            else:
                # Movie is not user-rated, use neutral score
                rating = movie_rating

            movie_vector = movie_embedding.metadata.vector
            weighted_embedding = np.multiply(movie_vector, rating)
            aggregated_embedding = np.add(aggregated_embedding, weighted_embedding)
            total_weight += rating

    # Normalize the aggregated embedding
    if total_weight > 0:
        user_profile_vector = np.divide(aggregated_embedding, total_weight)
    else:
        user_profile_vector = aggregated_embedding  # Fallback in case of no ratings

    return user_profile_vector.tolist()


def main():
    user_profile_vector = get_user_profile_vector()
    response = get_movie_collection().query.near_vector(
        near_vector=user_profile_vector,
        limit=100,
    )
    recommendations = [
        f"{recommendation.get('original_title', 'unknown')} ({int(recommendation.properties.get('release_year', 0))})"
        for recommendation in response.objects
    ]
    output = f"TOP recommendations: {' ,  '.join(recommendations)}"
    print(output)
    return output
