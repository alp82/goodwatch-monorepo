from datetime import datetime

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb, close_mongodb
from f.db.postgres import init_postgres, generate_upsert_query


BATCH_SIZE = 1000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_crew_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def copy_crew(pg):
    pg_cursor = pg.cursor()
    mongo_db = get_db()

    table_name = "crew"
    columns = [
        "id",
        "name",
        "original_name",
        "gender",
        "adult",
        "popularity",
        "profile_path",
        "known_for_department",
        "movie_jobs",
        "movie_ids",
        "tv_jobs",
        "tv_ids",
        "updated_at",
    ]

    # Get all unique crew IDs from both collections
    unique_movie_crew_ids = [
        doc["_id"]
        for doc in mongo_db.tmdb_movie_details.aggregate(
            [{"$unwind": "$credits.crew"}, {"$group": {"_id": "$credits.crew.id"}}]
        )
    ]
    unique_tv_crew_ids = [
        doc["_id"]
        for doc in mongo_db.tmdb_tv_details.aggregate(
            [
                {"$unwind": "$aggregate_credits.crew"},
                {"$group": {"_id": "$aggregate_credits.crew.id"}},
            ]
        )
    ]
    all_unique_crew_ids = list(set(unique_movie_crew_ids + unique_tv_crew_ids))
    total_count = len(all_unique_crew_ids)
    print(f"selected {total_count} crew members")

    # Aggregate and write to Postgres in batches
    for i in range(0, len(all_unique_crew_ids), BATCH_SIZE):
        print(f"processing {i} to {i + BATCH_SIZE} crew members")
        batch_ids = all_unique_crew_ids[i : i + BATCH_SIZE]

        # Aggregate movie data
        movie_crew_aggregation = mongo_db.tmdb_movie_details.aggregate(
            [
                {"$match": {"credits.crew.id": {"$in": batch_ids}}},
                {"$unwind": "$credits.crew"},
                {
                    "$group": {
                        "_id": "$credits.crew.id",
                        "crew_member": {"$first": "$credits.crew"},
                        "jobs": {"$push": "$credits.crew.job"},
                        "movie_ids": {"$push": "$tmdb_id"},
                    }
                },
            ]
        )

        # Aggregate TV data
        tv_crew_aggregation = mongo_db.tmdb_tv_details.aggregate(
            [
                {"$match": {"aggregate_credits.crew.id": {"$in": batch_ids}}},
                {"$unwind": "$aggregate_credits.crew"},
                {"$unwind": "$aggregate_credits.crew.jobs"},
                {
                    "$group": {
                        "_id": "$aggregate_credits.crew.id",
                        "crew_member": {"$first": "$aggregate_credits.crew"},
                        "jobs": {
                            "$addToSet": "$aggregate_credits.crew.jobs.job"
                        },
                        "tv_ids": {"$push": "$tmdb_id"},
                    }
                },
            ]
        )

        # Merge and prepare data for Postgres
        merged_crew_members = {}
        for crew in movie_crew_aggregation:
            merged_crew_members[crew["_id"]] = {
                "crew_member": crew["crew_member"],
                "movie_jobs": crew["jobs"],
                "movie_ids": crew["movie_ids"],
                "tv_jobs": [],
                "tv_ids": [],
            }

        for crew in tv_crew_aggregation:
            if crew["_id"] in merged_crew_members:
                merged_crew_members[crew["_id"]]["tv_ids"] = crew["tv_ids"]
                merged_crew_members[crew["_id"]]["tv_jobs"] = crew["jobs"]
            else:
                merged_crew_members[crew["_id"]] = {
                    "crew_member": crew["crew_member"],
                    "movie_jobs": [],
                    "movie_ids": [],
                    "tv_jobs": crew["jobs"],
                    "tv_ids": crew["tv_ids"],
                }

        date_now = datetime.utcnow()
        batch_data = []
        for crew_id, result in merged_crew_members.items():
            crew_member = result["crew_member"]
            batch_data.append(
                (
                    crew_id,
                    crew_member.get("name"),
                    crew_member.get("original_name"),
                    crew_member.get("gender"),
                    crew_member.get("adult", False),
                    crew_member.get("popularity"),
                    crew_member.get("profile_path"),
                    crew_member.get("known_for_department"),
                    list(set(result["movie_jobs"])),
                    result["movie_ids"],
                    list(set(result["tv_jobs"])),
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
    result = copy_crew(pg)
    pg.close()
    close_mongodb()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    init_postgres_tables(pg=pg)
    main()
    pg.close()
