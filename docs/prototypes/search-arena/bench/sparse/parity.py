"""Parity of Qdrant's `terms_bm25f` sparse queries with the prototype's BM25F on every BM25 operation of the trace.

.venv/bin/python bench/sparse/parity.py

Query side, as the webapp would build it from its term stats (bench/sparse/out/term_stats.json), not from the trace:
  text ops (bm25:query, coverage unit, profile:mention): sparse.query_terms(text) (distinct terms, first-seen order),
      terms with eligible df > 0, value = float32 IDF
  profile:terms: the eligible seeds' terms_bm25f vectors fetched from Qdrant (the port of fetch_terms), value = share
      of seeds holding the term x IDF, zero below min(terms_min_df, seeds) holders, the top terms_n
The client-built terms are compared with the trace's recorded terms (query-side check).

Reference: the prototype itself: sparse.scores(text, BODY) for text ops (what sparse_top and mention_scores call),
simp_combo.term_scores(seeds, cfg) for the term profile; top-k = the replay's exact topk (argpartition, positive only)
inside the query's filter mask.
"""
import json, os, sys, time

import httpx
import numpy as np

from common import ARENA, COLLECTION, QDRANT, VECTOR, C, S, idf_from_df, load_stats, trace, update_result

sys.path.insert(0, os.path.join(ARENA, "bench", "replay"))
import simp_combo as SC  # noqa: E402
from prepare import mask_for, topk  # noqa: E402

CFG = dict(SC.DEFAULTS)
assert CFG["body"] == SC.BODY and CFG["terms_n"] == 40 and CFG["terms_min_df"] == 2


def qdrant_filter(f):
    must = [dict(key="goodwatch_overall_score_voting_count", range=dict(gte=f["min_votes"]))]
    must_not = [dict(key="adult", match=dict(value=True))]
    if f["media_type"]:
        must.append(dict(key="media_type", match=dict(value=f["media_type"])))

    def cond(fid):
        if fid.startswith(("media_type:", "production_method:")):
            k, v = fid.split(":", 1)
            return dict(key=k, match=dict(value=v))
        return dict(key=fid, match=dict(value=True))
    must += [cond(x) for x in f["required"]]
    must_not += [cond(x) for x in f["excluded"]]
    if f["year_range"]:
        must.append(dict(key="release_year", range=dict(gte=f["year_range"][0], lte=f["year_range"][1])))
    return dict(must=must, must_not=must_not)


class Client:
    """The webapp's side: term stats in memory, query vectors built from them."""

    def __init__(self):
        st = load_stats()
        self.N = st["N"]
        self.term = {t: (j, df) for t, (j, df) in st["terms"].items() if df > 0}
        n = max(j for j, _ in st["terms"].values()) + 1
        self.df = np.zeros(n, np.float64)
        self.name = [None] * n
        for t, (j, df) in st["terms"].items():
            self.df[j] = df
            self.name[j] = t
        self.idf = idf_from_df(self.df, self.N)

    def text_query(self, text):
        idx, val, terms = [], [], []
        for t in S.query_terms(text):
            if t in self.term:
                j = self.term[t][0]
                idx.append(j)
                val.append(float(np.float32(self.idf[j])))
                terms.append([t, val[-1]])
        return idx, val, terms

    def profile_query(self, seed_vectors, terms_n=CFG["terms_n"], min_df=CFG["terms_min_df"]):
        n = len(seed_vectors)
        dfo = {}
        for v in seed_vectors:
            for j in v["indices"]:
                dfo[j] = dfo.get(j, 0) + 1
        w = {j: c / n * self.idf[j] for j, c in dfo.items() if c >= min(min_df, n)}
        top = sorted(w, key=lambda j: -w[j])[:terms_n]
        top = [j for j in top if w[j] > 0]
        cutoff = w[top[-1]] if len(top) == terms_n else None
        return top, [w[j] for j in top], [[self.name[j], w[j]] for j in top], w, cutoff


def compare_terms(mine, rec, rel_tol=2e-6):
    """Client-built terms vs the trace's recorded terms (weights rounded to 6 decimals there). Terms the recording has
    and the client does not are fine if their body df is 0 (they hit no document)."""
    m = {t: w for t, w in mine}
    r = {t: w for t, w in rec}
    only_rec = sorted(set(r) - set(m))
    only_mine = sorted(set(m) - set(r))
    common = set(m) & set(r)
    err = max([abs(m[t] - r[t]) for t in common], default=0.0)
    return dict(same_terms=not only_rec and not only_mine, only_trace=only_rec, only_client=only_mine,
                max_weight_abs_err=err)


def check_topk(http, op, idx, val, ref, cat, row_of, rows, mask, qf):
    k = op["k"]
    res = []
    if idx:
        body = dict(query=dict(indices=idx, values=val), using=VECTOR, filter=qf, limit=k, with_payload=False)
        res = http.post(f"/collections/{COLLECTION}/points/query", json=body).json()["result"]["points"]
    ref_ids, ref_sc = topk(rows, ref[rows], k, positive_only=True)
    got_ids = [p["id"] for p in res]
    got_sc = np.array([p["score"] for p in res])
    ref_pts = [int(cat.ids[r]) for r in ref_ids]
    ref_set = set(ref_pts)
    truth = np.array([ref[row_of[i]] for i in got_ids])       # prototype score of each Qdrant hit
    kth = ref_sc[-1] if ref_sc else 0.0
    full = len(ref_pts) == k                                   # the list was cut at k (ties possible there)
    inter = len(set(got_ids) & ref_set)
    tie_ok = sum(1 for i, s in zip(got_ids, truth) if i in ref_set or (full and abs(s - kth) <= 1e-5 * max(1, kth)))
    err = np.abs(got_sc - truth)
    return dict(k=k, n_ref=len(ref_pts), n_qdrant=len(got_ids),
                recall=inter / len(ref_pts) if ref_pts else (1.0 if not got_ids else 0.0),
                tie_aware_recall=tie_ok / len(ref_pts) if ref_pts else (1.0 if not got_ids else 0.0),
                same_order=got_ids == ref_pts,
                in_filter=bool(all(mask[row_of[i]] for i in got_ids)),
                max_abs_err=float(err.max()) if len(got_ids) else 0.0,
                max_rel_err=float((err[truth > 0] / truth[truth > 0]).max()) if (truth > 0).any() else 0.0,
                hits_scored_0_by_prototype=int((truth == 0).sum()),
                max_score=float(ref_sc[0]) if ref_sc else 0.0)


def check_ids(http, op, idx, val, ref, pool, row_of):
    res = []
    if idx:
        body = dict(query=dict(indices=idx, values=val), using=VECTOR, filter=dict(must=[dict(has_id=pool)]),
                    limit=len(pool), with_payload=False)
        res = http.post(f"/collections/{COLLECTION}/points/query", json=body).json()["result"]["points"]
    got = {p["id"]: p["score"] for p in res}
    truth = np.array([ref[row_of[i]] for i in pool])
    mine = np.array([got.get(i, 0.0) for i in pool])
    err = np.abs(mine - truth)
    return dict(n_ids=len(pool), n_nonzero_ref=int((truth > 0).sum()), n_returned=len(got),
                missing_nonzero=int(((truth > 0) & (mine == 0)).sum()),
                extra_nonzero=int(((truth == 0) & (mine > 0)).sum()),
                max_abs_err=float(err.max()),
                max_rel_err=float((err[truth > 0] / truth[truth > 0]).max()) if (truth > 0).any() else 0.0,
                max_score=float(truth.max()))


def summarize(rs):
    s = dict(n=len(rs), max_abs_err=max(r["max_abs_err"] for r in rs), max_rel_err=max(r["max_rel_err"] for r in rs))
    if rs[0]["kind"] == "bm25_topk":
        s.update(recall_mean=round(float(np.mean([r["recall"] for r in rs])), 5), recall_min=min(r["recall"] for r in rs),
                 tie_aware_recall_mean=round(float(np.mean([r["tie_aware_recall"] for r in rs])), 5),
                 tie_aware_recall_min=min(r["tie_aware_recall"] for r in rs),
                 lists_identical_incl_order=sum(r["same_order"] for r in rs),
                 all_in_filter=all(r["in_filter"] for r in rs), empty_lists=sum(1 for r in rs if r["n_ref"] == 0))
    else:
        s.update(missing_nonzero=sum(r["missing_nonzero"] for r in rs), extra_nonzero=sum(r["extra_nonzero"] for r in rs),
                 ids_mean=round(float(np.mean([r["n_ids"] for r in rs])), 1))
    return s


def main():
    t0 = time.time()
    cat = C.load()
    row_of = {int(p): i for i, p in enumerate(cat.ids)}
    cl = Client()
    http = httpx.Client(base_url=QDRANT, timeout=120)
    ops_out = []
    for q in trace():
        f = q["filter"]
        mask = mask_for(cat, f)
        rows = np.flatnonzero(mask)
        qf = qdrant_filter(f)
        prof, ref_cache = None, {}
        for op in q["ops"]:
            if op["kind"] not in ("bm25_topk", "bm25_score_ids"):
                continue
            role = op["role"]
            proto = None    # the profile with the prototype's own term selection (the trace's terms)
            if role == "profile:terms":
                fetch = next(o for o in q["ops"] if o["kind"] == "fetch_terms")
                seed_ids = q["id_lists"][fetch["ids"]]
                if prof is None:
                    r = http.post(f"/collections/{COLLECTION}/points", json=dict(
                        ids=seed_ids, with_vector=[VECTOR], with_payload=False)).json()["result"]
                    got = {p["id"]: (p.get("vector") or {}).get(VECTOR, dict(indices=[], values=[])) for p in r}
                    prof = cl.profile_query([got[i] for i in seed_ids])
                idx, val, terms, w_all, cutoff = prof
                proto = ([cl.term[t][0] for t, _ in op["terms"]], [w_all[cl.term[t][0]] for t, _ in op["terms"]])
                key = ("terms",)
                if key not in ref_cache:
                    ref_cache[key] = SC.term_scores([row_of[i] for i in seed_ids], CFG)
            else:
                idx, val, terms = cl.text_query(op["text"])
                cutoff, w_all = None, {}
                key = ("text", op["text"])
                if key not in ref_cache:
                    ref_cache[key] = S.scores(op["text"], CFG["body"]).astype(np.float64)
            ref = ref_cache[key]
            qs = compare_terms(terms, op["terms"])
            # explain query-side differences: a trace-only term of a text query has body df 0 (hits nothing); a swapped
            # profile term has exactly the weight of the last kept term (a tie at the terms_n cut)
            qs["explained"] = all(
                (cl.term.get(t, (0, 0))[1] == 0) if cutoff is None
                else abs(w_all.get(cl.term.get(t, (-1,))[0], -1) - cutoff) <= 1e-12
                for t in qs["only_trace"] + qs["only_client"])
            base = dict(query=q["id"], op=op["id"], kind=op["kind"], role=role, n_terms=len(idx), query_side=qs)
            pool = q["id_lists"].get(op.get("ids"), [])
            run = (lambda i, v: check_topk(http, op, i, v, ref, cat, row_of, rows, mask, qf)) if op["kind"] == "bm25_topk" \
                else (lambda i, v: check_ids(http, op, i, v, ref, pool, row_of))
            ops_out.append(dict(base, mode="client", **run(idx, val)))
            if proto is not None:
                ops_out.append(dict(base, mode="prototype_terms", **run(*proto)))
    # --- summary ----------------------------------------------------------------------------------------------------
    groups = {}
    for r in ops_out:
        groups.setdefault(f"{r['kind']} {r['role']} [{r['mode']}]", []).append(r)
    summary = {g: summarize(rs) for g, rs in sorted(groups.items())}
    qside = {}
    for r in ops_out:
        if r["mode"] != "client":
            continue
        g = qside.setdefault(r["role"], dict(n=0, same_terms=0, differing_explained=0, max_weight_abs_err_vs_trace=0.0))
        g["n"] += 1
        g["same_terms"] += r["query_side"]["same_terms"]
        g["differing_explained"] += (not r["query_side"]["same_terms"]) and r["query_side"]["explained"]
        g["max_weight_abs_err_vs_trace"] = max(g["max_weight_abs_err_vs_trace"], r["query_side"]["max_weight_abs_err"])
    diffs = [dict(query=r["query"], op=r["op"], role=r["role"], only_trace=r["query_side"]["only_trace"],
                  only_client=r["query_side"]["only_client"], explained=r["query_side"]["explained"])
             for r in ops_out if r["mode"] == "client" and not r["query_side"]["same_terms"]]
    below = [dict(query=r["query"], op=r["op"], role=r["role"], mode=r["mode"], recall=r["recall"],
                  tie_aware_recall=r["tie_aware_recall"]) for r in ops_out if r.get("tie_aware_recall", 1) < 1]
    out = dict(ops_checked=len(ops_out), seconds=round(time.time() - t0, 1),
               note="trace weights are rounded to 6 decimals, so query_side errors vs the trace are rounding",
               summary=summary, query_side=qside, query_side_differences=diffs, tie_aware_recall_below_1=below)
    print(json.dumps(dict(summary=summary, query_side=qside, below=below), indent=1))
    update_result("parity", out)
    json.dump(ops_out, open(os.path.join(os.path.dirname(__file__), "out", "parity_ops.json"), "w"))


if __name__ == "__main__":
    main()
