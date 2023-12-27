from datetime import datetime

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres, generate_insert_query


BATCH_SIZE = 50000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_streaming_provider_links_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def copy_streaming_provider_links(
    pg_cursor, media_type, mongo_collection, query_selector: dict = {}
):
    mongo_db = get_db()

    # read provider id's and names
    query = """
    SELECT DISTINCT ON (name) id, name
    FROM streaming_providers
    ORDER BY name, id;
    """
    pg_cursor.execute(query)
    rows = pg_cursor.fetchall()
    provider_lookup = {row[1]: row[0] for row in rows}

    table_name = "streaming_provider_links"
    columns = [
        "tmdb_id",
        "tmdb_url",
        "media_type",
        "provider_id",
        "country_code",
        "stream_url",
        "stream_type",
        "price_dollar",
        "quality",
        "display_priority",
        "updated_at",
    ]

    with_streaming_links = {"streaming_links": {"$exists": True, "$ne": []}}
    query = with_streaming_links | query_selector
    count = mongo_db[mongo_collection].count_documents(query)
    print(f"found {count} streaming providers with one or more links to copy")

    for i in range(0, count, BATCH_SIZE):
        end = min(count, i + BATCH_SIZE)
        print(f"processing {i} to {end} streaming provider links")
        providers = (
            mongo_db[mongo_collection]
            .find(query)
            .skip(i)
            .limit(BATCH_SIZE)
        )
        now = datetime.utcnow()

        batch_data = []
        for provider in providers:
            tmdb_id = provider.get("tmdb_id")
            country_code = provider.get("country_code")
            display_priority = 1
            for streaming_link in provider.get("streaming_links", []):
                provider_name = streaming_link.get("provider_name")
                provider_id = provider_lookup.get(provider_name)

                if provider_id:
                    batch_data.append(
                        (
                            tmdb_id,
                            provider.get("tmdb_watch_url"),
                            media_type,
                            provider_lookup[provider_name],
                            country_code,
                            streaming_link.get("stream_url"),
                            streaming_link.get("stream_type"),
                            streaming_link.get("price_dollar"),
                            streaming_link.get("quality", ""),
                            display_priority,
                            now,
                        )
                    )
                    display_priority += 1
                else:
                    # print(f"provider with name '{provider_name}' not found!")
                    pass

        query = generate_insert_query(table_name, columns)
        execute_values(pg_cursor, query, batch_data)

    return count


def main():
    init_mongodb()
    pg = init_postgres()
    pg_cursor = pg.cursor()

    table_name = "streaming_provider_links"
    pg_cursor.execute("BEGIN")
    pg_cursor.execute(f"TRUNCATE TABLE {table_name}")

    total_movie_count = copy_streaming_provider_links(
        pg_cursor, "movie", "tmdb_movie_providers"
    )
    total_tv_count = copy_streaming_provider_links(pg_cursor, "tv", "tmdb_tv_providers")

    pg.commit()
    pg_cursor.close()
    pg.close()
    return {"total_movie_count": total_movie_count, "total_tv_count": total_tv_count}


if __name__ == "__main__":
    pg = init_postgres()
    init_postgres_tables(pg=pg)
    main()
    pg.close()
