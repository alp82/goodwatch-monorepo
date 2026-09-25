# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Publish Rotten Tomatoes and Metacritic season scores to Crate (#152).

Tables `rotten_tomatoes_season` and `metacritic_season`, one row per TMDB show and
season in the site's numbering, clustered by show like `imdb_season`, so one show's
seasons are one routed read. A show's rows are rewritten from Mongo
(`*_tv_season_rating`) each time it is crawled, and rows of seasons the site no longer
lists are deleted.
"""
from f.sync.models.crate_models import MetacriticSeason, RottenTomatoesSeason

TABLES = {
    "rotten_tomatoes": {
        "table": "rotten_tomatoes_season", "model": RottenTomatoesSeason, "collection": "rotten_tomatoes_tv_season_rating",
        "columns": {"url": "rotten_tomatoes_url",
                    "tomato_score_original": "rotten_tomatoes_tomato_score_original",
                    "tomato_score_vote_count": "rotten_tomatoes_tomato_score_review_count",
                    "audience_score_original": "rotten_tomatoes_audience_score_original",
                    "audience_score_vote_count": "rotten_tomatoes_audience_score_rating_count"},
    },
    "metacritic": {
        "table": "metacritic_season", "model": MetacriticSeason, "collection": "metacritic_tv_season_rating",
        "columns": {"url": "metacritic_url",
                    "meta_score_original": "metacritic_meta_score_original",
                    "meta_score_vote_count": "metacritic_meta_score_review_count",
                    "user_score_original": "metacritic_user_score_original",
                    "user_score_vote_count": "metacritic_user_score_rating_count"},
    },
}
SHOWS_PER_BATCH = 500


def season_rows(db, site: str, show_ids: list[int]) -> list[dict]:
    conf = TABLES[site]
    projection = {"_id": 0, "tmdb_id": 1, "season_number": 1, **{name: 1 for name in conf["columns"]}}
    rows = []
    for doc in db[conf["collection"]].find({"tmdb_id": {"$in": list(show_ids)}}, projection).sort(
            [("tmdb_id", 1), ("season_number", 1)]):
        row = {"show_id": doc["tmdb_id"], "season_number": doc["season_number"]}
        row.update({column: doc.get(name) for name, column in conf["columns"].items()})
        rows.append(row)
    return rows


def publish_seasons(db, connector, site: str, show_ids: list[int]) -> dict:
    conf = TABLES[site]
    table = conf["table"]
    counts = {"shows": 0, "rows": 0}
    for start in range(0, len(show_ids), SHOWS_PER_BATCH):
        chunk = list(show_ids[start:start + SHOWS_PER_BATCH])
        rows = season_rows(db, site, chunk)
        if rows:
            connector.upsert_many(table=table, records=[conf["model"](**row) for row in rows],
                                  conflict_columns=["show_id", "season_number"], silent=True, replace_nulls=True)
            kept = [f"{row['show_id']}:{row['season_number']}" for row in rows]
            connector.run(f"DELETE FROM {table} WHERE show_id = ANY(?) "
                          f"AND NOT (CAST(show_id AS TEXT) || ':' || CAST(season_number AS TEXT) = ANY(?))",
                          (chunk, kept))
        else:
            connector.run(f"DELETE FROM {table} WHERE show_id = ANY(?)", (chunk,))
        counts["shows"] += len(chunk)
        counts["rows"] += len(rows)
    return counts


def main(site: str = "rotten_tomatoes", show_ids: list = None, all_shows: bool = False):
    """Republish season rows: the given shows, or with all_shows every show with a season document."""
    from mongoengine import get_db
    from f.db.cratedb import CrateConnector
    from f.db.mongodb import close_mongodb, init_mongodb

    init_mongodb()
    connector = CrateConnector()
    try:
        db = get_db()
        ids = [int(show_id) for show_id in show_ids or []]
        if all_shows:
            ids = sorted(db[TABLES[site]["collection"]].distinct("tmdb_id"))
        counts = publish_seasons(db, connector, site, ids)
        connector.run(f"REFRESH TABLE {TABLES[site]['table']}")
        print(counts, flush=True)
        return counts
    finally:
        connector.disconnect()
        close_mongodb()
