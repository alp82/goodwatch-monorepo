"""Round-6 ranker: r5 (rankers5.hyb5) with a new style path for person / studio style queries.

`hyb6(ctx, **cfg)` returns hyb5 unchanged unless the query names an entity with intent "style" or "both". For those,
r5's style list (dense cosine to one embedding centroid plus a popularity prior) is replaced by a mix of signals
specific to the entity's style. Every signal is z-scored over the candidates:

- fp: cosine to the entity's fingerprint centroid (its main-role titles, weighted by log votes). Mood and tone are
  what "vibes" means, so this is the core signal.
- emb: cosine to the entity's bge embedding centroid (same titles and weights; r5's signal).
- terms: an IDF-weighted term profile of the entity's titles (stemmed words and bigrams of tags, keywords, tropes and
  essence text that at least two of its main titles share, weight = share of titles x IDF), scored with the BM25
  body index (no title or people fields), so titles that share its distinctive tropes and keywords rank high.
- mention: BM25 of the entity's name over the body fields (other titles' essence texts and tags that call themselves
  "Tarantino-esque" or "Lynchian").
- peers: similar people (or studios). Every director / creator with >= 3 eligible main-crew titles and >= 200k votes
  gets offline an embedding and a fingerprint centroid (the same weighting). The entity's nearest peer_k people by
  z(fp cos) + peer_emb * z(emb cos) (peer_emb 0: fingerprint only) are its peers; their main titles get the peer's similarity (z over all people, clipped at 0).
- agree: min(z fp, z emb, z terms): a neighbour has to match on all three, not only on one.
- the Jev reading (fingerprint weighted sum, b) and the residual query ("humor", "atmosphere") as in r5.
- damping: - damp * z(log votes) on titles that are not the entity's own, so generic blockbusters (Fight Club,
  Breaking Bad) don't win on popularity; the goodwatch-score half of the prior stays.

Own titles (credit weight >= own_w: director, creator, Writing-department writer, top-billed cast, studio's first
companies) get + own_boost. Then the top 10 holds between own_min and own_max of them: extra own titles move below
rank 10, missing ones are pulled up (the best own titles by score, placed at interleaved slots own_slots). "both"
keeps r5's head (the first head_n own titles by filmography score) and then this style list.
"""
import numpy as np

import catalog as C
import entities as E
import qemb
import rankers4 as R4
import rankers5 as R5
import sparse as S
from rankers import LIMIT, as_list, top, weighted_sum, z
from rankers2 import prior_terms, split_negation
from rankers3 import english_from_chips, looks_foreign, spell

# Frozen round-6 values (tuned on the dev style queries; see LOG.md "Round 6"). The first sweep started from
# w_fp 0.5, w_emb 0.3, w_jev 0.2, own_boost 0.3, own_max 5, peer_emb 1.0.
DEFAULTS6 = dict(R5.DEFAULTS5, s6=True, w_fp=0.8, w_emb=0.6, w_terms=0.3, w_mention=0.1, w_peer=0.3, w_agree=0.2,
                 w_jev=0.4, w_res=0.3, damp=0.2, gw=0.1, own_w=0.8, own_boost=1.0, own_min=3, own_max=6,
                 own_slots=(0, 2, 4, 6, 8), cen6_k=20, terms_n=40, terms_min_df=2, peer_k=15, peer_titles=8, peer_emb=0.0,
                 k_cen=500, k_terms=300, style_head=None, neg_own_min=None, neg_own_boost=None, neg_own_max=None, neg_w=None, fold=True)

_cache = {}


def _body():
    return S.index(dict(R4.BODY))


def _centroid(rows, Em, cat):
    rows = np.asarray(rows, np.int64)
    w = np.log1p(cat.votes[rows]).astype(np.float64)
    w = w / (w.sum() or 1)
    c = (Em[rows] * w[:, None]).sum(0)
    f = (cat.fp[rows] * w[:, None]).sum(0)
    return (c / (np.linalg.norm(c) or 1)).astype(np.float32), (f / (np.linalg.norm(f) or 1)).astype(np.float32)


def main_rows(tw, cat, k, min_w=0.85):
    el = cat.eligible()
    rows = [r for r, w in tw.items() if w >= min_w and el[r]]
    if len(rows) < 3:
        rows = [r for r, w in tw.items() if w >= 0.5 and el[r]]
    rows.sort(key=lambda r: -cat.votes[r])
    return rows[:k]


def peer_index(emb):
    """Offline: centroids of every director / creator with >= 3 eligible main-crew titles and >= 200k votes, and of
    every studio group; {"ids": [...], "M": emb centroids, "F": fp centroids, "rows": [main rows]}."""
    key = ("peers", emb)
    if key in _cache:
        return _cache[key]
    cat = C.load()
    Em = C.embeddings(emb)
    el = cat.eligible()
    ids, Ms, Fs, rows_l = [], [], [], []
    for pid, d in E.credits().items():
        rs = [r for r, (w, role) in d.items() if w >= 0.85 and role in ("director", "creator") and el[r]]
        if len(rs) < 3 or cat.votes[rs].sum() < 200_000:
            continue
        c, f = _centroid(rs, Em, cat)
        ids.append(("p", pid))
        Ms.append(c)
        Fs.append(f)
        rs.sort(key=lambda r: -cat.votes[r])
        rows_l.append(rs)
    for alias, v in E._studio_index().items():
        rs = [r for r, w in v["rows"].items() if w >= 1.0 and el[r]]
        if len(rs) < 8 or cat.votes[rs].sum() < 200_000:
            continue
        c, f = _centroid(rs, Em, cat)
        ids.append(("s", tuple(v["keys"])))
        Ms.append(c)
        Fs.append(f)
        rs.sort(key=lambda r: -cat.votes[r])
        rows_l.append(rs)
    _cache[key] = dict(ids=ids, M=np.stack(Ms), F=np.stack(Fs), rows=rows_l,
                       kind=np.array([i[0] for i in ids]))
    return _cache[key]


def peers(det, cen, fpc, cfg):
    """[(peer index, similarity z >= 0)] for the entity's nearest people (person entities) or studios."""
    pi = peer_index(cfg["emb"])
    kind = "s" if all(e.kind == "studio" for e in det.entities) else "p"
    mine = set()
    for e in det.entities:
        if e.kind == "studio":
            mine.add(("s", tuple(e.ids)))
        else:
            mine |= {("p", p) for p in e.ids}
    sel = np.flatnonzero(pi["kind"] == kind)
    sim = cfg["peer_emb"] * z(pi["M"][sel] @ cen) + z(pi["F"][sel] @ fpc)
    order = np.argsort(-sim)
    out = []
    for i in order:
        if pi["ids"][sel[i]] in mine:
            continue
        out.append((int(sel[i]), float(max(sim[i], 0))))
        if len(out) >= cfg["peer_k"]:
            break
    return out


def term_profile(mrows, cfg):
    """(term columns, weights) of the IDF-weighted profile of the entity's main titles on the body index."""
    rows_idx, vocab, X, idf = _body()
    if "pos" not in _cache:
        _cache["pos"] = {int(r): i for i, r in enumerate(rows_idx)}
        _cache["Xr"] = X.tocsr()
    pos = _cache["pos"]
    ii = [pos[r] for r in mrows if r in pos]
    if len(ii) < 2:
        return None, None
    sub = _cache["Xr"][ii]
    dfo = np.asarray((sub > 0).sum(0)).ravel()
    w = dfo / len(ii) * idf
    w[dfo < cfg["terms_min_df"]] = 0
    cols = np.argsort(-w)[: cfg["terms_n"]]
    cols = cols[w[cols] > 0]
    return cols, w[cols]


def term_scores(cols, wts):
    rows_idx, vocab, X, idf = _body()
    cat = C.load()
    out = np.zeros(len(cat.ids))
    if cols is None or not len(cols):
        return out
    out[rows_idx] = X[:, cols] @ wts
    return out


def mention_scores(det):
    words = []
    for e in det.entities:
        if e.kind == "studio":
            words.append(E.fold(e.name))
        else:
            for pid in e.ids:
                n = E._persons()[pid]["name"]
                sur = E.surname(n)
                words.append(E.fold(n))
                if sur and not E.is_common(sur):
                    words.append(sur)
    return S.scores(" ".join(words), dict(R4.BODY), 2.0).astype(np.float64)


def place_own(order, own, cfg, n_top=10):
    """order: candidate indices by score; own: bool per candidate. Enforce own_min..own_max own titles in the top
    n_top; pulled-up own titles go to the interleaved slots."""
    top_, rest = list(order[:n_top]), list(order[n_top:])
    n_own = sum(own[i] for i in top_)
    if n_own > cfg["own_max"]:
        keep, moved, k = [], [], 0
        for i in top_:
            if own[i]:
                k += 1
                if k > cfg["own_max"]:
                    moved.append(i)
                    continue
            keep.append(i)
        fill = [i for i in rest if not own[i]][: n_top - len(keep)]
        fs = set(fill)
        top_ = keep + fill
        rest = moved + [i for i in rest if i not in fs]
        # keep score order inside the top
        pos = {i: k for k, i in enumerate(order)}
        top_.sort(key=lambda i: pos[i])
    elif n_own < cfg["own_min"]:
        need = cfg["own_min"] - n_own
        pull = [i for i in rest if own[i]][:need]
        ps = set(pull)
        others = [i for i in top_ if not own[i]]
        drop = others[len(others) - len(pull):] if pull else []
        ds = set(drop)
        base = [i for i in top_ if i not in ds]
        # put pulled own titles at the first free own slots
        for i in pull:
            slot = next((s for s in cfg["own_slots"] if s <= len(base) and not (s < len(base) and own[base[s]])), len(base))
            base.insert(slot, i)
        top_ = base[:n_top]
        rest = [i for i in drop] + [i for i in rest if i not in ps]
    return np.array(top_ + rest, dtype=np.int64)


def hyb6(ctx, debug=None, **over):
    cfg = {**DEFAULTS6, **over}
    det = E.detect(ctx.query) if cfg["ent"] else None
    if det is None or det.intent == "filmography" or not cfg["s6"]:
        return R5.hyb5(ctx, debug=debug, **{k: v for k, v in cfg.items() if k in R5.DEFAULTS5})
    cat = C.load()
    non_en = ctx.non_english or (cfg["nonen"] and looks_foreign(ctx.text))
    emb_main = "me5s" if non_en else cfg["emb"]
    Em = C.embeddings(emb_main)
    Eb = C.embeddings(cfg["emb"])
    mask = ctx.mask
    rows = np.flatnonzero(mask)

    # residual query and negations, as in r5
    rtext = R5.residual_text(ctx, det)
    fixes = []
    if cfg["spell"] and not non_en:
        rtext, fixes = spell(rtext)
    less = [m.group(1) for m in R5._LESS.finditer(rtext)]
    rtext_pos = R5._LESS.sub(" ", rtext)
    positive, negated = split_negation(rtext_pos) if cfg["neg"] else (rtext_pos, [])
    negated = negated + less
    content = [w for w in S.tokens(positive) if w not in E._FILLER and w not in E._STYLE_WORDS and w not in S.STOP]
    q_text = " ".join(w for w in positive.split() if w not in E._FILLER and w not in E._STYLE_WORDS) if content else ""

    tw = E.title_weights(det, cat)
    w_all = np.zeros(len(cat.ids))
    for r, w in tw.items():
        w_all[r] = w
    ent_rows = np.array([r for r in tw if mask[r] and tw[r] >= 0.5], dtype=np.int64)
    mrows = main_rows(tw, cat, cfg["cen6_k"])
    cen, fpc = _centroid(mrows, Eb, cat)
    e_c = Eb @ cen
    f_c = cat.fp @ fpc
    cols, wts = term_profile(mrows, cfg)
    t_s = term_scores(cols, wts) if cfg["w_terms"] or cfg["w_agree"] else np.zeros(len(cat.ids))
    m_s = mention_scores(det) if cfg["w_mention"] else np.zeros(len(cat.ids))
    ws_all = weighted_sum(ctx)
    e_q = None
    if q_text:
        e_q = Em @ qemb.embed(emb_main, q_text)
    p_s = np.zeros(len(cat.ids))
    peer_list = []
    if cfg["w_peer"]:
        pi = peer_index(cfg["emb"])
        for idx, sim in peers(det, cen, fpc, cfg):
            peer_list.append((pi["ids"][idx], sim))
            for r in pi["rows"][idx][: cfg["peer_titles"]]:
                p_s[r] = max(p_s[r], sim)

    parts = [top(rows, e_c[rows], cfg["k_cen"])[0], top(rows, f_c[rows], cfg["k_cen"])[0], ent_rows,
             top(rows, ws_all[rows], cfg["k_fp"])[0]]
    if cfg["w_terms"]:
        tt, tv = top(rows, t_s[rows], cfg["k_terms"])
        parts.append(tt[tv > 0])
    if cfg["w_mention"]:
        mt, mv = top(rows, m_s[rows], 100)
        parts.append(mt[mv > 0])
    if cfg["w_peer"]:
        parts.append(rows[p_s[rows] > 0])
    if e_q is not None:
        parts.append(top(rows, e_q[rows], cfg["k_emb"])[0])
    cand = np.unique(np.concatenate(parts))
    own = w_all[cand] >= cfg["own_w"]

    comp = {}
    zf, ze, zt = z(f_c[cand]), z(e_c[cand]), z(t_s[cand])
    comp["style_fp"] = cfg["w_fp"] * zf
    comp["style_emb"] = cfg["w_emb"] * ze
    if cfg["w_terms"]:
        comp["style_terms"] = cfg["w_terms"] * zt
    if cfg["w_agree"]:
        comp["agree"] = cfg["w_agree"] * np.minimum(np.minimum(zf, ze), zt)
    if cfg["w_mention"] and m_s[cand].any():
        comp["mention"] = cfg["w_mention"] * z(np.log1p(m_s[cand]))
    if cfg["w_peer"] and p_s[cand].any():
        comp["peer"] = cfg["w_peer"] * p_s[cand]
    comp["fp"] = cfg["w_jev"] * z(ws_all[cand])
    if e_q is not None:
        comp["dense"] = cfg["w_res"] * z(e_q[cand])
    if negated and cfg["neg"]:
        pens = [Em @ qemb.embed(emb_main, n) for n in negated]
        comp["neg"] = -(cfg["neg_w"] if cfg["neg_w"] is not None else max(cfg["neg"], cfg["less_neg"] if less else 0)) * z(np.max(np.stack([p[cand] for p in pens]), axis=0))
    lv, gw = prior_terms(cand)
    comp["prior"] = cfg["gw"] * z(gw) - cfg["damp"] * z(lv) * (~own)
    if negated:
        # "like david lynch but less weird": the person's own titles have to pass the negation like any other title
        if cfg["neg_own_min"] is not None:
            cfg = dict(cfg, own_min=cfg["neg_own_min"])
        if cfg["neg_own_boost"] is not None:
            cfg = dict(cfg, own_boost=cfg["neg_own_boost"])
        if cfg["neg_own_max"] is not None:
            cfg = dict(cfg, own_max=cfg["neg_own_max"], own_min=min(cfg["own_min"], cfg["neg_own_max"]))
    comp["entity"] = cfg["own_boost"] * own
    score = sum(comp.values())

    head = []
    order = list(np.argsort(-score, kind="stable"))
    if cfg["fold"]:
        # alternate cuts count once: a 2nd cut moves to the end before the own-title slots are filled
        import cuts
        ids = [int(cat.ids[cand[i]]) for i in order]
        keep = set(cuts.fold(ids))
        order = [i for i, p in zip(order, ids) if p in keep] + [i for i, p in zip(order, ids) if p not in keep]
    if det.intent == "both":
        n = cfg["head_actor"] if det.lean == "filmography" else cfg["head_style"]
        if cfg["style_head"] is not None:
            n = cfg["style_head"]
        fil = score + cfg["fil_boost"] * w_all[cand]
        head = [i for i in np.argsort(-fil, kind="stable") if own[i]][:n]
        hs = set(head)
        order = [i for i in order if i not in hs]
        sub_cfg = dict(cfg, own_min=max(0, cfg["own_min"] - len(head)), own_max=max(0, cfg["own_max"] - len(head)))
        order = list(place_own(np.array(order), own, sub_cfg, n_top=10 - len(head)))
    else:
        order = list(place_own(np.array(order), own, cfg))
    order = np.array(head + order, dtype=np.int64)
    final = np.empty(len(cand))
    final[order] = -np.arange(len(order), dtype=np.float64)
    if debug is not None:
        debug.update(fixes=fixes, era=None, non_en=non_en, n_cand=len(cand), units=[], long=False, ref=None,
                     exclude=set(), cand=cand, comp=comp, score=final,
                     entity=dict(names=[e.name for e in det.entities], kinds=[e.kind for e in det.entities],
                                 match=[e.match for e in det.entities], intent=det.intent, lean=det.lean,
                                 residual=q_text, negated=negated, era=det.era, n_titles=len(ent_rows),
                                 centroid=[cat.title[r] for r in mrows],
                                 peers=[(_peer_name(i), round(s, 2)) for i, s in peer_list],
                                 terms=_term_names(cols)[:15], detect_ms=round(det.ms, 3),
                                 own_max=cfg["own_max"], own_ids={int(cat.ids[r]) for r, w in tw.items() if w >= cfg["own_w"]}))
    r_, s_ = top(cand, final, LIMIT)
    return as_list(r_, s_)


def _peer_name(i):
    kind, key = i
    if kind == "p":
        return E._persons()[key]["name"]
    return next((v["name"] for v in E._studio_index().values() if tuple(v["keys"]) == key), str(key))


def _term_names(cols):
    if cols is None:
        return []
    rows_idx, vocab, X, idf = _body()
    if "inv" not in _cache:
        _cache["inv"] = {j: t for t, j in vocab.items()}
    return [_cache["inv"][j] for j in cols]
