import psycopg2
import wmill

def init_postgres():
    print(f"Initializing postregsql...")
    db_name = wmill.get_variable("u/Alp/POSTGRES_DB")
    db_host = wmill.get_variable("u/Alp/POSTGRES_HOST")
    db_port = int(wmill.get_variable("u/Alp/POSTGRES_PORT"))
    db_user = wmill.get_variable("u/Alp/POSTGRES_USER")
    db_pass = wmill.get_variable("u/Alp/POSTGRES_PASS")
    try:
        connection = psycopg2.connect(
            database=db_name,
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
        )
        print(f"Successfully initialized postregsql")
        return connection
    except Exception as error:
        print(f"Failed postregsql initialization: ", error)


def generate_upsert_query(table_name, columns):
    columns_str = ", ".join(columns)

    unique_column, *other_columns = columns 
    update_str = ", ".join([f"{col} = EXCLUDED.{col}" for col in other_columns])

    query = f"""
        INSERT INTO {table_name} ({columns_str})
        VALUES %s
        ON CONFLICT ({unique_column}) DO UPDATE SET {update_str}
    """
    return query

    """
    TODO
    SPLIT
    UPSERT
    
    # Step 1: Insert new records, skip existing ones
    insert_query = ""
    INSERT
    INTO
    movies(
        tmdb_id, original_title, synopsis, genres,
        imdb_user_score, metacritic_user_score,
        rotten_tomatoes_audience_score, trope_names
    )
    VALUES % s
    ON
    CONFLICT(tmdb_id)
    DO
    NOTHING
    ""
    execute_values(pg_cursor, insert_query, aggregated_data)
    pg.commit()
    
    # Step 2: Find out which records were not inserted
    tmdb_ids = [data[0] for data in aggregated_data]
    select_query = "SELECT tmdb_id FROM movies WHERE tmdb_id IN %s"
    pg_cursor.execute(select_query, (tuple(tmdb_ids),))
    inserted_ids = [record[0] for record in pg_cursor.fetchall()]
    
    # Get the list of tmdb_ids that were not inserted
    not_inserted_ids = set(tmdb_ids) - set(inserted_ids)
    
    # Step 3: Prepare data for updating
    update_data = [data for data in aggregated_data if data[0] in not_inserted_ids]
    
    # Step 4: Batch update
    update_query = ""
    UPDATE
    movies
    SET
    original_title = data.original_title,
    synopsis = data.synopsis,
    genres = data.genres,
    imdb_user_score = data.imdb_user_score,
    metacritic_user_score = data.metacritic_user_score,
    rotten_tomatoes_audience_score = data.rotten_tomatoes_audience_score,
    trope_names = data.trope_names
    FROM(VALUES % s)
    AS
    data(
        tmdb_id, original_title, synopsis, genres,
        imdb_user_score, metacritic_user_score,
        rotten_tomatoes_audience_score, trope_names
    )
    WHERE
    movies.tmdb_id = data.tmdb_id
    ""
    execute_values(pg_cursor, update_query, update_data)
    pg.commit()
    
    print(f"Inserted: {len(inserted_ids)}, Updated: {len(not_inserted_ids)}")
    """


def main():
    pass
