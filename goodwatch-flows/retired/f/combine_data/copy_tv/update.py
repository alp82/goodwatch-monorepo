from f.db.mongodb import init_mongodb, close_mongodb, build_query_selector_for_object_ids
from f.db.postgres import init_postgres
from f.combine_data.copy_tv.main import copy_tv


def main(next_ids: dict):
    print("Copy tv data")
    init_mongodb()
    pg = init_postgres()
    query_selector = build_query_selector_for_object_ids(ids=next_ids.get("tv_ids", []))
    result = copy_tv(pg, query_selector=query_selector)
    pg.close()
    close_mongodb()
    return result
