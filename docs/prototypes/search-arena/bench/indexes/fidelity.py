"""Fidelity of the production index builders (goodwatch-flows f/search/index_builders.py) against the ranker's own
in-memory indexes (harness/simp_combo.py, FINAL["combo-safe-v3"]).

Two checks:

  logic    feed the builders the arena's own inputs (data/catalog.pkl, data/.credits-raw.pkl.gz, the stored
           embeddings) and compare every index with the prototype's version built from the same inputs. Any
           difference here is a logic difference.
  prod     compare a production build (the index files downloaded from Crate, plus the reference profiles from
           Qdrant) with the prototype on the graded queries: name resolution, credits of the resolved entities,
           reference-profile centroids and terms, term df of the query terms. Differences here come from fresher
           data; the report lists them so they can be checked.

Usage (from docs/prototypes/search-arena, with the arena's .venv; ARENA_DIR points at an arena checkout with the data):
  .venv/bin/python bench/indexes/fidelity.py logic [--out=results/bench/indexes-logic.json]
  .venv/bin/python bench/indexes/fidelity.py prod <dir with the downloaded build> [--out=results/bench/indexes-prod.json]
"""
import base64, gzip, json, os, pickle, sys, time, types
from collections import Counter, defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE)))))
# The arena's gitignored data (catalog, embeddings, raw credits, captures) lives in the worktree that ran it.
ARENA = os.environ.get("ARENA_DIR", os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ARENA, "harness"))
sys.path.insert(0, os.path.join(REPO, "goodwatch-flows", "windmill"))

import catalog as C  # noqa: E402
import context as X  # noqa: E402
import simp_combo as M  # noqa: E402
import sparse as SP  # noqa: E402
from f.search import index_builders as B  # noqa: E402

CFG = M.FINAL["combo-safe-v3"][0]


def arg(name, default=None):
    for a in sys.argv:
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


# === arena inputs ========================================================================================

def arena_sources():
    cat = C.load()
    el = np.flatnonzero(cat.eligible())
    titles = []
    for r in el:
        titles.append(B.Title(
            point_id=int(cat.ids[r]), media_type=cat.media_type(r), tmdb_id=int(cat.tmdb_id[r]), title=cat.title[r],
            original_title=cat.original_title[r], year=int(cat.year[r]), votes=int(cat.votes[r]),
            goodwatch_score=None if np.isnan(cat.goodwatch_score[r]) else float(cat.goodwatch_score[r]),
            popularity=float(cat.popularity[r]), imdb_id=cat.imdb_id[r],
            flags={k: (None if v[r] < 0 else bool(v[r])) for k, v in cat.flags.items()},
            production_method=cat.production_method[r], essence_text=cat.essence_text[r],
            essence_tags=cat.essence_tags[r], keywords=cat.keywords[r], tropes=cat.tropes[r]))
    raw = pickle.load(gzip.open(os.path.join(C.DATA, ".credits-raw.pkl.gz"), "rb"))
    people = {r[0]: B.Person(r[1], r[2], r[3], r[4]) for r in raw["person"]}
    media = {(mt, m): (pc, nw) for mt, m, pc, nw in raw["media"]}
    terms = set()
    for t in titles:
        terms |= B.title_terms(t)
    return B.Sources(
        titles=titles, fingerprints=cat.fp[el], text_en=C.embeddings("bgeb-notitle")[el],
        text_multi=C.embeddings("me5s")[el],
        crew=[(mt, m, p, job, ep) for mt, m, p, job, ep in raw["crew"]],
        cast=[(mt, m, p, od, ep) for mt, m, p, od, ch, ep in raw["cast"]],
        people=people, media_companies=media, company_names={r[0]: r[1] for r in raw["company"]},
        network_names={r[0]: r[1] for r in raw["network"]}, term_ids={t: i for i, t in enumerate(sorted(terms))},
    ), el


def diff_summary(a, b, name, show=5):
    """a, b: dicts; counts keys only in one side and keys whose values differ."""
    only_a = [k for k in a if k not in b]
    only_b = [k for k in b if k not in a]
    changed = [k for k in a if k in b and a[k] != b[k]]
    return {"index": name, "prototype": len(a), "build": len(b), "only_prototype": len(only_a),
            "only_build": len(only_b), "different": len(changed),
            "examples": {"only_prototype": [repr(k) for k in only_a[:show]], "only_build": [repr(k) for k in only_b[:show]],
                         "different": [repr((k, a[k], b[k]))[:300] for k in changed[:show]]}}


# === name detection on the graded queries ==================================================================

class _Cand:
    """The prototype's Candidate shape for an entity of a build: kind "person" (a team too) or "studio"."""

    def __init__(self, kind, name, ids, mass=0.0):
        self.kind, self.name, self.ids, self.mass = kind, name, tuple(ids), mass


def detections(resolved=None, wf=None):
    """query id -> [(kind, sorted ids, span)] of M.detect over every query. With `resolved` (key -> _Cand) and `wf`
    (word -> df), detect reads those instead of the prototype's own name index and word frequencies."""
    saved = (M.resolve_key, M.fuzzy_keys, M.name_index, M.word_freq)
    if resolved is not None:
        vocab = [w for w, c in wf.items() if c >= 20 and w.isalpha()]
        M.resolve_key = lambda key, cfg: resolved.get(key)
        M.fuzzy_keys = lambda cfg: sorted(k for k in resolved if " " in k)
        M.name_index = lambda cfg: {k: [c] for k, c in resolved.items()}
        M.word_freq = lambda: (wf, vocab)
    try:
        out = {}
        for q in X.queries():
            det = M.detect(q["query"], CFG)
            out[q["id"]] = [] if det is None else [(e.kind, tuple(sorted(e.ids)), e.span) for e in det.entities]
        return out
    finally:
        M.resolve_key, M.fuzzy_keys, M.name_index, M.word_freq = saved


def compare_detections(proto, build):
    diff = {q: (proto[q], build.get(q)) for q in proto if proto[q] != build.get(q)}
    return {"index": "names detected in the graded queries", "queries": len(proto),
            "with_names": sum(1 for v in proto.values() if v), "different": len(diff),
            "examples": {q: repr(v)[:300] for q, v in list(diff.items())[:10]}}


# === logic check ===========================================================================================

def logic():
    t0 = time.time()
    cat = C.load()
    src, el = arena_sources()
    t_src = time.time() - t0
    pid_of = {r: int(cat.ids[r]) for r in el}          # catalog row -> point id
    row_of = {int(cat.ids[r]): i for i, r in enumerate(el)}   # point id -> build row
    t1 = time.time()
    tc = B.title_credits(src)
    credits = B.person_credits(src, tc)
    persons = B.kept_persons(src, tc)
    st = B.studios(src)
    wf = B.word_frequencies(src.titles)
    votes = np.array([t.votes for t in src.titles], np.int64)
    point_ids = np.array([t.point_id for t in src.titles], np.int64)
    idx = B.name_index(votes, persons, credits, st)
    resolved = B.resolved_keys(idx, wf)
    ti = B.term_index(src.titles, src.term_ids)
    t_build = time.time() - t1
    out = {"inputs_seconds": round(t_src, 1), "builders_seconds": round(t_build, 1), "checks": []}
    add = out["checks"].append

    # credits: person -> {point id: (weight, role)}
    pc = {pid: {pid_of[r]: v for r, v in d.items()} for pid, d in M.credits(CFG).items()}
    bc = {pid: {int(point_ids[r]): v for r, v in d.items()} for pid, d in credits.items()}
    add(diff_summary(pc, bc, "credits (person -> {title: (weight, role)})"))

    # persons: the prototype's persons.json counts the old fallback creators (top Executive Producers); the build
    # counts the writer fallback. Compare the key sets, then the name index itself.
    pp = {pid: (v["name"], v.get("original_name")) for pid, v in M.persons().items()}
    bp = {pid: (v.name, v.original_name) for pid, v in persons.items()}
    add(diff_summary(pp, bp, "persons (kept for the name index)"))

    # studios
    ps = {k: (n, {pid_of[r]: w for r, w in rw.items()}) for k, (n, rw) in M.studios(CFG).items()}
    bs = {k: (n, {int(point_ids[r]): w for r, w in rw.items()}) for k, (n, rw) in st.items()}
    add(diff_summary(ps, bs, "studios ((c|n, id) -> (name, {title: weight}))"))

    # word frequencies
    add(diff_summary(dict(M.word_freq()[0]), dict(wf), "word frequencies"))
    add({"index": "spell vocabulary", "same": sorted(M.word_freq()[1]) ==
         sorted(w for w, c in wf.items() if c >= B.SPELL_MIN_DF and w.isalpha())})

    # name index: the resolution of every key (the only way the ranker reads it)
    pidx = M.name_index(CFG)
    pwf = M.word_freq()[0]

    def canon_p(c):
        if c.kind == "studio":
            return ("studio", tuple(sorted(c.ids)))
        return ("team" if len(c.ids) > 1 else "person", tuple(sorted(c.ids)))

    def canon_b(c):
        return (c.kind, tuple(sorted(c.members)))

    pres = {k: canon_p(cs[0]) for k, cs in pidx.items() if M.resolves(cs, pwf.get(k, 0), CFG)}
    bres = {k: canon_b(c) for k, c in resolved.items()}
    add(diff_summary(pres, bres, "resolved name keys (key -> entity)"))
    add({"index": "fuzzy keys (multi-word keys that resolve)", "prototype": len(M.fuzzy_keys(CFG)),
         "build": sum(1 for k in resolved if " " in k),
         "same": sorted(M.fuzzy_keys(CFG)) == sorted(k for k in resolved if " " in k)})
    # masses of the resolved entities
    pm = {k: pidx[k][0].mass for k in pres}
    bm = {k: resolved[k].mass for k in bres}
    add(diff_summary(pm, bm, "resolved entity mass"))
    bcand = {k: _Cand("studio" if c.kind == "studio" else "person", c.name, c.members, c.mass) for k, c in resolved.items()}
    add(compare_detections(detections(), detections(bcand, wf)))

    # term statistics (body fields, eligible titles)
    rows_idx, vocab, Xb, idf = SP.index(CFG["body"])
    dfp = np.diff(Xb.indptr)
    pdf = {t: int(dfp[j]) for t, j in vocab.items() if dfp[j] > 0}
    bdf = dict(zip(ti.terms, ti.df.tolist()))
    add(diff_summary(pdf, bdf, "term df (body fields)"))
    pidf = {t: float(idf[j]) for t, j in vocab.items() if dfp[j] > 0}
    bidf = dict(zip(ti.terms, ti.idf.tolist()))
    add(diff_summary(pidf, bidf, "term idf (bitwise)"))
    add({"index": "eligible titles (N)", "prototype": int(Xb.shape[0]), "build": ti.n})

    # collocations
    _, vall, Xall, _ = SP.index()
    dfa = np.diff(Xall.indptr)
    pcol = set()
    for t, j in vall.items():
        if "_" in t:
            a, b = t.split("_", 1)
            ja, jb = vall.get(a), vall.get(b)
            if ja is not None and jb is not None and dfa[j] / max(1, min(dfa[ja], dfa[jb])) >= 0.3:
                pcol.add(t)
    bcol = set(B.collocations(src.titles, B.collocation_people(src)))
    add({"index": "collocations", "prototype": len(pcol), "build": len(bcol), "only_prototype": len(pcol - bcol),
         "only_build": len(bcol - pcol), "examples_only_prototype": sorted(pcol - bcol)[:10],
         "examples_only_build": sorted(bcol - pcol)[:10]})

    # negation labels
    labels, by_stem = M.cached("labels", lambda: None) if "labels" in M._cache else (None, None)
    if labels is None:
        M.label_negation("x")
        labels, by_stem = M._cache["labels"]
    pl = {k: sorted(pid_of[r] for r in rs) for k, rs in labels.items() if SP.tokens(k)}
    bl = {lab: [int(point_ids[r]) for r in rows] for lab, _, rows in B.negation_labels(src.titles)}
    add(diff_summary(pl, bl, "negation labels (label -> titles)"))
    pst = {k: sorted(set(SP.tokens(k))) for k in labels if SP.tokens(k)}
    bst = {lab: stems for lab, stems, _ in B.negation_labels(src.titles)}
    add(diff_summary(pst, bst, "negation label stems"))

    # alternate cuts
    pe = M.cut_edges()
    pcut = {(min(p, q), max(p, q)) for p, qs in pe.items() for q in qs}
    directors = [{p for p, _ in c.directors} for c in tc]
    bcut = {(int(point_ids[a]), int(point_ids[b])) for a, b in B.cut_edges(src.titles, directors)}
    add({"index": "alternate cuts (pairs)", "prototype": len(pcut), "build": len(bcut), "same": pcut == bcut,
         "only_prototype": sorted(pcut - bcut)[:5], "only_build": sorted(bcut - pcut)[:5]})

    # peers
    pi = M.peer_index(CFG)
    ppeer = {}
    for key, F, rows in zip(pi["ids"], pi["F"], pi["rows"]):
        mem = f"p:{key[1]}" if key[0] == "p" else B.studio_member(key[1])
        ppeer[mem] = (F, [pid_of[r] for r in rows[:B.PEER_TITLES]])
    bpeer = {m: (F, [int(point_ids[r]) for r in rows]) for m, F, rows in B.peers(credits, st, src.fingerprints, votes, point_ids)}
    common = [m for m in ppeer if m in bpeer]
    add({"index": "peers", "prototype": len(ppeer), "build": len(bpeer), "only_prototype": len(set(ppeer) - set(bpeer)),
         "only_build": len(set(bpeer) - set(ppeer)),
         "centroid_max_abs_diff": float(max(np.abs(ppeer[m][0] - bpeer[m][0]).max() for m in common)),
         "top_titles_different": sum(ppeer[m][1] != bpeer[m][1] for m in common)})

    # reference profiles: every graded query whose reference is a person, studio or team
    ents = B.entities(resolved, credits, st, persons, votes, point_ids)
    by_members = {tuple(sorted(e.candidate.members)): e for e in ents.values()}
    prof = []
    for ctx in X.contexts():
        non_en = ctx.non_english or M.looks_foreign(ctx.text)
        ref = M.resolve_reference(ctx, CFG, non_en)
        if ref is None or ref.kind != "entity" or len(ref.det.entities) != 1:
            continue
        M.settle(ref)
        e = by_members.get(tuple(sorted(ref.det.entities[0].ids)))
        if e is None:
            prof.append({"query": ctx.id, "entity": ref.det.entities[0].name, "missing": True})
            continue
        pseeds = [pid_of[r] for r in ref.seeds]
        bseeds = [int(point_ids[r]) for r in e.seeds]
        pfp = M.centroid(cat.fp, ref.seeds, cat)
        pen = M.centroid(C.embeddings(CFG["emb"]), ref.seeds, cat)
        bfp = B.centroid(src.fingerprints, e.seeds, votes)
        ben = B.centroid(src.text_en, e.seeds, votes)
        rows_idx, voc, Xb2, idf2 = SP.index(CFG["body"])
        pos = {int(r): i for i, r in enumerate(rows_idx)}
        Xr = Xb2.tocsr()
        ii = [pos[r] for r in ref.seeds if r in pos]
        dfo = np.asarray((Xr[ii] > 0).sum(0)).ravel()
        w = dfo / len(ii) * idf2
        w[dfo < min(CFG["terms_min_df"], len(ii))] = 0
        cols = M.top_terms(w, CFG)
        inv = {j: t for t, j in voc.items()}
        pterms = [(inv[j], float(w[j])) for j in cols]
        bterms = B.profile_terms(e.seeds, ti)
        prof.append({"query": ctx.id, "entity": e.candidate.name, "seeds_same": pseeds == bseeds,
                     "seed_sets_same": set(pseeds) == set(bseeds),
                     "fp_cos": float(pfp @ bfp), "text_cos": float(pen @ ben),
                     "terms_same": pterms == bterms, "term_names_same": [t for t, _ in pterms] == [t for t, _ in bterms]})
    add({"index": "reference profiles (graded single-entity queries)", "queries": len(prof),
         "missing": sum(1 for p in prof if p.get("missing")),
         "seeds_same": sum(1 for p in prof if p.get("seeds_same")),
         "seed_sets_same": sum(1 for p in prof if p.get("seed_sets_same")),
         "terms_same": sum(1 for p in prof if p.get("terms_same")),
         "min_fp_cos": min(p["fp_cos"] for p in prof if "fp_cos" in p),
         "min_text_cos": min(p["text_cos"] for p in prof if "text_cos" in p), "per_query": prof})
    return out


# === production check ========================================================================================

def load_build(d):
    files = {}
    for name in os.listdir(d):
        if name.endswith(".json.gz"):
            files[name[:-8]] = json.load(gzip.open(os.path.join(d, name), "rt", encoding="utf-8"))
    profiles = {}
    path = os.path.join(d, "profiles.json.gz")
    if os.path.exists(path):
        for p in json.load(gzip.open(path, "rt", encoding="utf-8")):
            profiles[p["id"]] = p
    return files, profiles


def decode(a):
    for dtype in ("float32", "int8"):
        if dtype in a:
            return np.frombuffer(base64.b64decode(a[dtype]), "<f4" if dtype == "float32" else np.int8).reshape(a["shape"])
    raise ValueError(a.keys())


def prod(d):
    cat = C.load()
    files, profiles = load_build(d)
    out = {"build": d, "checks": []}
    add = out["checks"].append
    ni, wfd = files["name_index"], files["word_frequencies"]
    wf = Counter(dict(zip(wfd["words"], wfd["df"])))
    ents = ni["entities"]

    def cand(e):
        ids = [int(m[2:]) if m.startswith("p:") else (m[0], int(m[2:])) for m in e["members"]]
        return _Cand("studio" if e["kind"] == "studio" else "person", e["name"], ids, e["mass"])
    resolved = {k: cand(ents[i]) for k, i in zip(ni["keys"], ni["entity"])}
    pdet, bdet = detections(), detections(resolved, wf)
    add(compare_detections(pdet, bdet))

    # the entities of the graded queries: credits and reference profiles
    by_members = {tuple(sorted(cand(e).ids)): e for e in ents}
    ti = files["term_statistics"]
    df_b = dict(zip(ti["terms"], ti["df"]))
    idf_b = {t: float(np.log(1 + (ti["n"] - df + 0.5) / (df + 0.5))) for t, df in df_b.items()}
    rows_idx, voc, Xb, idf_p = SP.index(CFG["body"])
    dfp = np.diff(Xb.indptr)
    pos = {int(r): i for i, r in enumerate(rows_idx)}
    Xr = Xb.tocsr()
    inv = {j: t for t, j in voc.items()}
    per_query = []
    for ctx in X.contexts():
        non_en = ctx.non_english or M.looks_foreign(ctx.text)
        ref = M.resolve_reference(ctx, CFG, non_en)
        if ref is None or ref.kind != "entity":
            continue
        M.settle(ref)
        for pe in ref.det.entities:
            e = by_members.get(tuple(sorted(pe.ids)))
            rec = {"query": ctx.id, "entity": pe.name}
            if e is None:
                rec["missing"] = True
                per_query.append(rec)
                continue
            # credits: title weights of the entity (the prototype's own titles vs the build's)
            if pe.kind == "studio":
                tw = {}
                for k in pe.ids:
                    for r, x in M.studios(CFG)[k][1].items():
                        tw[r] = max(tw.get(r, 0), x)
            else:
                tw = {}
                for k in pe.ids:
                    for r, (x, _) in M.credits(CFG).get(k, {}).items():
                        tw[r] = max(tw.get(r, 0), x)
            pw = {int(cat.ids[r]): x for r, x in tw.items()}
            bw = {int(p): x for p, x in e["titles"]}
            common = set(pw) & set(bw)
            rec |= {"titles_prototype": len(pw), "titles_build": len(bw), "titles_common": len(common),
                    "weight_changed": sum(pw[p] != bw[p] for p in common),
                    "only_prototype": sorted(set(pw) - set(bw))[:8], "only_build": sorted(set(bw) - set(pw))[:8],
                    "weight_changes": sorted((p, pw[p], bw[p]) for p in common if pw[p] != bw[p])[:8]}
            p = profiles.get(e["id"])
            if p is not None and len(ref.det.entities) == 1:
                pfp = M.centroid(cat.fp, ref.seeds, cat)
                pen = M.centroid(C.embeddings(CFG["emb"]), ref.seeds, cat)
                ii = [pos[r] for r in ref.seeds if r in pos]
                dfo = np.asarray((Xr[ii] > 0).sum(0)).ravel()
                w = dfo / len(ii) * idf_p
                w[dfo < min(CFG["terms_min_df"], len(ii))] = 0
                pterms = [inv[j] for j in M.top_terms(w, CFG)]
                bterms = [t["term"] for t in p["payload"]["terms"]]
                bfp, ben = np.array(p["fingerprint_v1"], np.float32), np.array(p["text_en_v1"], np.float32)
                rec |= {"fp_cos": float(pfp @ bfp / np.linalg.norm(bfp)), "text_cos": float(pen @ ben / np.linalg.norm(ben)),
                        "terms_overlap": len(set(pterms) & set(bterms)), "terms_prototype": len(pterms),
                        "terms_same_order": pterms == bterms}
            per_query.append(rec)
    prof = [r for r in per_query if "fp_cos" in r]
    add({"index": "entities of the graded reference queries", "entities": len(per_query),
         "missing": sum(1 for r in per_query if r.get("missing")),
         "same_titles": sum(1 for r in per_query if not r.get("missing") and r["titles_common"] == r["titles_prototype"]
                            == r["titles_build"] and not r["weight_changed"]),
         "profiles": len(prof), "min_fp_cos": min((r["fp_cos"] for r in prof), default=None),
         "median_fp_cos": float(np.median([r["fp_cos"] for r in prof])) if prof else None,
         "min_text_cos": min((r["text_cos"] for r in prof), default=None),
         "median_text_cos": float(np.median([r["text_cos"] for r in prof])) if prof else None,
         "terms_same_order": sum(1 for r in prof if r["terms_same_order"]),
         "mean_terms_overlap": float(np.mean([r["terms_overlap"] / max(1, r["terms_prototype"]) for r in prof])) if prof else None,
         "per_query": per_query})

    # term df of the graded queries' terms
    qt = set()
    for ctx in X.contexts():
        qt |= set(SP.query_terms(ctx.text))
        for ph in M.searched_phrases(ctx):
            qt |= set(SP.query_terms(ph))
    rel, missing_b, missing_p = [], [], []
    for t in sorted(qt):
        j = voc.get(t)
        a = int(dfp[j]) if j is not None else 0
        b = df_b.get(t, 0)
        if a and not b:
            missing_b.append(t)
        elif b and not a:
            missing_p.append(t)
        elif a:
            rel.append(abs(b - a) / a)
    add({"index": "term df of the graded queries' terms", "terms": len(qt), "in_both": len(rel),
         "only_prototype": missing_b[:20], "only_build": missing_p[:20],
         "median_relative_df_change": float(np.median(rel)), "p95_relative_df_change": float(np.percentile(rel, 95)),
         "max_relative_df_change": float(np.max(rel)), "eligible_titles": {"prototype": int(Xb.shape[0]), "build": ti["n"]}})

    # intent examples: the build's vectors against the prototype's
    ie = files["intent_examples"]
    if "vectors" in ie:
        labels, pv = M.intent_vectors()
        bv = decode(ie["vectors"])
        cos = [float(a @ b) for a, b in zip(pv, bv)]
        agree = 0
        n = 0
        for q in X.queries():
            det = M.detect(q["query"], CFG)
            if det is None:
                continue
            M.settle(types.SimpleNamespace(intent=det.intent, det=det))   # the intent encode may still be running
            if det.qvec is None:
                continue
            n += 1
            agree += labels[int(np.argmax(pv @ det.qvec))] == ie["labels"][int(np.argmax(bv @ det.qvec))]
        add({"index": "intent example vectors", "examples": len(cos), "min_cos": min(cos),
             "labels_same": labels == ie["labels"], "queries": n, "nearest_intent_same": agree})

    # the rest: sizes against the prototype
    add({"index": "sizes", "titles": len(files["title_table"]["point_ids"]), "collocations": len(files["collocations"]["bigrams"]),
         "alternate_cut_pairs": len(files["alternate_cuts"]["pairs"]), "negation_labels": len(files["negation_labels"]["labels"]),
         "peers": len(files["peers"]["members"]), "entities": len(ents), "resolved_keys": len(ni["keys"]),
         "profiles": len(profiles)})
    return out


def main():
    mode = sys.argv[1]
    if mode == "logic":
        res = logic()
        path = arg("out", os.path.join(ARENA, "results", "bench", "indexes-logic.json"))
    elif mode == "prod":
        res = prod(sys.argv[2])
        path = arg("out", os.path.join(ARENA, "results", "bench", "indexes-prod.json"))
    else:
        raise SystemExit("usage: fidelity.py logic|prod ...")
    json.dump(res, open(path, "w"), indent=1, default=str)
    for c in res["checks"]:
        print(json.dumps({k: v for k, v in c.items() if k != "per_query"}, default=str)[:900])


if __name__ == "__main__":
    main()
