from mongoengine import get_db

from f.db.mongodb import init_mongodb, close_mongodb, build_query_selector_for_object_ids
from f.db.postgres import init_postgres
from f.combine_data.copy_streaming_provider_links.main import (
    copy_streaming_provider_links,
)


def main(next_ids: dict):
    print("Copy streaming provider links")
    init_mongodb()
    mongo_db = get_db()
    pg = init_postgres()
    pg_cursor = pg.cursor()

    movie_ids = next_ids.get("movie_ids", [])
    tv_ids = next_ids.get("tv_ids", [])

    movie_tmdb_ids = [details.get("tmdb_id") for details in mongo_db.tmdb_movie_details.find(
        build_query_selector_for_object_ids(ids=movie_ids)
    )]
    tv_tmdb_ids = [details.get("tmdb_id") for details in mongo_db.tmdb_tv_details.find(
        build_query_selector_for_object_ids(ids=tv_ids)
    )]

    if movie_tmdb_ids:
        print(f"resetting movie links for: {movie_tmdb_ids} ")
    if tv_tmdb_ids:
        print(f"resetting tv links for: {tv_tmdb_ids} ")

    pg_cursor.execute("BEGIN")
    pg_cursor.execute(
        f"DELETE FROM streaming_provider_links WHERE tmdb_id = ANY(%s) AND media_type = 'movie'",
        (movie_tmdb_ids,),
    )
    pg_cursor.execute(
        f"DELETE FROM streaming_provider_links WHERE tmdb_id = ANY(%s) AND media_type = 'tv'",
        (tv_tmdb_ids,),
    )

    total_movie_count = 0
    total_tv_count = 0
    if movie_tmdb_ids:
        total_movie_count = copy_streaming_provider_links(
            pg_cursor, "movie", "tmdb_movie_providers", {"tmdb_id": {"$in": movie_tmdb_ids}}
        )
    if tv_tmdb_ids:
        total_tv_count = copy_streaming_provider_links(
            pg_cursor, "tv", "tmdb_tv_providers", {"tmdb_id": {"$in": tv_tmdb_ids}}
        )

    pg.commit()
    pg_cursor.close()
    pg.close()
    close_mongodb()
    return {"total_movie_streaming_links_count": total_movie_count, "total_tv_streaming_links_count": total_tv_count}
