# requirements:
# kaleido
# openai
# pandas
# plotly
# scikit-learn
# umap-learn
# wmill

import os
import kaleido
import openai
import pandas as pd
import plotly.express as px
from scipy.spatial import distance
from sklearn.cluster import KMeans
from umap import UMAP
import wmill

import base64
from io import BytesIO

OpenAI = wmill.get_resource("u/Alp/openai_windmill_codegen")


def convert_plot_to_base64(fig):
    # Create a BytesIO object
    buffer = BytesIO()

    # Write the figure to the BytesIO object
    fig.write_image(buffer, format="png")

    # Get the PNG data from the BytesIO object
    png_data = buffer.getvalue()

    # Encode the PNG data to base64
    return base64.b64encode(png_data).decode()


def get_embedding(text_to_embed):
    # Embed a line of text
    response = openai.Embedding.create(
        model="text-embedding-ada-002", input=[text_to_embed]
    )
    # Extract the AI output embedding as a list of floats
    embedding = response["data"][0]["embedding"]

    return embedding


def main():
    openai.api_key = OpenAI.get("api_key")
    data_URL = "https://raw.githubusercontent.com/keitazoumana/Experimentation-Data/main/Musical_instruments_reviews.csv"

    review_df = pd.read_csv(data_URL)
    review_df = review_df[["reviewText"]]
    review_df = review_df.sample(100)
    review_df["embedding"] = review_df["reviewText"].astype(str).apply(get_embedding)

    # Make the index start from 0
    review_df.reset_index(drop=True)

    print(review_df.head(10))

    kmeans = KMeans(n_clusters=3)
    kmeans.fit(review_df["embedding"].tolist())

    reducer = UMAP()
    embeddings_2d = reducer.fit_transform(review_df["embedding"].tolist())

    fig = px.scatter(x=embeddings_2d[:, 0], y=embeddings_2d[:, 1], color=kmeans.labels_)
    # fig.show()
    base64 = convert_plot_to_base64(fig)

    return {
        "png": str(base64),
    }
