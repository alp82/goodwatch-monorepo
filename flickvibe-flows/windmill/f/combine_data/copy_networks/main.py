from datetime import datetime

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres, generate_upsert_query


BATCH_SIZE = 1000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_networks_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def copy_networks(pg):
    pg_cursor = pg.cursor()
    mongo_db = get_db()

    table_name = "networks"
    columns = [
        "id",
        "name",
        "logo_path",
        "origin_country",
        "tv_ids",
        "updated_at",
    ]

    unique_networks = mongo_db.tmdb_tv_details.aggregate([
        {"$match": {"networks.id": {"$ne": None}}},
        {"$unwind": "$networks"},
        {"$group": {
            "_id": "$networks.id",
            "network": {"$first": "$networks"},
            "tv_ids": {"$push": "$tmdb_id"}
        }}
    ])

    batch_data = []
    for result in unique_networks:
        network = result["network"]
        batch_data.append((
            network.get('id'),
            network.get('name'),
            network.get('logo_path'),
            network.get('origin_country'),
            result['tv_ids'],
            datetime.utcnow()
        ))

    print(f"selected {len(batch_data)} networks")

    for i in range(0, len(batch_data), BATCH_SIZE):
        print(f"processing {i} to {i + BATCH_SIZE} networks")
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
    result = copy_networks(pg)
    pg.close()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    init_postgres_tables(pg=pg)
    main()
    pg.close()
