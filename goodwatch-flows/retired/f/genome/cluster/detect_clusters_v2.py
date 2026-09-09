from collections import defaultdict
import time
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from psycopg2.extras import execute_batch
from sklearn.preprocessing import normalize
from ast import literal_eval

from f.db.postgres import init_postgres


def create_tables(conn):
    """Create necessary tables and indexes if they don't exist."""
    with conn.cursor() as cur:
        # Main clusters table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS dna_clusters (
                cluster_id INTEGER NOT NULL,
                dna_id INTEGER NOT NULL,
                PRIMARY KEY (cluster_id, dna_id)
            );
        """)
        conn.commit()
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_dna_clusters_cluster_id 
            ON dna_clusters(cluster_id);
        """)
        conn.commit()
        
        # Progress tracking table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS dna_clusters_progress (
                run_id SERIAL PRIMARY KEY,
                processed_count INTEGER NOT NULL DEFAULT 0,
                total_count INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL,
                start_time TIMESTAMP NOT NULL DEFAULT NOW(),
                update_time TIMESTAMP,
                end_time TIMESTAMP
            );
        """)
        conn.commit()
        
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_dna_clusters_progress_status 
            ON dna_clusters_progress(status) 
            WHERE status = 'in_progress';
        """)
        conn.commit()


def get_or_create_run(conn, total_count: int) -> Tuple[int, int]:
    """Get existing run or create new one, returning (run_id, processed_count)."""
    with conn.cursor() as cur:
        # Check for in-progress run
        cur.execute("""
            SELECT run_id, processed_count
            FROM dna_clusters_progress
            WHERE status = 'in_progress'
            ORDER BY run_id DESC
            LIMIT 1;
        """)
        result = cur.fetchone()
        conn.commit()
        
        if result:
            return result[0], result[1]
        
        # No existing run, create new one
        cur.execute("""
            INSERT INTO dna_clusters_progress (status, total_count)
            VALUES ('in_progress', %s)
            RETURNING run_id;
        """, (total_count,))
        run_id = cur.fetchone()[0]
        conn.commit()
        
        # Clear existing clusters for new run
        cur.execute("TRUNCATE TABLE dna_clusters;")
        conn.commit()
        
        return run_id, 0


def load_vectors(conn, max_tags: int) -> pd.DataFrame:
    """Load all DNA vectors sorted by count_all, regardless of resume state."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, label, label_vector_v2, count_all
            FROM dna
            ORDER BY count_all DESC
            LIMIT %s;
        """, (max_tags,))
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        conn.commit()
    
    return pd.DataFrame(rows, columns=cols)


def reconstruct_clusters(conn, vectors: np.ndarray, df: pd.DataFrame) -> Tuple[List[np.ndarray], List[int], Dict[int, List[str]], int]:
    """
    Reconstruct clustering state from database.
    Returns (cluster_centers, cluster_ids, clusters, largest_cluster_size).
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.cluster_id, c.dna_id, d.label
            FROM dna_clusters c
            JOIN dna d ON c.dna_id = d.id
            ORDER BY c.cluster_id;
        """)
        rows = cur.fetchall()
        conn.commit()

    if not rows:
        return [], [], defaultdict(list), 0

    # Group by cluster
    clusters = defaultdict(list)
    cluster_vectors = {}
    largest_size = 0

    for cluster_id, dna_id, label in rows:
        clusters[cluster_id].append(label)
        
        # Store vector for cluster representative
        if cluster_id == dna_id:
            idx = np.where(df['id'] == dna_id)[0][0]
            cluster_vectors[cluster_id] = vectors[idx]
        
        size = len(clusters[cluster_id])
        largest_size = max(largest_size, size)

    # Convert to lists maintaining order
    cluster_ids = list(cluster_vectors.keys())
    cluster_centers = [cluster_vectors[cid] for cid in cluster_ids]

    return cluster_centers, cluster_ids, clusters, largest_size


def update_progress(conn, run_id: int, processed_count: int):
    """Update clustering progress."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE dna_clusters_progress
            SET processed_count = %s,
                update_time = NOW()
            WHERE run_id = %s;
        """, (processed_count, run_id))
        conn.commit()


def finish_run(conn, run_id: int):
    """Mark clustering run as completed."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE dna_clusters_progress
            SET status = 'completed',
                end_time = NOW()
            WHERE run_id = %s;
        """, (run_id,))
        conn.commit()


def main(
    distance_threshold: float = 0.25,
    max_cluster_size: int = 10000,
    max_tags: int = 1000000,
    batch_size: int = 1000,
    return_multiple: bool = True,
    verbose: bool = True,
) -> Dict[int, List[str]]:
    """Complete-link clustering using a k-center approach."""
    conn = init_postgres()
    
    try:
        create_tables(conn)
        
        # 1. Load all vectors
        df = load_vectors(conn, max_tags)
        if df.empty:
            return {}
        
        # 2. Get or create run
        run_id, processed_count = get_or_create_run(conn, len(df))
        
        # 3. Process vectors
        vectors = []
        for idx, vec_str in enumerate(df["label_vector_v2"]):
            if vec_str:
                vec = np.array(literal_eval(vec_str), dtype=np.float32)
            else:
                vec = np.zeros(768, dtype=np.float32)
            vectors.append(vec)
        
        vectors = np.stack(vectors)
        vectors = normalize(vectors, norm='l2', axis=1)
        
        if verbose:
            print(f"Loaded {len(vectors)} vectors with dimension {vectors.shape[1]}.")
            print(f"Starting from position {processed_count}/{len(df)}")
        
        # 4. Reconstruct existing clusters
        cluster_centers, cluster_ids, clusters, largest_cluster_size = reconstruct_clusters(conn, vectors, df)
        
        if verbose:
            print(f"Reconstructed {len(clusters)} existing clusters.")
            print(f"Current largest cluster size: {largest_cluster_size}")
        
        # 5. Process remaining vectors
        similarity_threshold = 1.0 - (distance_threshold / 2.0)
        start_time = time.time()
        batch = []
        
        # Track largest cluster details
        largest_cluster_id = None
        
        for i in range(processed_count, len(df)):
            vec = vectors[i]
            dna_id = int(df.iloc[i]['id'])
            label = df.iloc[i]['label']
            
            # Find eligible clusters
            if cluster_centers:
                similarities = np.dot(cluster_centers, vec)
                eligible_clusters = np.where(similarities >= similarity_threshold)[0]
            else:
                eligible_clusters = np.array([])
            
            # Assign to clusters
            if len(eligible_clusters) > 0:
                if return_multiple:
                    for idx in eligible_clusters:
                        cid = int(cluster_ids[idx])
                        batch.append({'cluster_id': cid, 'dna_id': dna_id})
                        clusters[cid].append(label)
                        if len(clusters[cid]) > largest_cluster_size:
                            largest_cluster_size = len(clusters[cid])
                            largest_cluster_id = cid
                else:
                    idx = eligible_clusters[np.argmax(similarities[eligible_clusters])]
                    cid = int(cluster_ids[idx])
                    batch.append({'cluster_id': cid, 'dna_id': dna_id})
                    clusters[cid].append(label)
                    if len(clusters[cid]) > largest_cluster_size:
                        largest_cluster_size = len(clusters[cid])
                        largest_cluster_id = cid
            else:
                # Create new cluster
                cluster_centers.append(vec)
                cluster_ids.append(dna_id)
                clusters[dna_id].append(label)
                batch.append({'cluster_id': dna_id, 'dna_id': dna_id})
            
            # Batch processing
            if len(batch) >= batch_size:
                with conn.cursor() as cur:
                    execute_batch(cur, """
                        INSERT INTO dna_clusters (cluster_id, dna_id)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING;
                    """, [(b['cluster_id'], b['dna_id']) for b in batch])
                    conn.commit()
                
                batch = []
                update_progress(conn, run_id, i + 1)
                
            # Print progress
            if verbose and (i + 1) % batch_size == 0:
                elapsed = time.time() - start_time
                current_clusters = len(clusters)
                print(f"Processing item {i + 1}/{len(df)} "
                      f"- Clusters: {current_clusters:,} "
                      f"- Largest cluster: {largest_cluster_size} "
                      f"(Elapsed: {elapsed/60:.2f}m)")
            
            if max_cluster_size and largest_cluster_size >= max_cluster_size:
                if verbose:
                    print(f"Early stop: reached max cluster size {max_cluster_size}")
                break
        
        # Process remaining batch
        if batch:
            with conn.cursor() as cur:
                execute_batch(cur, """
                    INSERT INTO dna_clusters (cluster_id, dna_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING;
                """, [(b['cluster_id'], b['dna_id']) for b in batch])
                conn.commit()
        
        finish_run(conn, run_id)
        
        # Print final statistics
        if verbose:
            total_time = time.time() - start_time
            print(f"\nClustering complete in {total_time/60:.2f} minutes.")
            print(f"Total clusters formed: {len(clusters):,}")
            print(f"Largest cluster size: {largest_cluster_size}")
            
            # Get representative label and top labels for largest cluster
            if largest_cluster_id is not None:
                representative_label = clusters[largest_cluster_id][0]
                print(f"Largest cluster representative label: {representative_label}")
                print(f"Largest cluster labels (up to 10): {clusters[largest_cluster_id][:10]}")
        
        # Sort clusters by size in descending order
        sorted_clusters = sorted(clusters.items(), key=lambda item: len(item[1]), reverse=True)
        ordered_clusters = {}
        for new_id, (old_id, members) in enumerate(sorted_clusters):
            ordered_clusters[new_id] = members
        
        return ordered_clusters
    
    finally:
        conn.close()
