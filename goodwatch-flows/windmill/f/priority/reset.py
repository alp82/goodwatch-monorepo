from typing import Union, Literal

from f.data_source.common import IdsParameter
from f.db.postgres import init_postgres


def main(next_ids: dict):
    ids = IdsParameter(
        movie_ids=next_ids.get("movie_ids", []),
        tv_ids=next_ids.get("tv_ids", []),
    )

    pg = init_postgres()
    pg_cursor = pg.cursor()
    reset_priority(pg=pg, pg_cursor=pg_cursor, type="movie", tmdb_ids=ids.movie_ids)
    reset_priority(pg=pg, pg_cursor=pg_cursor, type="tv", tmdb_ids=ids.tv_ids)
    pg.close()


def reset_priority(
    pg, pg_cursor, type: Union[Literal["movie"], Literal["tv"]], tmdb_ids
):
    query = f"""
    UPDATE priority_queue_{type}
    SET priority = 0,
        reset_at = NOW()
    WHERE tmdb_id = ANY(%s::int[]);
    """

    pg_cursor.execute(query, (tmdb_ids,))
    pg.commit()

    print(f"Reset priority for {pg_cursor.rowcount} {type} rows")
