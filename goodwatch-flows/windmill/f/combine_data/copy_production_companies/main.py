from datetime import datetime

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres, generate_upsert_query


BATCH_SIZE = 10000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_production_companies_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def copy_production_companies(pg):
    pg_cursor = pg.cursor()
    mongo_db = get_db()

    table_name = "production_companies"
    columns = [
        "id",
        "name",
        "logo_path",
        "origin_country",
        "movie_ids",
        "tv_ids",
        "updated_at",
    ]

    unique_movie_production_companies = mongo_db.tmdb_movie_details.aggregate([
        {"$match": {"production_companies.id": {"$ne": None}}},
        {"$unwind": "$production_companies"},
        {"$group": {
            "_id": "$production_companies.id",
            "production_company": {"$first": "$production_companies"},
            "movie_ids": {"$push": "$tmdb_id"},
        }}
    ])

    unique_tv_production_companies = mongo_db.tmdb_tv_details.aggregate([
        {"$match": {"production_companies.id": {"$ne": None}}},
        {"$unwind": "$production_companies"},
        {"$group": {
            "_id": "$production_companies.id",
            "production_company": {"$first": "$production_companies"},
            "tv_ids": {"$push": "$tmdb_id"},
        }}
    ])

    merged_production_companies = {}

    # Process movie production companies
    for result in unique_movie_production_companies:
        production_company = result["production_company"]
        company_id = production_company.get('id')
        merged_production_companies[company_id] = {
            'production_company': production_company,
            'movie_ids': result['movie_ids'],
            'tv_ids': [],
        }

    # Process TV production companies
    for result in unique_tv_production_companies:
        production_company = result["production_company"]
        company_id = production_company.get('id')
        if company_id in merged_production_companies:
            merged_production_companies[company_id]['tv_ids'] = result['tv_ids']
        else:
            merged_production_companies[company_id] = {
                'production_company': production_company,
                'movie_ids': [],
                'tv_ids': result['tv_ids'],
            }

    print(f"selected {len(merged_production_companies.keys())} production_companies")

    # Prepare batch data
    batch_data = []
    for company_id, result in merged_production_companies.items():
        production_company = result['production_company']
        batch_data.append((
            company_id,
            production_company.get('name'),
            production_company.get('logo_path'),
            production_company.get('origin_country'),
            result['movie_ids'],
            result['tv_ids'],
            datetime.utcnow(),
        ))

    for i in range(0, len(batch_data), BATCH_SIZE):
        print(f"processing {i} to {i + BATCH_SIZE} production companies")
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
    result = copy_production_companies(pg)
    pg.close()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    init_postgres_tables(pg=pg)
    main()
    pg.close()
