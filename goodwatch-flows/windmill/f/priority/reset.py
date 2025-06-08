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
    reset_priority(pg, pg_cursor, "movie", ids.movie_ids)
    reset_priority(pg, pg_cursor, "tv", ids.tv_ids)
    pg.close()


def reset_priority(pg, pg_cursor, type: Union[Literal["movie"], Literal["tv"]], tmdb_ids: list[int]):
    query = f"""
        INSERT INTO priority_queue_{type} (tmdb_id, priority, created_at, updated_at, reset_at)
        SELECT UNNEST(%s::int[]), 0, NOW(), NOW(), NOW()
        ON CONFLICT (tmdb_id)
        DO UPDATE 
            SET priority = EXCLUDED.priority,
                updated_at = EXCLUDED.updated_at,
                reset_at = NOW()
    """
    pg_cursor.execute(query, (tmdb_ids,))
    pg.commit()

    print(f"Upserted priority=0 for {pg_cursor.rowcount} {type} rows")