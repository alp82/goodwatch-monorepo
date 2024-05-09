from f.db.mongodb import init_mongodb, close_mongodb, build_query_selector_for_object_ids
from f.db.postgres import init_postgres
from f.combine_data.copy_movies.main import copy_movies


def main(next_ids: dict):
    print("Copy movie data")
    init_mongodb()
    pg = init_postgres()
    query_selector = build_query_selector_for_object_ids(ids=next_ids.get("movie_ids", []))
    result = copy_movies(pg, query_selector=query_selector)
    pg.close()
    close_mongodb()
    return result
