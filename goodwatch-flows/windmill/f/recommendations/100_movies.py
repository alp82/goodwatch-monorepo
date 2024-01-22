# requirements:
# kaleido
# np
# openai
# pandas
# plotly
# psycopg2-binary
# scikit-learn
# umap-learn
# wmill

import os
import kaleido
import np
import openai
import pandas as pd
import plotly.express as px
from scipy.spatial import distance
from sklearn.cluster import KMeans
from umap import UMAP
import wmill

import base64
from io import BytesIO

from f.db.postgres import init_postgres

OpenAI = wmill.get_resource("u/Alp/openai_windmill_codegen")
EMBEDDING_DIM = 1536


def get_movies_df():
    pg = init_postgres()
    sql_query = """
    SELECT
        original_title,
        release_year,
        genres,
        trope_names,
        tmdb_user_score_normalized_percent,
        imdb_user_score_normalized_percent,
        metacritic_user_score_normalized_percent,
        metacritic_meta_score_normalized_percent,
        rotten_tomatoes_audience_score_normalized_percent,
        rotten_tomatoes_tomato_score_normalized_percent
    FROM
        movies
    ORDER BY
        popularity DESC
    LIMIT
        100;
    """
    df = pd.read_sql_query(sql_query, pg)
    pg.close()
    return df


def get_embedding(text_list):
    combined_text = " ".join(text_list)
    response = openai.Embedding.create(
        model="text-embedding-ada-002", input=combined_text
    )
    # Extract the AI output embedding as a list of floats
    embedding = response["data"][0]["embedding"]
    return embedding


def get_weighted_embedding(year, genres, tropes, ratings):
    weights = {
        "year_genres": 3,
        "tropes": 1,
        "ratings": 5,
    }

    # Prepare the text for embedding with context
    year_text = f"release year: {year}" if year else "release year is unknown"
    genres_text = f"genres: {' '.join(genres)}" if genres else "no genres available"
    tropes_text = f"tags: {' '.join(tropes)}" if tropes else "no tags available"
    ratings_text = (
        f"scores: {' '.join([f'{rating}/100' for rating in ratings])}"
        if ratings
        else "no scores available"
    )

    # Get embeddings for each field
    year_genres_embedding = (
        get_embedding(f"{year_text}, {genres_text}")
        if genres
        else np.zeros(EMBEDDING_DIM)
    )
    tropes_embedding = get_embedding(tropes_text) if tropes else np.zeros(EMBEDDING_DIM)
    ratings_embedding = (
        get_embedding(ratings_text) if ratings else np.zeros(EMBEDDING_DIM)
    )

    # Apply weights to each embedding
    weighted_year_genres = np.multiply(year_genres_embedding, weights["year_genres"])
    weighted_tropes = np.multiply(tropes_embedding, weights["tropes"])
    weighted_ratings = np.multiply(ratings_embedding, weights["ratings"])

    # Combine the weighted embeddings
    combined_embedding = np.add(
        np.add(weighted_year_genres, weighted_tropes),
        weighted_ratings,
    )
    return combined_embedding.tolist()


def get_top_recommendations(df, n_recommendations=3):
    # Extract the embeddings into a list of lists
    embeddings = df["embedding"].tolist()

    # Calculate the pairwise distance matrix
    distance_matrix = distance.cdist(embeddings, embeddings, "euclidean")

    # Create a DataFrame from the distance matrix
    distance_df = pd.DataFrame(
        distance_matrix, index=df["original_title"], columns=df["original_title"]
    )

    # Initialize a dictionary to store recommendations
    recommendations = {}

    # Iterate over movies to get the closest ones
    for title in df["original_title"]:
        # Get the distances for the current movie, sort them, and take the top n recommendations
        closest_titles = (
            distance_df[title].sort_values()[1 : n_recommendations + 1].index.tolist()
        )
        recommendations[title] = closest_titles

    return recommendations


def convert_plot_to_base64(fig):
    # Create a BytesIO object
    buffer = BytesIO()

    # Write the figure to the BytesIO object
    fig.write_image(buffer, format="png")

    # Get the PNG data from the BytesIO object
    png_data = buffer.getvalue()

    # Encode the PNG data to base64
    return base64.b64encode(png_data).decode()


def main():
    openai.api_key = OpenAI.get("api_key")

    df = get_movies_df()
    df["embedding"] = df.apply(
        lambda row: get_weighted_embedding(
            row["release_year"],
            row["genres"],
            row["trope_names"],
            [
                row["tmdb_user_score_normalized_percent"],
                row["imdb_user_score_normalized_percent"],
                row["metacritic_user_score_normalized_percent"],
                row["metacritic_meta_score_normalized_percent"],
                row["rotten_tomatoes_audience_score_normalized_percent"],
                row["rotten_tomatoes_tomato_score_normalized_percent"],
            ],
        ),
        axis=1,
    )
    df.reset_index(drop=True)

    top_recommendations = get_top_recommendations(df)
    for movie, recs in top_recommendations.items():
        print(f"Top recommendations for '{movie}': {recs}")

    kmeans = KMeans(n_clusters=3)
    kmeans.fit(df["embedding"].tolist())

    reducer = UMAP()
    embeddings_2d = reducer.fit_transform(df["embedding"].tolist())

    fig = px.scatter(
        x=embeddings_2d[:, 0],
        y=embeddings_2d[:, 1],
        color=kmeans.labels_,
        text=df["original_title"],
    )
    fig.update_traces(textposition="top center")
    # fig.show()
    base64 = convert_plot_to_base64(fig)

    return {
        "png": str(base64),
    }
