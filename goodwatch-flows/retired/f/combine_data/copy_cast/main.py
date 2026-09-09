from datetime import datetime

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb, close_mongodb
from f.db.postgres import init_postgres, generate_upsert_query


BATCH_SIZE = 1000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_cast_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def copy_cast(pg):
    pg_cursor = pg.cursor()
    mongo_db = get_db()

    table_name = "cast"
    columns = [
        "id",
        "name",
        "original_name",
        "gender",
        "adult",
        "popularity",
        "profile_path",
        "known_for_department",
        "movie_characters",
        "movie_ids",
        "tv_characters",
        "tv_ids",
        "updated_at",
    ]

    # Get all unique cast IDs from both collections
    unique_movie_cast_ids = [
        doc["_id"]
        for doc in mongo_db.tmdb_movie_details.aggregate(
            [{"$unwind": "$credits.cast"}, {"$group": {"_id": "$credits.cast.id"}}]
        )
    ]
    unique_tv_cast_ids = [
        doc["_id"]
        for doc in mongo_db.tmdb_tv_details.aggregate(
            [
                {"$unwind": "$aggregate_credits.cast"},
                {"$group": {"_id": "$aggregate_credits.cast.id"}},
            ]
        )
    ]
    all_unique_cast_ids = list(set(unique_movie_cast_ids + unique_tv_cast_ids))
    total_count = len(all_unique_cast_ids)
    print(f"selected {total_count} cast members")

    # Aggregate and write to Postgres in batches
    for i in range(0, len(all_unique_cast_ids), BATCH_SIZE):
        print(f"processing {i} to {i + BATCH_SIZE} cast members")
        batch_ids = all_unique_cast_ids[i : i + BATCH_SIZE]

        # Aggregate movie data
        movie_cast_aggregation = mongo_db.tmdb_movie_details.aggregate(
            [
                {"$match": {"credits.cast.id": {"$in": batch_ids}}},
                {"$unwind": "$credits.cast"},
                {
                    "$group": {
                        "_id": "$credits.cast.id",
                        "cast_member": {"$first": "$credits.cast"},
                        "characters": {"$push": "$credits.cast.character"},
                        "movie_ids": {"$push": "$tmdb_id"},
                    }
                },
            ]
        )

        # Aggregate TV data
        tv_cast_aggregation = mongo_db.tmdb_tv_details.aggregate(
            [
                {"$match": {"aggregate_credits.cast.id": {"$in": batch_ids}}},
                {"$unwind": "$aggregate_credits.cast"},
                {"$unwind": "$aggregate_credits.cast.roles"},
                {
                    "$group": {
                        "_id": "$aggregate_credits.cast.id",
                        "cast_member": {"$first": "$aggregate_credits.cast"},
                        "characters": {
                            "$addToSet": "$aggregate_credits.cast.roles.character"
                        },
                        "tv_ids": {"$push": "$tmdb_id"},
                    }
                },
            ]
        )

        # Merge and prepare data for Postgres
        merged_cast_members = {}
        for cast in movie_cast_aggregation:
            merged_cast_members[cast["_id"]] = {
                "cast_member": cast["cast_member"],
                "movie_characters": cast["characters"],
                "movie_ids": cast["movie_ids"],
                "tv_characters": [],
                "tv_ids": [],
            }

        for cast in tv_cast_aggregation:
            if cast["_id"] in merged_cast_members:
                merged_cast_members[cast["_id"]]["tv_ids"] = cast["tv_ids"]
                merged_cast_members[cast["_id"]]["tv_characters"] = cast["characters"]
            else:
                merged_cast_members[cast["_id"]] = {
                    "cast_member": cast["cast_member"],
                    "movie_characters": [],
                    "movie_ids": [],
                    "tv_characters": cast["characters"],
                    "tv_ids": cast["tv_ids"],
                }

        date_now = datetime.utcnow()
        batch_data = []
        for cast_id, result in merged_cast_members.items():
            cast_member = result["cast_member"]
            batch_data.append(
                (
                    cast_id,
                    cast_member.get("name"),
                    cast_member.get("original_name"),
                    cast_member.get("gender"),
                    cast_member.get("adult", False),
                    cast_member.get("popularity"),
                    cast_member.get("profile_path"),
                    cast_member.get("known_for_department"),
                    list(set(result["movie_characters"])),
                    result["movie_ids"],
                    list(set(result["tv_characters"])),
                    result["tv_ids"],
                    date_now,
                )
            )

        # Insert into Postgres
        query = generate_upsert_query(table_name, columns)
        execute_values(pg_cursor, query, batch_data)
        pg.commit()

    pg_cursor.close()
    return {"total_count": total_count}


def main():
    init_mongodb()
    pg = init_postgres()
    result = copy_cast(pg)
    pg.close()
    close_mongodb()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    # init_postgres_tables(pg=pg)
    main()
    pg.close()
