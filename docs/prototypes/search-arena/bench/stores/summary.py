"""Add the `connection` and `summary` sections to results/bench/stores.json from the measured sections.

Run after load_qdrant.py, load_crate.py, disk.py, measure_memory.py and smoke.py.
Usage: .venv/bin/python bench/stores/summary.py
"""
import json

import common as K
import load_crate

MiB = 2 ** 20


def main():
    d = json.load(open(K.RESULT_FILE))
    # the load step's own RSS fields read the entrypoint shell (PID 1), not qdrant; measure_memory.py supersedes them
    for v in d["qdrant"].values():
        for k in ("rss_before_load", "rss_after_index", "rss_delta_bytes"):
            v.pop(k, None)
    for v, r in d["qdrant_disk"].items():
        d["qdrant"][v]["disk_bytes"] = r["total_allocated_bytes"]

    mem, smoke = d["qdrant_memory"], d["smoke"]["qdrant"]
    base_rss = mem["base"]["after_warmup"]["rss_bytes"]
    rows = {}
    for v in list(K.VARIANTS) + ["base"]:
        m = mem[v]["after_warmup"]
        coll = dict(K.VARIANTS, base=K.BASE[1])[v]
        sm = m["smaps"][coll]
        text = {k: round(b / MiB) for k, b in sm.items() if "text_" in k}
        row = dict(
            collection=coll, load_s=d["qdrant"][v]["load_s"], index_build_s=d["qdrant"][v]["index_build_s"],
            disk_mib=round(d["qdrant_disk"][v]["total_allocated_bytes"] / MiB),
            rss_mib=round(m["rss_bytes"] / MiB), rss_anon_mib=round(m["rss_anon_bytes"] / MiB),
            rss_file_mib=round(m["rss_file_bytes"] / MiB), rss_over_base_mib=round((m["rss_bytes"] - base_rss) / MiB),
            docker_stats=m["docker_mem_usage"], jemalloc_resident_mib=round(mem[v]["telemetry_memory"]["resident_bytes"] / MiB),
            text_vector_rss_mib=text, payload_index_rss_mib=round(sm.get("payload_index", 0) / MiB),
        )
        if v in smoke:
            s = smoke[v]
            row.update(top500_hnsw_median_ms=s["hnsw"]["top500_median_ms"], top500_hnsw_recall=s["hnsw"]["top500_mean_recall"],
                       top500_exact_median_ms=s["exact"]["top500_median_ms"],
                       score1500_median_ms=s["hnsw"]["score1500_median_ms"],
                       score1500_returned_min=s["hnsw"]["score1500_min_returned"])
        rows[v] = row
    c = d["crate"]
    cm = d["crate_memory"]["after_queries"]
    d["summary"] = dict(
        qdrant=rows,
        qdrant_all_collections_after_restart=dict(
            rss_mib=round(mem["all_three_after_restart"]["rss_bytes"] / MiB),
            docker_stats=mem["all_three_after_restart"]["docker_mem_usage"]),
        crate=dict(table=K.CRATE_TABLE, version=c["version"], rows=c["rows"], load_s=c["load_s"],
                   refresh_optimize_s=c["refresh_optimize_s"], disk_mib=round(c["disk_bytes"] / MiB),
                   rss_mib=round(cm["rss_bytes"] / MiB), docker_stats=cm["docker_mem_usage"],
                   heap_used_mib=round(cm["heap_used_bytes"] / MiB), heap_max_mib=round(cm["heap_committed_bytes"] / MiB),
                   bm25_top300_median_ms=d["smoke"]["crate"]["bm25_top300_median_ms"],
                   fetch1500_median_ms=d["smoke"]["crate"]["fetch1500_median_ms"]),
    )
    d["connection"] = dict(
        qdrant=dict(container=K.QDRANT_CONTAINER, image="qdrant/qdrant:v1.19.1", rest=K.QDRANT_URL,
                    grpc="127.0.0.1:16334", api_key=None, collections=dict(K.VARIANTS, base=K.BASE[1]),
                    vectors=dict(fingerprint_v1="74-d Cosine (L2-normalized catalog fingerprint)",
                                 text_en="768-d Cosine, bge-base-en-v1.5 over the title's text without its title "
                                         "(data/emb-bge-base-en-v1.5-notitle.npy); query prefix 'Represent this "
                                         "sentence for searching relevant passages: '",
                                 text_multi="384-d Cosine, multilingual-e5-small (data/emb-multilingual-e5-small.npy); "
                                            "query prefix 'query: '"),
                    point_id="1e12 + tmdb_id (movie), 2e12 + tmdb_id (show); same as data/emb-ids.json",
                    payload_fields=["tmdb_id", "media_type", "title", "original_title", "poster_path", "genres",
                                    "release_year", "release_decade", "adult", "production_method",
                                    "goodwatch_overall_score_normalized_percent", "goodwatch_overall_score_voting_count",
                                    "imdb_user_score_rating_count", "tmdb_user_score_rating_count", "popularity",
                                    "tropes", "fingerprint_scores_v1.<dim>"] + K.BOOL_FLAGS,
                    eligible_filter=d["smoke"]["filter_top500"],
                    era_filter="range on release_year (gte / lte)",
                    sq8_query_params={"quantization": {"rescore": True}}),
        crate=dict(container=K.CRATE_CONTAINER, image="crate:5.10.9", http=K.CRATE_URL + "/_sql",
                   postgres="127.0.0.1:15432 (user crate, no password)", table=K.CRATE_TABLE,
                   fulltext_columns=dict(title="TEXT", original_title="TEXT", tags="TEXT (essence_tags, newline-joined)",
                                         keywords="TEXT (newline-joined)", tropes="TEXT (newline-joined)",
                                         essence_text="TEXT", creators="TEXT (newline-joined)",
                                         cast_names="TEXT (top cast, newline-joined)"),
                   analyzer="english",
                   raw_lists=[f"{c}_list" for c in load_crate.LISTS],
                   other_columns=["id", "tmdb_id", "media_type", "release_year", "release_decade", "adult", "genres",
                                  "production_method"] + K.BOOL_FLAGS +
                                 ["votes", "goodwatch_score", "popularity", "fingerprint_scores['<dim>']",
                                  "fps (74 SMALLINT, harness/catalog.py DIMS order)"],
                   bm25_body_example=d["smoke"]["crate"]["bm25_stmt"]),
    )
    with open(K.RESULT_FILE, "w") as f:
        json.dump(d, f, indent=2)
    print(json.dumps(d["summary"], indent=1))


if __name__ == "__main__":
    main()
