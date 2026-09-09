from collections import defaultdict
from io import StringIO
import csv
from f.db.postgres import init_postgres

def get_clusters(pg_cursor):
    print("Fetching cluster mappings...")
    pg_cursor.execute("""
        SELECT dna_id, cluster_id 
        FROM dna_clusters
        WHERE dna_id != cluster_id
    """)
    clusters = {row[0]: row[1] for row in pg_cursor.fetchall()}
    print(f"Found {len(clusters):,} cluster mappings")
    return clusters

def load_all_data(pg, media_type):
    print(f"\nLoading all {media_type} data...")
    dna_entries = 0
    dna_map = defaultdict(lambda: {
        "count_all": 0, 
        "count_movies": 0, 
        "count_tv": 0, 
        "movie_ids": set(), 
        "tv_ids": set()
    })

    with pg.cursor() as cursor:
        table = "movies" if media_type == "movie" else "tv"
        cursor.execute(f"""
            SELECT tmdb_id, dna
            FROM {table}
            ORDER BY tmdb_id
        """)
        
        data = cursor.fetchall()
        processed = len(data)

        for tmdb_id, dna_data in data:
            for category, values in dna_data.items():
                for value in values:
                    dna_entries += 1
                    entry = dna_map[(category, value)]
                    entry["count_all"] += 1
                    if media_type == "movie":
                        entry["count_movies"] += 1
                        entry["movie_ids"].add(tmdb_id)
                    else:
                        entry["count_tv"] += 1
                        entry["tv_ids"].add(tmdb_id)

        print(f"Processed {processed:,} {media_type}s, found {dna_entries:,} DNA entries")

    return dna_map, {"processed": processed, "dna_entries": dna_entries}

def setup_temp_table(pg):
    print("\nCreating temporary table...")
    with pg.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS dna_temp;")
        
        cursor.execute("""
        CREATE TABLE dna_temp (
            id SERIAL PRIMARY KEY,
            category VARCHAR(255),
            label TEXT,
            count_all INTEGER,
            count_movies INTEGER,
            count_tv INTEGER,
            movie_tmdb_id INTEGER[],
            tv_tmdb_id INTEGER[],
            cluster_id INTEGER
        );
        """)
    pg.commit()

def write_to_temp_table(pg, combined_data, clusters):
    print("Preparing data for bulk load...")
    
    output = StringIO()
    writer = csv.writer(output)
    row_count = 0

    # First, get existing DNA IDs
    dna_ids = {}
    with pg.cursor() as cursor:
        cursor.execute("SELECT category, label, id FROM dna")
        for category, label, dna_id in cursor.fetchall():
            dna_ids[(category, label)] = dna_id

    for (category, label), data in combined_data.items():
        # Look up the DNA ID and its potential cluster
        dna_id = dna_ids.get((category, label))
        cluster_id = clusters.get(dna_id) if dna_id else None
        
        writer.writerow([
            category,
            label,
            data["count_all"],
            data["count_movies"],
            data["count_tv"],
            "{" + ",".join(map(str, data["movie_ids"])) + "}",
            "{" + ",".join(map(str, data["tv_ids"])) + "}",
            cluster_id
        ])
        row_count += 1

    print(f"Prepared {row_count:,} rows for bulk load")
    
    output.seek(0)
    
    print("Performing bulk load to temp table...")
    with pg.cursor() as cursor:
        cursor.copy_expert(
            "COPY dna_temp (category, label, count_all, count_movies, count_tv, movie_tmdb_id, tv_tmdb_id, cluster_id) FROM STDIN WITH (FORMAT csv)",
            output
        )
    pg.commit()

def merge_in_batches(pg, batch_size=1000):
    print("\nMerging data in batches...")
    processed = 0
    
    while True:
        with pg.cursor() as cursor:
            cursor.execute("""
            WITH batch AS (
                SELECT *
                FROM dna_temp
                WHERE id > %s
                ORDER BY id
                LIMIT %s
            )
            INSERT INTO dna (
                category, label,
                count_all, count_movies, count_tv,
                movie_tmdb_id, tv_tmdb_id,
                cluster_id, updated_at
            )
            SELECT 
                category, label,
                count_all, count_movies, count_tv,
                movie_tmdb_id, tv_tmdb_id,
                cluster_id, CURRENT_TIMESTAMP
            FROM batch
            ON CONFLICT (category, label) DO UPDATE SET
                count_all = EXCLUDED.count_all,
                count_movies = EXCLUDED.count_movies,
                count_tv = EXCLUDED.count_tv,
                movie_tmdb_id = EXCLUDED.movie_tmdb_id,
                tv_tmdb_id = EXCLUDED.tv_tmdb_id,
                cluster_id = EXCLUDED.cluster_id,
                updated_at = CURRENT_TIMESTAMP
            RETURNING 1;
            """, (processed, batch_size))
            
            count = cursor.rowcount
            if count == 0:
                break
                
            processed += count
            pg.commit()
            print(f"Merged {processed:,} rows")

def cleanup_temp_table(pg):
    print("\nCleaning up temporary table...")
    with pg.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS dna_temp;")
    pg.commit()

def cleanup_zero_counts(pg):
    print("\nRemoving entries with zero counts...")
    with pg.cursor() as cursor:
        cursor.execute("DELETE FROM dna WHERE count_all = 0")
        deleted_count = cursor.rowcount
        print(f"Removed {deleted_count:,} zero-count entries")
    pg.commit()

def copy_dna_data(pg):
    try:
        with pg.cursor() as cursor:
            clusters = get_clusters(cursor)
        
        combined_data = defaultdict(lambda: {
            "count_all": 0, 
            "count_movies": 0, 
            "count_tv": 0, 
            "movie_ids": set(), 
            "tv_ids": set()
        })
        
        stats = {}
        for media_type in ["movie", "tv"]:
            data, media_stats = load_all_data(pg, media_type)
            stats[media_type] = media_stats
            
            for key, value in data.items():
                entry = combined_data[key]
                entry["count_all"] += value["count_all"]
                entry["count_movies"] += value["count_movies"]
                entry["count_tv"] += value["count_tv"]
                entry["movie_ids"].update(value["movie_ids"])
                entry["tv_ids"].update(value["tv_ids"])
        
        setup_temp_table(pg)
        write_to_temp_table(pg, combined_data, clusters)
        
        merge_in_batches(pg)
        cleanup_zero_counts(pg)
        
        total_dna_entries = sum(s["dna_entries"] for s in stats.values())
        print("\nFinal totals:")
        print(f"Movies processed: {stats['movie']['processed']:,}")
        print(f"TV shows processed: {stats['tv']['processed']:,}")
        print(f"Total DNA entries processed: {total_dna_entries:,}")
        
        return {
            "total_counts": {k: v["processed"] for k, v in stats.items()},
            "total_dna_entries": total_dna_entries
        }
    finally:
        cleanup_temp_table(pg)

def main():
    with init_postgres() as pg:
        return copy_dna_data(pg)

if __name__ == "__main__":
    main()