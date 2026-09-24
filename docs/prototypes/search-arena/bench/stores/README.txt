Search bench stores: a local, production-like Qdrant + CrateDB holding the full catalog (191,634 titles)
=======================================================================================================

Results: results/bench/stores.json (sections: qdrant, qdrant_disk, qdrant_memory, crate, crate_memory, smoke,
summary, connection). All commands run from docs/prototypes/search-arena.

Versions
  Qdrant  qdrant/qdrant:v1.19.1 (production 1.19.1, single node)
  CrateDB crate:5.10.9 (production: SELECT version['number'] FROM sys.nodes via scripts/readonly_stores.py
          returned 5.10.9 on all three nodes)

Connection
  Qdrant  REST http://127.0.0.1:16333   gRPC 127.0.0.1:16334   no API key
          collections  media_fingerprint_v1_f32   text vectors float32
                       media_fingerprint_v1_f16   text vectors datatype float16
                       media_fingerprint_v1_sq8   text vectors float32 + int8 scalar quantization (always_ram);
                                                  query with params {"quantization": {"rescore": true}}
                       media_fingerprint_v1_base  reference only: fingerprint_v1 alone (production today)
          named vectors fingerprint_v1 (74, Cosine), text_en (768, Cosine, bge-base-en-v1.5 no-title),
                        text_multi (384, Cosine, multilingual-e5-small)
          point id = 1e12 + tmdb_id (movie) / 2e12 + tmdb_id (show), as data/emb-ids.json
          payload: tmdb_id, media_type, title[], original_title[], genres[], release_year, release_decade, adult,
                   production_method, is_anime, suitability_* / context_is_* flags,
                   goodwatch_overall_score_normalized_percent, goodwatch_overall_score_voting_count (= votes),
                   imdb/tmdb_user_score_rating_count, popularity, tropes[], poster_path[],
                   fingerprint_scores_v1.<dim> (raw 0..10)
          eligible filter: goodwatch_overall_score_voting_count >= 2000, must_not adult = true
          era filter: range on release_year
  CrateDB HTTP http://127.0.0.1:14200/_sql   PostgreSQL wire 127.0.0.1:15432   user crate, no password
          table doc.search_title; FULLTEXT (english analyzer): title, original_title, tags, keywords, tropes,
          essence_text, creators, cast_names (label lists newline-joined; raw arrays in <name>_list because Crate
          cannot MATCH an ARRAY(TEXT)); priors: votes, goodwatch_score, popularity; fingerprint_scores (object),
          fps (74 SMALLINT in harness/catalog.py DIMS order); filter columns as in Qdrant.
          BM25 body query: MATCH((tags 2, keywords 2, tropes 1, essence_text 1), ?) USING most_fields

Recreate
  # 1. containers (ports bound to 127.0.0.1; check `docker ps` for clashes first)
  docker volume create searchbench-qdrant-data
  docker volume create searchbench-crate-data
  docker run -d --name searchbench-qdrant -p 127.0.0.1:16333:6333 -p 127.0.0.1:16334:6334 \
      -v searchbench-qdrant-data:/qdrant/storage qdrant/qdrant:v1.19.1
  docker run -d --name searchbench-crate -p 127.0.0.1:14200:4200 -p 127.0.0.1:15432:5432 \
      -e CRATE_HEAP_SIZE=4g -v searchbench-crate-data:/data crate:5.10.9 \
      -Cdiscovery.type=single-node -Ccluster.name=searchbench
  # 2. load (each script records its numbers in results/bench/stores.json)
  .venv/bin/python bench/stores/load_qdrant.py f32 f16 sq8 base   # ~6 min per variant incl. HNSW build
  .venv/bin/python bench/stores/load_crate.py                      # ~1 min
  # 3. measure
  .venv/bin/python bench/stores/disk.py             # per-component disk use of each collection
  .venv/bin/python bench/stores/smoke.py            # top-500 and 1,500-id queries per variant, Crate queries
  .venv/bin/python bench/stores/measure_memory.py   # stops searchbench-qdrant for a few minutes: each collection
                                                    # is measured alone in a throwaway container
                                                    # (searchbench-qdrant-measure), then restarts both stores
  .venv/bin/python bench/stores/summary.py          # writes the summary and connection sections

Teardown
  docker rm -f searchbench-qdrant searchbench-crate
  docker volume rm searchbench-qdrant-data searchbench-crate-data

Notes
  - Collection settings follow goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py: 6 shards,
    default_segment_number 2, indexing_threshold 1000 KB, HNSW m 16 / ef_construct 200 / full_scan_threshold
    1000 KB, and the production payload indexes (including the 74 fingerprint_scores_v1.* integer indexes and
    adult bool). Points are uploaded with indexing_threshold 0. The threshold then goes to 1000 KB, and the index
    build is timed until the collection is green and indexed_vectors_count = 3 x points.
  - Disk is allocated bytes (du -sk). Qdrant preallocates sparse mmap files, so the apparent size is about 3x larger.
  - RSS is the qdrant process's VmRSS. Most of it is file-backed mmap pages. The payload indexes alone hold about
    3 GiB resident per collection, the same in base (production today), so compare variants by rss_over_base.
    docker stats does not count those mmap pages in a stable way.
  - After a restart, sq8 keeps its float32 originals in RAM mode (on_disk false), paged in lazily by rescoring.
    Under sustained load it tends toward f32 plus about 220 MiB of int8 codes.
