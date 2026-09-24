"""Round-5 ranker: r4-combo-fast (rankers4.hyb4) plus person and studio boosts.

`hyb5(ctx, **cfg)` runs `entities.detect(ctx.query)`. Without a detected entity it returns hyb4 unchanged (the same
list, so earlier splits only move on queries that name a person or studio). With one:

- residual: the query without the entity span and filler words ("funny", "deadpan comedies", "horror"); a clause after
  "less" / "fewer" joins the negated clauses ("but less weird" -> penalty on "weird").
- centroid: mean bge embedding and mean fingerprint of the entity's top titles by votes among its main-role credits
  (director / creator, lead cast, first two companies or the network), like the "like X" reference of round 4.
- signals over the candidates (hyb4's dense top, fingerprint top, sparse top, plus every credited title and the
  centroid's top 500):
  dense = (1 - mix) z(query residual) + mix z(cos to centroid), or z(cos to centroid) when the residual is empty,
  fingerprint = b z(Jev weighted sum) + cen_fp z(cos to centroid fingerprint),
  sparse = BM25 of the residual (people fields off when ent_sparse_people is False), facets from Jev phrases without
  the entity words, negation, prior and era as in hyb4 (no facet coverage, no reference title).
- entity weight w in [0, 1] per title (entities.title_weights: billing order, crew role, company position; the mean
  over entities, so a Bud Spencer + Terence Hill title gets 1 and a title with one of them 0.5); "early" / "late"
  scale it down outside the first / last part of the career.
- intent:
  filmography: score + fil_boost * w (credited titles lead, the residual orders them, others fill after),
  style: score + sty_boost * w, at most sty_cap credited titles in the top 10 (the rest move below rank 10),
  both: the top head_n credited titles by the filmography score, then the style list (credited titles capped as in
  style). head_n is head_style for directors / writers / studios and head_actor for actors.
"""
import re

import numpy as np

import blend as B
import catalog as C
import entities as E
import qemb
import rankers4 as R4
import sparse as S
from rankers import LIMIT, as_list, top, weighted_sum, z
from rankers2 import facets, prior_terms, split_negation
from rankers3 import _floor, english_from_chips, looks_foreign, parse_era, spell

# Tuned on dev (round-5 sweeps; see LOG.md "Round 5"). less_fp (fingerprint direction of "less X") was tried and is off.
DEFAULTS5 = dict(R4.DEFAULTS, ent=True, fil_boost=4.0, sty_boost=0.3, sty_cap=4, head_style=6, head_actor=6,
                 mix_style=0.7, mix_fil=0.3, cen_k=20, cen_fp=0.3, cen_fp_fil=0.0, ent_sparse_people=True,
                 early_frac=0.4, era_off=0.35, ent_facet=True, cen_top=500, sty_prior=1.0, less_neg=0.3, less_fp=0.0)

_LESS = re.compile(r"\b(?:less|fewer|not so|not as)\s+([^\W\d_]+(?:\s+[^\W\d_]+)?)", re.IGNORECASE)


_cache = {}


def _fps_mean():
    if "fpm" not in _cache:
        cat = C.load()
        _cache["fpm"] = cat.fps[cat.eligible()].mean(0)
    return _cache["fpm"]


def _hyb4_cfg(cfg):
    return {k: v for k, v in cfg.items() if k in R4.DEFAULTS}


def residual_text(ctx, det):
    """The query text without entity spans (original words and order, so "but less weird" survives)."""
    toks = det.tokens
    used = set()
    for e in det.entities:
        used.update(range(*e.span))
    keep = [w for i, w in enumerate(toks) if i not in used and w not in ("brothers", "bros", "sisters", "-")]
    return " ".join(keep)


def era_scale(det, tw, cat, cfg):
    if not det.era:
        return tw
    rows = [r for r, w in tw.items() if w >= 0.85 and cat.year[r] > 0] or [r for r in tw if cat.year[r] > 0]
    if not rows:
        return tw
    ys = np.array([cat.year[r] for r in rows])
    lo, hi = ys.min(), ys.max()
    span = max(hi - lo, 10)
    out = {}
    for r, w in tw.items():
        y = cat.year[r] or (lo + hi) / 2
        inside = (y <= lo + cfg["early_frac"] * span) if det.era == "early" else (y >= hi - cfg["early_frac"] * span)
        out[r] = w if inside else w * cfg["era_off"]
    return out


def hyb5(ctx, debug=None, **over):
    cfg = {**DEFAULTS5, **over}
    det = E.detect(ctx.query) if cfg["ent"] else None
    if det is None:
        if debug is not None:
            debug["entity"] = None
        return R4.hyb4(ctx, debug=debug, **_hyb4_cfg(cfg))
    cat = C.load()
    tr = cfg["trunc"] or {}
    non_en = ctx.non_english or (cfg["nonen"] and looks_foreign(ctx.text))
    emb_main = "me5s" if non_en else cfg["emb"]
    Em = C.embeddings(emb_main)
    mask = ctx.mask
    rows = np.flatnonzero(mask)
    a, b, c = cfg["a"], cfg["b"], cfg["c"]

    # residual query, negation, "less X"
    rtext = residual_text(ctx, det)
    fixes = []
    if cfg["spell"] and not non_en:
        rtext, fixes = spell(rtext)
    less = [m.group(1) for m in _LESS.finditer(rtext)]
    rtext_pos = _LESS.sub(" ", rtext)
    positive, negated = split_negation(rtext_pos) if cfg["neg"] else (rtext_pos, [])
    negated = negated + less
    content = [w for w in S.tokens(positive) if w not in E._FILLER and w not in E._STYLE_WORDS and w not in S.STOP]
    q_text = " ".join(w for w in positive.split() if w not in E._FILLER and w not in E._STYLE_WORDS) if content else ""
    era = parse_era(ctx.text) if cfg["era"] else None
    if era and era[0] == "range" and cfg["era_mode"] == "filter":
        m2 = mask & (cat.year >= era[1]) & (cat.year <= era[2])
        if m2.sum() >= 50:
            mask = m2
            rows = np.flatnonzero(mask)

    # entity weights and centroid
    tw = era_scale(det, E.title_weights(det, cat), cat, cfg)
    w_all = np.zeros(len(cat.ids))
    for r, w in tw.items():
        w_all[r] = w
    ent_rows = np.array([r for r in tw if mask[r]], dtype=np.int64)
    crow = E.main_rows(det, cat, cfg["cen_k"])
    cen = Em[crow].mean(0)
    cen /= np.linalg.norm(cen) or 1
    e_c = Em @ cen
    fpc = cat.fp[crow].mean(0)
    fpc /= np.linalg.norm(fpc) or 1
    f_c = cat.fp @ fpc

    style = det.intent in ("style", "both")
    mix = cfg["mix_style"] if style else cfg["mix_fil"]
    e_q = None
    if q_text:
        e_q = Em @ qemb.embed(emb_main, q_text)
        if non_en and cfg["nonen"]:
            en_pos, _ = english_from_chips(ctx)
            if en_pos:
                Eb = C.embeddings(cfg["emb"])
                b_all = Eb @ qemb.embed(cfg["emb"], en_pos)
                mu1, sd1 = e_q[rows].mean(), e_q[rows].std() or 1
                mu2, sd2 = b_all[rows].mean(), b_all[rows].std() or 1
                e_q = 0.5 * (e_q - mu1) / sd1 + 0.5 * (b_all - mu2) / sd2
    ws_all = weighted_sum(ctx)
    parts = [top(rows, e_c[rows], cfg["cen_top"])[0], top(rows, ws_all[rows], cfg["k_fp"])[0], ent_rows]
    if e_q is not None:
        parts.append(top(rows, e_q[rows], cfg["k_emb"])[0])
    s_all = None
    if q_text and not non_en and cfg["text"] in ("sparse", "both"):
        sw = dict(cfg["sparse_w"] or {}, title=0.0) if cfg["sparse_body"] else dict(cfg["sparse_w"] or {})
        if not cfg["ent_sparse_people"]:
            sw.update(creators=0.0, cast=0.0)
        s_all = S.scores(q_text, sw or None, cfg["sparse_bigram"]).astype(np.float64)
        s_all = np.where(mask, s_all, 0)
        s_top, s_val = top(rows, s_all[rows], tr.get("sparse", cfg["sparse_k"]))
        s_top = s_top[s_val > 0]
        kept = np.zeros_like(s_all)
        kept[s_top] = s_all[s_top]
        s_all = kept
        parts.append(s_top)
    # facets: Jev phrases without entity words
    ent_words = {w for e in det.entities for w in det.tokens[e.span[0]:e.span[1]]}
    ent_words |= {w for e in det.entities for w in E.fold(e.name).split()}
    f_alls = []
    if cfg["facet"] and cfg["ent_facet"] and q_text:
        fcs = [f for f in facets(ctx, cfg["facet_source"]) if not (set(E.fold(f).split()) & ent_words)]
        if len(fcs) >= 2:
            for f in fcs:
                fa = Em @ qemb.embed(emb_main, f)
                f_alls.append(fa)
                parts.append(top(rows, fa[rows], 200)[0])

    cand = np.unique(np.concatenate(parts))
    comp = {}
    if e_q is not None:
        dense = (1 - mix) * z(e_q[cand]) + mix * z(e_c[cand])
    else:
        dense = z(e_c[cand])
    comp["dense"] = a * z(dense)
    comp["fp"] = b * z(ws_all[cand]) + (cfg["cen_fp"] if style else cfg["cen_fp_fil"]) * z(f_c[cand])
    score = comp["dense"] + comp["fp"]
    if c and s_all is not None and s_all[cand].any():
        comp["text"] = c * z(s_all[cand])
        score = score + comp["text"]
    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        comp["facet"] = cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
        score = score + comp["facet"]
    if negated and cfg["neg"]:
        pens = [Em @ qemb.embed(emb_main, n) for n in negated]
        comp["neg"] = -max(cfg["neg"], cfg["less_neg"] if less else 0) * z(np.max(np.stack([p[cand] for p in pens]), axis=0))
        score = score + comp["neg"]
    if less and cfg["less_fp"]:
        # "less weird": the fingerprint direction of the word = mean fingerprint of its top BM25 hits (tags, keywords,
        # tropes, essence text) minus the catalog mean; titles far along it drop
        dirs = []
        for word in less:
            sw = S.scores(word, dict(R4.BODY), 1.0)
            hits = np.argsort(-sw)[:200]
            hits = hits[sw[hits] > 0]
            if len(hits) >= 20:
                dirs.append(cat.fps[hits].mean(0) - _fps_mean())
        if dirs:
            d = np.mean(dirs, 0)
            comp["less"] = -cfg["less_fp"] * z(cat.fps[cand] @ d)
            score = score + comp["less"]
    p, q = cfg["prior"]
    if p or q:
        lv, gw = prior_terms(cand)
        k = cfg["sty_prior"] if style else 1.0
        comp["prior"] = k * (p * z(lv) + q * z(gw))
        score = score + comp["prior"]
    if era and (era[0] != "range" or cfg["era_mode"] == "soft"):
        y = cat.year[cand].astype(np.float64)
        y = np.where(y > 0, y, np.median(y[y > 0]) if (y > 0).any() else 2000)
        if era[0] == "range":
            dist = np.maximum(0, np.maximum(era[1] - y, y - era[2]))
            score = score + cfg["era_w"] * z(-np.minimum(dist, 30))
        elif era[0] == "recent":
            score = score + cfg["era_w"] * z(np.minimum(y, 2026))
        else:
            score = score + cfg["era_w"] * z(-y)
    w = w_all[cand]
    own = w >= 0.5
    if det.intent == "filmography":
        comp["entity"] = cfg["fil_boost"] * w
        final = score + comp["entity"]
        order = np.argsort(-final, kind="stable")
    else:
        comp["entity"] = cfg["sty_boost"] * w
        sty = score + comp["entity"]
        order = list(np.argsort(-sty, kind="stable"))
        head = []
        if det.intent == "both":
            n = cfg["head_actor"] if det.lean == "filmography" else cfg["head_style"]
            fil = score + cfg["fil_boost"] * w
            head = [i for i in np.argsort(-fil, kind="stable") if own[i]][:n]
            hs = set(head)
            order = [i for i in order if i not in hs]
        # cap credited titles in the top 10 (after the head)
        top10, later, n_own = [], [], 0
        cap = cfg["sty_cap"] if det.intent == "style" else max(0, cfg["sty_cap"] - len(head) + 1)
        for i in order:
            if len(head) + len(top10) >= 10:
                later.append(i)
                continue
            if own[i]:
                if n_own >= cap:
                    later.append(i)
                    continue
                n_own += 1
            top10.append(i)
        order = np.array(head + top10 + later, dtype=np.int64)
        final = np.empty(len(cand))
        final[order] = -np.arange(len(order), dtype=np.float64)
    if debug is not None:
        debug.update(fixes=fixes, era=era, non_en=non_en, n_cand=len(cand), units=[], long=False, ref=None,
                     exclude=set(), cand=cand, comp=comp, score=final,
                     entity=dict(names=[e.name for e in det.entities], kinds=[e.kind for e in det.entities],
                                 match=[e.match for e in det.entities], intent=det.intent, lean=det.lean,
                                 residual=q_text, negated=negated, era=det.era, n_titles=len(ent_rows),
                                 centroid=[cat.title[r] for r in crow], detect_ms=round(det.ms, 3)))
    r_, s_ = top(cand, final, LIMIT)
    return as_list(r_, s_)
