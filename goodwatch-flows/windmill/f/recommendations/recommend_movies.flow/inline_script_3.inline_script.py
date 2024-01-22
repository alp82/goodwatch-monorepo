import pandas as pd

from f.db.postgres import init_postgres


def get_movies_df(min_popularity: float, limit: int, offset: int):
    pg = init_postgres()
    sql_query = f"""
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
    WHERE
        popularity >= {min_popularity} AND
        (m.popularity, m.tmdb_id) < (
            SELECT popularity, tmdb_id FROM movies ORDER BY popularity DESC, tmdb_id DESC LIMIT 1 OFFSET {offset}
        )
    ORDER BY
        m.popularity DESC
    LIMIT
        {limit};
    """
    df = pd.read_sql_query(sql_query, pg)
    pg.close()
    return df


def main(min_popularity: float, batch: dict, batch_size: int):
    print("fetching movies...")
    movies_df = get_movies_df(
        min_popularity=min_popularity, limit=batch_size, offset=batch["start"]
    )
    return {
        "movies": movies_df.to_dict("split"),
        "movies_list": movies_df.to_dict("records"),
    }
