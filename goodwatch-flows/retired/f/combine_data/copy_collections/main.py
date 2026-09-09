from datetime import datetime

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb, close_mongodb
from f.db.postgres import init_postgres, generate_upsert_query


BATCH_SIZE = 1000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_collections_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def copy_collections(pg):
    pg_cursor = pg.cursor()
    mongo_db = get_db()

    table_name = "collections"
    columns = [
        "id",
        "name",
        "poster_path",
        "backdrop_path",
        "tmdb_ids",
        "updated_at",
    ]

    unique_collections = mongo_db.tmdb_movie_details.aggregate([
        {"$match": {"belongs_to_collection.id": {"$ne": None}}},
        {"$group": {
            "_id": "$belongs_to_collection.id",
            "collection": {"$first": "$belongs_to_collection"},
            "tmdb_ids": {"$push": "$tmdb_id"}
        }}
    ])

    batch_data = []
    for result in unique_collections:
        collection = result["collection"]
        batch_data.append((
            collection.get('id'),
            collection.get('name'),
            collection.get('poster_path'),
            collection.get('backdrop_path'),
            result['tmdb_ids'],
            datetime.utcnow()
        ))

    for i in range(0, len(batch_data), BATCH_SIZE):
        batch = batch_data[i:i + BATCH_SIZE]
        query = generate_upsert_query(table_name, columns)
        execute_values(pg_cursor, query, batch)
        pg.commit()

    pg_cursor.close()
    return {
        "total_count": len(batch_data)
    }


def main():
    init_mongodb()
    pg = init_postgres()
    result = copy_collections(pg)
    pg.close()
    close_mongodb()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    # init_postgres_tables(pg=pg)
    main()
    pg.close()
