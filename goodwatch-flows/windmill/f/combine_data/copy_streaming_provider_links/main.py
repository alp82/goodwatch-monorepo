# extra_requirements:
# pymongo==4.8.0

from datetime import datetime
import gc
from mongoengine import get_db
from psycopg2.extras import execute_batch, execute_values

from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres, generate_insert_query

BATCH_SIZE = 5000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()
    with open("./create_streaming_provider_links_table.pg.sql", "r") as f:
        create_table_query = f.read()
    pg_cursor.execute(create_table_query)
    pg.commit()


def process_link(
    key,
    existing_entry,
    new_entry_data,
    batch_update_data,
    batch_insert_data,
    display_priority,
    now,
):
    """
    Processes a single link, deciding whether to update or insert.
    """
    if existing_entry:
        # Determine if an update is needed
        needs_update = (
            existing_entry["price_dollar"] != new_entry_data["price_dollar"]
            or existing_entry["quality"] != new_entry_data["quality"]
            or existing_entry["obsolete_at"] is not None
        )
        if needs_update:
            # Prepare data for update
            batch_update_data.append(
                {
                    "updated_at": now,
                    "price_dollar": new_entry_data["price_dollar"],
                    "quality": new_entry_data["quality"],
                    "obsolete_at": None,  # Reactivate if obsolete
                    "tmdb_id": key["tmdb_id"],
                    "provider_id": key["provider_id"],
                    "country_code": key["country_code"],
                    "stream_type": key["stream_type"],
                }
            )
        return "update"
    else:
        # Prepare data for insert
        batch_insert_data.append(
            (
                key["tmdb_id"],
                new_entry_data["tmdb_url"],
                key["media_type"],
                key["provider_id"],
                key["country_code"],
                new_entry_data["stream_url"],
                key["stream_type"],
                new_entry_data["price_dollar"],
                new_entry_data["quality"],
                display_priority,
                now,  # updated_at
                None,  # obsolete_at
            )
        )
        return "insert"


def copy_streaming_provider_links(
    pg, media_type, mongo_collection, details_collection, query_selector: dict = {}
):
    mongo_db = get_db()
    pg_cursor = pg.cursor()

    # Read provider IDs and names
    pg_cursor.execute("""
        SELECT id, name
        FROM streaming_providers;
    """)
    provider_rows = pg_cursor.fetchall()
    provider_lookup = {name: id for id, name in provider_rows}

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
        "obsolete_at",
    ]  # 'created_at' removed since it defaults to NOW()

    count = mongo_db[mongo_collection].count_documents(query_selector)

    if count:
        print(f"Found {count} streaming links to copy.")
    else:
        print("No streaming links found.")
        print(f"Query: {query_selector}")
        return 0

    for i in range(0, count, BATCH_SIZE):
        end = min(count, i + BATCH_SIZE)
        print(f"Processing records {i} to {end}...")
        providers = list(
            mongo_db[mongo_collection].find(query_selector).skip(i).limit(BATCH_SIZE)
        )
        now = datetime.utcnow()

        # Collect tmdb_ids for fetching existing links and details
        tmdb_ids = [p.get("tmdb_id") for p in providers]

        # Fetch existing streaming links from the database
        placeholders = ",".join(["%s"] * len(tmdb_ids))
        pg_cursor.execute(
            f"""
            SELECT
                tmdb_id,
                media_type,
                provider_id,
                country_code,
                stream_type,
                price_dollar,
                quality,
                obsolete_at
            FROM {table_name}
            WHERE tmdb_id IN ({placeholders})
            AND media_type = %s;
        """,
            tmdb_ids + [media_type],
        )
        existing_links = pg_cursor.fetchall()
        print(f"  Fetched {len(existing_links)} streaming links rows from target table")

        # Build a dictionary for existing links
        existing_links_dict = {}
        for row in existing_links:
            (
                tmdb_id,
                media_type,
                provider_id,
                country_code,
                stream_type,
                price_dollar,
                quality,
                obsolete_at,
            ) = row
            key = {
                "tmdb_id": tmdb_id,
                "media_type": media_type,
                "provider_id": provider_id,
                "country_code": country_code,
                "stream_type": stream_type,
            }
            existing_links_dict[tuple(key.items())] = {
                "price_dollar": price_dollar,
                "quality": quality,
                "obsolete_at": obsolete_at,
            }

        # Fetch details documents for these tmdb_ids
        details_docs = mongo_db[details_collection].find({"tmdb_id": {"$in": tmdb_ids}})
        tmdb_id_to_details = {doc["tmdb_id"]: doc for doc in details_docs}
        print(
            f"  Fetched {len(tmdb_id_to_details.keys())} docs from details collection"
        )

        batch_update_data = []
        batch_insert_data = []
        batch_obsolete_links = []

        try:
            # Begin transaction for this batch
            pg_cursor.execute("BEGIN")

            for provider in providers:
                tmdb_id = provider.get("tmdb_id")
                country_code = provider.get("country_code")
                display_priority = 1

                # print(f"    Start processing {tmdb_id} in {country_code}")

                # Existing entries from the database for this tmdb_id and media_type
                existing_entries_keys = {
                    key
                    for key in existing_links_dict
                    if key[0][0] == tmdb_id and key[0][1] == media_type
                }

                # New links from the provider collection
                new_links_keys = set()

                # Existing streaming links from the provider collection
                provider_streaming_links = provider.get("streaming_links", [])
                # Get streaming links from provider and details collections
                provider_links = []
                details_links = []

                # Add links from provider collection
                for link in provider_streaming_links:
                    provider_name = link.get("provider_name")
                    provider_id = provider_lookup.get(provider_name)
                    if not provider_id:
                        continue  # Skip if provider_id not found

                    key = {
                        "tmdb_id": tmdb_id,
                        "media_type": media_type,
                        "provider_id": provider_id,
                        "country_code": country_code,
                        "stream_type": link.get("stream_type"),
                    }
                    new_entry_data = {
                        "tmdb_url": provider.get("tmdb_watch_url"),
                        "price_dollar": link.get("price_dollar"),
                        "quality": link.get("quality", ""),
                        "stream_url": link.get("stream_url"),
                    }
                    provider_links.append((key, new_entry_data))

                # print(f"    Found {len(provider_links)} links from provider collection")

                # Add links from details collection (if not already in provider links)
                details_doc = tmdb_id_to_details.get(tmdb_id)
                if details_doc:
                    watch_providers = details_doc.get("watch_providers", {})
                    results = watch_providers.get("results", {})
                    country_data = results.get(country_code, {})
                    if country_data:
                        tmdb_url = country_data.pop(
                            "link", provider.get("tmdb_watch_url")
                        )
                        for stream_type, providers_list in country_data.items():
                            for p_info in providers_list:
                                provider_name = p_info.get("provider_name")
                                provider_id = provider_lookup.get(provider_name)
                                if not provider_id:
                                    continue  # Skip if provider_id not found

                                # Skip if this link already exists in provider links
                                if any(
                                    link[0]["provider_id"] == provider_id
                                    and link[0]["stream_type"] == stream_type
                                    for link in provider_links
                                ):
                                    continue

                                key = {
                                    "tmdb_id": tmdb_id,
                                    "media_type": media_type,
                                    "provider_id": provider_id,
                                    "country_code": country_code,
                                    "stream_type": stream_type,
                                }
                                new_entry_data = {
                                    "tmdb_url": tmdb_url,
                                    "price_dollar": None,
                                    "quality": "",
                                    "stream_url": "",  # No stream_url for details links
                                }
                                details_links.append((key, new_entry_data))

                # print(f"    Found {len(details_links)} additional links from details collection")

                # Process all collected links
                all_links = provider_links + details_links
                for key, new_entry_data in all_links:
                    key_tuple = tuple(key.items())
                    existing_entry = existing_links_dict.get(key_tuple)
                    action = process_link(
                        key,
                        existing_entry,
                        new_entry_data,
                        batch_update_data,
                        batch_insert_data,
                        display_priority,
                        now,
                    )
                    if action:
                        new_links_keys.add(key_tuple)
                        # Remove from existing_entries_keys to avoid marking as obsolete
                        existing_entries_keys.discard(key_tuple)
                        display_priority += 1

                # print(f"    Marked {len(new_links_keys)} actions to insert new links into target table")

                # Any remaining entries in existing_entries_keys are obsolete
                for obsolete_key in existing_entries_keys:
                    key_dict = dict(obsolete_key)
                    batch_obsolete_links.append(
                        {
                            "obsolete_at": now,
                            "tmdb_id": key_dict["tmdb_id"],
                            "provider_id": key_dict["provider_id"],
                            "country_code": key_dict["country_code"],
                            "stream_type": key_dict["stream_type"],
                        }
                    )

                # print(f"    Marked {len(existing_entries_keys)} links as obsolete in the target table for tmdb_id {tmdb_id}")

            print("")

            # Update existing links
            if batch_update_data:
                print(f"  Updating {len(batch_update_data)} existing links...")
                update_query = f"""
                    UPDATE {table_name}
                    SET updated_at = %(updated_at)s,
                        price_dollar = %(price_dollar)s,
                        quality = %(quality)s,
                        obsolete_at = %(obsolete_at)s
                    WHERE tmdb_id = %(tmdb_id)s
                      AND provider_id = %(provider_id)s
                      AND country_code = %(country_code)s
                      AND stream_type = %(stream_type)s;
                """
                execute_batch(pg_cursor, update_query, batch_update_data)

            # Mark obsolete links
            if batch_obsolete_links:
                print(f"  Setting {len(batch_obsolete_links)} links to obsolete...")
                obsolete_query = f"""
                    UPDATE {table_name}
                    SET obsolete_at = %(obsolete_at)s
                    WHERE tmdb_id = %(tmdb_id)s
                      AND provider_id = %(provider_id)s
                      AND country_code = %(country_code)s
                      AND stream_type = %(stream_type)s;
                """
                execute_batch(pg_cursor, obsolete_query, batch_obsolete_links)

            # Insert new links
            if batch_insert_data:
                print(f"  Inserting {len(batch_insert_data)} new links...")
                insert_query = generate_insert_query(table_name, columns)
                execute_values(pg_cursor, insert_query, batch_insert_data)

            # Commit the transaction for this batch
            pg_cursor.execute("COMMIT")

            print("------------------")

            # Clear batch-specific data structures
            batch_update_data.clear()
            batch_insert_data.clear()
            batch_obsolete_links.clear()

            # Reinitialize or clear other large objects
            existing_links_dict = {}
            tmdb_id_to_details = {}
            
            # Collect garbage
            gc.collect()

        except Exception as e:
            # Rollback transaction in case of error
            pg_cursor.execute("ROLLBACK")
            print(f"Error occurred during batch processing: {e}")
            # Optionally log or handle the error further

    pg_cursor.close()
    return count


def main():
    init_mongodb()
    pg = init_postgres()

    total_movie_count = copy_streaming_provider_links(
        pg,
        "movie",
        "tmdb_movie_providers",
        "tmdb_movie_details",
    )
    total_tv_count = copy_streaming_provider_links(
        pg,
        "tv",
        "tmdb_tv_providers",
        "tmdb_tv_details",
    )

    pg.close()
    return {
        "total_movie_count": total_movie_count,
        "total_tv_count": total_tv_count,
    }


if __name__ == "__main__":
    main()
