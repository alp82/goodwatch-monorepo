from collections import defaultdict
from f.db.postgres import init_postgres

BATCH_SIZE = 20000


def reset_dna_table(pg_cursor):
    reset_sql = """
    UPDATE dna
    SET count_all = 0,
        count_movies = 0,
        count_tv = 0,
        movie_tmdb_id = '{}',
        tv_tmdb_id = '{}',
        updated_at = CURRENT_TIMESTAMP;
    """
    pg_cursor.execute(reset_sql)


def get_next_batch_of_dna_data(pg_cursor, media_type, last_id):
    table_name = "movies" if media_type == "movie" else "tv"
    fetch_dna_sql = f"""
    SELECT tmdb_id, dna
    FROM {table_name}
    WHERE tmdb_id > %s
    ORDER BY tmdb_id
    LIMIT %s;
    """
    pg_cursor.execute(fetch_dna_sql, (last_id, BATCH_SIZE))
    return pg_cursor.fetchall()


def prepare_dna_inserts(data, media_type):
    dna_inserts = []
    count_all_increment = defaultdict(int)
    count_movies_increment = defaultdict(int)
    count_tv_increment = defaultdict(int)
    tmdb_id_list = defaultdict(lambda: {"movie": [], "tv": []})

    for tmdb_id, dna_data in data:
        for category, values in dna_data.items():
            for value in values:
                key = (category, value)
                count_all_increment[key] += 1
                if media_type == "movie":
                    count_movies_increment[key] += 1
                else:
                    count_tv_increment[key] += 1
                tmdb_id_list[key][media_type].append(tmdb_id)

    for (category, value), count_all in count_all_increment.items():
        count_movies = count_movies_increment[(category, value)]
        count_tv = count_tv_increment[(category, value)]
        movie_tmdb_ids = tmdb_id_list[(category, value)]["movie"]
        tv_tmdb_ids = tmdb_id_list[(category, value)]["tv"]
        dna_inserts.append(
            (
                category,
                value,
                count_all,
                count_movies,
                count_tv,
                movie_tmdb_ids,
                tv_tmdb_ids,
            )
        )

    return dna_inserts


def batch_upsert_dna(pg_cursor, dna_inserts):
    upsert_sql = """
    INSERT INTO dna (category, label, count_all, count_movies, count_tv, movie_tmdb_id, tv_tmdb_id, created_at, updated_at)
    VALUES %s
    ON CONFLICT (category, label)
    DO UPDATE SET
        count_all = dna.count_all + EXCLUDED.count_all,
        count_movies = dna.count_movies + EXCLUDED.count_movies,
        count_tv = dna.count_tv + EXCLUDED.count_tv,
        movie_tmdb_id = array_cat(dna.movie_tmdb_id, EXCLUDED.movie_tmdb_id),
        tv_tmdb_id = array_cat(dna.tv_tmdb_id, EXCLUDED.tv_tmdb_id),
        updated_at = CURRENT_TIMESTAMP;
    """
    values = [
        pg_cursor.mogrify(
            "(%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", row
        ).decode("utf-8")
        for row in dna_inserts
    ]
    pg_cursor.execute(upsert_sql % ",".join(values))


def copy_dna_data(pg):
    pg_cursor = pg.cursor()

    try:
        # Begin transaction
        pg_cursor.execute("BEGIN;")
        
        # Step 0: Reset all counts and tmdb_id arrays at the beginning
        print("Resetting dna table counts and tmdb_id arrays...")
        reset_dna_table(pg_cursor)

        media_types = ["movie", "tv"]
        counts = {}

        for media_type in media_types:
            print(f"Processing {media_type}...")
            start = 0
            last_id = 0  # Start from the beginning

            while True:
                # Step 1: Fetch the next batch of dna data
                dna_data = get_next_batch_of_dna_data(pg_cursor, media_type, last_id)
                if not dna_data:
                    print(f"No more data to process for {media_type}.")
                    counts[media_type] = start
                    break

                end = start + len(dna_data)
                print(f"Processing {media_type} {start} to {end} records...")
                start = end

                # Step 2: Prepare the batch of dna inserts
                dna_inserts = prepare_dna_inserts(dna_data, media_type)

                # Step 3: Execute the batch upsert
                batch_upsert_dna(pg_cursor, dna_inserts)

                # Update the last_id for the next iteration
                last_id = dna_data[-1][0]

        # Commit transaction after all data processing
        pg_cursor.execute("COMMIT;")
        
    except Exception as e:
        print("Error encountered, rolling back transaction:", e)
        pg_cursor.execute("ROLLBACK;")
        raise  # Re-raise the exception after rollback
    
    finally:
        pg_cursor.close()
    return {"total_counts": counts}


def main():
    pg = init_postgres()
    result = copy_dna_data(pg)
    pg.close()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    main()
    pg.close()
