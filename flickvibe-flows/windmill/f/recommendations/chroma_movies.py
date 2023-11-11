import chromadb
from chromadb.utils import embedding_functions
import np
import openai
import pandas as pd
import wmill

from f.db.postgres import init_postgres

OpenAI = wmill.get_resource("u/Alp/openai_windmill_codegen")
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIM = 1536
EMBEDDING_MAX_TOKENS = 8192
TROPE_PREFIX_BUFFER = 15

# TODO add
# budget
# age ratings
# spoken langs
# prod country

# TODO metadata
# streaming providers


def get_movies_df():
    pg = init_postgres()
    sql_query = """
    SELECT
        m.tmdb_id,
        m.original_title,
        m.release_year,
        m.genres,
        m.trope_names,
        m.tmdb_user_score_normalized_percent,
        m.imdb_user_score_normalized_percent,
        m.metacritic_user_score_normalized_percent,
        m.metacritic_meta_score_normalized_percent,
        m.rotten_tomatoes_audience_score_normalized_percent,
        m.rotten_tomatoes_tomato_score_normalized_percent,
        (
            SELECT array_agg(c.name)
            FROM (
                SELECT cr.name
                FROM jsonb_array_elements(m.crew) AS j(crew_elem)
                JOIN "crew" AS cr ON cr.id = (crew_elem->>'id')::int
                WHERE crew_elem->>'job' = 'Director'
                ORDER BY cr.popularity DESC
            ) c
        ) AS directors,
        (
            SELECT array_agg(c.name)
            FROM (
                SELECT ca.name
                FROM jsonb_array_elements(m.cast) AS j(cast_elem)
                JOIN "cast" AS ca ON ca.id = (cast_elem->>'id')::int
                ORDER BY ca.popularity DESC
                LIMIT 10
            ) c
        ) AS top_actors
    FROM
        movies m
    ORDER BY
        m.popularity DESC
    LIMIT
        100;
    """
    df = pd.read_sql_query(sql_query, pg)
    pg.close()
    return df


def get_movie_tropes_df():
    pg = init_postgres()
    sql_query = """
        SELECT UNNEST(trope_names) AS trope, COUNT(*) AS trope_count
        FROM movies
        GROUP BY trope
        ORDER BY trope_count DESC;
    """
    df = pd.read_sql_query(sql_query, pg)
    pg.close()
    return df


def estimate_token_count(tropes):
    # Join the tropes into a single string with a space as a separator
    # and count the tokens (roughly equivalent to the number of words)
    enclosed_tropes = [f"{{{trope}}}" for trope in tropes] if tropes else []
    return len(" ".join(enclosed_tropes))


def reduce_tropes_to_fit(tropes, max_tokens):
    # Start by estimating the token count
    token_count = estimate_token_count(tropes)

    # If the token count is already within the limit, return the original list
    if token_count <= max_tokens:
        return tropes

    # Use binary search to find the maximum number of tropes that fit within the token limit
    left, right = 0, len(tropes)
    while left < right:
        mid = (left + right) // 2
        current_count = estimate_token_count(tropes[:mid])

        if current_count == max_tokens:
            # Found the exact number of tropes that fit, return them
            return tropes[:mid]
        elif current_count < max_tokens:
            left = mid + 1
        else:
            right = mid

    # After binary search, check if we have gone over the limit
    # This is necessary because the estimate might not be perfect
    while estimate_token_count(tropes[:left]) > max_tokens:
        left -= 1

    # Return the list of tropes that fit within the token limit
    return tropes[:left]


def split_tropes_for_embedding(
    df_tropes, max_tokens=EMBEDDING_MAX_TOKENS - TROPE_PREFIX_BUFFER, overlap_ratio=0.5
):
    # Sort the DataFrame by count
    df_tropes_sorted = df_tropes.sort_values(by="trope_count", ascending=False)

    # Determine the number of tropes to overlap
    overlap_count = int(len(df_tropes_sorted) * overlap_ratio)

    # Split into most common and rarest with overlap
    common_tropes = df_tropes_sorted["trope"].tolist()[
        : len(df_tropes_sorted) - overlap_count
    ]
    rare_tropes = df_tropes_sorted["trope"].tolist()[
        -(len(df_tropes_sorted) - overlap_count) :
    ]

    # Reduce each list to fit the token limit
    common_tropes_reduced = reduce_tropes_to_fit(common_tropes, max_tokens)
    rare_tropes_reduced = reduce_tropes_to_fit(rare_tropes, max_tokens)

    # Return two separate lists
    return common_tropes_reduced, rare_tropes_reduced


def get_embedding(text):
    response = openai.embeddings.create(model=EMBEDDING_MODEL, input=text)
    # Extract the AI output embedding as a list of floats
    embedding = response.data[0].embedding
    return embedding


def get_weighted_embedding(
    year, genres, directors, top_actors, ratings, tropes, all_tropes_df
):
    weights = {
        "metadata": 3,
        "tropes": 4,
        "ratings": 5,
    }

    # Prepare the text for embedding with context
    year_text = f"release year: {year}" if year else "release year is unknown"
    genres_text = f"genres: {' '.join(genres)}" if genres else "no genres available"
    directors_text = (
        f"directed by: {' '.join(directors)}" if directors else "director unknown"
    )
    top_actors_text = (
        f"top actors: {' '.join(top_actors)}" if top_actors else "actors unknown"
    )
    ratings_text = (
        f"scores: {' '.join([f'{rating}/100' if rating is not None else '-' for rating in ratings])}"
        if ratings
        else "no scores available"
    )

    common_tropes, rare_tropes = split_tropes_for_embedding(
        all_tropes_df[all_tropes_df["trope"].isin(set(tropes))]
    )
    enclosed_common_tropes = (
        [f"{{{trope}}}" for trope in common_tropes] if common_tropes else None
    )
    common_tropes_text = (
        f"common tags: {' '.join(enclosed_common_tropes)}"
        if enclosed_common_tropes
        else "no tags available"
    )
    enclosed_rare_tropes = (
        [f"{{{trope}}}" for trope in rare_tropes] if rare_tropes else None
    )
    rare_tropes_text = (
        f"rare tags: {' '.join(enclosed_rare_tropes)}"
        if enclosed_rare_tropes
        else "no tags available"
    )

    # Get embeddings for each field
    metadata_embedding = get_embedding(
        f"{year_text}, {genres_text}, {directors_text}, {top_actors_text}"
    )
    ratings_embedding = (
        get_embedding(ratings_text) if ratings else np.zeros(EMBEDDING_DIM)
    )
    common_tropes_embedding = (
        get_embedding(common_tropes_text)
        if enclosed_common_tropes
        else np.zeros(EMBEDDING_DIM)
    )
    rare_tropes_embedding = (
        get_embedding(rare_tropes_text)
        if enclosed_rare_tropes
        else np.zeros(EMBEDDING_DIM)
    )

    # Apply weights to each embedding
    weighted_metadata = np.multiply(metadata_embedding, weights["metadata"])
    weighted_ratings = np.multiply(ratings_embedding, weights["ratings"])
    weighted_common_tropes = np.multiply(common_tropes_embedding, weights["tropes"])
    weighted_rare_tropes = np.multiply(rare_tropes_embedding, weights["tropes"])

    # Combine the weighted embeddings
    combined_embedding = np.add(
        np.add(np.add(weighted_common_tropes, weighted_rare_tropes), weighted_ratings),
        weighted_metadata,
    )
    return combined_embedding.tolist()


def build_data():
    movies_df = get_movies_df()
    all_tropes_df = get_movie_tropes_df()

    movies_df["embedding"] = movies_df.apply(
        lambda row: get_weighted_embedding(
            row["release_year"],
            row["genres"],
            row["directors"],
            row["top_actors"],
            [
                row["tmdb_user_score_normalized_percent"],
                row["imdb_user_score_normalized_percent"],
                row["metacritic_user_score_normalized_percent"],
                row["metacritic_meta_score_normalized_percent"],
                row["rotten_tomatoes_audience_score_normalized_percent"],
                row["rotten_tomatoes_tomato_score_normalized_percent"],
            ],
            row["trope_names"],
            all_tropes_df,
        ),
        axis=1,
    )
    movies_df.reset_index(drop=True, inplace=True)

    chroma_client = chromadb.Client()
    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=OpenAI.get("api_key"),
        model_name=EMBEDDING_MODEL,
    )
    movies_collection = chroma_client.get_or_create_collection(
        name="movies", embedding_function=openai_ef
    )

    documents = movies_df.apply(
        lambda x: f"{x['original_title']} ({x['release_year']})", axis=1
    ).tolist()
    embeddings = movies_df["embedding"].tolist()
    metadatas = movies_df[["original_title", "release_year"]].to_dict(orient="records")
    ids = movies_df["tmdb_id"].astype(str).tolist()

    movies_collection.upsert(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )

    for id in ids:
        movie_doc = movies_collection.get(
            ids=id, include=["documents", "metadatas", "embeddings"]
        )
        results = movies_collection.query(
            query_embeddings=movie_doc["embeddings"], n_results=4, include=["documents"]
        )
        print(
            f"TOP3 for {movie_doc['documents'][0]}: {', '.join(results['documents'][0][1:])}"
        )


def main():
    openai.api_key = OpenAI.get("api_key")
    build_data()
    return
