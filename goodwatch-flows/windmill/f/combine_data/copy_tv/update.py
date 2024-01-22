from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres
from f.combine_data.copy_tv.main import copy_tv


def main(next_ids: dict):
    print("Copy tv data")
    init_mongodb()
    pg = init_postgres()
    tv_ids = next_ids.get("tv_ids", [])
    query_selector = {"tmdb_id": {"$in": tv_ids}}
    result = copy_tv(pg, query_selector=query_selector)
    pg.close()
    return result
