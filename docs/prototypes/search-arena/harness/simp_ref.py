"""The search ranking with one reference mechanism: `rank(ctx) -> list`.

Copy of simp.py (the flat round-6 baseline) with the three reference paths merged. A "like X" title, a person and a
studio are all a *reference*: something the query names that resolves to a weighted set of titles. One mechanism
handles all three:

1. Resolve (`resolve_reference`): entity detection (`detect`, unchanged) or a "like X" title (`find_reference`) gives
   the reference's titles with a weight in [0, 1] (credit weight for people, company position for studios, 1 for a
   title and its franchise), its seed titles (the main-role titles by votes, or the title itself), the residual query
   (the query without the reference and filler words) and an intent: like, filmography, style or both.
2. Profile (`reference_profile`): the seed titles give a fingerprint centroid, an embedding centroid and a term
   profile (optionally name mentions and similar people / studios). Their weighted sum is one extra signal.
3. Rank (`rank_query`): the same candidate pool and fusion as a query without a reference (dense, Jev fingerprint,
   BM25 and facets on the residual query, negation, era, prior), plus the profile (at strength `weak` for like and
   filmography intents, 1 for style) and a boost of the title weight (lead_boost for filmography, own_boost else).
   A title is known to the embedding model, so for "like X" the dense signal embeds the whole query.
4. Own titles (`bound_own`, after the blend): the top 10 holds bounds[intent] = (min, max) own titles. A title
   reference's own titles (the title and its franchise) may appear once, not at rank 1, and not at all when the
   query modifies it ("like X but Y"). Own titles are pulled up only from the discovery list, so an own title with
   no fit to the query (a producer-style credit such as Love, Death & Robots for Fincher) is not forced in.

The intent picks a strength, a boost and bounds; there is no separate code path per intent.

Evaluation: `harness/evalsimp.py score simp_ref:FINAL`.
Complexity: `harness/complexity.py --module simp_ref --name <variant> --defaults simp_ref.DEFAULTS`.
"""
import gzip, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import numpy as np
from rapidfuzz import fuzz, process
from rapidfuzz.distance import Levenshtein

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
    # --- negation, era, facets, coverage -------------------------------------------------------------------------------
    neg=0.1,                  # negated clauses: - neg * z(max cosine)
    less=True,                # reference queries: "less / fewer X" joins the negated clauses
    less_neg=0.3,             # negation weight when a "less X" clause exists
    era=True,                 # a decade or year filters the candidates; "recent" / "old" add a prior
    era_w=0.3,                # weight of the recent / old prior
    facet=0.1,                # Jev phrase facets: facet * (0.5 mean + 0.5 min of z)
    cov=0.3,                  # facet coverage on short queries: cov * z(min over units)
    cov_beta=0.5,             # unit score = z(dense) + cov_beta * z(BM25 body)
    cov_k=300,                # candidates per unit
    cov_max_tokens=5,         # coverage only for queries with at most this many content tokens
    cov_concrete=True,        # coverage only when a unit holds a Jev-concrete word
    collocations=True,        # adjacent unit words that form a collocation stay one unit
    # --- title blend -------------------------------------------------------------------------------------------------
    strict=0.9,               # a partial title match needs this similarity to the query
    fuzzy=0.88,               # fuzzy title match cutoff for short queries with an unknown word
    kind=True,                # title-word bonus: a failed strict match keeps min(lex, cap) ...
    kind_all=True,            # ... when every Jev-concrete query word is in the title (False: any one)
    cap=0.65,
    creator_bonus=True,       # the bonus also applies when the query only names one creator
    title_bonus_on_entity=False,  # the title-word bonus also on person / studio queries
    # --- people and studios (detection, unchanged from simp.py) --------------------------------------------------------
    ent=True,                 # person and studio detection
    studios=True,             # studio detection
    credit_weights=True,      # per-credit weights by role and billing (off: every credit weighs 1)
    common_word_guard=True,   # single words frequent in essence texts or titles need a full-name match
    intent="auto",            # "auto" or a fixed intent: "filmography", "style", "both"
    # --- references: a "like X" title, a person or a studio ------------------------------------------------------------
    ref=True,                 # "like X" title references
    ref_votes=10000,          # a reference title needs this many votes
    franchise=True,           # a title's own titles include its franchise (titles containing its distinctive name)
    seeds="main",             # seeds of a person / studio, top ref_k by votes: "main" main-role titles (weight >= 0.85,
    ref_k=20,                 # else >= 0.5) or "own" own titles (else every credited title)
    w_fp=0.8, w_emb=0.6,      # profile: cosine to the fingerprint / embedding centroid of the seeds
    w_terms=0.3,              # profile: BM25 of the seeds' shared terms
    terms_n=40, terms_min_df=2,
    w_mention=0.1,            # profile: BM25 of the reference's name in other titles' texts (0: off)
    w_peer=0.3,               # profile: titles of similar people / studios (0: off)
    peer_k=15, peer_titles=8,
    w_agree=0.2,              # profile: min(z fp, z emb, z terms) (0: off)
    weak=0.15,                # like / filmography intents take the profile at this strength (style / both: 1)
    own_w=0.8,                # own title = title weight >= own_w
    own_boost=1.0,            # + own_boost * title weight ...
    lead_boost=4.0,           # ... filmography: + lead_boost * title weight (the entity's titles lead)
    damp=0.2,                 # style / both: - damp * z(log votes) on other titles replaces the votes prior
    bounds=dict(like=(0, 1), style=(3, 6), both=(6, 10)),   # own titles in the top 10 (min, max) by intent
    like_first=1,             # a title reference's own titles never take the first like_first ranks
    like_modified=True,       # "like X but Y": the reference's own titles stay out of the top 10
    both_as_style=False,      # a bare name ("both") ranks like a style query
    career_w=1.0,             # "early" / "late" with a person: weight of the old / recent era prior (0: off)
    # --- alternate cuts ----------------------------------------------------------------------------------------------
    fold_after_blend=True,    # 2nd+ cuts are dropped from every list
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


FINAL = {
    # every profile signal (fingerprint, embedding, terms, mentions, peers, agreement); bare names keep own bounds
    "ref-merge": variant(),
    # without name mentions and the agreement term
    "ref-slim": variant(w_mention=0, w_agree=0),
    # fingerprint, embedding and terms only; seeds = own titles; a bare name ranks like a style query
    "ref-lean": variant(w_mention=0, w_agree=0, w_peer=0, seeds="own", both_as_style=True),
}


def run(kw, bk, ctxs):
    """complexity.py contract: rank every context with the merged config."""
    cfg = {**kw, **bk}
    return {ctx.id: rank(ctx, cfg) for ctx in ctxs}


# === entry point ======================================================================================================

def rank(ctx, cfg=None):
    """The ranked list for one query: [{id, title, year, media_type, score}], at most TOP long."""
    cfg = DEFAULTS if cfg is None else cfg
    non_en = cfg["native_routing"] and (ctx.non_english or (cfg["nonen"] and looks_foreign(ctx.text)))
    ref = resolve_reference(ctx, cfg, non_en)
    disc = rank_query(ctx, cfg, non_en, ref)
    blended = blend(ctx, disc, cfg, set(), entity=ref is not None and ref.kind == "entity")
    if cfg["fold_after_blend"]:
        keep = set(cuts.fold([x["id"] for x in blended]))
        blended = [x for x in blended if x["id"] in keep]
    if ref is not None and ref.intent in cfg["bounds"]:
        blended = bound_own(blended, ref, cfg)
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


def correct_word(w):
    freq, vocab = word_freq()
    if not w.isascii() or not w.isalpha() or len(w) < 4 or freq.get(w, 0) >= 3:
        return w
    maxd = 1 if len(w) < 8 else 2
    hits = process.extract(w, vocab, scorer=Levenshtein.distance, score_cutoff=maxd, limit=200)
    if not hits:
        return w
    return min(hits, key=lambda h: (h[1], -freq[h[0]]))[0]


def spell(text):
    def rep(m):
        w = m.group(0)
        c = correct_word(w.lower())
        return c if c != w.lower() else w
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
        elif k == "avoid":
            neg.append(re.sub(r"^Low\s+", "", t))
        elif k == "excluded":
            neg.append(re.sub(r"^Not\s+", "", t))
    return ", ".join(pos), neg


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


# --- era ----------------------------------------------------------------------------------------------------------

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
    era = parse_era(ctx.text) if cfg["era"] else None
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

def facets(ctx, min_p=0.1, max_n=4):
    """Jev's phrases (probability >= min_p, deduplicated) without negated words; [] when fewer than 2."""
    _, negated = split_negation(ctx.text)
    banned = set().union(*[content_words(n) for n in negated]) if negated else set()
    phrases = []
    for p in ctx.reading.get("phrases") or []:
        if p["probability"] >= min_p and p["phrase"] not in phrases:
            phrases.append(p["phrase"])
    out = [f for f in phrases if not (content_words(f) & banned)][:max_n]
    return out if len(out) >= 2 else []


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
    for p in ctx.reading.get("phrases") or []:
        if p["probability"] < min_p:
            continue
        ws = [correct_word(w) for w in words(p["phrase"])]
        ws = [w for w in ws if w not in S.STOP and w not in _GENERIC and w not in banned and len(w) > 1 and not w[0].isdigit()]
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
    return units[:max_n] if 2 <= len(units) <= max_n else []


def concrete_words(ctx):
    return {w["word"].lower() for w in (ctx.reading.get("concreteWords") or []) if w.get("isConcrete")}



# --- "like X" reference titles ------------------------------------------------------------------------------------

_LIKE = [m.split() for m in ("similar to", "in the vein of", "in the style of", "reminiscent of", "along the lines of",
                             "same vibe as", "if i liked", "if i loved", "for fans of", "like")]
_NOT_LIKE = set("feel feels felt look looks sound sounds d would i you we just t not".split())  # "i'd like", "feels like"
_NOT_AFTER_BUT = set("not no without never less".split())


def reference_titles(min_votes):
    """Normalized title (also without a leading "the") -> the row with the most votes, rows with votes >= min_votes."""
    def build():
        cat = C.load()
        idx = {}
        for r in np.flatnonzero(cat.votes >= min_votes):
            for t in {cat.title[r], cat.original_title[r]}:
                n = normalized(t)
                for key in {n, n[4:] if n.startswith("the ") else n}:
                    if key and (key not in idx or cat.votes[r] > cat.votes[idx[key]]):
                        idx[key] = r
        return idx
    return cached(("reference_titles", min_votes), build)


def find_reference(toks, min_votes):
    """(row, used token positions) or None. The longest title (up to 8 words) right after a like-marker, or at the
    start of the query running up to "but" ("breaking bad but funny", not "... but not ...")."""
    idx = reference_titles(min_votes)
    starts = []   # (marker start, title start, required title end or None)
    for i in range(len(toks)):
        for m in _LIKE:
            if toks[i:i + len(m)] == m and not (m == ["like"] and i and toks[i - 1] in _NOT_LIKE):
                starts.append((i, i + len(m), None))
    if "but" in toks[1:]:
        b = toks.index("but", 1)
        if b + 1 < len(toks) and toks[b + 1] not in _NOT_AFTER_BUT:
            starts.append((0, 0, b))
    for m0, s, end in starts:
        for k in range(min(len(toks) - s, 8), 0, -1):
            key = " ".join(toks[s:s + k])
            if len(key) < 3 or key in S.STOP or (end is not None and s + k != end):
                continue
            r = idx.get(key)
            if r is not None:
                return int(r), set(range(m0, s + k))
    return None


def franchise_rows(ref_row):
    """The reference and the titles (votes >= 2000) whose title contains its the-less title as a word phrase, when
    that stem is distinctive (2+ words or 6+ letters)."""
    cat = C.load()

    def build():
        return [(int(r), f" {normalized(cat.title[r])} ", f" {normalized(cat.original_title[r])} ")
                for r in np.flatnonzero(cat.votes >= 2000)]
    titles = cached("franchise_titles", build)
    stem = normalized(cat.title[ref_row])
    stem = stem[4:] if stem.startswith("the ") else stem
    out = {int(ref_row)}
    if len(stem.split()) >= 2 or len(stem) >= 6:
        pat = f" {stem} "
        out |= {r for r, t, o in titles if pat in t or pat in o}
    return out


# --- references -----------------------------------------------------------------------------------------------------

@dataclass
class Reference:
    kind: str                 # "title" | "entity"
    intent: str               # like | filmography | style | both
    weights: dict             # row -> title weight in [0, 1] (the reference's own titles and credits)
    seeds: list               # rows the profile is built from
    names: list               # names mentioned in other titles' texts (w_mention)
    words: set                # words of the reference (dropped from facets)
    text: str                 # residual query: the query without the reference, filler and style words
    negated: list             # negated clauses of the residual (with "less X")
    less: list                # "less X" clauses
    era: str = None           # "early" | "late" (people)
    det: object = None        # the entity Detection (peers)
    own: set = field(default_factory=set)   # point ids of own titles (weight >= own_w)


def resolve_reference(ctx, cfg, non_en):
    """The person, studio or "like X" title the query names, or None."""
    cat = C.load()
    det = detect(ctx.query, cfg) if cfg["ent"] else None
    if det is not None:
        tw = title_weights(det, cfg)
        used = {i for e in det.entities for i in range(*e.span)}
        names, ws = [], set()
        for e in det.entities:
            ws |= set(det.tokens[e.span[0]:e.span[1]]) | set(fold(e.name).split())
            if e.kind == "studio":
                names.append(fold(e.name))
            else:
                for pid in e.ids:
                    n = persons()[pid]["name"]
                    names.append(fold(n))
                    sur = surname(n)
                    if sur and not is_common(sur, cfg):
                        names.append(sur)
        if cfg["seeds"] == "own":
            el = cat.eligible()
            seeds = [r for r, w in tw.items() if w >= cfg["own_w"] and el[r]] or [r for r in tw if el[r]]
            seeds = sorted(seeds, key=lambda r: -cat.votes[r])[: cfg["ref_k"]]
        else:
            seeds = main_rows(tw, cfg["ref_k"])
        intent = "style" if det.intent == "both" and cfg["both_as_style"] else det.intent
        ref = Reference("entity", intent, tw, seeds, names, ws,
                        *residual(det.tokens, used, cfg, non_en), era=det.era, det=det)
    elif cfg["ref"] and not non_en:
        toks = words(ctx.text)
        hit = find_reference(toks, cfg["ref_votes"])
        if hit is None:
            return None
        row, used = hit
        own = franchise_rows(row) if cfg["franchise"] else {row}
        ws = {toks[i] for i in used} | set(words(cat.title[row]))
        ref = Reference("title", "like", {r: 1.0 for r in own}, [row], [normalized(cat.title[row])], ws,
                        *residual(toks, used, cfg, non_en))
    else:
        return None
    ref.own = {int(cat.ids[r]) for r, w in ref.weights.items() if w >= cfg["own_w"]}
    return ref


def residual(tokens, used, cfg, non_en):
    """(residual text, negated clauses, "less X" clauses): the tokens outside the reference, spell-corrected, "less X"
    and negated clauses split off; empty when no content word is left."""
    text = " ".join(w for i, w in enumerate(tokens) if i not in used and w not in _TEAM and w != "-")
    if cfg["spell"] and not non_en:
        text = spell(text)
    less = [m.group(1) for m in _LESS.finditer(text)] if cfg["less"] else []
    if cfg["less"]:
        text = _LESS.sub(" ", text)
    positive, negated = split_negation(text) if cfg["neg"] else (text, [])
    content = [w for w in S.tokens(positive) if w not in _FILLER and w not in _STYLE_WORDS and w not in S.STOP]
    q_text = " ".join(w for w in positive.split() if w not in _FILLER and w not in _STYLE_WORDS) if content else ""
    return q_text, negated + less, less


def reference_profile(ref, cfg, cat):
    """Per-row profile signals of the reference: [(weight, scores, candidate rows or None)]. The candidate rows of a
    signal join the pool; None means its top k_emb."""
    Eb = C.embeddings(cfg["emb"])
    fpc = centroid_fp(ref.seeds, cat)
    sig = [(cfg["w_fp"], cat.fp @ fpc, None), (cfg["w_emb"], Eb @ centroid_emb(ref.seeds, Eb, cat), None)]
    if cfg["w_terms"] or cfg["w_agree"]:
        sig.append((cfg["w_terms"], term_scores(ref.seeds, cfg), "terms"))
    if cfg["w_mention"]:
        sig.append((cfg["w_mention"], mention_scores(ref.names), "mention"))
    if cfg["w_peer"] and ref.det is not None:
        sig.append((cfg["w_peer"], peer_scores(ref.det, fpc, cfg), "peer"))
    return sig


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


def detect(query, cfg):
    """People and studios named in the query (longest n-grams first) and the intent; None when there is none."""
    pidx = person_index(cfg)
    sidx = studio_index(cfg)[0] if cfg["studios"] else {}
    P = persons()
    raw = re.sub(r"(?<=[^\W_])-(?=[^\W_])", " - ", query or "")   # "miyazaki-like" -> "miyazaki - like"
    toks = fold(raw).split()
    # the word lists are English: in other languages only multi-word full names count ("Bud Spencer")
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


# === ranking ==========================================================================================================

def rank_query(ctx, cfg, non_en, ref):
    """[(point id, score)] for every query: dense + Jev fingerprint + BM25 of the (residual) query, facets, facet
    coverage, negation, era, prior; with a reference also its profile and the title-weight boost."""
    cat = C.load()
    emb_main = "me5s" if non_en else cfg["emb"]
    E = C.embeddings(emb_main)
    text = spell(ctx.text) if cfg["spell"] and not non_en else ctx.text
    positive, negated = split_negation(text) if cfg["neg"] else (text, [])
    less, dense_text = [], positive
    if ref is not None:
        # a title is known to the embedding model: the dense signal embeds the whole query ("like groundhog day")
        positive, negated, less = ref.text, ref.negated, ref.less
        dense_text = dense_text if ref.kind == "title" else positive
    mask, era = era_filter(ctx, cfg, ctx.mask)
    if ref is not None and ref.era and cfg["career_w"]:
        era = ("old",) if ref.era == "early" else ("recent",)
        cfg = {**cfg, "era_w": cfg["career_w"]}
    rows = np.flatnonzero(mask)

    ws_all = weighted_sum(ctx)
    parts = [top(rows, ws_all[rows], cfg["k_fp"])[0]]
    e_all, extra_neg = None, []
    if dense_text:
        e_all = E @ qemb.embed(emb_main, dense_text)
        if non_en and cfg["nonen"]:
            en_pos, en_neg = english_from_chips(ctx)
            if en_pos:
                Eb = C.embeddings(cfg["emb"])
                e_all = mix_z(e_all, Eb @ qemb.embed(cfg["emb"], en_pos), rows, cfg["nonen_mix"])
                if cfg["avoid_chips"]:
                    extra_neg = [Eb @ qemb.embed(cfg["emb"], n) for n in en_neg]
        parts.append(top(rows, e_all[rows], cfg["k_emb"])[0])

    s_all = None
    if cfg["sparse"] and not non_en and positive:
        weights = dict(title=0.0) if cfg["sparse_body"] else None
        s_all, hits = sparse_top(positive, weights, cfg["sparse_bigram"], mask, rows, cfg["sparse_k"])
        parts.append(hits)

    # facets: Jev phrases without the reference's words
    f_alls = []
    if cfg["facet"] and positive:
        fcs = facets(ctx)
        if ref is not None:
            fcs = [f for f in fcs if not (set(fold(f).split()) & ref.words)]
            fcs = fcs if len(fcs) >= 2 else []
        for f in fcs:
            fa = E @ qemb.embed(emb_main, f)
            f_alls.append(fa)
            parts.append(top(rows, fa[rows], 200)[0])

    # facet coverage: titles that match only the dominant facet drop
    units = []
    if cfg["cov"] and not non_en and ref is None and len(S.tokens(positive)) <= cfg["cov_max_tokens"]:
        units = facet_units(ctx, negated, cfg)
        concrete = concrete_words(ctx)
        if cfg["cov_concrete"] and not any(set(u.split()) & concrete for u in units):
            units = []
    u_d, u_s = [], []
    for u in units:
        d = E @ qemb.embed(emb_main, u)
        u_d.append(d)
        parts.append(top(rows, d[rows], cfg["cov_k"])[0])
        s, hits = sparse_top(u, BODY, 1.0, mask, rows, cfg["sparse_k"])
        u_s.append(s)
        parts.append(hits[: cfg["cov_k"]])

    # the reference: its profile signals and its own titles join the pool
    profile, w_all = [], None
    if ref is not None:
        w_all = np.zeros(len(cat.ids))
        for r, w in ref.weights.items():
            w_all[r] = w
        parts.append(np.array([r for r, w in ref.weights.items() if mask[r] and w >= 0.5], dtype=np.int64))
        profile = reference_profile(ref, cfg, cat)
        for w, sc, kind in profile:
            if kind is None:
                parts.append(top(rows, sc[rows], cfg["k_emb"])[0])
            elif kind == "peer":
                parts.append(rows[sc[rows] > 0])
            else:
                k = cfg["sparse_k"] if kind == "terms" else 100
                tt, tv = top(rows, sc[rows], k)
                parts.append(tt[tv > 0])

    cand = np.unique(np.concatenate(parts))
    score = cfg["b"] * z(ws_all[cand])
    if e_all is not None:
        score += cfg["a"] * z(e_all[cand])
    if cfg["c"] and s_all is not None and s_all[cand].any():
        score += cfg["c"] * z(s_all[cand])
    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score += cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    if units:
        cov = np.stack([z(d[cand]) + cfg["cov_beta"] * z(s[cand]) for d, s in zip(u_d, u_s)]).min(0)
        score += cfg["cov"] * z(cov)
    if cfg["neg"]:
        pens = [(E @ qemb.embed(emb_main, n))[cand] for n in negated] + [x[cand] for x in extra_neg]
        if pens:
            wn = max(cfg["neg"], cfg["less_neg"] if less else 0)
            score -= wn * z(np.max(np.stack(pens), axis=0))
    p, q = cfg["prior"]
    lv, gw = prior_terms(cand)
    if ref is not None:
        intent = ref.intent
        own = w_all[cand] >= cfg["own_w"]
        strength = cfg["weak"] if intent in ("like", "filmography") else 1.0
        zs = []
        for w, sc, kind in profile:
            zc = z(np.log1p(sc[cand])) if kind == "mention" else sc[cand] if kind == "peer" else z(sc[cand])
            if w:
                score += strength * w * zc
            if kind in (None, "terms"):
                zs.append(zc)
        if cfg["w_agree"] and len(zs) == 3:
            score += strength * cfg["w_agree"] * np.minimum(np.minimum(zs[0], zs[1]), zs[2])
        score += (cfg["lead_boost"] if intent == "filmography" else cfg["own_boost"]) * w_all[cand]
        if intent in ("style", "both"):
            score = score + q * z(gw) - cfg["damp"] * z(lv) * (~own)
        else:
            score = score + p * z(lv) + q * z(gw)
    elif p or q:
        score = score + p * z(lv) + q * z(gw)
    score = era_prior(score, era, cand, cfg)
    r, s = top(cand, score, LIMIT)
    return as_list(r, s)


# === reference profile helpers ========================================================================================

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



def term_scores(seeds, cfg):
    """BM25 body scores of the seeds' term profile: stemmed terms that at least min(terms_min_df, seeds) of them share,
    weight = share of seeds x IDF, the top terms_n."""
    cat = C.load()
    rows_idx, _, X, idf = S.index(BODY)

    def build():
        return {int(r): i for i, r in enumerate(rows_idx)}, X.tocsr()
    pos, Xr = cached("body_rows", build)
    out = np.zeros(len(cat.ids))
    ii = [pos[r] for r in seeds if r in pos]
    if not ii:
        return out
    dfo = np.asarray((Xr[ii] > 0).sum(0)).ravel()
    w = dfo / len(ii) * idf
    w[dfo < min(cfg["terms_min_df"], len(ii))] = 0
    cols = np.argsort(-w)[: cfg["terms_n"]]
    cols = cols[w[cols] > 0]
    if len(cols):
        out[rows_idx] = X[:, cols] @ w[cols]
    return out


def mention_scores(names):
    """BM25 body scores of the reference's names in other titles' texts."""
    return S.scores(" ".join(names), BODY, 2.0).astype(np.float64)


def bound_own(blended, ref, cfg, n=10):
    """The top n holds bounds[intent] = (lo, hi) own titles (a title reference's: none in the first like_first ranks).
    Extra own titles move below n; missing ones (from the rest of the list) are pulled up into every second rank."""
    lo, hi = cfg["bounds"][ref.intent]
    if cfg["like_modified"] and ref.kind == "title" and ref.text:
        hi = 0
    first = cfg["like_first"] if ref.kind == "title" else 0
    items = blended
    is_own = [x["id"] in ref.own for x in items]
    own_i = [i for i, o in enumerate(is_own) if o]
    other_i = [i for i, o in enumerate(is_own) if not o]
    k_top = sum(1 for i in own_i if i < n)
    k = min(max(k_top, lo), hi, len(own_i))
    keep_own = own_i[:k]
    pulled = [i for i in keep_own if i >= n]
    base = sorted([i for i in keep_own if i < n] + other_i[: n - k])
    # own titles above `first` move down to `first`
    head = [i for i in base if not is_own[i]][:first]
    base = head + [i for i in base if i not in head]
    for i in pulled:
        slot = next((s for s in range(first, n, 2) if s <= len(base) and not (s < len(base) and is_own[base[s]])),
                    len(base))
        base.insert(slot, i)
    top_ = base[:n]
    ts = set(top_)
    return [items[i] for i in top_] + [items[i] for i in range(len(items)) if i not in ts] + blended[len(items):]


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
