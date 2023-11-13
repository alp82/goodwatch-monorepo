from datetime import datetime

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres, generate_upsert_query


BATCH_SIZE = 100


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_streaming_providers_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def copy_streaming_providers(pg):
    pg_cursor = pg.cursor()
    mongo_db = get_db()

    table_name = "streaming_providers"
    columns = [
        "id",
        "name",
        "logo_path",
        "display_priority",
        "updated_at",
    ]

    pipeline = [
        {"$match": {"watch_providers.results": {"$exists": True, "$ne": {}}}},
        {"$project": {
            "tmdb_id": 1,
            "watch_providers": {
                "$objectToArray": "$watch_providers.results"
            }
        }},
        {"$unwind": "$watch_providers"},
        {"$project": {
            "tmdb_id": 1,
            "all_providers": {
                "$concatArrays": [
                    "$watch_providers.v.buy",
                    "$watch_providers.v.rent",
                    "$watch_providers.v.ads",
                    "$watch_providers.v.free",
                    "$watch_providers.v.flatrate",
                    "$watch_providers.v.flatrate_and_buy"
                ]
            }
        }},
        {"$unwind": "$all_providers"},
        {"$group": {
            "_id": "$all_providers.provider_id",
            "provider": {"$first": "$all_providers"},
        }}
    ]
    unique_watch_providers = mongo_db.tmdb_movie_details.aggregate(pipeline)

    now = datetime.utcnow()
    batch_data = []
    for result in unique_watch_providers:
        provider = result["provider"]
        batch_data.append((
            provider.get('provider_id'),
            provider.get('provider_name'),
            provider.get('logo_path'),
            provider.get('display_priority'),
            now
        ))

    print(f"selected {len(batch_data)} streaming providers")

    for i in range(0, len(batch_data), BATCH_SIZE):
        print(f"processing {i} to {i + BATCH_SIZE} streaming providers")
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
    result = copy_streaming_providers(pg)
    pg.close()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    init_postgres_tables(pg=pg)
    main()
    pg.close()
