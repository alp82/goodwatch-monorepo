from typing import Union, Literal

from mongoengine import get_db

from f.data_source.common import IdsParameter
from f.db.mongodb import init_mongodb, close_mongodb
from f.db.postgres import init_postgres


BATCH_SIZE = 10
BUFFER_SELECTED_AT_MINUTES = 30


def main():
    init_mongodb()
    mongo_db = get_db()
    pg = init_postgres()
    pg_cursor = pg.cursor()

    next_movie_ids = get_next_ids(pg_cursor, mongo_db, "movie")
    next_tv_ids = get_next_ids(pg_cursor, mongo_db, "tv")

    pg.close()
    close_mongodb()

    ids = IdsParameter(
        movie_ids=next_movie_ids.get("ids") or [],
        tv_ids=next_tv_ids.get("ids") or [],
    )
    tmdb_ids = IdsParameter(
        movie_ids=next_movie_ids.get("tmdb_ids") or [],
        tv_ids=next_tv_ids.get("tmdb_ids") or [],
    )

    result = {
        "ids": ids.model_dump(),
        "tmdb_ids": tmdb_ids.model_dump(),
    }
    print(result)
    return result


def get_next_ids(
    pg_cursor, mongo_db, type: Union[Literal["movie"], Literal["tv"]]
) -> dict[str, list[str]]:
    query = f"""
    SELECT tmdb_id
    FROM priority_queue_{type}
    WHERE priority > 0
    AND (reset_at IS NULL OR reset_at AT TIME ZONE 'UTC' < NOW() AT TIME ZONE 'UTC' - INTERVAL '1 day')
    ORDER BY priority DESC
    LIMIT 5;
    """
    pg_cursor.execute(query)
    rows = pg_cursor.fetchall()

    tmdb_ids = [str(row[0]) for row in rows]
    if not tmdb_ids:
        return {}

    collection_name = "tmdb_movie_details" if type == "movie" else "tmdb_tv_details"
    query = {"tmdb_id": {"$in": [int(id) for id in tmdb_ids]}}
    documents = mongo_db[collection_name].find(query)

    return {
        "ids": [str(doc["_id"]) for doc in documents],
        "tmdb_ids": tmdb_ids,
    }


if __name__ == "__main__":
    main()
