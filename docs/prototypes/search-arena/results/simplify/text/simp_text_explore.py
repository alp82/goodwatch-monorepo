"""Simplify round, text area: the flat baseline (simp.py) with simpler general text rules, `rank(ctx) -> list`.

Text-area changes against simp.py (each behind a config key, so the baseline stays reachable as DEFAULTS):
- spell (`spell_mode="osa1"`): one edit (a transposition counts one), no long-word distance 2, no candidate limit;
  the shared word tokenizer instead of its own regex.
- language (`lang="flag"`): production's non-English flag only, no stopword lists.
- negation (`neg_mode="tokens"`): one marker word list and one clause-end word list over whitespace tokens, no regexes;
  Jev's avoid chips join the same embedding penalty for every language (`avoid_neg="all"`); "than" is a marker;
  "less X" is either dropped (`less=False`) or one more marker (`less="marker"`).
- era (`era_mode="range"`): one regex for a decade or a year, a hard filter only; no recent / old prior.
- facets and coverage (`cover="concrete"`): one coverage term over Jev's concrete words (isConcrete, not negated):
  min over units of z(dense) + beta z(BM25 body). No phrase facets, generic list, collocations or unit cap.

Original description of the flat baseline follows.

Same rankings as the round-6 baseline (rankers.py to rankers6.py, blend.py to blend4.py, entities.py, run6.run),
without the inheritance chain, dead branches and dead config keys. Every mechanism of the rule table in
results/simplify/baseline-complexity.md has a config key in DEFAULTS (default = baseline behaviour), so an ablation
is `variant(key=value)`.

Per query, after the Jev reading (ctx):
1. Language: production's non-English flag or a stopword check routes the query to the multilingual embedding.
2. Entity detection (people and studios, `detect`). Three paths:
   - general (`rank_general`): dense + Jev fingerprint + BM25, facets, facet coverage, negation, era, "like X";
   - filmography (`rank_filmography`): the entity's credited titles lead, ordered by the residual query;
   - style (`rank_style`): neighbours of the entity's style (fingerprint / embedding centroids, term profile, name
     mentions, peers) with a bounded number of its own titles in the top 10.
3. Title blend (`blend`, production's title-lookup blend with strict matching, the title-word bonus and fuzzy titles).
4. Alternate cuts folded, own titles capped again on style queries.

Data it reads: the catalog snapshot, embeddings and query embeddings (catalog.py, qemb.py), the BM25 index
(sparse.py), the cut index (cuts.py), and data/persons.json.gz, credits.jsonl.gz, companies.jsonl.gz,
people.jsonl.gz. Nothing per query except ctx: no capture files are read here.

Evaluation: `harness/evalsimp.py score simp:FINAL` (every entry of FINAL is callable as rank(ctx)).
Complexity: `harness/complexity.py --module simp --name simp --defaults simp.DEFAULTS` (entries unpack as (cfg, {})).
"""
import gzip, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass

import numpy as np
from rapidfuzz import fuzz, process
from rapidfuzz.distance import OSA, Levenshtein

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402
import cuts  # noqa: E402
import qemb  # noqa: E402
import sparse as S  # noqa: E402

TOP = 50          # returned list length
LIMIT = 100       # discovery list length handed to the blend

DEFAULTS = dict(
    # --- core fusion: z-scored dense, Jev fingerprint, BM25; prior -------------------------------------------------
    emb="bgeb-notitle",       # English catalog embedding (non-English queries use me5s)
    a=0.4, b=0.48, c=0.12,    # weights of dense, fingerprint weighted sum, BM25
    prior=(0.1, 0.1),         # z(log votes), z(GoodWatch score)
    k_emb=500, k_fp=500,      # candidates from the dense and fingerprint top lists
    sparse=True,              # BM25 over tags, keywords, tropes, essence, creators, cast
    sparse_k=300,             # BM25 hits kept (top k with score > 0)
    sparse_bigram=2.0,        # weight of bigram terms in the main BM25 query
    sparse_body=True,         # the main BM25 query skips the title field
    # --- language ----------------------------------------------------------------------------------------------------
    native_routing=True,      # non-English queries: me5s, no BM25 / spell / reference / coverage, multi-word names only
    nonen=True,               # also treat a query as non-English by a stopword check (not only production's flag)
    nonen_mix=0.5,            # non-English: share of z(bge on Jev's English chips) in the dense signal
    avoid_chips=True,         # non-English: Jev's avoid / excluded chips join the negation penalty
    spell=True,               # spell correction of unknown words
    spell_mode="r6",          # "r6" (distance 1, or 2 for 8+ letters) | "osa1" (one edit, transpositions count one)
    lang="lists",             # "lists": production's flag or the stopword check | "flag": production's flag only
    # --- negation, era, facets, coverage -------------------------------------------------------------------------------
    neg=0.1,                  # negated clauses: - neg * z(max cosine)
    neg_mode="r6",            # "r6": marker regexes | "tokens": marker words over whitespace tokens
    avoid_neg="nonen",        # Jev avoid (+excluded) chips in the penalty: "nonen" (r6) | "all" (avoid only) | "none"
    nonen_skip_sparse=True,   # non-English: no BM25
    nonen_skip_cov=True,      # non-English: no coverage
    nonen_skip_ref=True,      # non-English: no reference title
    less=True,                # entity queries: "less / fewer X" joins the negated clauses
    less_neg=0.3,             # negation weight when a "less X" clause exists
    era=True,                 # a decade or year filters the candidates; "recent" / "old" add a prior
    era_mode="r6",            # "r6" | "range": one regex, decade or exact year, filter only
    era_w=0.3,                # weight of the recent / old prior
    facet=0.1,                # Jev phrase facets: facet * (0.5 mean + 0.5 min of z)
    cov=0.3,                  # facet coverage on short queries: cov * z(min over units)
    cov_beta=0.5,             # unit score = z(dense) + cov_beta * z(BM25 body)
    cov_k=300,                # candidates per unit
    cov_max_tokens=5,         # coverage only for queries with at most this many content tokens
    cov_concrete=True,        # coverage only when a unit holds a Jev-concrete word
    cover="r6",               # coverage units: "r6" (phrase words) | "concrete" (Jev concrete words) | "phrases"
    cover_min=2,              # coverage needs at least this many units
    cover_mean=0.0,           # coverage = z((1 - cover_mean) min + cover_mean mean) over units
    facet_source="r6",        # "r6": Jev phrases p >= 0.1, at most 4 | "searched": Jev's searched phrases
    facet_k=200,              # candidates per facet (None: cov_k)
    facet_min=0.5,            # facet term = (1 - facet_min) mean + facet_min min of z
    facet_min_n=2,            # facets need at least this many phrases
    generic=True,             # coverage units skip a hand list of generic words
    cover_max=None,           # ... and at most this many (None: no cap; "r6" has its own cap of 4)
    collocations=True,        # adjacent unit words that form a collocation stay one unit
    # --- "like X" reference titles -----------------------------------------------------------------------------------
    ref=True,
    ref_votes=10000,          # a reference title needs this many votes
    ref_mix=0.2,              # dense = (1 - ref_mix) z(query) + ref_mix z(cosine to the reference)
    ref_agree=0.2,            # + ref_agree * min(z dense, z fingerprint)
    ref_facet=True,           # with a modifier, facets = [reference, modifier]
    exclude_reference=True,   # the reference and its franchise titles are removed
    # --- title blend -------------------------------------------------------------------------------------------------
    strict=0.9,               # a partial title match needs this similarity to the query
    fuzzy=0.88,               # fuzzy title match cutoff for short queries with an unknown word
    kind=True,                # title-word bonus: a failed strict match keeps min(lex, cap) ...
    kind_all=True,            # ... when every Jev-concrete query word is in the title (False: any one)
    cap=0.65,
    creator_bonus=True,       # the bonus also applies when the query only names one creator
    title_bonus_on_entity=False,  # the title-word bonus also on person / studio queries
    # --- people and studios ------------------------------------------------------------------------------------------
    ent=True,                 # person and studio detection (off: every query takes the general path)
    studios=True,             # studio detection
    credit_weights=True,      # per-credit weights by role and billing (off: every credit weighs 1)
    common_word_guard=True,   # single words frequent in essence texts or titles need a full-name match
    intent="auto",            # "auto" or a fixed intent: "filmography", "style", "both"
    entity_residual=True,     # the query without the entity names ranks the entity paths (off: centroid only)
    ent_facet=True,           # facets on the filmography path
    # --- filmography path --------------------------------------------------------------------------------------------
    fil_boost=4.0,            # + fil_boost * credit weight
    mix_fil=0.3,              # dense = (1 - mix_fil) z(residual) + mix_fil z(cosine to the centroid)
    cen_k=20,                 # centroid titles
    cen_top=500,              # candidates from the centroid's top list
    early_frac=0.4,           # "early" / "late": the first / last share of the career keeps its weight
    era_off=0.35,             # ... the rest is scaled by era_off
    # --- style path --------------------------------------------------------------------------------------------------
    style_path=True,          # style / both intents take the style path (off: the filmography path)
    cen6_k=20,                # style centroid titles
    w_fp=0.8, w_emb=0.6,      # cosine to the fingerprint / embedding centroid
    w_terms=0.3,              # term profile of the entity's titles
    w_mention=0.1,            # BM25 of the entity's name in other titles' texts
    w_peer=0.3,               # titles of similar people / studios
    w_agree=0.2,              # min(z fp, z emb, z terms)
    w_jev=0.4,                # Jev fingerprint weighted sum
    w_res=0.3,                # residual query
    damp=0.2,                 # - damp * z(log votes) on titles that are not the entity's own
    gw=0.1,                   # + gw * z(GoodWatch score)
    own_w=0.8,                # own title = credit weight >= own_w
    own_boost=1.0,
    own_min=3, own_max=6,     # own titles in the top 10
    own_slots=(0, 2, 4, 6, 8),  # ranks that pulled-up own titles take
    terms_n=40, terms_min_df=2,
    peer_k=15, peer_titles=8,
    k_cen=500, k_terms=300,
    both_head=6,              # "both" intent: the first both_head own titles by filmography score lead
    # --- alternate cuts and the final cap ------------------------------------------------------------------------------
    fold_before_slots=True,   # style path: 2nd+ cuts move to the end before the own-title slots
    fold_after_blend=True,    # 2nd+ cuts are dropped from every list
    cap_after_blend=True,     # style intent: own_max is applied again after the blend and the fold
)


class Variant(tuple):
    """A config that ranks: callable as rank(ctx) for evalsimp, and unpacks as (cfg, {}) for complexity.py."""

    def __new__(cls, cfg):
        return super().__new__(cls, (cfg, {}))

    def __call__(self, ctx):
        return rank(ctx, self[0])


def variant(**over):
    unknown = set(over) - set(DEFAULTS)
    if unknown:
        raise KeyError(f"unknown config keys: {sorted(unknown)}")
    return Variant({**DEFAULTS, **over})


BASE = {"text-base": Variant(DEFAULTS)}

# exploration: one change at a time
EXPLORE = {
    "text-x-spell": variant(spell_mode="osa1"),
    "text-x-lang": variant(lang="flag"),
    "text-x-neg": variant(neg_mode="tokens"),
    "text-x-neg-avoid": variant(neg_mode="tokens", avoid_neg="all"),
    "text-x-less-off": variant(less=False),
    "text-x-less-marker": variant(neg_mode="tokens", less="marker"),
    "text-x-era": variant(era_mode="range"),
    "text-x-conc2": variant(cover="concrete", cover_min=2),
    "text-x-conc1": variant(cover="concrete", cover_min=1),
    "text-x-conc1-nofacet": variant(cover="concrete", cover_min=1, facet=0),
    "text-x-phr-nofacet": variant(cover="phrases", cover_min=1, facet=0),
    "text-x-conc1-nogate": variant(cover="concrete", cover_min=1, cov_max_tokens=None),
    "text-x-nonen-skips": variant(nonen_skip_sparse=False, nonen_skip_cov=False, nonen_skip_ref=False),
}
EXPLORE2 = {
    "text-y-nofacet": variant(facet=0),
    "text-y-nocolloc": variant(collocations=False),
    "text-y-words": variant(cover="words"),
    "text-y-words-nofacet": variant(cover="words", facet=0),
    "text-y-words-nofacet-nogate4": variant(cover="words", facet=0, cov_max_tokens=None, cover_max=4),
    "text-y-words-nofacet-nogate": variant(cover="words", facet=0, cov_max_tokens=None),
    "text-y-words-nofacet-cov4": variant(cover="words", facet=0, cov=0.4),
    "text-y-nonen-sparse": variant(nonen_skip_sparse=False),
    "text-y-nonen-cov": variant(nonen_skip_cov=False),
    "text-y-nonen-ref": variant(nonen_skip_ref=False),
}
EXPLORE3 = {
    "text-z-fsearched": variant(cover="words", facet_source="searched"),
    "text-z-fsearched-k": variant(cover="words", facet_source="searched", facet_k=None),
    "text-z-fsearched-k-mean": variant(cover="words", facet_source="searched", facet_k=None, facet_min=0.0),
    "text-z-fsearched-k-min": variant(cover="words", facet_source="searched", facet_k=None, facet_min=1.0),
    "text-z-merged-min": variant(cover="merged", facet=0),
    "text-z-merged-mm": variant(cover="merged", facet=0, cover_mean=0.5),
    "text-z-merged-mm-nogate": variant(cover="merged", facet=0, cover_mean=0.5, cov_max_tokens=None),
    "text-z-merged-mm-nogate-noconc": variant(cover="merged", facet=0, cover_mean=0.5, cov_max_tokens=None,
                                               cov_concrete=False),
}
EXPLORE4 = {
    "text-w-searched": variant(facet_source="searched"),
    "text-w-searched-k-mean": variant(facet_source="searched", facet_k=None, facet_min=0.0),
    "text-w-searched-k-mean-nocol": variant(facet_source="searched", facet_k=None, facet_min=0.0,
                                            collocations=False),
    "text-w-searched-k-mean-nogate": variant(facet_source="searched", facet_k=None, facet_min=0.0,
                                             cov_max_tokens=None),
}
BEST_COVER = dict(facet_source="searched", facet_k=None, facet_min=0.0)
EXPLORE5 = {
    "text-v-avoid-only": variant(avoid_neg="nonen-avoid"),
    "text-v-avoid-none": variant(avoid_neg="none"),
    "text-v-tokens-marker-avoid-only": variant(neg_mode="tokens", less="marker", avoid_neg="nonen-avoid"),
    "text-v-entfacet-off": variant(ent_facet=False),
    "text-v-cons": variant(spell_mode="osa1", neg_mode="tokens", less="marker", avoid_neg="nonen",
                           era_mode="range", nonen_skip_cov=False, nonen_skip_ref=False, ent_facet=False,
                           **BEST_COVER),
}
EXPLORE6 = {
    "text-u-neg": variant(neg_mode="tokens"),
    "text-u-neg-marker": variant(neg_mode="tokens", less="marker"),
    "text-u-cons": EXPLORE5["text-v-cons"],
}
CONS = dict(EXPLORE5["text-v-cons"][0])
EXPLORE7 = {
    "text-t-nofacet": Variant({**CONS, "facet": 0}),
    "text-t-merged2": Variant({**CONS, "facet": 0, "cover": "merged2", "cover_mean": 0.5}),
    "text-t-merged2-min": Variant({**CONS, "facet": 0, "cover": "merged2"}),
    "text-t-merged2-nogate": Variant({**CONS, "facet": 0, "cover": "merged2", "cover_mean": 0.5,
                                      "cov_max_tokens": None}),
}
EXPLORE8 = {
    "text-s-nocol": Variant({**CONS, "collocations": False}),
    "text-s-nogate": Variant({**CONS, "cov_max_tokens": None}),
    "text-s-lessglobal": Variant({**CONS, "less": "global"}),
    "text-s-avoidnone": Variant({**CONS, "avoid_neg": "none"}),
    "text-s-all4": Variant({**CONS, "collocations": False, "cov_max_tokens": None, "less": "global",
                            "avoid_neg": "none"}),
}
CONS2 = {**CONS, "less": "global"}
EXPLORE9 = {
    "text-r-nogeneric": Variant({**CONS2, "generic": False}),
    "text-r-facet1": Variant({**CONS2, "facet_min_n": 1}),
    "text-r-cover1": Variant({**CONS2, "cover_min": 1}),
}
# The candidates of this round (see results/simplify/text/REPORT.md).
TEXT = dict(
    spell_mode="osa1",            # M04: one edit, no long-word distance 2, shared tokenizer
    neg_mode="tokens",            # M06: marker and clause-end word lists, no regexes
    less="global",                # M07: "less" / "fewer" are two more marker words
    era_mode="range",             # M08: one regex, decade or exact year, filter only
    nonen_skip_cov=False,         # M05: coverage and reference are not skipped for non-English queries
    nonen_skip_ref=False,
    ent_facet=False,              # M09: no facets on the filmography path
    facet_source="searched",      # M09 + M10: Jev's searched phrases, no probability floor or cap
    facet_k=None,                 # M09: facet candidates share cov_k
    facet_min=0.0,                # M09: facet term = mean of z (no min)
)
FINAL = {
    "text-safe": variant(**TEXT),
    "text-cons": variant(**TEXT, facet_min_n=1),
    "text-agg": variant(**TEXT, facet_min_n=1, collocations=False),
}


def run(kw, bk, ctxs):
    """complexity.py contract: rank every context with the merged config."""
    cfg = {**kw, **bk}
    return {ctx.id: rank(ctx, cfg) for ctx in ctxs}


# === entry point ======================================================================================================

def rank(ctx, cfg=None):
    """The ranked list for one query: [{id, title, year, media_type, score}], at most TOP long."""
    cfg = DEFAULTS if cfg is None else cfg
    non_en = is_non_english(ctx, cfg)
    det = detect(ctx.query, cfg, non_en if cfg["lang"] == "flag" else None) if cfg["ent"] else None
    exclude, own_ids = set(), None
    if det is None:
        disc, exclude = rank_general(ctx, cfg, non_en)
    elif det.intent == "filmography" or not cfg["style_path"]:
        disc = rank_filmography(ctx, det, cfg, non_en)
    else:
        disc, own_ids = rank_style(ctx, det, cfg, non_en)
    blended = blend(ctx, disc, cfg, exclude, entity=det is not None)
    if cfg["fold_after_blend"]:
        keep = set(cuts.fold([x["id"] for x in blended]))
        blended = [x for x in blended if x["id"] in keep]
    if own_ids is not None and det.intent == "style" and cfg["cap_after_blend"]:
        blended = cap_own(blended, own_ids, cfg["own_max"])
    return blended[:TOP]


# === shared numerics ==================================================================================================

def z(x):
    x = np.asarray(x, np.float64)
    s = x.std()
    return (x - x.mean()) / s if s > 1e-12 else np.zeros_like(x)


def top(rows, score, k):
    """rows: candidate row indices; score: aligned scores. Returns rows sorted by score, top k."""
    if len(rows) > k:
        part = np.argpartition(-score, k - 1)[:k]
        rows, score = rows[part], score[part]
    order = np.argsort(-score, kind="stable")
    return rows[order], score[order]


def as_list(rows, score):
    cat = C.load()
    return [(int(cat.ids[r]), float(s)) for r, s in zip(rows, score)]


def mix_z(x, y, rows, w):
    """(1 - w) z(x) + w z(y), both z-scored over rows."""
    mu1, sd1 = x[rows].mean(), x[rows].std() or 1
    mu2, sd2 = y[rows].mean(), y[rows].std() or 1
    return (1 - w) * (x - mu1) / sd1 + w * (y - mu2) / sd2


def weighted_sum(ctx):
    """Production's fingerprint score: sum of Jev weight * raw 0..10 score over the used dimensions."""
    return C.load().fps @ ctx.wvec


def prior_terms(cand):
    cat = C.load()
    gw = cat.goodwatch_score[cand].astype(np.float64)
    gw = np.where(np.isnan(gw), np.nanmean(gw) if np.isfinite(gw).any() else 0, gw)
    return np.log1p(cat.votes[cand]).astype(np.float64), gw


def sparse_top(text, weights, bigram, mask, rows, k):
    """BM25 scores kept only for the top k hits (score > 0) inside the mask: (scores per row, hit rows)."""
    s = S.scores(text, weights, bigram).astype(np.float64)
    s = np.where(mask, s, 0)
    hits, val = top(rows, s[rows], k)
    hits = hits[val > 0]
    kept = np.zeros_like(s)
    kept[hits] = s[hits]
    return kept, hits


BODY = dict(title=0.0, creators=0.0, cast=0.0)   # BM25 body fields: tags, keywords, tropes, essence

_cache = {}


def cached(key, build):
    if key not in _cache:
        _cache[key] = build()
    return _cache[key]


# === text handling ====================================================================================================

_WORD = re.compile(r"[^\W_]+", re.UNICODE)


def words(s):
    return _WORD.findall((s or "").lower())


def normalized(s):
    return " ".join(words(s))


# --- spell correction ---------------------------------------------------------------------------------------------

def word_freq():
    """Word -> document frequency over eligible titles, original titles, essence texts, tags and keywords."""
    def build():
        cat = C.load()
        cnt = Counter()
        for r in np.flatnonzero(cat.eligible()):
            ws = set()
            for s in (cat.title[r], cat.original_title[r], cat.essence_text[r], " ".join(cat.essence_tags[r]),
                      " ".join(cat.keywords[r])):
                ws.update(words(s))
            cnt.update(ws)
        return cnt, [w for w, c in cnt.items() if c >= 20 and w.isalpha()]
    return cached("word_freq", build)


def correct_word(w, mode="r6"):
    freq, vocab = word_freq()
    if not w.isascii() or not w.isalpha() or len(w) < 4 or freq.get(w, 0) >= 3:
        return w
    if mode == "osa1":
        hits = process.extract(w, vocab, scorer=OSA.distance, score_cutoff=1, limit=None)
    else:
        maxd = 1 if len(w) < 8 else 2
        hits = process.extract(w, vocab, scorer=Levenshtein.distance, score_cutoff=maxd, limit=200)
    if not hits:
        return w
    return min(hits, key=lambda h: (h[1], -freq[h[0]]))[0]


def spell(text, mode="r6"):
    def rep(m):
        w = m.group(0)
        c = correct_word(w.lower(), mode)
        return c if c != w.lower() else w
    if mode == "osa1":
        return _WORD.sub(rep, text)
    return re.sub(r"[^\W\d_]+", rep, text)


# --- language -----------------------------------------------------------------------------------------------------

_FOREIGN = {
    "fr": set("un une le la les des du de pour avec sans et est pas qui que toute tout tous dans sur drôle film série".split()),
    "de": set("ich ein eine einen der die das und nicht aber mit ohne etwas mich für ist sehr am ende".split()),
    "es": set("una uno el la los las y con sin que quiero para por serie película muy algo".split()),
}
_EN = set("the a an and with without of for to in on is it that this something i me my".split())


def looks_foreign(text):
    ws = words(text)
    en = sum(1 for w in ws if w in _EN)
    best = max(sum(1 for w in ws if w in v) for v in _FOREIGN.values())
    return best >= 2 and best > en


def english_from_chips(ctx):
    """(positive English text, [avoided English terms]) from Jev's chips."""
    pos, neg = [], []
    for ch in ctx.reading.get("chips") or []:
        t, k = ch["text"], ch["kind"]
        if k in ("want", "attribute"):
            pos.append(t)
        elif k in ("avoid", "excluded"):
            neg.append(t.removeprefix("Low ").removeprefix("Not "))
    return ", ".join(pos), neg


def avoided(ctx):
    """Jev's avoid chips as English terms ("Low bleakness" -> "bleakness")."""
    return [ch["text"].removeprefix("Low ") for ch in ctx.reading.get("chips") or [] if ch["kind"] == "avoid"]


def is_non_english(ctx, cfg):
    if not cfg["native_routing"]:
        return False
    if cfg["lang"] == "flag":
        return ctx.non_english
    return ctx.non_english or (cfg["nonen"] and looks_foreign(ctx.text))


# --- negation -----------------------------------------------------------------------------------------------------

# Markers that open a negated clause, longest first. The clause runs to the next , . ; ! ? or a contrast conjunction.
# "than" counts only after "more" / "rather" ("more getaway driver than superheroes").
_MARKERS = [
    # en
    r"but not", r"isn'?t about", r"is not about", r"not about", r"except for", r"except", r"without", r"minus",
    r"nothing where", r"nothing with", r"nothing", r"(?:i )?don[’']?t want(?: to)?", r"(?:i )?do not want(?: to)?",
    r"isn[’']?t", r"aren[’']?t", r"not", r"no",
    # de
    r"ohne", r"nicht", r"keine[nmrs]?", r"kein",
    # fr
    r"sans", r"pas de", r"pas", r"ni",
    # es
    r"sin",
]
_MARKER_RE = re.compile(r"(?<![\w])(" + "|".join(_MARKERS) + r")(?![\w])", re.IGNORECASE)
_THAN_RE = re.compile(r"\b(?:more|rather)\b[^,.;!?]*?\b(than)\b", re.IGNORECASE)
_CLAUSE_END = re.compile(r"[,.;!?]|\s(?:but|and|aber|und|mais|et|pero|y)\s", re.IGNORECASE)
_DANGLING = re.compile(r"(?:\s|^)(?:but|aber|mais|pero|and|und|et|y|that|which|who|,)\s*$", re.IGNORECASE)
_LESS = re.compile(r"\b(?:less|fewer|not so|not as)\s+([^\W\d_]+(?:\s+[^\W\d_]+)?)", re.IGNORECASE)


def content_words(s):
    return {w for w in words(s) if len(w) > 2}


def split_negation(text):
    """(positive text, [negated clauses]). No markers: (text, [])."""
    spans = []
    for m in _MARKER_RE.finditer(text):
        end = _clause_end(text, m.end())
        clause = text[m.end():end].strip(" -:")
        if clause:
            spans.append((m.start(), end, clause))
    for m in _THAN_RE.finditer(text):
        end = _clause_end(text, m.end(1))
        clause = text[m.end(1):end].strip()
        if clause:
            spans.append((m.start(1), end, clause))
    if not spans:
        return text, []
    spans.sort()
    merged = []
    for s, e, c in spans:
        if merged and s < merged[-1][1]:
            continue  # a marker inside an earlier clause ("nothing where ... not ...")
        merged.append((s, e, c))
    pos, last = [], 0
    for s, e, _ in merged:
        pos.append(text[last:s])
        last = e
    pos.append(text[last:])
    positive = " ".join(p.strip() for p in pos if p.strip())
    positive = re.sub(r"\s*,\s*,", ",", positive)
    for _ in range(3):
        positive = _DANGLING.sub("", positive).strip(" ,.;")
    # "more X than Y": keep X, drop the comparative scaffolding
    positive = re.sub(r"\b(?:make it )?more\b\s*", "", positive, flags=re.IGNORECASE).strip()
    positive = positive or text
    # a negated clause that repeats a positive word ("anime for someone who never watched anime") is not an exclusion
    pw = content_words(positive)
    return positive, [c for _, _, c in merged if not (content_words(c) & pw)]


def _clause_end(text, start):
    stop = _CLAUSE_END.search(text, start)
    return stop.start() if stop else len(text)


# One marker word opens a negated clause; the clause runs to a clause-end word or a token ending in , . ; ! ?
NEG_WORDS = set("no not without except minus nothing than isn't aren't don't doesn't "
                "ohne nicht kein keine keinen keiner sans pas ni sin".split())
CLAUSE_END = set("but and aber und mais et pero y".split())


def split_negation_tokens(text, markers=NEG_WORDS):
    """(positive text, [negated clauses]) over whitespace tokens."""
    pos, negs, cur = [], [], None
    for tok in text.replace("’", "'").split():
        w = tok.strip(",.;:!?-()\"").lower()
        if cur is not None and w in CLAUSE_END:
            cur = None
        if cur is None and w in markers:
            cur = []
            negs.append(cur)
            if pos and pos[-1].strip(",").lower() in CLAUSE_END:
                pos.pop()   # "tense but not bleak" -> "tense"
        elif cur is None:
            pos.append(tok)
        elif w:
            cur.append(w)
        if cur is not None and tok[-1] in ",.;!?":
            cur = None
    return " ".join(pos) or text, [" ".join(c) for c in negs if c]


def negation(text, cfg, less=False):
    """(positive text, negated clauses) by the configured mode; `less` adds "less" / "fewer" as markers."""
    if not cfg["neg"]:
        return text, []
    if cfg["neg_mode"] == "tokens":
        less = less or cfg["less"] == "global"
        return split_negation_tokens(text, NEG_WORDS | {"less", "fewer"} if less else NEG_WORDS)
    return split_negation(text)


# --- era ----------------------------------------------------------------------------------------------------------

# A decade ("80s", "1980s", "'80s", "80er", "2000s") or a year ("1994").
_ERA = re.compile(r"(?<!\w)(?:(19|20)?(\d)0(?:'?s|’s|er)|(19\d\d|20\d\d))(?!\w)", re.IGNORECASE)


def parse_range(text):
    """(lo, hi) of the first decade or year in the text, or None."""
    m = _ERA.search(text)
    if not m:
        return None
    if m.group(3):
        return int(m.group(3)), int(m.group(3))
    century = int(m.group(1) or (19 if int(m.group(2)) >= 2 else 20)) * 100
    lo = century + 10 * int(m.group(2))
    return lo, lo + 9


_DECADE = re.compile(r"(?<![\w])(?:(?:19)?([2-9])0|20([0-2])0)(?:'?s|er|’s)(?![\w])", re.IGNORECASE)
_DECADE_ROMANCE = re.compile(r"(?:années|anos|años|anni)\s+(?:19)?([2-9])0", re.IGNORECASE)
_YEAR = re.compile(r"(?<![\w])(19[2-9]\d|20[0-2]\d)(?![\w])")
_RECENT = re.compile(r"(?<![\w])(recent|new|newer|latest|modern|neu|neue[nrs]?|récent|nouveau|reciente|nueva?)(?![\w])",
                     re.IGNORECASE)
_OLD = re.compile(r"(?<![\w])(old|older|vintage|golden age)(?![\w])", re.IGNORECASE)


def parse_era(text):
    """("range", lo, hi) | ("recent",) | ("old",) | None."""
    m = _DECADE.search(text) or _DECADE_ROMANCE.search(text)
    if m:
        if m.re is _DECADE and m.group(2) is not None:
            lo = 2000 + 10 * int(m.group(2))
        else:
            lo = 1900 + 10 * int(m.group(1))
        return ("range", lo, lo + 9)
    m = _YEAR.search(text)
    if m:
        y = int(m.group(1))
        return ("range", y - 1, y + 1)
    if _RECENT.search(text):
        return ("recent",)
    if _OLD.search(text):
        return ("old",)
    return None


def era_filter(ctx, cfg, mask):
    """(mask, era): a decade or year keeps only titles inside it when at least 50 remain."""
    if not cfg["era"]:
        return mask, None
    if cfg["era_mode"] == "range":
        rng = parse_range(ctx.text)
        if rng:
            cat = C.load()
            m2 = mask & (cat.year >= rng[0]) & (cat.year <= rng[1])
            if m2.any():
                mask = m2
        return mask, None
    era = parse_era(ctx.text)
    if era and era[0] == "range":
        cat = C.load()
        m2 = mask & (cat.year >= era[1]) & (cat.year <= era[2])
        if m2.sum() >= 50:
            mask = m2
    return mask, era


def era_prior(score, era, cand, cfg):
    """"recent" / "old": + era_w * z(year) or z(-year); a missing year becomes the median."""
    if not era or era[0] == "range":
        return score
    y = C.load().year[cand].astype(np.float64)
    y = np.where(y > 0, y, np.median(y[y > 0]) if (y > 0).any() else 2000)
    if era[0] == "recent":
        return score + cfg["era_w"] * z(np.minimum(y, 2026))
    return score + cfg["era_w"] * z(-y)


# --- facets -------------------------------------------------------------------------------------------------------

def facets(ctx, cfg, min_p=0.1, max_n=4):
    """Jev's phrases (probability >= min_p, deduplicated) without negated words; [] when fewer than 2."""
    _, negated = split_negation(ctx.text) if cfg["neg_mode"] == "r6" else negation(ctx.text, cfg)
    banned = set().union(*[content_words(n) for n in negated]) if negated else set()
    phrases = []
    if cfg["facet_source"] == "searched":
        phrases = [p["phrase"] for p in ctx.reading.get("searchedPhrases") or []]
        max_n = None
    for p in ctx.reading.get("phrases") or [] if cfg["facet_source"] == "r6" else []:
        if p["probability"] >= min_p and p["phrase"] not in phrases:
            phrases.append(p["phrase"])
    out = [f for f in phrases if not (content_words(f) & banned)][:max_n]
    return out if len(out) >= cfg["facet_min_n"] else []


_GENERIC = set("good great best nice watch movie film show series something kind type style whole takes place one "
               "stuff story stories tv people person big two first short absolutely".split())


def collocated(a, b, ratio=0.3):
    """Adjacent words form one unit when their bigram's document frequency is >= ratio x the rarer word's."""
    def build():
        _, vocab, X, _ = S.index()
        return vocab, np.diff(X.indptr)
    vocab, df = cached("doc_freq", build)
    ja, jb, jab = vocab.get(S.stem(a)), vocab.get(S.stem(b)), vocab.get(f"{S.stem(a)}_{S.stem(b)}")
    if ja is None or jb is None or jab is None:
        return False
    return df[jab] / max(1, min(df[ja], df[jb])) >= ratio


def facet_units(ctx, negated, cfg, min_p=0.1, max_n=4):
    """Content units of Jev's phrases (collocations merged), deduplicated, not negated; 2 to max_n or []."""
    banned = set()
    for n in negated:
        banned |= set(words(n))
    units = []
    if cfg["facet_source"] == "searched":
        phrases, max_n = ctx.reading.get("searchedPhrases") or [], cfg["cover_max"] or 99
    else:
        phrases = [p for p in ctx.reading.get("phrases") or [] if p["probability"] >= min_p]
    for p in phrases:
        ws = [correct_word(w, cfg["spell_mode"]) for w in words(p["phrase"])]
        ws = [w for w in ws if w not in S.STOP and (w not in _GENERIC or not cfg["generic"]) and w not in banned
              and len(w) > 1 and not w[0].isdigit()]
        i = 0
        while i < len(ws):
            if cfg["collocations"] and i + 1 < len(ws) and collocated(ws[i], ws[i + 1]):
                u = f"{ws[i]} {ws[i + 1]}"
                i += 2
            else:
                u = ws[i]
                i += 1
            if u not in units and not any(u in x.split() or x in u.split() for x in units if " " in x or " " in u):
                units.append(u)
    return units[:max_n] if cfg["cover_min"] <= len(units) <= max_n else []


def concrete_words(ctx):
    return {w["word"].lower() for w in (ctx.reading.get("concreteWords") or []) if w.get("isConcrete")}


def cover_units(ctx, negated, cfg):
    """Coverage units: every one of them should match. [] when fewer than cover_min.
    "r6": content units of Jev's phrases (facet_units).
    "words": the content words of Jev's searched phrases, spell-corrected, not negated, not stop or generic words.
    "concrete": Jev's concrete query words, spell-corrected, not negated, not stopwords.
    "phrases": Jev's searched phrases without negated words.
    With cov_concrete, "r6" and "words" need a Jev-concrete word among the units."""
    if cfg["cover"] in ("r6", "merged2"):
        units = facet_units(ctx, negated, cfg)
        if cfg["cover"] == "merged2":   # Jev's multi-word phrases join as units of their own
            banned = {w for n in negated for w in words(n)}
            units += [p["phrase"] for p in ctx.reading.get("searchedPhrases") or [] if " " in p["phrase"]
                      and p["phrase"] not in units and not (set(words(p["phrase"])) & banned)]
    else:
        banned = {w for n in negated for w in words(n)}
        units = []
        if cfg["cover"] == "phrases":
            units = [p["phrase"] for p in ctx.reading.get("searchedPhrases") or []
                     if not (set(words(p["phrase"])) & banned)]
        if cfg["cover"] in ("words", "merged"):
            if cfg["cover"] == "merged":
                units = [p["phrase"] for p in ctx.reading.get("searchedPhrases") or []
                         if " " in p["phrase"] and not (set(words(p["phrase"])) & banned)]
            for p in ctx.reading.get("searchedPhrases") or []:
                for w in words(p["phrase"]):
                    u = correct_word(w, cfg["spell_mode"]) if cfg["spell"] else w
                    if u not in S.STOP and u not in _GENERIC and u not in banned and len(u) > 1 and \
                            not u[0].isdigit() and u not in units:
                        units.append(u)
        elif cfg["cover"] == "concrete":
            for w in (ctx.reading.get("concreteWords") or []):
                u = correct_word(w["word"].lower(), cfg["spell_mode"]) if cfg["spell"] else w["word"].lower()
                if w.get("isConcrete") and u not in banned and u not in S.STOP and u not in units:
                    units.append(u)
        if cfg["cover_max"] and len(units) > cfg["cover_max"]:
            units = []
    if cfg["cover"] in ("r6", "words", "merged", "merged2") and cfg["cov_concrete"] and \
            not any(set(u.split()) & concrete_words(ctx) for u in units):
        return []
    return units if len(units) >= cfg["cover_min"] else []


# --- "like X" reference titles ------------------------------------------------------------------------------------

_LIKE = re.compile(r"(?<![\w’'])(?:similar to|in the vein of|in the style of|reminiscent of|along the lines of|"
                   r"same vibe as|if i (?:liked|loved)|for fans of|like)\s+", re.IGNORECASE)
_NOT_LIKE = re.compile(r"(?:feels?|felt|looks?|sounds?|i'?d|would|i|you|we|just|don'?t|didn'?t|not)\s+$", re.IGNORECASE)
_BUT = re.compile(r"\s+but\s+", re.IGNORECASE)
_MOD_LEAD = re.compile(r"^(?:but|only|except|and|,|;|-|as|a|an|in|with|more|make it|made)\s+", re.IGNORECASE)


def reference_titles(min_votes):
    """Normalized title (also without a leading "the") -> the row with the most votes, rows with votes >= min_votes."""
    def build():
        cat = C.load()
        idx = {}
        for r in np.flatnonzero(cat.votes >= min_votes):
            for t in {cat.title[r], cat.original_title[r]}:
                n = normalized(t)
                if not n:
                    continue
                for key in {n, re.sub(r"^the ", "", n)}:
                    if key and (key not in idx or cat.votes[r] > cat.votes[idx[key]]):
                        idx[key] = r
        return idx
    return cached(("reference_titles", min_votes), build)


def find_reference(text, min_votes):
    """(row, reference span, modifier text) or None."""
    idx = reference_titles(min_votes)
    starts = []
    for m in _LIKE.finditer(text):
        if _NOT_LIKE.search(text[: m.start()]) and m.group(0).lower().startswith("like"):
            continue
        starts.append(m.end())
    # "<Title> but <modifier>" without a marker
    mb = _BUT.search(text)
    if mb and not re.match(r"(?:not|no|without|never|less)\b", text[mb.end():], re.IGNORECASE):
        starts.append(0)
    for s in starts:
        rest = text[s:]
        ws = list(re.finditer(r"[^\W_]+(?:['’][^\W_]+)?", rest))
        for k in range(min(len(ws), 8), 0, -1):
            span = rest[: ws[k - 1].end()]
            key = normalized(span)
            if len(key) < 3 or key in S.STOP:
                continue
            r = idx.get(key)
            if r is None:
                continue
            if s == 0 and not (mb and mb.start() <= ws[k - 1].end() + 1):
                continue  # without a marker the title has to run right up to "but"
            mod = rest[ws[k - 1].end():].strip(" ,.;:-!?")
            for _ in range(3):
                mod = _MOD_LEAD.sub("", mod).strip(" ,.;:-!?")
            return int(r), span.strip(), mod
    return None


def franchise_rows(ref_row):
    """The reference and the titles (votes >= 2000) whose title contains its the-less title as a word phrase, when
    that stem is distinctive (2+ words or 6+ letters)."""
    cat = C.load()

    def build():
        return [(int(r), f" {normalized(cat.title[r])} ", f" {normalized(cat.original_title[r])} ")
                for r in np.flatnonzero(cat.votes >= 2000)]
    titles = cached("franchise_titles", build)
    stem = re.sub(r"^the ", "", normalized(cat.title[ref_row]))
    out = {int(ref_row)}
    if len(stem.split()) >= 2 or len(stem) >= 6:
        pat = f" {stem} "
        out |= {r for r, t, o in titles if pat in t or pat in o}
    return out


# === general path =====================================================================================================

def rank_general(ctx, cfg, non_en):
    """Queries without a person or studio: [(point id, score)] and the excluded point ids ("like X")."""
    cat = C.load()
    emb_main = "me5s" if non_en else cfg["emb"]
    E = C.embeddings(emb_main)
    text = spell(ctx.text, cfg["spell_mode"]) if cfg["spell"] and not non_en else ctx.text
    positive, negated = negation(text, cfg)
    mask, era = era_filter(ctx, cfg, ctx.mask)

    ref = find_reference(ctx.text, cfg["ref_votes"]) if cfg["ref"] and not (non_en and cfg["nonen_skip_ref"]) else None
    exclude, ref_words, mod = set(), set(), ""
    if ref:
        ref_row, ref_span, mod = ref
        ref_words = set(words(ref_span)) | set(words(cat.title[ref_row]))
        if cfg["exclude_reference"]:
            exclude = franchise_rows(ref_row)
            mask = mask.copy()
            mask[list(exclude)] = False
    rows = np.flatnonzero(mask)

    e_all = E @ qemb.embed(emb_main, positive)
    extra_neg = []
    Eb = C.embeddings(cfg["emb"])
    if non_en and cfg["nonen"]:
        en_pos, en_neg = english_from_chips(ctx)
        if en_pos:
            e_all = mix_z(e_all, Eb @ qemb.embed(cfg["emb"], en_pos), rows, cfg["nonen_mix"])
            if cfg["avoid_chips"] and cfg["avoid_neg"] == "nonen":
                extra_neg = [Eb @ qemb.embed(cfg["emb"], n) for n in en_neg]
            elif cfg["avoid_neg"] == "nonen-avoid":
                extra_neg = [Eb @ qemb.embed(cfg["emb"], n) for n in avoided(ctx)]
    if cfg["avoid_neg"] == "all":
        extra_neg = [Eb @ qemb.embed(cfg["emb"], n) for n in avoided(ctx)]
    if ref:
        r_all = E @ E[ref_row]
        e_all = mix_z(e_all, r_all, rows, cfg["ref_mix"])
    ws_all = weighted_sum(ctx)
    parts = [top(rows, e_all[rows], cfg["k_emb"])[0], top(rows, ws_all[rows], cfg["k_fp"])[0]]

    s_all = None
    if cfg["sparse"] and not (non_en and cfg["nonen_skip_sparse"]) and positive:
        weights = dict(title=0.0) if cfg["sparse_body"] else None
        s_all, hits = sparse_top(positive, weights, cfg["sparse_bigram"], mask, rows, cfg["sparse_k"])
        parts.append(hits)

    # facets: Jev phrases, or [reference, modifier] for "like X but Y"
    f_alls = []
    if cfg["facet"]:
        if ref and mod and cfg["ref_facet"]:
            ma = E @ qemb.embed(emb_main, mod)
            f_alls = [r_all, ma]
            parts.append(top(rows, ma[rows], 200)[0])
        else:
            fcs = facets(ctx, cfg)
            if ref:
                fcs = [f for f in fcs if not (set(words(f)) & ref_words)]
                fcs = fcs if len(fcs) >= 2 else []
            for f in fcs:
                fa = E @ qemb.embed(emb_main, f)
                f_alls.append(fa)
                parts.append(top(rows, fa[rows], cfg["facet_k"] or cfg["cov_k"])[0])

    # facet coverage: titles that match only the dominant facet drop
    units = []
    if cfg["cov"] and not (non_en and cfg["nonen_skip_cov"]) and not ref and \
            (cfg["cov_max_tokens"] is None or len(S.tokens(positive)) <= cfg["cov_max_tokens"]):
        units = cover_units(ctx, negated, cfg)
    u_d, u_s = [], []
    for u in units:
        d = E @ qemb.embed(emb_main, u)
        u_d.append(d)
        parts.append(top(rows, d[rows], cfg["cov_k"])[0])
        s, hits = sparse_top(u, BODY, 1.0, mask, rows, cfg["sparse_k"])
        u_s.append(s)
        parts.append(hits[: cfg["cov_k"]])

    cand = np.unique(np.concatenate(parts))
    score = cfg["a"] * z(e_all[cand]) + cfg["b"] * z(ws_all[cand])
    if ref and cfg["ref_agree"]:
        score += cfg["ref_agree"] * np.minimum(z(e_all[cand]), z(ws_all[cand]))
    if cfg["c"] and s_all is not None and s_all[cand].any():
        score += cfg["c"] * z(s_all[cand])
    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score += cfg["facet"] * ((1 - cfg["facet_min"]) * fz.mean(0) + cfg["facet_min"] * fz.min(0))
    if units:
        uz = np.stack([z(d[cand]) + cfg["cov_beta"] * z(s[cand]) for d, s in zip(u_d, u_s)])
        score += cfg["cov"] * z((1 - cfg["cover_mean"]) * uz.min(0) + cfg["cover_mean"] * uz.mean(0))
    if cfg["neg"]:
        pens = [(E @ qemb.embed(emb_main, n))[cand] for n in negated] + [x[cand] for x in extra_neg]
        if pens:
            score -= cfg["neg"] * z(np.max(np.stack(pens), axis=0))
    p, q = cfg["prior"]
    if p or q:
        lv, gw = prior_terms(cand)
        score = score + p * z(lv) + q * z(gw)
    score = era_prior(score, era, cand, cfg)
    r, s = top(cand, score, LIMIT)
    return as_list(r, s), {int(cat.ids[x]) for x in exclude}


# === people and studios ===============================================================================================

_SUFFIX = set("pictures picture productions production studios studio films film entertainment animation company "
              "inc ltd llc co corporation corp media releasing international features television tv group "
              "distribution enterprises cinema".split())
_STYLE_WORDS = set("vibe vibes vibey style styled stylish esque like feel feels feeling atmosphere atmospheric "
                   "aesthetic aesthetics humor humour tone mood energy similar inspired vein sensibility touch "
                   "flavor flavour spirit type sort kind way approach à la".split())
_FILM_WORDS = set("movie movies film films filme filmen show shows series tv starring stars star with featuring feat "
                  "by directed director written produced voiced mit von avec de del con filmography early late later "
                  "recent old classic best top every all complete career works work".split())
_ERA_WORDS = {"early": "early", "late": "late", "later": "late", "recent": "late", "new": "late", "newer": "late",
              "old": "early", "older": "early", "classic": "early", "frühe": "early", "frühen": "early"}
_FILLER = set("a an the and or und et y of in on for to me some any good great best top all every movie movies film "
              "films filme filmen show shows series tv starring stars star with featuring feat by directed "
              "director written produced voiced mit von avec de del con from filmography works work career "
              "early late later recent old older classic newer new frühe frühen s give want watch something "
              "anything".split())
_NAME_SUFFIX = {"jr", "sr", "ii", "iii", "iv"}
_TEAM = ("brothers", "bros", "sisters")
_STYLE_SUFFIX = re.compile(r"^(.{4,}?)(?:esque|ian|like|ish)$")

SURNAME_VOTES = 500_000     # lead score (votes over main-role titles, director / creator credits 2x) of a surname
SURNAME_DOMINANCE = 3.0     # ... and its margin over the next person with the surname
STUDIO_MIN_TITLES = 8
COMMON_LOWER_DF = 20        # essence texts with the word in lowercase
COMMON_TITLE_DF = 15        # eligible titles with the word
COMMON_ANY_DF = 250         # essence texts with the word in any case ("British", "Christmas")
RARE_LOWER_DF = 2           # a single-word studio alias must (almost) never be a lowercase word
FUZZY_NAME_CUTOFF = 90
FUZZY_MAX_WORDS = 5


def fold(s):
    """Lowercase, strip diacritics, keep letters / digits, collapse spaces."""
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"['’`]s\b", "", s)            # possessive
    s = s.replace("&", " and ").replace("+", " ")
    return " ".join(re.findall(r"[^\W_]+", s))


def surname(name):
    t = [w for w in fold(name).split() if w not in _NAME_SUFFIX]
    return t[-1] if len(t) >= 2 else None


# --- offline indexes ----------------------------------------------------------------------------------------------

def _gz_lines(name):
    with gzip.open(os.path.join(C.DATA, name), "rt", encoding="utf-8") as f:
        for line in f:
            yield json.loads(line)


def persons():
    def build():
        p = json.load(gzip.open(os.path.join(C.DATA, "persons.json.gz"), "rt", encoding="utf-8"))
        return {int(k): v for k, v in p.items()}
    return cached("persons", build)


def credits(cfg):
    """person id -> {row: (credit weight, role)}."""
    def build():
        cat = C.load()
        per = defaultdict(dict)

        def put(pid, r, w, role):
            w = w if cfg["credit_weights"] else 1.0
            cur = per[pid].get(r)
            if cur is None or w > cur[0]:
                per[pid][r] = (w, role)
        for t in _gz_lines("credits.jsonl.gz"):
            r = cat.row_of.get(t["id"])
            if r is None:
                continue
            show = t["media_type"] == "show"
            for i, d in enumerate(t["directors"]):
                # shows list episode directors by episode count: only the top one is a main credit
                w = (0.9 if i == 0 else 0.5) if show else (1.0 if d.get("job") == "Director" else 0.8)
                put(d["id"], r, w, "director")
            for d in t["creators"]:
                put(d["id"], r, 1.0 if t.get("creator_source") == "creator" else 0.8, "creator")
            for i, d in enumerate(t["writers"]):
                w = 0.9 if d.get("department") == "Writing" else 0.6
                put(d["id"], r, (w if i <= 1 else 0.5) if show else w, "writer")
            for d in t["cast"]:
                o = d.get("order") or 0
                # the first four billed are leads (ensembles such as Snatch bill Brad Pitt fourth)
                w = 1.0 if o <= 3 else 0.85 if o <= 5 else 0.6 if o <= 8 else 0.4
                if d.get("department") and d["department"] != "Acting":
                    w *= 0.5  # a director's cameo
                put(d["id"], r, w, "cast")
        return per
    return cached(("credits", cfg["credit_weights"]), build)


def common_words(cfg):
    """(common words, common words without the title-word part, lowercase essence-text df)."""
    def build():
        cat = C.load()
        low, anycase, tit = Counter(), Counter(), Counter()
        for r in np.flatnonzero(cat.eligible()):
            ws = set(re.findall(r"[^\W\d_]+", cat.essence_text[r]))
            low.update({w for w in ws if w.islower()})
            anycase.update({w.lower() for w in ws})
            tit.update(set(fold(cat.title[r]).split()))
        word = S.STOP | _FILLER | _STYLE_WORDS
        if not cfg["common_word_guard"]:
            return word, word, low
        word = word | {w for w, n in low.items() if n >= COMMON_LOWER_DF} | \
            {w for w, n in anycase.items() if n >= COMMON_ANY_DF}
        return word | {w for w, n in tit.items() if n >= COMMON_TITLE_DF}, word, low
    return cached(("common", cfg["common_word_guard"]), build)


def is_common(word, cfg, titles=True):
    common, common_word, _ = common_words(cfg)
    return word in (common if titles else common_word) or len(word) < 3


def person_index(cfg):
    """full: folded name -> person; sur: dominant surname -> person; groups: surname -> sibling team; prominent."""
    def build():
        P = persons()
        full = {}
        for pid, v in P.items():
            for n in {v["name"], v.get("original_name") or ""}:
                k = fold(n)
                if not k:
                    continue
                if k not in full or v["votes_sum"] > P[full[k]]["votes_sum"]:
                    full[k] = pid
        cat = C.load()
        cr = credits(cfg)

        def lead(pid):
            return sum(cat.votes[r] * (2 if role in ("director", "creator") else 1)
                       for r, (w, role) in cr.get(pid, {}).items() if w >= 0.85)

        by_sur = defaultdict(list)
        for pid, v in P.items():
            s = surname(v["name"])
            if s and v["titles"] >= 2:
                by_sur[s].append(pid)
        sur, groups = {}, {}
        for s, pids in by_sur.items():
            if len(s) < 4:
                continue
            score = {p: lead(p) for p in pids}
            pids.sort(key=lambda p: -score[p])
            if P[pids[0]]["titles"] < 3 or score[pids[0]] < SURNAME_VOTES:
                continue
            second = score[pids[1]] if len(pids) > 1 else 0
            if score[pids[0]] >= SURNAME_DOMINANCE * second:
                sur[s] = pids[0]
            # sibling teams: prominent people with the surname who share titles with the top one
            mine = set(cr.get(pids[0], {}))
            team = [pids[0]] + [p for p in pids[1:4] if P[p]["titles"] >= 3 and score[p] >= SURNAME_VOTES / 2
                                and len(mine & set(cr.get(p, {}))) >= 3]
            if len(team) >= 2:
                groups[s] = team
        prominent = [k for k, pid in full.items() if P[pid]["titles"] >= 3 and P[pid]["votes_sum"] >= 4 * SURNAME_VOTES
                     and " " in k]
        return dict(full=full, sur=sur, groups=groups, prominent=prominent)
    return cached(("person_index", cfg["credit_weights"]), build)


def studio_index(cfg):
    """alias -> {keys, rows: {row: weight}, weak, name} for production companies and networks."""
    def build():
        cat = C.load()
        names, rows = {}, defaultdict(dict)     # (kind, id) -> name ; (kind, id) -> {row: weight}
        for t in _gz_lines("companies.jsonl.gz"):
            r = cat.row_of.get(t["id"])
            if r is None:
                continue
            for i, c in enumerate(t["companies"] or []):
                names[("c", c["id"])] = c["name"]
                rows[("c", c["id"])][r] = 1.0 if i <= 1 else 0.8
            for c in t["networks"] or []:
                names[("n", c["id"])] = c["name"]
                rows[("n", c["id"])][r] = 1.0

        def stripped(k):
            ws = k.split()
            while len(ws) > 1 and ws[-1] in _SUFFIX:
                ws = ws[:-1]
            if len(ws) > 1 and ws[0] in ("studio", "the"):
                ws = ws[1:]
            if len(ws) > 1 and ws[0] == "walt":
                ws = ws[1:]
            return " ".join(ws)

        alias = defaultdict(set)
        for key, n in names.items():
            k = fold(n)
            if not k:
                continue
            alias[k].add(key)
            alias[stripped(k)].add(key)
            if k.startswith("studio ") or k.startswith("walt "):
                alias[" ".join(k.split()[1:])].add(key)
        # brand prefix: "hbo max" joins "hbo" when "hbo" is itself the full name of a studio or network
        fulls = {fold(n) for n in names.values()}
        for key, n in names.items():
            first = fold(n).split()[:1]
            if first and first[0] in fulls and first[0] != fold(n):
                alias[first[0]].add(key)
        low = common_words(cfg)[2]
        out = {}
        for a, keys in alias.items():
            ws = a.split()
            if not ws or len(a) < 2:
                continue
            weak = False
            if len(ws) == 1 and low.get(a, 0) > RARE_LOWER_DF:
                # "lighthouse" (Lighthouse Pictures) is also a word: it counts only for a big group ("marvel") and
                # only next to a film word ("marvel movies"), see detect()
                n_rows = len({r for k in keys for r in rows[k]})
                if n_rows < 50 or low.get(a, 0) >= COMMON_LOWER_DF:
                    continue
                weak = True
            if all(is_common(w, cfg, titles=False) for w in ws):
                # all common words: only a full original name that ends in a company suffix ("Working Title Films")
                if not [k for k in keys if fold(names[k]) == a and len(ws) >= 2 and ws[-1] in _SUFFIX]:
                    continue
            rw = {}
            for k in keys:
                for r, w in rows[k].items():
                    rw[r] = max(rw.get(r, 0), w)
            if len(rw) < STUDIO_MIN_TITLES:
                continue
            out[a] = dict(keys=sorted(keys), rows=rw, weak=weak, name=names[sorted(keys, key=lambda k: -len(rows[k]))[0]])
        first_alias = {}
        for a, v in out.items():
            first_alias.setdefault(tuple(v["keys"]), a)
        return out, first_alias
    return cached(("studio_index", cfg["common_word_guard"]), build)


# --- detection ----------------------------------------------------------------------------------------------------

@dataclass
class Entity:
    kind: str                 # "person" | "studio"
    name: str
    ids: list                 # person ids, or studio keys
    span: tuple               # token span in the folded query (start, end)


@dataclass
class Detection:
    entities: list
    intent: str               # filmography | style | both
    era: str                  # early | late | None
    tokens: list              # the folded query


def detect(query, cfg, foreign=None):
    """People and studios named in the query (longest n-grams first) and the intent; None when there is none."""
    pidx = person_index(cfg)
    sidx = studio_index(cfg)[0] if cfg["studios"] else {}
    P = persons()
    raw = re.sub(r"(?<=[^\W_])-(?=[^\W_])", " - ", query or "")   # "miyazaki-like" -> "miyazaki - like"
    toks = fold(raw).split()
    # the word lists are English: in other languages only multi-word full names count ("Bud Spencer")
    if foreign is None:
        foreign = cfg["native_routing"] and looks_foreign(query)
    ents, used = [], set()
    style_marker = False

    def free(i, j):
        return not any(k in used for k in range(i, j))

    def person(pid, span):
        return Entity("person", P[pid]["name"], [pid], span)

    # 1. exact n-grams, longest first
    for n in (4, 3, 2, 1):
        for i in range(0, len(toks) - n + 1):
            j = i + n
            if not free(i, j):
                continue
            g = " ".join(toks[i:j])
            if n == 1 and (is_common(g, cfg, titles=False) or foreign):
                continue
            hit = None
            if g in sidx and not (sidx[g]["weak"] and not ({toks[i - 1] if i else "", toks[j] if j < len(toks) else ""}
                                                            & (_FILM_WORDS | {"studio", "studios"}))):
                hit = Entity("studio", sidx[g]["name"], sidx[g]["keys"], (i, j))
            elif n >= 2 and g in pidx["full"]:
                v = P[pidx["full"][g]]
                # a full name of common words only needs a prominent owner
                if all(is_common(w, cfg) for w in g.split()) and not (v["titles"] >= 5 and v["votes_sum"] >= SURNAME_VOTES):
                    continue
                if v["titles"] < 3 and v["popularity"] < 5:
                    continue
                hit = person(pidx["full"][g], (i, j))
            elif n == 1 and not is_common(g, cfg) and g in pidx["full"] and P[pidx["full"][g]]["titles"] >= 5 and \
                    P[pidx["full"][g]]["votes_sum"] >= SURNAME_VOTES and " " not in P[pidx["full"][g]]["name"].strip():
                hit = person(pidx["full"][g], (i, j))    # mononym
            if hit:
                ents.append(hit)
                used.update(range(i, j))
    # 2. surnames, sibling teams, style suffixes
    for i, w in enumerate(toks):
        if i in used or foreign:
            continue
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if nxt in _TEAM or (w.endswith("s") and w[:-1] in pidx["groups"] and not is_common(w, cfg)):
            base = w[:-1] if w.endswith("s") and w[:-1] in pidx["groups"] else w
            if base in pidx["groups"] and not is_common(base, cfg):
                pids = pidx["groups"][base]
                span = (i, i + 2) if nxt in _TEAM else (i, i + 1)
                ents.append(Entity("person", " & ".join(P[p]["name"] for p in pids), pids, span))
                used.update(range(*span))
                continue
        m = _STYLE_SUFFIX.match(w)
        for c, suffixed in [(w, False)] + ([(m.group(1), True)] if m else []):
            if c in pidx["sur"] and not is_common(c, cfg):
                ents.append(person(pidx["sur"][c], (i, i + 1)))
                used.add(i)
                style_marker |= suffixed
                break
            if suffixed and c in sidx and not is_common(c, cfg, titles=False):
                ents.append(Entity("studio", sidx[c]["name"], sidx[c]["keys"], (i, i + 1)))
                used.add(i)
                style_marker = True
                break
    # 3. typos, only for n-grams with an unknown word in short queries
    if not ents and not foreign and len(toks) <= FUZZY_MAX_WORDS:
        vocab = word_freq()[0]
        unknown = [i for i, w in enumerate(toks) if i not in used and w.isalpha() and vocab.get(w, 0) < 3
                   and vocab.get(S.stem(w), 0) < 3 and not is_common(w, cfg)]
        done = False
        for n in (3, 2):
            for i in range(0, len(toks) - n + 1):
                j = i + n
                if done or not free(i, j) or not any(k in unknown for k in range(i, j)) or \
                        any(w in S.STOP or w in _FILLER or w in _STYLE_WORDS for w in toks[i:j]):
                    continue
                hit = process.extractOne(" ".join(toks[i:j]), pidx["prominent"], scorer=fuzz.ratio,
                                         score_cutoff=FUZZY_NAME_CUTOFF)
                if hit and len(hit[0].split()) == n:
                    ents.append(person(pidx["full"][hit[0]], (i, j)))
                    used.update(range(i, j))
                    done = True
        if not done:
            for i in unknown:
                if len(toks[i]) < 7:
                    continue
                hit = process.extractOne(toks[i], list(pidx["sur"]), scorer=Levenshtein.distance, score_cutoff=1)
                if hit:
                    ents.append(person(pidx["sur"][hit[0]], (i, i + 1)))
                    used.add(i)
                    break
    if not ents:
        return None
    ents.sort(key=lambda e: e.span)
    rest = [w for k, w in enumerate(toks) if k not in used]
    era = next((_ERA_WORDS[w] for w in rest if w in _ERA_WORDS), None)
    style_marker |= any(w in _STYLE_WORDS for w in rest) or bool(re.search(r"\b(?:in the vein of|à la|a la)\b", fold(query)))
    residual = [w for w in rest if w not in _FILLER and w not in _STYLE_WORDS and w not in S.STOP and w != "-"
                and w not in _TEAM]
    if cfg["intent"] != "auto":
        intent = cfg["intent"]
    elif style_marker:
        intent = "style"
    elif any(w in _FILM_WORDS for w in rest) or residual or era or all(e.kind == "studio" for e in ents):
        intent = "filmography"
    else:
        intent = "both"
    return Detection(ents, intent, era, toks)


def title_weights(det, cfg):
    """row -> weight in [0, 1]: the mean over entities of each entity's credit weight (a title with both Bud Spencer
    and Terence Hill scores 1, one of them 0.5); studios by company position / network."""
    per = []
    for e in det.entities:
        w = {}
        if e.kind == "studio":
            sidx, first_alias = studio_index(cfg)
            w = dict(sidx[first_alias[tuple(e.ids)]]["rows"])
        else:
            cr = credits(cfg)
            for pid in e.ids:   # a team: any member counts
                for r, (x, _) in cr.get(pid, {}).items():
                    w[r] = max(w.get(r, 0), x)
        per.append(w)
    rows = set().union(*[set(w) for w in per])
    return {r: sum(w.get(r, 0) for w in per) / len(per) for r in rows}


def main_rows(tw, k, min_w=0.85):
    """The entity's top k eligible titles by votes among its main-role credits (weight >= 0.5 when fewer than 3)."""
    el = C.load().eligible()
    rows = [r for r, w in tw.items() if w >= min_w and el[r]]
    if len(rows) < 3:
        rows = [r for r, w in tw.items() if w >= 0.5 and el[r]]
    rows.sort(key=lambda r: -C.load().votes[r])
    return rows[:k]


def entity_query(ctx, det, cfg, non_en):
    """(residual query text, negated clauses, "less X" clauses) of an entity query."""
    used = set()
    for e in det.entities:
        used.update(range(*e.span))
    text = " ".join(w for i, w in enumerate(det.tokens) if i not in used and w not in _TEAM and w != "-")
    if cfg["spell"] and not non_en:
        text = spell(text, cfg["spell_mode"])
    less = []
    if cfg["less"] is True:
        less = [m.group(1) for m in _LESS.finditer(text)]
        text = _LESS.sub(" ", text)
    positive, negated = negation(text, cfg, less=cfg["less"] == "marker")
    content = [w for w in S.tokens(positive) if w not in _FILLER and w not in _STYLE_WORDS and w not in S.STOP]
    q_text = " ".join(w for w in positive.split() if w not in _FILLER and w not in _STYLE_WORDS) if content else ""
    return (q_text if cfg["entity_residual"] else ""), negated + less, less


def negation_weight(cfg, less):
    return max(cfg["neg"], cfg["less_neg"] if less else 0)


# === filmography path =================================================================================================

def career_scale(det, tw, cfg):
    """"early" / "late": credits outside the first / last early_frac of the career are scaled by era_off."""
    if not det.era:
        return tw
    cat = C.load()
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


def rank_filmography(ctx, det, cfg, non_en):
    """The entity's credited titles lead (+ fil_boost * weight), the residual query orders them, others fill after."""
    cat = C.load()
    emb_main = "me5s" if non_en else cfg["emb"]
    Em = C.embeddings(emb_main)
    q_text, negated, less = entity_query(ctx, det, cfg, non_en)
    mask, era = era_filter(ctx, cfg, ctx.mask)
    rows = np.flatnonzero(mask)

    tw0 = title_weights(det, cfg)
    tw = career_scale(det, tw0, cfg)
    w_all = np.zeros(len(cat.ids))
    for r, w in tw.items():
        w_all[r] = w
    ent_rows = np.array([r for r in tw if mask[r]], dtype=np.int64)
    cen = Em[main_rows(tw0, cfg["cen_k"])].mean(0)
    cen /= np.linalg.norm(cen) or 1
    e_c = Em @ cen

    e_q = None
    if q_text:
        e_q = Em @ qemb.embed(emb_main, q_text)
        if non_en and cfg["nonen"]:
            en_pos, _ = english_from_chips(ctx)
            if en_pos:
                e_q = mix_z(e_q, C.embeddings(cfg["emb"]) @ qemb.embed(cfg["emb"], en_pos), rows, cfg["nonen_mix"])
    ws_all = weighted_sum(ctx)
    parts = [top(rows, e_c[rows], cfg["cen_top"])[0], top(rows, ws_all[rows], cfg["k_fp"])[0], ent_rows]
    if e_q is not None:
        parts.append(top(rows, e_q[rows], cfg["k_emb"])[0])
    s_all = None
    if q_text and not (non_en and cfg["nonen_skip_sparse"]) and cfg["sparse"]:
        weights = dict(title=0.0) if cfg["sparse_body"] else None
        s_all, hits = sparse_top(q_text, weights, cfg["sparse_bigram"], mask, rows, cfg["sparse_k"])
        parts.append(hits)
    # facets: Jev phrases without entity words
    f_alls = []
    if cfg["facet"] and cfg["ent_facet"] and q_text:
        ent_words = {w for e in det.entities for w in det.tokens[e.span[0]:e.span[1]]}
        ent_words |= {w for e in det.entities for w in fold(e.name).split()}
        fcs = [f for f in facets(ctx, cfg) if not (set(fold(f).split()) & ent_words)]
        if len(fcs) >= 2:
            for f in fcs:
                fa = Em @ qemb.embed(emb_main, f)
                f_alls.append(fa)
                parts.append(top(rows, fa[rows], 200)[0])

    cand = np.unique(np.concatenate(parts))
    mix = cfg["mix_fil"]
    dense = (1 - mix) * z(e_q[cand]) + mix * z(e_c[cand]) if e_q is not None else z(e_c[cand])
    score = cfg["a"] * z(dense) + cfg["b"] * z(ws_all[cand])
    if cfg["c"] and s_all is not None and s_all[cand].any():
        score = score + cfg["c"] * z(s_all[cand])
    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score = score + cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    if negated and cfg["neg"]:
        pens = [Em @ qemb.embed(emb_main, n) for n in negated]
        score = score - negation_weight(cfg, less) * z(np.max(np.stack([x[cand] for x in pens]), axis=0))
    p, q = cfg["prior"]
    if p or q:
        lv, gw = prior_terms(cand)
        score = score + (p * z(lv) + q * z(gw))
    score = era_prior(score, era, cand, cfg)
    r, s = top(cand, score + cfg["fil_boost"] * w_all[cand], LIMIT)
    return as_list(r, s)


# === style path =======================================================================================================

def centroid_fp(rows, cat):
    """L2-normalized fingerprint centroid of rows, weighted by log votes."""
    rows = np.asarray(rows, np.int64)
    w = np.log1p(cat.votes[rows]).astype(np.float64)
    w = w / (w.sum() or 1)
    f = (cat.fp[rows] * w[:, None]).sum(0)
    return (f / (np.linalg.norm(f) or 1)).astype(np.float32)


def centroid_emb(rows, Em, cat):
    rows = np.asarray(rows, np.int64)
    w = np.log1p(cat.votes[rows]).astype(np.float64)
    w = w / (w.sum() or 1)
    c = (Em[rows] * w[:, None]).sum(0)
    return (c / (np.linalg.norm(c) or 1)).astype(np.float32)


def peer_index(cfg):
    """Fingerprint centroids of every director / creator with >= 3 eligible main-crew titles and >= 200k votes, and of
    every studio group with >= 8 titles and >= 200k votes: {ids, F, rows (by votes), kind}."""
    def build():
        cat = C.load()
        el = cat.eligible()
        ids, Fs, rows_l = [], [], []
        for pid, d in credits(cfg).items():
            rs = [r for r, (w, role) in d.items() if w >= 0.85 and role in ("director", "creator") and el[r]]
            if len(rs) < 3 or cat.votes[rs].sum() < 200_000:
                continue
            ids.append(("p", pid))
            Fs.append(centroid_fp(rs, cat))
            rs.sort(key=lambda r: -cat.votes[r])
            rows_l.append(rs)
        for v in studio_index(cfg)[0].values():
            rs = [r for r, w in v["rows"].items() if w >= 1.0 and el[r]]
            if len(rs) < 8 or cat.votes[rs].sum() < 200_000:
                continue
            ids.append(("s", tuple(v["keys"])))
            Fs.append(centroid_fp(rs, cat))
            rs.sort(key=lambda r: -cat.votes[r])
            rows_l.append(rs)
        return dict(ids=ids, F=np.stack(Fs), rows=rows_l, kind=np.array([i[0] for i in ids]))
    return cached(("peer_index", cfg["credit_weights"], cfg["common_word_guard"]), build)


def peer_scores(det, fpc, cfg):
    """Per row: the similarity (z over people or studios, clipped at 0) of the nearest peer_k peers whose top
    peer_titles titles it is among."""
    pi = peer_index(cfg)
    kind = "s" if all(e.kind == "studio" for e in det.entities) else "p"
    mine = set()
    for e in det.entities:
        if e.kind == "studio":
            mine.add(("s", tuple(e.ids)))
        else:
            mine |= {("p", p) for p in e.ids}
    sel = np.flatnonzero(pi["kind"] == kind)
    sim = z(pi["F"][sel] @ fpc)
    out = np.zeros(len(C.load().ids))
    n = 0
    for i in np.argsort(-sim):
        if pi["ids"][sel[i]] in mine:
            continue
        s = float(max(sim[i], 0))
        for r in pi["rows"][sel[i]][: cfg["peer_titles"]]:
            out[r] = max(out[r], s)
        n += 1
        if n >= cfg["peer_k"]:
            break
    return out


def term_scores(mrows, cfg):
    """BM25 body scores of the entity's term profile: stemmed terms that at least terms_min_df of its main titles
    share, weight = share of titles x IDF, the top terms_n."""
    cat = C.load()
    rows_idx, _, X, idf = S.index(BODY)

    def build():
        return {int(r): i for i, r in enumerate(rows_idx)}, X.tocsr()
    pos, Xr = cached("body_rows", build)
    out = np.zeros(len(cat.ids))
    ii = [pos[r] for r in mrows if r in pos]
    if len(ii) < 2:
        return out
    dfo = np.asarray((Xr[ii] > 0).sum(0)).ravel()
    w = dfo / len(ii) * idf
    w[dfo < cfg["terms_min_df"]] = 0
    cols = np.argsort(-w)[: cfg["terms_n"]]
    cols = cols[w[cols] > 0]
    if len(cols):
        out[rows_idx] = X[:, cols] @ w[cols]
    return out


def mention_scores(det, cfg):
    """BM25 body scores of the entity's name (studio name, or full name plus a non-common surname)."""
    names = []
    for e in det.entities:
        if e.kind == "studio":
            names.append(fold(e.name))
        else:
            for pid in e.ids:
                n = persons()[pid]["name"]
                sur = surname(n)
                names.append(fold(n))
                if sur and not is_common(sur, cfg):
                    names.append(sur)
    return S.scores(" ".join(names), BODY, 2.0).astype(np.float64)


def place_own(order, own, own_min, own_max, own_slots, n_top=10):
    """order: candidate indices by score; own: bool per candidate. Enforce own_min..own_max own titles in the top
    n_top; pulled-up own titles go to the interleaved own_slots."""
    top_, rest = list(order[:n_top]), list(order[n_top:])
    n_own = sum(own[i] for i in top_)
    if n_own > own_max:
        keep, moved, k = [], [], 0
        for i in top_:
            if own[i]:
                k += 1
                if k > own_max:
                    moved.append(i)
                    continue
            keep.append(i)
        fill = [i for i in rest if not own[i]][: n_top - len(keep)]
        fs = set(fill)
        top_ = keep + fill
        rest = moved + [i for i in rest if i not in fs]
        pos = {i: k for k, i in enumerate(order)}   # keep score order inside the top
        top_.sort(key=lambda i: pos[i])
    elif n_own < own_min:
        pull = [i for i in rest if own[i]][: own_min - n_own]
        ps = set(pull)
        others = [i for i in top_ if not own[i]]
        drop = others[len(others) - len(pull):] if pull else []
        ds = set(drop)
        base = [i for i in top_ if i not in ds]
        for i in pull:   # the first free own slot
            slot = next((s for s in own_slots if s <= len(base) and not (s < len(base) and own[base[s]])), len(base))
            base.insert(slot, i)
        top_ = base[:n_top]
        rest = drop + [i for i in rest if i not in ps]
    return np.array(top_ + rest, dtype=np.int64)


def rank_style(ctx, det, cfg, non_en):
    """Titles in the entity's style, own titles bounded in the top 10: ([(point id, score)], own point ids)."""
    cat = C.load()
    emb_main = "me5s" if non_en else cfg["emb"]
    Em = C.embeddings(emb_main)
    Eb = C.embeddings(cfg["emb"])
    mask = ctx.mask
    rows = np.flatnonzero(mask)
    q_text, negated, less = entity_query(ctx, det, cfg, non_en)

    tw = title_weights(det, cfg)
    w_all = np.zeros(len(cat.ids))
    for r, w in tw.items():
        w_all[r] = w
    ent_rows = np.array([r for r in tw if mask[r] and tw[r] >= 0.5], dtype=np.int64)
    mrows = main_rows(tw, cfg["cen6_k"])
    e_c = Eb @ centroid_emb(mrows, Eb, cat)
    fpc = centroid_fp(mrows, cat)
    f_c = cat.fp @ fpc
    t_s = term_scores(mrows, cfg) if cfg["w_terms"] or cfg["w_agree"] else np.zeros(len(cat.ids))
    m_s = mention_scores(det, cfg) if cfg["w_mention"] else np.zeros(len(cat.ids))
    p_s = peer_scores(det, fpc, cfg) if cfg["w_peer"] else np.zeros(len(cat.ids))
    ws_all = weighted_sum(ctx)
    e_q = Em @ qemb.embed(emb_main, q_text) if q_text else None

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

    zf, ze, zt = z(f_c[cand]), z(e_c[cand]), z(t_s[cand])
    terms = [cfg["w_fp"] * zf, cfg["w_emb"] * ze]
    if cfg["w_terms"]:
        terms.append(cfg["w_terms"] * zt)
    if cfg["w_agree"]:
        terms.append(cfg["w_agree"] * np.minimum(np.minimum(zf, ze), zt))
    if cfg["w_mention"] and m_s[cand].any():
        terms.append(cfg["w_mention"] * z(np.log1p(m_s[cand])))
    if cfg["w_peer"] and p_s[cand].any():
        terms.append(cfg["w_peer"] * p_s[cand])
    terms.append(cfg["w_jev"] * z(ws_all[cand]))
    if e_q is not None:
        terms.append(cfg["w_res"] * z(e_q[cand]))
    if negated and cfg["neg"]:
        pens = [Em @ qemb.embed(emb_main, n) for n in negated]
        terms.append(-negation_weight(cfg, less) * z(np.max(np.stack([x[cand] for x in pens]), axis=0)))
    lv, gw = prior_terms(cand)
    terms.append(cfg["gw"] * z(gw) - cfg["damp"] * z(lv) * (~own))
    terms.append(cfg["own_boost"] * own)
    score = sum(terms)

    order = list(np.argsort(-score, kind="stable"))
    if cfg["fold_before_slots"]:
        # alternate cuts count once: a 2nd cut moves to the end before the own-title slots are filled
        ids = [int(cat.ids[cand[i]]) for i in order]
        keep = set(cuts.fold(ids))
        order = [i for i, p in zip(order, ids) if p in keep] + [i for i, p in zip(order, ids) if p not in keep]
    head = []
    if det.intent == "both":
        fil = score + cfg["fil_boost"] * w_all[cand]
        head = [i for i in np.argsort(-fil, kind="stable") if own[i]][: cfg["both_head"]]
        hs = set(head)
        order = [i for i in order if i not in hs]
        order = list(place_own(np.array(order), own, max(0, cfg["own_min"] - len(head)),
                               max(0, cfg["own_max"] - len(head)), cfg["own_slots"], n_top=10 - len(head)))
    else:
        order = list(place_own(np.array(order), own, cfg["own_min"], cfg["own_max"], cfg["own_slots"]))
    order = np.array(head + order, dtype=np.int64)
    final = np.empty(len(cand))
    final[order] = -np.arange(len(order), dtype=np.float64)
    r, s = top(cand, final, LIMIT)
    return as_list(r, s), {int(cat.ids[r]) for r, w in tw.items() if w >= cfg["own_w"]}


def cap_own(blended, own_ids, own_max, n=10):
    """After the blend and the cut folding: at most own_max own titles in the top n (a lookup row or a folded cut can
    shift an own title from rank 11 into the top 10)."""
    top_, extra, k = [], [], 0
    for x in blended:
        if len(top_) >= n:
            break
        if x["id"] in own_ids:
            k += 1
            if k > own_max:
                extra.append(x)
                continue
        top_.append(x)
    ids = {x["id"] for x in top_} | {x["id"] for x in extra}
    return top_ + extra + [x for x in blended if x["id"] not in ids]


# === title blend ======================================================================================================

def title_match(title, query):
    """Production's lexical title score (search-model.tsx): exact 2, phrase 1.05, all words 0.9, word coverage,
    partial last-word prefix 0.15."""
    name, request = normalized(title), normalized(query)
    if not name or not request:
        return 0.0
    if name == request:
        return 2.0
    target, wanted = words(title), words(query)
    uniq = set(wanted)
    hits = sum(1 for w in uniq if w in target)
    coverage = hits / len(uniq)
    if f" {request} " in f" {name} ":
        return 1.05
    if coverage == 1:
        return 0.9
    if hits:
        return 0.65 * coverage
    if wanted and len(wanted[-1]) >= 2 and any(w.startswith(wanted[-1]) for w in target):
        return 0.15
    return 0.0


_TITLE_HEAD = re.compile(r"\s*(?::| - | – )\s*")


def title_similarity(title, query):
    """Similarity of the query to the title or its part before ":" / " - " (rapidfuzz ratio / 100)."""
    q = normalized(query)
    if not q or not title:
        return 0.0
    heads = {normalized(title), normalized(_TITLE_HEAD.split(title)[0])}
    return max(fuzz.ratio(h, q) for h in heads if h) / 100


def names_creator(query):
    """The query is only (at most 3) name tokens of one director / show creator with 2+ titles, one of 4+ letters."""
    def build():
        count = Counter()
        for t in _gz_lines("people.jsonl.gz"):
            count.update(t["creators"])
        by_token = defaultdict(set)
        for i, n in enumerate(n for n, c in count.items() if c >= 2):
            for w in set(words(n)):
                by_token[w].add(i)
        return by_token
    by_token = cached("creator_tokens", build)
    ws = [w for w in words(query) if w not in S.STOP]
    if not ws or len(ws) > 3 or max(len(w) for w in ws) < 4:
        return False
    return bool(set.intersection(*[by_token.get(w, set()) for w in ws]))


def fuzzy_title(query, mask, cutoff):
    """Short queries (<= 4 words, >= 5 letters) with an unknown word: the eligible title most similar to the query
    (>= cutoff, then most votes), unless an exact title exists."""
    q = normalized(query)
    if len(q.split()) > 4 or len(q.replace(" ", "")) < 5:
        return None
    if all(w in word_freq()[0] for w in q.split()):
        return None  # every word is a known word: not a typo
    cat = C.load()

    def build():
        names, owners = [], []
        for r in np.flatnonzero(cat.eligible()):
            for t in {cat.title[r], cat.original_title[r]}:
                n = normalized(t)
                if n:
                    names.append(n)
                    owners.append(r)
        return names, np.array(owners)
    names, owners = cached("eligible_titles", build)
    best = None
    for _, score, i in process.extract(q, names, scorer=fuzz.ratio, score_cutoff=cutoff * 100, limit=20):
        r = owners[i]
        if not mask[r]:
            continue
        if score >= 100:
            return None  # an exact title exists: the TMDB lookup already handles it
        key = (score, cat.votes[r])
        if best is None or key > best[0]:
            best = (key, r)
    return None if best is None else int(best[1])


def blend(ctx, disc, cfg, exclude, entity):
    """Production's title-lookup blend over the discovery list, with strict title matching, the title-word bonus,
    fuzzy titles, the excluded reference titles and the imdb dedup: [{id, title, year, media_type, score}]."""
    cat = C.load()
    query = ctx.query
    kind = cfg["kind"] and (not entity or cfg["title_bonus_on_entity"])
    concrete = concrete_words(ctx)
    creator = kind and cfg["creator_bonus"] and names_creator(query)

    def lexical(title, original):
        lex, src = title_match(title, query), title
        o_lex = title_match(original or "", query)
        if o_lex > lex:
            lex, src = o_lex, original
        if lex and lex < 2 and cfg["strict"]:
            if max(title_similarity(title, query), title_similarity(original or "", query)) < cfg["strict"]:
                matched = set(words(query)) & set(words(src))
                ok = (matched >= concrete) if cfg["kind_all"] else bool(matched & concrete)
                if kind and (creator or (concrete and ok and matched & concrete)):
                    return min(lex, cfg["cap"]) if cfg["cap"] else lex
                return 0.0
        return lex

    rows = {}
    for t in ctx.title_lookup:
        if t.get("type") not in ("movie", "tv"):
            continue
        pid = C.point_id(t["type"], t["id"])
        if pid in exclude:
            continue
        rows[pid] = dict(id=pid, title=t["title"], media_type="show" if t["type"] == "tv" else "movie",
                         year=str(t.get("year") or ""), popularity=float(t.get("popularity") or 0),
                         lexical=lexical(t["title"], t.get("original")), rank=None)
    if cfg["fuzzy"]:
        r = fuzzy_title(query, ctx.mask, cfg["fuzzy"])
        if r is not None and int(cat.ids[r]) not in exclude:
            pid = int(cat.ids[r])
            if pid not in rows or rows[pid]["lexical"] < 1.05:
                rows[pid] = dict(id=pid, title=cat.title[r], media_type=cat.media_type(r), year=str(cat.year[r] or ""),
                                 popularity=float(cat.popularity[r]), lexical=1.05, rank=None)
    for rank_, (pid, _) in enumerate(disc, 1):
        if pid in exclude:
            continue
        row = rows.get(pid)
        if row is None:
            r = cat.row_of[pid]
            row = rows[pid] = dict(id=pid, title=cat.title[r], media_type=cat.media_type(r), year=str(cat.year[r] or ""),
                                   popularity=0.0, lexical=lexical(cat.title[r], cat.original_title[r]), rank=None)
        row["rank"] = rank_
    for row in rows.values():
        fingerprint = 10 / (9 + row["rank"]) if row["rank"] else 0
        lex = row["lexical"]
        row["score"] = 3 + 0.1 * fingerprint if lex == 2 else max(lex * 1.0, fingerprint * 0.9) + min(lex, fingerprint) * 0.15
    key = lambda r: f"{r['media_type']}:{r['id'] % 1_000_000_000_000}"
    ordered = sorted(rows.values(), key=lambda r: (-r["score"], -r["popularity"], key(r)))[:LIMIT]
    out, seen = [], set()
    for row in ordered:
        r = cat.row_of.get(row["id"])
        imdb = cat.imdb_id[r] if r is not None else None
        ident = f"imdb:{imdb}" if imdb else key(row)
        if ident in seen:
            continue
        seen.add(ident)
        out.append(dict(id=row["id"], title=row["title"], year=row["year"], media_type=row["media_type"],
                        score=round(row["score"], 4)))
    return out
