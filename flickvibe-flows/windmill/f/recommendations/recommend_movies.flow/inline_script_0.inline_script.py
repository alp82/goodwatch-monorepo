import pandas as pd

from f.db.postgres import init_postgres


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


def main():
    print("fetching tropes...")
    movie_tropes_df = get_movie_tropes_df()
    return {
        "movie_tropes": movie_tropes_df.to_dict('split'),
    }
