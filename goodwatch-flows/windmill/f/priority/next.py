from typing import Optional, Union, Literal

from mongoengine import get_db

from f.data_source.common import IdsParameter
from f.db.mongodb import init_mongodb, close_mongodb
from f.db.postgres import init_postgres


BATCH_SIZE = 10
BUFFER_SELECTED_AT_MINUTES = 30


def main(movie_tmdb_id: str, tv_tmdb_id: str):
    init_mongodb()
    mongo_db = get_db()
    pg = init_postgres()
    pg_cursor = pg.cursor()

    if movie_tmdb_id or tv_tmdb_id:
        next_movie_ids = get_ids_from_tmdb_id(mongo_db, "movie", [movie_tmdb_id]) if movie_tmdb_id else []
        next_tv_ids = get_ids_from_tmdb_id(mongo_db, "tv", [tv_tmdb_id]) if tv_tmdb_id else []

        ids = IdsParameter(
            movie_ids=next_movie_ids,
            tv_ids=next_tv_ids,
        )
        tmdb_ids = IdsParameter(
            movie_ids=[movie_tmdb_id] if movie_tmdb_id else [],
            tv_ids=[tv_tmdb_id] if tv_tmdb_id else [],
        )
    else:
        next_movie_ids = get_next_ids(pg_cursor, mongo_db, "movie")
        next_tv_ids = get_next_ids(pg_cursor, mongo_db, "tv")

        ids = IdsParameter(
            movie_ids=next_movie_ids.get("ids") or [],
            tv_ids=next_tv_ids.get("ids") or [],
        )
        tmdb_ids = IdsParameter(
            movie_ids=next_movie_ids.get("tmdb_ids") or [],
            tv_ids=next_tv_ids.get("tmdb_ids") or [],
        )

    pg.close()
    close_mongodb()

    result = {
        "ids": ids.model_dump(),
        "tmdb_ids": tmdb_ids.model_dump(),
    }
    print(result)
    return result


def get_ids_from_tmdb_id(
    mongo_db, type: Union[Literal["movie"], Literal["tv"]], tmdb_ids: list[str]
) -> list[str]:
    collection_name = "tmdb_movie_details" if type == "movie" else "tmdb_tv_details"
    query = {"tmdb_id": {"$in": [int(id) for id in tmdb_ids]}}
    documents = mongo_db[collection_name].find(query)
    return [str(doc["_id"]) for doc in documents]


def get_next_ids(
    pg_cursor, mongo_db, type: Union[Literal["movie"], Literal["tv"]]
) -> dict[str, list[str]]:
    query = f"""
    SELECT tmdb_id
    FROM priority_queue_{type}
    WHERE priority > 0
    AND (reset_at IS NULL OR reset_at AT TIME ZONE 'UTC' < NOW() AT TIME ZONE 'UTC' - INTERVAL '1 week')
    ORDER BY priority DESC
    LIMIT 1;
    """
    pg_cursor.execute(query)
    rows = pg_cursor.fetchall()

    tmdb_ids = [str(row[0]) for row in rows]
    if not tmdb_ids:
        return {}

    ids = get_ids_from_tmdb_id(mongo_db, type, tmdb_ids)
    return {
        "ids": ids,
        "tmdb_ids": tmdb_ids,
    }


if __name__ == "__main__":
    main()
