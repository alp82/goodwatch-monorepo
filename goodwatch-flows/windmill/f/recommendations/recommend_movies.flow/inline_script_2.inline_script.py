from f.db.postgres import init_postgres


BATCH_SIZE = 200


def get_movie_count(min_popularity: float):
    pg = init_postgres()
    sql_query = f"""
    SELECT
        COUNT(tmdb_id)
    FROM
        movies
    WHERE
        popularity >= {min_popularity}
    """
    pg_cursor = pg.cursor()
    pg_cursor.execute(sql_query)
    result = pg_cursor.fetchone()
    pg.close()
    return result[0] if result else 0


def create_batch_ranges(movie_count, batch_size):
    ranges = []
    for start in range(0, movie_count, batch_size):
        end = start + batch_size - 1
        if end >= movie_count:
            end = movie_count - 1
        ranges.append({"start": start, "end": end})
    return ranges


def main(min_popularity: float):
    print("fetching movie count...")
    movie_count = get_movie_count(min_popularity)
    movie_batches = create_batch_ranges(movie_count, BATCH_SIZE)
    return {
        "movie_count": movie_count,
        "movie_batches": movie_batches,
        "batch_size": BATCH_SIZE,
    }
