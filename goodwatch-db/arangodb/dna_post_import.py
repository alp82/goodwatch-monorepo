"""
Script to update DNA nodes in ArangoDB with label_vector_v2 values from Postgres after import.
"""
import os
import psycopg2
from dotenv import load_dotenv
from arango import ArangoClient
from utils.key_generators import make_dna_key

load_dotenv()

# --- CONFIG ---
POSTGRES = {
    'database': os.environ.get('POSTGRES_DB'),
    'user': os.environ.get('POSTGRES_USER'),
    'password': os.environ.get('POSTGRES_PASS'),
    'host': os.environ.get('POSTGRES_HOST'),
    'port': os.environ.get('POSTGRES_PORT', 5432),
}
ARANGO = {
    'host': os.environ.get('ARANGO_HOST', 'http://localhost:8529'),
    'db': os.environ.get('ARANGO_DB', 'goodwatch2'),
    'username': os.environ.get('ARANGO_USER', ''),
    'password': os.environ.get('ARANGO_PASS', ''),
}

# --- STEP 1: Get all unique (category, label) pairs from ArangoDB ---
def get_dna_pairs_from_arango():
    client = ArangoClient()
    db = client.db(ARANGO['db'], username=ARANGO['username'], password=ARANGO['password'])
    cursor = db.aql.execute('FOR d IN dna RETURN {category: d.category, label: d.label}')
    return set((d['category'], d['label']) for d in cursor)

# --- STEP 2: Fetch vectors from Postgres for these pairs ---
def fetch_vectors_from_postgres(pairs):
    conn = psycopg2.connect(**POSTGRES)
    cur = conn.cursor()
    # Prepare query with tuple list
    params = []
    where_clauses = []
    for i, (cat, lbl) in enumerate(pairs):
        params += [cat, lbl]
        where_clauses.append(f"(category = %s AND label = %s)")
    sql = f"SELECT category, label, label_vector_v2 FROM dna WHERE {' OR '.join(where_clauses)}"
    cur.execute(sql, params)
    results = cur.fetchall()
    cur.close()
    conn.close()
    return results

# --- STEP 3: Update ArangoDB dna nodes ---
def update_dna_nodes_in_arango(vectors, batch_size=1000):
    client = ArangoClient()
    db = client.db(ARANGO['db'], username=ARANGO['username'], password=ARANGO['password'])
    dna_col = db.collection('dna')
    batch = []
    for cat, lbl, vec in vectors:
        key = make_dna_key(cat, lbl)
        doc = dna_col.get(key)
        if doc is not None:
            doc['vector'] = vec
            batch.append(doc)
        if len(batch) >= batch_size:
            dna_col.update_many(batch)
            batch.clear()
    if batch:
        dna_col.update_many(batch)

if __name__ == '__main__':
    pairs = get_dna_pairs_from_arango()
    print(f"Found {len(pairs)} unique (category, label) pairs.")
    if not pairs:
        exit(0)
    vectors = fetch_vectors_from_postgres(pairs)
    print(f"Fetched {len(vectors)} vectors from Postgres.")
    update_dna_nodes_in_arango(vectors)
    print("DNA node vector update complete.")
