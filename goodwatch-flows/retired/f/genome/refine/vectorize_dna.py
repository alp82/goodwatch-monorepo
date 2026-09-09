from f.db.postgres import init_postgres
from f.vector.save import create_embeddings

BATCH_SIZE = 100


def get_count(pg_cursor):
    count_sql = f"""
    SELECT COUNT(id)
    FROM dna
    WHERE label_vector_v2 IS NULL
    """
    pg_cursor.execute(count_sql)
    return pg_cursor.fetchone()[0]


def get_next_batch_of_dna_data(pg_cursor, last_id):
    fetch_dna_sql = f"""
    SELECT id, category, label
    FROM dna
    WHERE id > %s AND label_vector_v2 IS NULL
    ORDER BY id
    LIMIT %s;
    """
    pg_cursor.execute(fetch_dna_sql, (last_id, BATCH_SIZE))
    return pg_cursor.fetchall()


def update_dna_vectors(pg_cursor, embeddings):
    update_query = """
    UPDATE dna
    SET label_vector_v2 = %s
    WHERE id = %s;
    """
    data_to_update = [(embeddings[id], id) for id in embeddings]

    # Execute the batch update
    pg_cursor.executemany(update_query, data_to_update)


def create_dna_vectors(pg):
    pg_cursor = pg.cursor()

    count_dna = get_count(pg_cursor)
    print(f"Processing {count_dna} DNA's for vector generation...")

    start = 0
    last_id = 0
    total_count = 0

    while True:
        # Step 1: Fetch the next batch of dna data
        dna_data = get_next_batch_of_dna_data(pg_cursor, last_id)
        if not dna_data or len(dna_data) == 0:
            print(f"No more DNA data to process.")
            total_count = start
            break

        end = start + len(dna_data)
        print(f"Processing records from {start+1} to {end+1}...")
        start = end

        embeddings_input = {}
        for dna in dna_data:
            id, category, label = dna
            embeddings_input[id] = label

        try:
            # Step 2: Generate embeddings
            embeddings = create_embeddings(embeddings_input, version='v2')

            # Step 3: Update database with embeddings
            update_dna_vectors(pg_cursor, embeddings)
            pg.commit()
        except Exception as e:
            print(f"Error processing batch: {e}")
            pg.rollback()
            break

        # Update the last_id to fetch the next batch
        last_id = dna_data[-1][0]

    pg_cursor.close()
    return {"total_count": total_count}


def main():
    pg = init_postgres()
    try:
        result = create_dna_vectors(pg)
        print(f"Total records processed: {result['total_count']}")
    finally:
        pg.close()
    return result
