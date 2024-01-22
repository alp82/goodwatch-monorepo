from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres
from f.combine_data.copy_movies.main import copy_movies


def main(next_ids: dict):
    print("Copy movie data")
    init_mongodb()
    pg = init_postgres()
    movie_ids = next_ids.get("movie_ids", [])
    query_selector = {"tmdb_id": {"$in": movie_ids}}
    result = copy_movies(pg, query_selector=query_selector)
    pg.close()
    return result
