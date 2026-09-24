"""Live r3-combo-fast against a LOCAL Qdrant (built by live_build.py): fidelity and per-stage latency.

Usage: .venv/bin/python harness/live_bench.py <collection> [reps] [variants,comma-separated] [url]
  -> results/holdout/latency-live-<collection>.json

Pipeline per query, after the Jev reading (the captured reading stands in for it):
  prep    spell, negation split, era, facets, sparse query terms, Qdrant filter
  embed   query embeddings, one batch per model (main + facets + negations [+ English chips]); ONNX int8, 4 threads
  q1      one POST /points/query/batch: dense top 500, sparse top 300, facets / negations top 200 each
          [+ fingerprint top 500 in the all-Qdrant variants]; ids + scores, no payload
  fp      (local-state variants) hard filter + weighted sum over an in-process 50k x 74 matrix, top 500
  q2      (2req) second batch: exact scores of every candidate for each dense vector and fp_raw (has_id filter),
          votes / goodwatch_score / year payload on the fp_raw search
  fuse    candidate union, candidate scores (local variants), z-score fusion as rankers3.hyb3, top 100
  blend   blend3 title-kind blend incl. fuzzy title match

Variants:
  1req-floor     one Qdrant request; a candidate outside a list gets that list's k-th score (a true floor)
                 [fingerprint, priors, years in process]
  1req-localvec  one Qdrant request for candidate lists; exact candidate scores from in-process eligible embedding
                 matrices (bge 50k x 768, me5s 50k x 384) and fingerprints. Same semantics as the harness.
  2req-qdrant    stateless: fingerprint list = fp_raw (dot on raw 0..10 scores = weighted sum) in request 1, then
                 request 2 fetches exact candidate scores + prior payload. Same semantics as the harness except
                 the non-English z-mix (candidate-set stats instead of the whole eligible catalog).
  1req-formula   latency probe only: fingerprint list = formula sum(w_k * fingerprint_scores.k) over a prefetch of
                 2000 by fingerprint_v1 cosine (production's d4 pool), floors like 1req-floor.
Embeddings: "cached" (the harness's fp32 sentence-transformers vectors: isolates the Qdrant path) or "onnx"
(int8 model_quantized.onnx; ONNX_FP32=1 uses model.onnx). MODES=cached,onnx picks the modes.
Run with OPENBLAS_NUM_THREADS=1: idle OpenBLAS threads spin and slow the ONNX threads down about 3x.

Note: rankers3._floor is a no-op (np.minimum keeps every score below the k-th unchanged), so the harness's
r3-combo-fast used exact scores for every candidate. 1req-floor is what "one request, lists only" really gives.
"""
import glob, json, os, statistics, sys, time, zlib
from urllib.parse import urlparse

import httpx
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blend2 as B2  # noqa: E402
import blend3 as B3  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import qemb  # noqa: E402
import rankers3 as R3  # noqa: E402
import sparse as S  # noqa: E402
from rankers import z  # noqa: E402
from rankers2 import facets, split_negation  # noqa: E402

COLL = sys.argv[1]
REPS = int(sys.argv[2]) if len(sys.argv) > 2 else 5
VARIANTS = sys.argv[3].split(",") if len(sys.argv) > 3 else ["1req-floor", "1req-localvec", "2req-qdrant", "1req-formula"]
URL = sys.argv[4] if len(sys.argv) > 4 else "http://127.0.0.1:6533"
assert urlparse(URL).hostname in ("127.0.0.1", "localhost"), "local Qdrant only"

CFG = dict(a=0.4, b=0.48, c=0.12, prior=(0.1, 0.1), neg=0.1, facet=0.1, era_w=0.3, nonen_mix=0.5)
K = dict(dense=500, fp=500, sparse=300, facet=200, neg=200)
LIMIT = 100


def term_index(t):  # same as live_build.term_index
    return zlib.crc32(t.encode("utf-8"))


# --- query embedding -------------------------------------------------------------------------------

HUB = os.path.expanduser("~/.cache/huggingface/hub")


class Onnx:
    def __init__(self, repo, prefix, pooling):
        snap = glob.glob(f"{HUB}/models--Xenova--{repo}/snapshots/*/")[0]
        so = ort.SessionOptions()
        so.intra_op_num_threads = 4
        so.inter_op_num_threads = 1
        f = "model.onnx" if os.environ.get("ONNX_FP32") else "model_quantized.onnx"
        self.s = ort.InferenceSession(snap + "onnx/" + f, so, providers=["CPUExecutionProvider"])
        self.tok = Tokenizer.from_file(snap + "tokenizer.json")
        self.tok.enable_truncation(512)
        self.tok.enable_padding()
        self.prefix, self.pooling = prefix, pooling

    def embed(self, texts):
        enc = self.tok.encode_batch([self.prefix + t for t in texts])
        ids = np.array([e.ids for e in enc], np.int64)
        am = np.array([e.attention_mask for e in enc], np.int64)
        h = self.s.run(None, {"input_ids": ids, "attention_mask": am, "token_type_ids": np.zeros_like(ids)})[0]
        if self.pooling == "cls":
            v = h[:, 0]
        else:
            m = am[:, :, None].astype(np.float32)
            v = (h * m).sum(1) / m.sum(1)
        return (v / np.linalg.norm(v, axis=1, keepdims=True)).astype(np.float32)


ONNX = {"bgeb-notitle": Onnx("bge-base-en-v1.5", C.EMBEDDINGS["bgeb"][2], "cls"),
        "me5s": Onnx("multilingual-e5-small", "query: ", "mean")}
USING = {"bgeb-notitle": "bge", "me5s": "me5s"}


def embed_all(groups, mode):
    out = {}
    for name, texts in groups.items():
        if texts:
            out[name] = ONNX[name].embed(texts) if mode == "onnx" else np.stack([qemb.embed(name, t) for t in texts])
    return out


# --- in-process state (what a stateful service keeps in memory) ------------------------------------

cat = C.load()
EROWS = np.flatnonzero(cat.eligible())
PID = cat.ids[EROWS]
POS = {int(p): i for i, p in enumerate(PID)}
FPS = np.ascontiguousarray(cat.fps[EROWS])
LV = np.log1p(cat.votes[EROWS]).astype(np.float64)
GW = cat.goodwatch_score[EROWS].astype(np.float64)
YEAR = cat.year[EROWS]
IS_SHOW = cat.is_show[EROWS]
PM_ANIM = np.array([cat.production_method[r] == "Animation" for r in EROWS])
PM_LIVE = np.array([cat.production_method[r] == "Live-Action" for r in EROWS])
FLAG = {k: cat.flags[k][EROWS] == 1 for k in C.BOOL_FLAGS}
EMB = {n: np.ascontiguousarray(C.embeddings(n)[EROWS]) for n in ("bgeb-notitle", "me5s")}
R3.word_freq(); B2.vocabulary(); B2.eligible_titles(); B3.creator_tokens()  # startup indexes


def hard(flags):
    """(must, must_not, local compact mask) for production's hard filter."""
    must, must_not = [{"key": "votes", "range": {"gte": 2000}}], []
    m = np.ones(len(EROWS), bool)
    for fid, decision, _ in flags:
        wanted = decision == "required"
        if not wanted and (fid.startswith("suitability_") or fid.startswith("context_")):
            continue
        if fid in ("movie", "show"):
            cond, has = {"key": "media_type", "match": {"value": fid}}, (IS_SHOW if fid == "show" else ~IS_SHOW)
        elif fid == "animated":
            cond, has = {"key": "production_method", "match": {"value": "Animation"}}, PM_ANIM
        elif fid == "live_action":
            cond, has = {"key": "production_method", "match": {"value": "Live-Action"}}, PM_LIVE
        else:
            cond, has = {"key": fid, "match": {"value": True}}, FLAG[fid]
        (must if wanted else must_not).append(cond)
        m &= has if wanted else ~has
    return must, must_not, m


# TCP_NODELAY: without it, bodies over ~150 KB hit a Nagle / delayed-ACK stall of ~40 ms (Node sets noDelay by default).
http = httpx.Client(base_url=URL, timeout=30, transport=httpx.HTTPTransport(
    socket_options=[(__import__("socket").IPPROTO_TCP, __import__("socket").TCP_NODELAY, 1)]))


def batch(searches, st, key):
    body = json.dumps({"searches": searches})
    if os.environ.get("DUMP"):  # request bodies for the Node replay (live_replay.mjs)
        with open(os.environ["DUMP"], "a") as f:
            f.write(json.dumps({"key": key, "n": len(searches), "body": body}) + "\n")
    r = http.post(f"/collections/{COLL}/points/query/batch", content=body, headers={"content-type": "application/json"})
    r.raise_for_status()
    out = r.json()
    st[f"{key}_resp_bytes"] = len(r.content)
    st[f"{key}_req_bytes"] = len(body)
    st[f"{key}_server"] = out["time"] * 1000
    st[f"{key}_n"] = len(searches)
    return [x["points"] for x in out["result"]]


def as_dict(hits):
    return {POS[h["id"]]: h["score"] for h in hits}


def floor_of(hits, k):
    return hits[-1]["score"] if len(hits) >= k else (min(h["score"] for h in hits) if hits else 0.0)


def run(ctx, variant, mode, st):
    t0 = time.perf_counter()
    text = ctx.text
    non_en = ctx.non_english or R3.looks_foreign(text)
    main = "me5s" if non_en else "bgeb-notitle"
    if not non_en:
        text, _ = R3.spell(text)
    positive, negated = split_negation(text)
    must, must_not, lmask = hard(ctx.flags)
    era = R3.parse_era(ctx.text)
    if era and era[0] == "range":
        m2 = lmask & (YEAR >= era[1]) & (YEAR <= era[2])
        if m2.sum() >= 50:
            lmask = m2
            must = must + [{"key": "year", "range": {"gte": era[1], "lte": era[2]}}]
    flt = {"must": must, "must_not": must_not}
    fcs = facets(ctx, "phrases")
    groups = {main: [positive] + fcs + negated}
    en_pos, en_neg = R3.english_from_chips(ctx) if non_en else ("", [])
    if en_pos:
        groups.setdefault("bgeb-notitle", []).extend([en_pos] + en_neg)
    sq = None
    if not non_en:
        idx = {}
        for t in S.query_terms(positive):
            idx.setdefault(term_index(t), 1.0)
        sq = {"indices": list(idx), "values": list(idx.values())} if idx else None
    t1 = time.perf_counter()

    V = embed_all(groups, mode)
    t2 = time.perf_counter()

    # vectors by role: (tag, emb name, vector, list k)
    nf, nn = len(fcs), len(negated)
    vecs = [("dense", main, V[main][0], K["dense"])]
    vecs += [(f"facet{i}", main, V[main][1 + i], K["facet"]) for i in range(nf)]
    vecs += [(f"neg{i}", main, V[main][1 + nf + i], K["neg"]) for i in range(nn)]
    if en_pos:
        bv = V["bgeb-notitle"]
        vecs.append(("dense_en", "bgeb-notitle", bv[0], K["dense"]))
        vecs += [(f"xneg{i}", "bgeb-notitle", bv[1 + i], K["neg"]) for i in range(len(en_neg))]
    searches, tags = [], []
    for tag, name, v, k in vecs:
        searches.append({"query": v.tolist(), "using": USING[name], "limit": k, "filter": flt, "with_payload": False})
        tags.append(tag)
    if sq:
        searches.append({"query": sq, "using": "lex", "limit": K["sparse"], "filter": flt, "with_payload": False})
        tags.append("sparse")
    w = ctx.wvec
    stateless = variant in ("2req-qdrant", "1req-formula")
    if stateless and w.any():
        if variant == "2req-qdrant":
            searches.append({"query": w.tolist(), "using": "fp_raw", "limit": K["fp"], "filter": flt, "with_payload": False,
                             "params": {"exact": True}})  # HNSW on dot with negative weights misses titles
        else:
            formula = {"sum": [{"mult": [float(w[j]), f"fingerprint_scores.{C.DIMS[j]}"]} for j in np.flatnonzero(w)]}
            searches.append({"prefetch": {"query": (w / np.linalg.norm(w)).tolist(), "using": "fingerprint_v1",
                                          "limit": 2000, "filter": flt},
                             "query": {"formula": formula}, "limit": K["fp"],
                             "with_payload": ["votes", "goodwatch_score", "year"]})
        tags.append("fp")
    res = dict(zip(tags, batch(searches, st, "q1")))
    t3 = time.perf_counter()

    ws_full = None
    if not stateless:
        rows_l = np.flatnonzero(lmask)
        ws_full = FPS @ w
        k = min(K["fp"], len(rows_l))
        wr = ws_full[rows_l]
        f_top = rows_l[np.argpartition(-wr, k - 1)[:k]] if k else rows_l
    t4 = time.perf_counter()

    # candidates (dense list: for non-English the 50/50 mix of me5s native and bge English chips)
    dense = as_dict(res["dense"])
    dfl = floor_of(res["dense"], K["dense"])
    mix_lists = None
    if "dense_en" in res:
        den, efl = as_dict(res["dense_en"]), floor_of(res["dense_en"], K["dense"])
        U = np.array(sorted(set(dense) | set(den)))
        e1, e2 = np.array([dense.get(i, dfl) for i in U]), np.array([den.get(i, efl) for i in U])
        mix = (1 - CFG["nonen_mix"]) * z(e1) + CFG["nonen_mix"] * z(e2)
        order = np.argsort(-mix, kind="stable")[:K["dense"]]
        mix_lists = True
        dense = {int(U[i]): float(mix[i]) for i in order}
        dfl = float(mix[order[-1]])
    parts = [np.fromiter(dense, np.int64)]
    if stateless and "fp" in res:
        parts.append(np.fromiter(as_dict(res["fp"]), np.int64))
    elif not stateless:
        parts.append(f_top)
    sp_d = {}
    if "sparse" in res:
        sp_d = {POS[h["id"]]: h["score"] for h in res["sparse"] if h["score"] > 0}
        parts.append(np.fromiter(sp_d, np.int64, len(sp_d)))
    for i in range(nf):
        parts.append(np.fromiter(as_dict(res[f"facet{i}"]), np.int64))
    cand = np.unique(np.concatenate(parts))
    pids = PID[cand]

    # candidate scores per signal
    sc = {}
    meta = {}
    t5a = time.perf_counter()
    if variant in ("1req-floor", "1req-formula"):
        for tag, _, _, k in vecs:
            if tag == "dense" and mix_lists:
                continue
            d, fl = as_dict(res[tag]), floor_of(res[tag], k)
            sc[tag] = np.array([d.get(i, fl) for i in cand])
        if mix_lists:
            sc["dense"] = np.array([dense.get(i, dfl) for i in cand])
        if variant == "1req-formula":
            hits = res.get("fp", [])
            d, fl = as_dict(hits), floor_of(hits, K["fp"])
            sc["ws"] = np.array([d.get(i, fl) for i in cand])
            meta = {POS[h["id"]]: h["payload"] for h in hits}
        else:
            sc["ws"] = ws_full[cand]
    elif variant == "1req-localvec":
        for tag, name, v, _ in vecs:
            sc[tag] = EMB[name][cand] @ v
        if mix_lists:  # harness semantics: z over the whole filtered catalog
            rows_l = np.flatnonzero(lmask)
            a1 = (EMB[main] @ V[main][0])[rows_l]
            a2 = (EMB["bgeb-notitle"] @ V["bgeb-notitle"][0])[rows_l]
            m = CFG["nonen_mix"]
            sc["dense"] = (1 - m) * (sc["dense"] - a1.mean()) / (a1.std() or 1) + \
                m * (sc["dense_en"] - a2.mean()) / (a2.std() or 1)
        sc["ws"] = ws_full[cand]
    else:  # 2req-qdrant
        ids = pids.tolist()
        f2 = {"must": [{"has_id": ids}]}
        s2, t2g = [], []
        for tag, name, v, _ in vecs:
            s2.append({"query": v.tolist(), "using": USING[name], "limit": len(ids), "filter": f2,
                       "with_payload": False, "params": {"exact": True}})
            t2g.append(tag)
        s2.append({"query": w.tolist() if w.any() else [0.0] * 74, "using": "fp_raw", "limit": len(ids), "filter": f2,
                   "with_payload": ["votes", "goodwatch_score", "year"], "params": {"exact": True}})
        t2g.append("ws")
        r2 = dict(zip(t2g, batch(s2, st, "q2")))
        for tag, hits in r2.items():
            d = as_dict(hits)
            sc[tag] = np.array([d.get(i, 0.0) for i in cand])
        meta = {POS[h["id"]]: h["payload"] for h in r2["ws"]}
        if mix_lists:
            m = CFG["nonen_mix"]
            sc["dense"] = (1 - m) * z(sc["dense"]) + m * z(sc["dense_en"])
    t5 = time.perf_counter()

    score = CFG["a"] * z(sc["dense"]) + CFG["b"] * z(sc["ws"])
    if sp_d:
        s = np.array([sp_d.get(i, 0.0) for i in cand])
        if s.any():
            score += CFG["c"] * z(s)
    if nf:
        fz = np.stack([z(sc[f"facet{i}"]) for i in range(nf)])
        score += CFG["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    pens = [sc[t] for t, _, _, _ in vecs if t.startswith(("neg", "xneg"))]
    if pens:
        score -= CFG["neg"] * z(np.max(np.stack(pens), axis=0))
    if stateless:
        lv = np.log1p(np.array([(meta.get(i) or {}).get("votes", 2000) for i in cand], np.float64))
        gw = np.array([(meta.get(i) or {}).get("goodwatch_score") for i in cand], dtype=float)
        yr = np.array([(meta.get(i) or {}).get("year", 0) for i in cand], np.float64)
    else:
        lv, gw, yr = LV[cand], GW[cand].copy(), YEAR[cand].astype(np.float64)
    gw = np.where(np.isnan(gw), np.nanmean(gw) if np.isfinite(gw).any() else 0, gw)
    score = score + CFG["prior"][0] * z(lv) + CFG["prior"][1] * z(gw)
    if era and era[0] != "range":
        y = np.where(yr > 0, yr, np.median(yr[yr > 0]) if (yr > 0).any() else 2000)
        score += CFG["era_w"] * (z(np.minimum(y, 2026)) if era[0] == "recent" else z(-y))
    k = min(LIMIT, len(cand))
    top = np.argpartition(-score, k - 1)[:k]
    top = top[np.argsort(-score[top], kind="stable")]
    disc = [(int(pids[i]), j + 1, float(score[i])) for j, i in enumerate(top)]
    t6 = time.perf_counter()
    out = B3.blend(ctx, disc, strict=0.9, fuzzy=0.88, kind=True, cap=0.65)
    t7 = time.perf_counter()
    q2 = (t5 - t5a) if variant == "2req-qdrant" else 0.0
    fuse = (t5a - t4) + ((t5 - t5a) - q2) + (t6 - t5)
    st.update(prep=(t1 - t0) * 1e3, embed=(t2 - t1) * 1e3, q1=(t3 - t2) * 1e3, fp=(t4 - t3) * 1e3, q2=q2 * 1e3,
              fuse=fuse * 1e3, blend=(t7 - t6) * 1e3, total=(t7 - t0) * 1e3, n_cand=len(cand),
              n_texts=sum(len(v) for v in groups.values()))
    return [x["id"] for x in out[:10]]


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(round(p * (len(v) - 1))))]


def main():
    ref = json.load(open(os.path.join(C.ARENA, "results", "round3", "lists", "r3-combo-fast.json")))
    ctxs = X.contexts(set(ref))  # the 69 queries with an offline r3-combo-fast list
    out_path = os.path.join(C.ARENA, "results", "holdout", f"latency-live-{COLL}.json")
    report = json.load(open(out_path)) if os.path.exists(out_path) else {}
    report.update(collection=COLL, reps=REPS)
    report.setdefault("variants", {})
    for variant in VARIANTS:
        for mode in os.environ.get("MODES", "cached,onnx").split(","):
            if variant == "1req-formula" and mode == "cached":
                continue
            for c in ctxs[:5]:
                run(c, variant, mode, {})  # warm-up
            fid, per = {}, {}
            for rep in range(REPS if mode == "onnx" else 1):
                for c in ctxs:
                    st = {}
                    top10 = run(c, variant, mode, st)
                    per.setdefault(c.id, []).append(st)
                    if rep == 0:
                        r10 = [x["id"] for x in ref[c.id][:10]]
                        fid[c.id] = dict(overlap=len(set(top10) & set(r10)), same_order=top10 == r10,
                                         top1=bool(top10) and bool(r10) and top10[0] == r10[0], split=c.split,
                                         non_en=bool(c.non_english or R3.looks_foreign(c.text)))
            key = f"{variant}/{mode}" + ("-fp32" if mode == "onnx" and os.environ.get("ONNX_FP32") else "")
            keys = sorted({k for c in ctxs for x in per[c.id] for k in x})
            stages = {}
            for s in keys:
                med = [statistics.median(x.get(s, 0) for x in per[c.id]) for c in ctxs]
                stages[s] = dict(p50=pct(med, 0.5), p95=pct(med, 0.95), max=max(med), mean=statistics.mean(med))
            ov = [f["overlap"] for f in fid.values()]
            report["variants"][key] = dict(
                stages=stages, overlap_mean=statistics.mean(ov), overlap_10of10=sum(o == 10 for o in ov),
                same_order=sum(f["same_order"] for f in fid.values()), top1=sum(f["top1"] for f in fid.values()),
                worst=sorted(((f["overlap"], q) for q, f in fid.items()))[:8],
                dev_overlap=statistics.mean(f["overlap"] for f in fid.values() if f["split"] == "dev"),
                nonen=[(q, f["overlap"]) for q, f in fid.items() if f["non_en"]], per_query=fid,
                per_query_total={c.id: statistics.median(x["total"] for x in per[c.id]) for c in ctxs})
            v = report["variants"][key]
            print(f"{key:24s} overlap {v['overlap_mean']:.2f} (10/10: {v['overlap_10of10']}, order {v['same_order']}, "
                  f"top1 {v['top1']}) worst {v['worst'][:5]} nonen {v['nonen']}", flush=True)
            print("   " + "  ".join(f"{s} {d['p50']:.1f}/{d['p95']:.1f}/{d['max']:.1f}" for s, d in stages.items()), flush=True)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    json.dump(report, open(out_path, "w"), indent=1)


if __name__ == "__main__":
    main()
