"""Trace the store access plan of combo-safe-v3 for every query in queries.json.

Usage (from docs/prototypes/search-arena): .venv/bin/python bench/trace/run_trace.py [--reps=3]

1. Uninstrumented pass: warms every cache, then `reps` timed passes; the lists are the reference.
2. Instrumented passes (`instrument.install()`): the first one records the trace; every pass is timed and its lists
   must equal the reference (top 10 exactly, the whole top 50 too).
3. Writes results/bench/trace/{trace.jsonl, vectors.json, summary.json}. See README.txt there.
"""
import json, os, statistics, sys, time
from collections import Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ARENA, "results", "bench", "trace")
sys.path.insert(0, HERE)
import instrument as I  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import simp_combo as SC  # noqa: E402
import sparse as S  # noqa: E402

NAME = "combo-safe-v3"


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, max(0, int(round(p / 100 * len(v))) - 1))]


def dist(v):
    if not v:
        return None
    return dict(n=len(v), min=min(v), median=statistics.median(v), p95=pct(v, 95), max=max(v),
                mean=round(sum(v) / len(v), 2))


# --- table sizes ---------------------------------------------------------------------------------------------------

def deep_size(obj, seen=None):
    """Python heap bytes of an object graph (numpy / scipy buffers by nbytes)."""
    seen = set() if seen is None else seen
    if id(obj) in seen:
        return 0
    seen.add(id(obj))
    if isinstance(obj, np.ndarray):
        return obj.nbytes + 112
    if hasattr(obj, "tocsr") and hasattr(obj, "nnz"):
        return sum(getattr(obj, a).nbytes for a in ("data", "indices", "indptr") if hasattr(obj, a))
    n = sys.getsizeof(obj)
    if isinstance(obj, dict):
        n += sum(deep_size(k, seen) + deep_size(v, seen) for k, v in obj.items())
    elif isinstance(obj, (list, tuple, set, frozenset)):
        n += sum(deep_size(x, seen) for x in obj)
    elif hasattr(obj, "__dict__") and not isinstance(obj, type):
        n += deep_size(obj.__dict__, seen)
    return n


def compact_size(obj, seen=None):
    """Payload bytes as a compact port would hold them: UTF-8 strings, 4-byte ids / numbers, typed arrays by nbytes,
    no container overhead."""
    seen = set() if seen is None else seen
    if isinstance(obj, (dict, list, tuple, set, frozenset, np.ndarray)) or hasattr(obj, "__dict__"):
        if id(obj) in seen:
            return 0
        seen.add(id(obj))
    if isinstance(obj, np.ndarray):
        return obj.nbytes
    if hasattr(obj, "tocsr") and hasattr(obj, "nnz"):
        return sum(getattr(obj, a).nbytes for a in ("data", "indices", "indptr") if hasattr(obj, a))
    if isinstance(obj, str):
        return len(obj.encode())
    if isinstance(obj, (bool, np.bool_)):
        return 1
    if isinstance(obj, (int, float, np.integer, np.floating)):
        return 4
    if obj is None:
        return 0
    if isinstance(obj, dict):
        return sum(compact_size(k, seen) + compact_size(v, seen) for k, v in obj.items())
    if isinstance(obj, (list, tuple, set, frozenset)):
        return sum(compact_size(x, seen) for x in obj)
    if hasattr(obj, "__dict__"):
        return compact_size(obj.__dict__, seen)
    return sys.getsizeof(obj)


def table_sizes(used):
    """name -> {python_mb, compact_mb, entries, note} for every in-memory table the ranker touched."""
    cat = C.load()
    el = np.flatnonzero(cat.eligible())
    objs, notes = {}, {}
    for key, val in SC._cache.items():
        base = key if isinstance(key, str) else key[0]
        name = I.TABLES.get(base, base)
        if name is None:
            continue
        objs.setdefault(name, []).append(val)
    # title table: the per-title scalars and names the ranker reads for eligible titles
    objs["title_table"] = [dict(ids=cat.ids[el], year=cat.year[el].astype(np.int16), votes=cat.votes[el].astype(np.int32),
                                goodwatch_score=cat.goodwatch_score[el], popularity=cat.popularity[el],
                                is_show=cat.is_show[el], title=[cat.title[r] for r in el],
                                original_title=[cat.original_title[r] for r in el],
                                imdb_id=[cat.imdb_id[r] for r in el])]
    notes["title_table"] = (f"{len(el)} eligible titles: id, title, original title, year, votes, GoodWatch score, "
                            "popularity, media type, IMDb id (seeds, centroid weights, priors, blend, cuts, bounds)")
    rows, vocab, X_, idf = S.index(SC.DEFAULTS["body"])
    objs["bm25_term_stats"] = [objs.get("bm25_term_stats", [None])[0], idf]
    notes["bm25_term_stats"] = (f"{len(vocab)} BM25 terms (unigrams + bigrams): vocabulary, document frequency, IDF "
                                "(collocations, term-profile weights)")
    store_side = dict(bm25_doc_matrix=dict(mb=round(deep_size(X_) / 1e6, 1), nnz=int(X_.nnz),
                                           note="BM25F doc term weights (body fields): moves to Crate"))
    out = {}
    for name, vals in objs.items():
        vals = [v for v in vals if v is not None]
        py = sum(deep_size(v) for v in vals)
        cp = sum(compact_size(v) for v in vals)
        ent = sum(len(v) if hasattr(v, "__len__") and not isinstance(v, (str, np.ndarray)) else 1 for v in vals)
        out[name] = dict(python_mb=round(py / 1e6, 2), compact_mb=round(cp / 1e6, 2), entries=ent,
                         touched_by_queries=used.get(name, 0), note=notes.get(name, ""))
    return out, store_side


# --- main ----------------------------------------------------------------------------------------------------------

def path_class(rec):
    if rec.ref is not None:
        return "reference"
    return "non_english" if rec.non_en else "general"


def main(reps=3):
    os.makedirs(OUT, exist_ok=True)
    ranker = SC.FINAL[NAME]
    ctxs = X.contexts()
    print(f"{len(ctxs)} queries", flush=True)

    # 1. uninstrumented: warm-up, then timed reference passes
    ref_lists = {c.id: ranker(c) for c in ctxs}
    base_ms = {c.id: [] for c in ctxs}
    for rep in range(reps):
        for c in ctxs:
            t = time.perf_counter()
            out = ranker(c)
            base_ms[c.id].append((time.perf_counter() - t) * 1000)
            assert [x["id"] for x in out] == [x["id"] for x in ref_lists[c.id]], f"nondeterministic {c.id}"
    print("reference pass done", flush=True)

    # 2. instrumented
    I.install()
    recs, timing, mismatch10, mismatch50, score_diff = {}, {c.id: [] for c in ctxs}, [], [], []
    for rep in range(reps):
        for c in ctxs:
            out, rec = I.trace_query(c, ranker)
            store, enc, ov = rec.t["store"] * 1000, rec.t["encode"] * 1000, rec.t["overhead"] * 1000
            timing[c.id].append((rec.wall * 1000, store, enc, rec.wall * 1000 - store - enc - ov, ov, rec.mem))
            a, b = [x["id"] for x in out], [x["id"] for x in ref_lists[c.id]]
            if rep == 0:
                recs[c.id] = rec
                if a[:10] != b[:10]:
                    mismatch10.append(c.id)
                if a != b:
                    mismatch50.append(c.id)
                if [x["score"] for x in out] != [x["score"] for x in ref_lists[c.id]]:
                    score_diff.append(c.id)
            elif a != b:
                mismatch50.append(f"{c.id} (rep {rep})")
        print(f"instrumented rep {rep} done", flush=True)

    saved = os.path.join(ARENA, "results", "simplify", "lists", f"{NAME}.json")
    saved_cmp = None
    if os.path.exists(saved):
        sl = json.load(open(saved))
        common = [c.id for c in ctxs if c.id in sl]
        same = sum(1 for q in common if [x["id"] for x in sl[q][:10]] == [x["id"] for x in ref_lists[q][:10]])
        saved_cmp = dict(file=os.path.relpath(saved, ARENA), queries=len(common), identical_top10=same)

    # 3. write
    qmeta = {q["id"]: q for q in X.queries()}
    tables_used = Counter()
    vectors = {}
    per = []
    with open(os.path.join(OUT, "trace.jsonl"), "w") as f:
        for c in ctxs:
            rec = recs[c.id]
            tm = timing[c.id]
            med = lambda i: round(statistics.median(t[i] for t in tm), 3)
            store_ops = [o for o in rec.ops if not o.get("display") and o["store"] != "external"]
            stages = {}
            for o in rec.ops:
                stages.setdefault(o["stage"], []).append(o["id"])
            ref = rec.ref
            # stages without the seed fetches (profiles precomputed per reference): drop fetch deps
            by_id = {o["id"]: o for o in rec.ops}
            alt = {}

            def alt_stage(o):
                if o["id"] not in alt:
                    deps = [d for d in o["deps"] if not by_id[d]["kind"].startswith("fetch_")]
                    alt[o["id"]] = 1 + max([alt_stage(by_id[d]) for d in deps], default=0)
                return alt[o["id"]]
            n_alt = max([alt_stage(o) for o in store_ops if not o["kind"].startswith("fetch_")], default=0)
            pool_srcs = Counter(o["role"] for o in rec.ops if o["kind"].endswith("_topk"))
            if ref is not None:
                pool_srcs["reference own titles (memory)"] = sum(1 for r_ in ref.weights if c.mask[r_])
            if rec.peer_rows:
                pool_srcs["peer titles (memory, needs the fingerprint_v1 seed fetch)"] = rec.peer_rows
            trips = sum(len({o["store"].split("|")[0] for o in store_ops if o["stage"] == s_}) for s_ in
                        {o["stage"] for o in store_ops})
            row = dict(
                id=c.id, query=c.query, text=c.text, type=qmeta[c.id]["type"], split=c.split,
                path=path_class(rec), non_english=rec.non_en,
                reference=None if ref is None else dict(kind=ref.kind, intent=ref.intent, residual=ref.text,
                                                        negated=ref.negated, n_seeds=len(ref.seeds),
                                                        n_weighted_titles=len(ref.weights),
                                                        entities=[e.name for e in ref.det.entities] if ref.det else None),
                filter=rec.filter,
                encodes=rec.encodes,
                vectors={vid: dict(rec.vec_meta[vid], dim=int(len(v))) for vid, v in rec.vectors.items()},
                id_lists=rec.id_lists,
                ops=rec.ops,
                stages=[dict(stage=s, ops=stages[s]) for s in sorted(stages)],
                n_store_stages=max([o["stage"] for o in store_ops], default=0),
                n_store_stages_if_profiles_precomputed=n_alt,
                n_store_ops=len(store_ops),
                n_round_trips_batched=trips,
                op_kinds=dict(Counter(o["kind"] for o in store_ops)),
                pool_size=len(rec.id_lists.get("pool", [])),
                pool_lists=dict(pool_srcs),
                n_encodes=len(rec.encodes),
                n_encodes_repeat=sum(e["repeat"] for e in rec.encodes),
                tables=sorted(rec.tables),
                timing_ms=dict(wall_instrumented=med(0), store_emulated=med(1), encode_cached=med(2),
                               memory=med(3), recorder_overhead=med(4),
                               memory_parts_inclusive={k: round(statistics.median(t[5].get(k, 0) for t in tm), 3)
                                                       for k in sorted({k for t in tm for k in t[5]})},
                               wall_uninstrumented=round(statistics.median(base_ms[c.id]), 3)),
                unclassified_gathers=rec.unclassified_gathers,
                top10=[x["id"] for x in ref_lists[c.id][:10]],
            )
            f.write(json.dumps(row) + "\n")
            vectors[c.id] = I.vectors_b64(rec)
            tables_used.update(rec.tables)
            per.append(row)
    json.dump(vectors, open(os.path.join(OUT, "vectors.json"), "w"))

    tables, store_side = table_sizes(tables_used)
    groups = {"all": per}
    for p in ("general", "non_english", "reference"):
        groups[p] = [r for r in per if r["path"] == p]
    summ = {}
    for g, rows in groups.items():
        summ[g] = dict(
            queries=len(rows),
            pool_size=dist([r["pool_size"] for r in rows]),
            store_ops=dist([r["n_store_ops"] for r in rows]),
            round_trips_batched=dist([r["n_round_trips_batched"] for r in rows]),
            store_stages=dict(sorted(Counter(r["n_store_stages"] for r in rows).items())),
            store_stages_if_profiles_precomputed=dict(sorted(Counter(r["n_store_stages_if_profiles_precomputed"]
                                                                     for r in rows).items())),
            ops_by_kind={k: dist([r["op_kinds"].get(k, 0) for r in rows]) for k in
                         sorted({k for r in rows for k in r["op_kinds"]})},
            encodes=dist([r["n_encodes"] for r in rows]),
            encodes_by_model=dict(Counter(e["model"] for r in rows for e in r["encodes"])),
            memory_ms=dist([r["timing_ms"]["memory"] for r in rows]),
            store_emulated_ms=dist([r["timing_ms"]["store_emulated"] for r in rows]),
            wall_uninstrumented_ms=dist([r["timing_ms"]["wall_uninstrumented"] for r in rows]),
            full_scan_mix_queries=sum(1 for r in rows if "dense_mix_topk" in r["op_kinds"]),
            score_ids_ids=dist([o["n_ids"] for r in rows for o in r["ops"] if o["kind"].endswith("_score_ids")]),
            score_ids_outside_own_topk=dist([o["n_ids_outside_own_topk"] for r in rows for o in r["ops"]
                                             if "n_ids_outside_own_topk" in o]),
        )
    # restructuring: what precomputed reference profiles would take
    cfg = ranker[0]
    ents = set()
    for key in SC.name_index(cfg):
        c_ = SC.resolve_key(key, cfg)
        if c_ is not None:
            ents.add((c_.kind, c_.ids))
    like_titles = len(set(SC.reference_titles(cfg["ref_votes"]).values()))
    vec_b = (74 + 768) * 4
    term_b = cfg["terms_n"] * 16
    restructure = dict(
        resolvable_entities=len(ents), like_x_titles=like_titles,
        entity_centroids_mb=round(len(ents) * vec_b / 1e6, 1),
        term_profiles_mb=round((len(ents) + like_titles) * term_b / 1e6, 1),
        note="Precomputed reference profiles remove the seed-fetch stage. Entities: the fingerprint_v1 + text_en "
             "centroids (entity_centroids_mb, e.g. a side Qdrant collection read with lookup_from, or webapp memory). "
             "'like X' titles (votes >= ref_votes): one seed, so the centroid is the title's own vector (Qdrant "
             "query by point id, nothing to store). Both: the top terms_n term profile (term_profiles_mb, about 16 "
             "bytes per term). Multi-entity queries still need the seed fetch (seeds come from the combined weights).")
    summary = dict(
        ranker=f"simp_combo.FINAL['{NAME}']", queries=len(per), reps=reps,
        verification=dict(top10_mismatches=mismatch10, top50_mismatches=mismatch50, score_mismatches=score_diff,
                          filter_verified=all(r["filter"]["verified"] for r in per),
                          unclassified_gathers=sum(r["unclassified_gathers"] for r in per),
                          saved_list_comparison=saved_cmp),
        groups=summ,
        tables=tables,
        tables_total_mb=dict(python=round(sum(t["python_mb"] for t in tables.values()), 1),
                             compact=round(sum(t["compact_mb"] for t in tables.values()), 1)),
        store_side_for_reference=store_side,
        restructure_precomputed_profiles=restructure,
        generated=time.strftime("%Y-%m-%dT%H:%M:%S"),
    )
    json.dump(summary, open(os.path.join(OUT, "summary.json"), "w"), indent=1)
    print(json.dumps(summary["verification"], indent=1))
    for g, s in summ.items():
        print(g, s["queries"], "pool", s["pool_size"], "ops", s["store_ops"], "stages", s["store_stages"],
              "alt", s["store_stages_if_profiles_precomputed"], "mem", s["memory_ms"])
    print(json.dumps(tables, indent=1), summary["tables_total_mb"])


if __name__ == "__main__":
    reps = next((int(a.split("=")[1]) for a in sys.argv[1:] if a.startswith("--reps=")), 3)
    main(reps)
