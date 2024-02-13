from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres
from f.combine_data.copy_streaming_provider_links.main import (
    copy_streaming_provider_links,
)


def main(next_ids: dict):
    print("Copy streaming provider links")
    init_mongodb()
    pg = init_postgres()
    pg_cursor = pg.cursor()

    movie_ids = next_ids.get("movie_ids", [])
    tv_ids = next_ids.get("tv_ids", [])
    combined_ids = movie_ids + tv_ids

    if movie_ids:
        print(f"resetting movie links for: {movie_ids} ")
    if tv_ids:
        print(f"resetting tv links for: {tv_ids} ")

    pg_cursor.execute("BEGIN")
    pg_cursor.execute(
        f"DELETE FROM streaming_provider_links WHERE tmdb_id = ANY(%s)",
        (combined_ids,),
    )

    total_movie_count = 0
    total_tv_count = 0
    if movie_ids:
        total_movie_count = copy_streaming_provider_links(
            pg_cursor, "movie", "tmdb_movie_providers", {"tmdb_id": {"$in": movie_ids}}
        )
    if tv_ids:
        total_tv_count = copy_streaming_provider_links(
            pg_cursor, "tv", "tmdb_tv_providers", {"tmdb_id": {"$in": tv_ids}}
        )

    pg.commit()
    pg_cursor.close()
    pg.close()
    return {"total_movie_count": total_movie_count, "total_tv_count": total_tv_count}
