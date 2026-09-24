"""How the BM25F corpus constants drift as titles change, and what a stale document side costs.

.venv/bin/python bench/sparse/drift.py

The stored values w(t, d) depend on the corpus only through avglen_f (4 numbers); IDF (df, N) lives in the client.
Simulation: the "build-time" corpus is today's eligible corpus minus m titles, which stand for the titles added or
rewritten since the build (about 260 changed titles per 48 hours, all counted as new eligible titles: pessimistic).
Two choices of the m titles: random, and the newest by release year (a systematic shift, since new titles differ).
For each m, on today's corpus and the trace's text BM25 top-k ops (main query, coverage units, mentions):
  stale_doc   document values built with the old avglen, IDF current (client stats refreshed)
  stale_both  old avglen and old IDF (terms unknown to the old stats dropped)
compared with a fresh build: top-300 recall and the relative score error of the fresh top 300.
"""
import json, os, sys

import numpy as np

from common import ARENA, BODY_FIELDS, C, S, avglens, doc_values, field_counts, idf_from_df, trace, update_result

sys.path.insert(0, os.path.join(ARENA, "bench", "replay"))
from prepare import mask_for, topk  # noqa: E402

PER_48H = 260


def main():
    cat = C.load()
    rows_all = np.arange(len(cat.ids))
    elig = cat.votes >= 2000
    mats, lens, vocab = field_counts(cat, rows_all)
    avg = avglens(lens, elig)
    D = doc_values(mats, lens, avg).tocsc()
    E = np.flatnonzero(elig)
    df = np.asarray((D[E] > 0).sum(0)).ravel().astype(np.float64)
    N = len(E)
    idf = idf_from_df(df, N)

    ops = []
    for q in trace():
        mask = mask_for(cat, q["filter"])
        for o in q["ops"]:
            if o["kind"] == "bm25_topk" and o.get("text"):
                cols = [vocab[t] for t in S.query_terms(o["text"]) if t in vocab and df[vocab[t]] > 0]
                if cols:
                    ops.append((np.flatnonzero(mask), np.array(cols)))
    print(len(ops), "text ops", flush=True)

    def run(Dx, idfx, known):
        out = []
        for rows, cols in ops:
            c = cols[known[cols]]
            s = (Dx[:, c] @ idfx[c].astype(np.float32)) if len(c) else np.zeros(D.shape[0], np.float32)
            out.append(np.asarray(s).ravel())
        return out

    fresh = run(D, idf, np.ones(len(df), bool))
    rng = np.random.default_rng(0)
    order_new = E[np.argsort(-np.nan_to_num(cat.year[E].astype(np.float64), nan=0), kind="stable")]
    res = dict(per_48h=PER_48H, N=N, avglen={f: float(avg[f]) for f in BODY_FIELDS}, scenarios={})
    for days in (2, 15, 30, 90, 180):
        m = PER_48H * days // 2
        for how in ("random", "newest"):
            removed = rng.choice(E, m, replace=False) if how == "random" else order_new[:m]
            old = elig.copy()
            old[removed] = False
            avg_o = avglens(lens, old)
            D_o = doc_values(mats, lens, avg_o).tocsc()
            Eo = np.flatnonzero(old)
            df_o = np.asarray((D[Eo] > 0).sum(0)).ravel().astype(np.float64)
            idf_o = idf_from_df(df_o, len(Eo))
            # document values: relative change on every stored value (eligible rows)
            a, b = D[E].tocsr(), D_o[E].tocsr()
            rel = np.abs(a.data - b.data) / a.data
            # IDF: relative change on the query terms the trace uses
            qcols = np.unique(np.concatenate([c for _, c in ops]))
            known = df_o > 0
            idf_rel = np.abs(idf[qcols] - idf_o[qcols]) / idf[qcols]
            sc = {}
            for name, (Dx, idfx, kn) in dict(stale_doc=(D_o, idf, np.ones(len(df), bool)),
                                             stale_both=(D_o, idf_o, known)).items():
                recs, errs = [], []
                for (rows, _), f_s, s_s in zip(ops, fresh, run(Dx, idfx, kn)):
                    fi, fv = topk(rows, f_s[rows], 300, positive_only=True)
                    si, _ = topk(rows, s_s[rows], 300, positive_only=True)
                    if fi:
                        recs.append(len(set(fi) & set(si)) / len(fi))
                        fv = np.array(fv)
                        errs.append(float((np.abs(s_s[fi] - fv) / fv).max()))
                sc[name] = dict(recall300_mean=round(float(np.mean(recs)), 5), recall300_min=round(float(np.min(recs)), 4),
                                top300_score_rel_err_median=float(np.median(errs)), top300_score_rel_err_max=float(np.max(errs)))
            key = f"{days}d_{how}"
            res["scenarios"][key] = dict(
                titles_changed=int(m), share_of_corpus=round(m / N, 4),
                avglen_rel_change={f: round(float(abs(avg_o[f] - avg[f]) / avg[f]), 5) for f in BODY_FIELDS},
                doc_value_rel_change_max=float(rel.max()), doc_value_rel_change_p99=float(np.quantile(rel, 0.99)),
                query_idf_rel_change_median=float(np.median(idf_rel)), query_idf_rel_change_max=float(idf_rel.max()),
                query_terms_unknown_to_old_stats=int((~known[qcols]).sum()), **sc)
            print(key, json.dumps(res["scenarios"][key]), flush=True)
    update_result("drift", res)


if __name__ == "__main__":
    main()
