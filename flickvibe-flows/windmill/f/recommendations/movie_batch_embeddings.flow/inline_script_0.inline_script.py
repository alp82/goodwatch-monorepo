import np
import openai
import pandas as pd
import wmill


EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIM = 1536
EMBEDDING_MAX_TOKENS = 8192
TROPE_PREFIX_BUFFER = 15

OpenAI = wmill.get_resource("u/Alp/openai_windmill_codegen")


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
    year, genres, directors, top_actors, ratings, tropes, movie_tropes_df
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
        movie_tropes_df[movie_tropes_df["trope"].isin(set(tropes))]
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


def main(movie, movie_tropes):
    openai.api_key = OpenAI.get("api_key")
    movie_tropes_df = pd.DataFrame(
        movie_tropes["data"],
        columns=movie_tropes["columns"],
        index=movie_tropes["index"],
    )

    embedding = get_weighted_embedding(
        movie["release_year"],
        movie["genres"],
        movie["directors"],
        movie["top_actors"],
        [
            movie["tmdb_user_score_normalized_percent"],
            movie["imdb_user_score_normalized_percent"],
            movie["metacritic_user_score_normalized_percent"],
            movie["metacritic_meta_score_normalized_percent"],
            movie["rotten_tomatoes_audience_score_normalized_percent"],
            movie["rotten_tomatoes_tomato_score_normalized_percent"],
        ],
        movie["trope_names"],
        movie_tropes_df,
    )
    return {
        "movie": movie,
        "embedding": embedding,
    }
