from collections import defaultdict

from f.db.postgres import init_postgres


BATCH_SIZE = 1000


def get_next_batch_of_tmdb_ids(pg_cursor, media_type, last_id):
    # SQL to get the next batch of tmdb_id's for a specific media_type, starting after the last_id
    fetch_ids_sql = """
    SELECT DISTINCT tmdb_id
    FROM streaming_provider_links
    WHERE tmdb_id > %s AND media_type = %s
    ORDER BY tmdb_id
    LIMIT %s;
    """
    pg_cursor.execute(fetch_ids_sql, (last_id, media_type, BATCH_SIZE))
    return [row[0] for row in pg_cursor.fetchall()]


def fetch_country_codes_for_ids(pg_cursor, media_type, tmdb_ids):
    # SQL to fetch distinct country codes for a list of tmdb_id's within a specific media_type
    fetch_countries_sql = """
    SELECT tmdb_id, country_code
    FROM streaming_provider_links
    WHERE tmdb_id = ANY(%s) AND media_type = %s
    GROUP BY tmdb_id, country_code
    ORDER BY tmdb_id, country_code;
    """
    pg_cursor.execute(fetch_countries_sql, (tmdb_ids, media_type))
    return pg_cursor.fetchall()


def batch_update_streaming_country_codes(pg_cursor, media_type, updates):
    """
    Batch update streaming_country_codes.

    Parameters:
    - cursor: The database cursor.
    - media_type: 'movie' or 'tv', indicating the table to update.
    - updates: A list of tuples, where each tuple contains (tmdb_id, country_codes),
               and country_codes is a list of country codes.
    """
    # Determine the correct table based on media_type
    table_name = "movies" if media_type == "movie" else "tv"

    # Constructing the VALUES list for the update
    values = ",".join(
        pg_cursor.mogrify("(%s,%s)", (tmdb_id, country_codes)).decode("utf-8")
        for tmdb_id, country_codes in updates
    )

    # SQL to batch update the streaming_country_codes column
    batch_update_sql = f"""
    UPDATE {table_name}
    SET streaming_country_codes = data.country_codes
    FROM (VALUES {values}) AS data(tmdb_id, country_codes)
    WHERE {table_name}.tmdb_id = data.tmdb_id;
    """

    pg_cursor.execute(batch_update_sql)


# def update_streaming_country_codes(pg_cursor, media_type, tmdb_id, country_codes):
#    # Determine the correct table based on media_type
#    table_name = "movies" if media_type == "movie" else "tv"
#
#    # SQL to update the streaming_country_codes column for a given tmdb_id
#    update_sql = f"""
#    UPDATE {table_name}
#    SET streaming_country_codes = %s
#    WHERE tmdb_id = %s;
#    """
#    pg_cursor.execute(update_sql, (country_codes, tmdb_id))


def copy_streaming_countries(pg):
    pg_cursor = pg.cursor()

    media_types = ["movie", "tv"]
    counts = {}
    for media_type in media_types:
        print(f"Processing {media_type}...")
        start = 0
        last_id = 0  # Initialize the last_id with 0 to start from the beginning

        while True:
            # Step 1: Get the next batch of tmdb_id's for the current media_type
            tmdb_ids = get_next_batch_of_tmdb_ids(pg_cursor, media_type, last_id)

            if not tmdb_ids:
                print(f"No more TMDB IDs to process for {media_type}.")
                counts[media_type] = start
                break  # Exit the loop if no more IDs are found

            end = start + len(tmdb_ids)
            print(
                f"processing {media_type} {start} to {end} to update streaming countries"
            )
            start = end

            # Step 2: Fetch distinct country codes for each tmdb_id within the current media_type
            results = fetch_country_codes_for_ids(pg_cursor, media_type, tmdb_ids)
            countries_by_tmdb_id = defaultdict(list)
            for row in results:
                countries_by_tmdb_id[row[0]].append(row[1])

            updates = [
                (tmdb_id, country_codes)
                for tmdb_id, country_codes in countries_by_tmdb_id.items()
            ]
            if updates:
                batch_update_streaming_country_codes(pg_cursor, media_type, updates)
                pg.commit()

            # for tmdb_id, country_codes in countries_by_tmdb_id.items():
            #    # Update the relevant table with the aggregated country codes
            #    print(f"TMDB ID: {tmdb_id}, Country Codes: {len(country_codes)}")
            #    update_streaming_country_codes(pg_cursor, media_type, tmdb_id, country_codes)
            # pg.commit()

            # Update the last_id for the next iteration
            last_id = tmdb_ids[-1]

    pg_cursor.close()
    return {"total_counts": counts}


def main():
    pg = init_postgres()
    result = copy_streaming_countries(pg)
    pg.close()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    main()
    pg.close()
