"""Round 7 experiment (copy of simp_combo.py): trope-based negation evidence (neg_tropes, trope_abs).

The simplified search ranking: `rank(ctx) -> list`. Round 3 of the simplify loop: the four round-2 areas combined.

Built from simp.py (the flat round-6 baseline) with each area's change ported and every replaced branch deleted:
- entity (simp_entity.py): one name index for people and studios with one ambiguity test, two credit classes
  (main 1, other minor_credit), intent from the nearest example phrase;
- reference (simp_ref.py): a "like X" title, a person and a studio are one reference (weighted titles, seeds, a
  residual query); one ranking function; own titles bounded after the blend (`bound_own`);
- text (simp_text.py): marker-word negation ("less", "than" included), a decade / year filter only, facets and
  coverage from Jev's searched phrases, one-edit spell correction;
- fusion (simp_fusion.py): dense and fingerprint weights plus one shared weight for every secondary signal, two
  candidate depths, the main BM25 query on the body fields, strict title similarity on the whole title, a simpler
  fuzzy title and cut rule, no creator-name or entity rule in the title-word bonus.

Per query, after the Jev reading (ctx):
1. Language: production's non-English flag or a stopword check routes the query to the multilingual embedding.
2. Reference (`resolve_reference`): a person, a studio or a "like X" title, or none.
3. Ranking (`rank_query`): dense + Jev fingerprint (+ BM25, facets, coverage, negation, votes and GoodWatch score at
   one shared weight) over the query, or over the residual query of a reference plus its profile and a boost of its
   own titles. The intent (like, filmography, style, both) picks numbers, not code.
4. Title blend (production's title lookup with strict matching, the title-word bonus and fuzzy titles), alternate cuts
   folded, own titles bounded in the top 10.

Round 4 (`combo-v2`, `combo-safe-v2`): the own-title bounds also count a person's co-directed films; a non-English
person / studio query reuses the intent's me5s vector as its dense query. Every variant encodes a text once per query
(`sims`).

Evaluation: `harness/evalsimp.py score simp_combo:FINAL`; latency with uncached query encodes:
`harness/evalsimp.py latency simp_combo:FINAL --uncached`.
Complexity: `harness/complexity.py --module simp_combo --name combo --defaults simp_combo.DEFAULTS`.
"""
import gzip, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field

import numpy as np
from rapidfuzz import fuzz, process
from rapidfuzz.distance import OSA, Levenshtein

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog as C  # noqa: E402
import cuts  # noqa: E402
import qemb  # noqa: E402
import sparse as S  # noqa: E402

TOP = 50          # returned list length (and the discovery list handed to the blend)

BODY = dict(title=0.0, creators=0.0, cast=0.0)   # BM25 body fields: tags 2, keywords 2, tropes 1, essence 1
BODY_UNIFORM = dict(BODY, tags=1.0, keywords=1.0)

DEFAULTS = dict(
    # --- fusion -----------------------------------------------------------------------------------------------------
    emb="bgeb-notitle",       # English catalog embedding (non-English queries use me5s)
    a=0.4, b=0.48,            # dense, Jev fingerprint weighted sum
    secondary=0.1,            # one weight for BM25, facets, coverage, negation, votes and GoodWatch score
    k_main=500,               # candidates per whole-query list (dense, fingerprint, reference centroids)
    k_part=300,               # candidates per partial list (BM25, facet, coverage unit, term profile)
    body=BODY,                # BM25 field weights (main query, coverage units, term profile)
    nonen_mix=0.5,            # non-English: share of z(bge on Jev's English chips) in the dense signal
    # --- facets and coverage ----------------------------------------------------------------------------------------
    facet_min_n=1,            # facets need at least this many searched phrases
    cov_beta=0.5,             # coverage unit score = z(dense) + cov_beta * z(BM25 body)
    cov_max_tokens=5,         # coverage only for queries with at most this many content tokens
    collocations=True,        # adjacent unit words that form a collocation stay one unit
    # --- people and studios -----------------------------------------------------------------------------------------
    minor_credit=0.5,         # weight of a credit that is not a main credit (main credits weigh 1)
    credits_file="credits.jsonl.gz",   # credits.jsonl.gz: a show without a Creator credit takes its top 2 Executive
                              # Producers / Writers by episodes as creators; credits-v2.jsonl.gz: people with a script
                              # credit (Executive Producers among them first), never pure producers
    fallback_creator="main",  # such a fallback creator has a "main" or a "minor" credit
    lead_billing=3,           # actors billed at order <= lead_billing have a main credit
    company_main=2,           # the first company_main listed production companies have a main credit
    team_overlap=0.5,         # two people with a key form a team when this share of the second's main titles is shared
    name_votes=150_000,       # a key resolves only when its entity's main-title votes >= name_votes x (1 + word df)
    name_dominance=3.0,       # ... and >= name_dominance x the next entity with the key
    name_max_words=4,         # longest key tried
    style_suffix=False,       # "kubrickesque", "lynchian": a suffixed word resolves by its stem
    # --- references -------------------------------------------------------------------------------------------------
    ref_votes=10000,          # a "like X" title needs this many votes
    ref_k=20,                 # seeds: the reference's top main-credit titles by votes
    w_fp=0.8, w_emb=0.6,      # profile: cosine to the fingerprint / embedding centroid of the seeds
    w_terms=0.3,              # profile: BM25 of the seeds' shared terms
    terms_n=40, terms_min_df=2,
    w_peer=0.3,               # profile: titles of similar people / studios (0: off)
    peer_k=15, peer_titles=8,
    w_mention=0.1,            # profile: BM25 of a person's / studio's name in other titles' texts (0: off)
    w_agree=0.0,              # profile: min(z fp, z emb, z terms) (0: off)
    weak=0.15,                # like / filmography take the profile at this strength (style / both: 1)
    own_boost=1.0,            # + own_boost * title weight (like / style / both) ...
    lead_boost=4.0,           # ... filmography: + lead_boost * title weight (the entity's titles lead)
    damp=0.2,                 # style / both: - damp * z(log votes) on other titles replaces the votes prior
    bounds=dict(like=(0, 1), style=(3, 6), both=(6, 10)),   # own titles in the top 10 (min, max) by intent
    bound_codirected=False,   # the bounds also count a person's co-directed films (a minor credit) as own titles
    like_first=1,             # a title reference's own titles never take the first like_first ranks
    entity_dense="residual",  # a person / studio query's dense signal: "residual" (the residual encoded in the main
                              # embedding), "intent" (the intent's me5s vector of the query with the names as "X",
                              # no second encode), "reuse" ("intent" when the main embedding is me5s, i.e. non-English
                              # queries, else "residual") or "none"
    career_w=0.0,             # "early" / "late" with a person: weight of z(-year) / z(year) (0: off)
    intent_thread=0,          # n > 0: the intent encode runs in a worker thread with n torch threads, concurrently with
                              # the residual and facet encodes, and is read after them (0: inline, before them)
    neg_lex=0.0,              # negated phrase: - neg_lex * share of 2 keyword / tag labels holding its stems (0: off)
    neg_tropes=False,         # ... TV Tropes names count as such labels too (presence evidence); "scoped": only for a
                              # phrase that has an absence trope (TV Tropes tracks that thing both ways)
    trope_abs=0.0,            # negated phrase: + trope_abs on titles with an absence trope for it ("Absent Aliens": an
                              # absence word followed by exactly the phrase's stems); they get no presence penalty and
                              # join the candidate pool (0: off)
    # --- title blend ------------------------------------------------------------------------------------------------
    strict=0.9,               # a partial title match needs this similarity to the query (also the fuzzy cutoff)
    kind=True,                # title-word bonus: a failed strict match keeps min(lex, cap) when every Jev-concrete
    cap=0.65,                 # query word is in the title
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


# Each area's safest variant: entity-resolver (career, suffix stems), ref-merge (agreement too), text-safe (facets from
# 2 phrases), fusion-lite (r6's separate secondary weights).
LITE_W = dict(bm25=0.12, facet=0.1, cov=0.3, neg=0.1, votes=0.1, gw=0.1)
SAFE = dict(secondary=LITE_W, facet_min_n=2, w_agree=0.2, career_w=1.0, style_suffix=True)
# The ambitious ones: entity-lean, ref-lean (no mentions or peers, a bare name ranks like a style query), text-agg
# (no collocations), fusion-lean (uniform BM25 field weights, no title-word bonus).
LEAN = dict(w_mention=0.0, w_peer=0.0, bounds=dict(like=(0, 1), style=(3, 6), both=(3, 6)), collocations=False,
            kind=False, body=BODY_UNIFORM)
V2 = dict(bound_codirected=True, entity_dense="reuse")

FINAL = {
    "combo-safe": variant(**SAFE),
    # the recommended variant of each area plus round 1's safe drops (DEFAULTS): entity-lean, ref-merge without the
    # agreement term, text-cons, fusion-shared
    "combo": variant(),
    "combo-lean": variant(**LEAN),
    # combo-lean with the peers kept inside the one reference mechanism
    "combo-lean-peers": variant(**dict(LEAN, w_peer=0.3)),
    # round 4: the own-title bounds count co-directed films (the own10 metric's definition: "tarantino vibes" kept
    # Sin City as a 7th own title), and a non-English person / studio query reuses the intent's me5s vector as its
    # dense query instead of encoding the residual again
    "combo-v2": variant(**V2),
    "combo-safe-v2": variant(**dict(SAFE, **V2)),
    # "funny brad pitt shows": producers are no longer creators of shows without a Creator credit
    "combo-safe-v2-wcred": variant(**dict(SAFE, **V2, credits_file="credits-v2.jsonl.gz")),   # (A) writers only
    "combo-safe-v2-fbminor": variant(**dict(SAFE, **V2, fallback_creator="minor")),            # (B) minor credit
    # round 5: the English person / studio query's intent encode (me5s, 1 torch thread) overlaps the residual encode
    "combo-safe-v2-wcred-par": variant(**dict(SAFE, **V2, credits_file="credits-v2.jsonl.gz", intent_thread=1)),
    # ... or one encode serves both: the intent's me5s vector is also the dense query of every person / studio query
    "combo-safe-v2-wcred-me5s": variant(**dict(SAFE, **dict(V2, entity_dense="intent"), credits_file="credits-v2.jsonl.gz")),
    # round 6: the round-5 candidate plus the lexical negation penalty (titles labelled with the negated thing)
    "combo-safe-v3": variant(**dict(SAFE, **V2, credits_file="credits-v2.jsonl.gz", intent_thread=1, neg_lex=2.0)),
    # trope negation: tropes as presence labels (pres), absence tropes as a boost (abs), both
    "trope-pres": variant(**dict(SAFE, **V2, credits_file="credits-v2.jsonl.gz", intent_thread=1, neg_lex=2.0,
                                 neg_tropes=True)),
    "trope-abs": variant(**dict(SAFE, **V2, credits_file="credits-v2.jsonl.gz", intent_thread=1, neg_lex=2.0,
                                trope_abs=1.0)),
    "trope-scoped": variant(**dict(SAFE, **V2, credits_file="credits-v2.jsonl.gz", intent_thread=1, neg_lex=2.0,
                                   neg_tropes="scoped", trope_abs=1.0)),
    "trope-both": variant(**dict(SAFE, **V2, credits_file="credits-v2.jsonl.gz", intent_thread=1, neg_lex=2.0,
                                 neg_tropes=True, trope_abs=1.0)),
}


def run(kw, bk, ctxs):
    """complexity.py contract: rank every context with the merged config."""
    cfg = {**kw, **bk}
    return {ctx.id: rank(ctx, cfg) for ctx in ctxs}


# === entry point ======================================================================================================

def rank(ctx, cfg=None):
    """The ranked list for one query: [{id, title, year, media_type, score}], at most TOP long."""
    cfg = DEFAULTS if cfg is None else cfg
    _sims.clear()
    non_en = ctx.non_english or looks_foreign(ctx.text)
    ref = resolve_reference(ctx, cfg, non_en)
    blended = blend(ctx, rank_query(ctx, cfg, non_en, ref), cfg)
    keep = set(fold_cuts([x["id"] for x in blended]))
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


def filled(x):
    """A float copy with missing values (NaN, or a year of 0) replaced by the mean of the others."""
    x = np.asarray(x, np.float64)
    x = np.where(x > 0, x, np.nan)
    return np.where(np.isnan(x), np.nanmean(x) if np.isfinite(x).any() else 0, x)


def sparse_top(text, weights, mask, rows, k):
    """BM25 scores kept only for the top k hits (score > 0) inside the mask: (scores per row, hit rows)."""
    s = np.where(mask, S.scores(text, weights).astype(np.float64), 0)
    hits, val = top(rows, s[rows], k)
    hits = hits[val > 0]
    kept = np.zeros_like(s)
    kept[hits] = s[hits]
    return kept, hits


_cache = {}
_sims = {}   # per query: (model, text) -> catalog similarities; a text is encoded once per query


def sims(model, text):
    """Cosine of every catalog row to the query text in the embedding `model`, memoized for the current query."""
    if (model, text) not in _sims:
        _sims[(model, text)] = C.embeddings(model) @ qemb.embed(model, text)
    return _sims[(model, text)]


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
    """An unknown word (ASCII letters, 4+, df < 3) becomes the most frequent vocabulary word one edit away (a
    transposition counts one)."""
    freq, vocab = word_freq()
    if not w.isascii() or not w.isalpha() or len(w) < 4 or freq.get(w, 0) >= 3:
        return w
    hits = process.extract(w, vocab, scorer=OSA.distance, score_cutoff=1, limit=None)
    if not hits:
        return w
    return min(hits, key=lambda h: (h[1], -freq[h[0]]))[0]


def spell(text):
    def rep(m):
        w = m.group(0)
        c = correct_word(w.lower())
        return c if c != w.lower() else w
    return _WORD.sub(rep, text)


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


# --- negation -----------------------------------------------------------------------------------------------------

# A marker word opens a negated clause; the clause runs to a clause-end word or a token ending in , . ; ! ?
# ("than": "more getaway driver than superheroes"; "less": "like david lynch but less weird").
NEG_WORDS = set("no not without except minus nothing than less fewer isn't aren't don't doesn't "
                "ohne nicht kein keine keinen keiner sans pas ni sin".split())
CLAUSE_END = set("but and aber und mais et pero y".split())


def split_negation(text):
    """(positive text, [negated clauses]) over whitespace tokens. No markers: (text, [])."""
    pos, negs, cur = [], [], None
    for tok in text.replace("’", "'").split():
        w = tok.strip(",.;:!?-()\"").lower()
        if cur is not None and w in CLAUSE_END:
            cur = None
        if cur is None and w in NEG_WORDS:
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


ABSENCE_WORDS = set("absent absence no without lack lacks lacking".split())


def trope_index():
    """(trope name -> eligible rows, stem -> trope names holding it, absence key -> trope names). An absence trope is
    an absence word followed only by content stems ("Absent Aliens" -> ("alien",)); its key is the sorted stems."""
    def build():
        cat = C.load()
        rows, by_stem, absent = defaultdict(set), defaultdict(set), defaultdict(set)
        for r in np.flatnonzero(cat.eligible()):
            for t in cat.tropes[r]:
                rows[t].add(r)
        for t in rows:
            for x in S.tokens(t):
                by_stem[x].add(t)
            ws = words(t)
            if len(ws) >= 2 and ws[0] in ABSENCE_WORDS:
                rest = S.tokens(" ".join(ws[1:]))
                if rest and len(rest) == len(ws) - 1:
                    absent[tuple(sorted(set(rest)))].add(t)
        return rows, by_stem, absent
    return cached("tropes", build)


def trope_negation(phrase):
    """(presence count, absence mask) per catalog row for a negated phrase: the number of tropes whose name holds every
    content stem of the phrase (absence tropes excluded), and titles carrying an absence trope for exactly those stems."""
    rows, by_stem, absent = trope_index()
    want = set(S.tokens(phrase))
    n = np.zeros(len(C.load().ids))
    a = np.zeros(len(n), bool)
    if not want:
        return n, a
    abs_t = absent.get(tuple(sorted(want)), set())
    for t in set.intersection(*[by_stem.get(x, set()) for x in want]) - abs_t:
        n[list(rows[t])] += 1
    for t in abs_t:
        a[list(rows[t])] = True
    return n, a


def label_negation(phrase, tropes=False):
    """Per catalog row, the share (capped at 1) of 2 keyword / essence-tag labels that hold every content stem of a
    negated phrase ("aliens" -> "alien", "alien invasion"; "about world war ii" -> "world war ii drama")."""
    def build():
        cat = C.load()
        labels, by_stem = defaultdict(set), defaultdict(set)   # label -> eligible rows; stem -> labels holding it
        for r in np.flatnonzero(cat.eligible()):
            for x in cat.keywords[r] + cat.essence_tags[r]:
                labels[x.lower()].add(r)
        for k in labels:
            for t in S.tokens(k):
                by_stem[t].add(k)
        return labels, by_stem
    labels, by_stem = cached("labels", build)
    want = set(S.tokens(phrase))
    hit = set.intersection(*[by_stem.get(t, set()) for t in want]) if want else set()
    n = np.zeros(len(C.load().ids))
    for k in hit:
        n[list(labels[k])] += 1
    if tropes:
        tn, ta = trope_negation(phrase)
        if tropes != "scoped" or ta.any():
            n = np.where(ta, 0, n + tn)
    return np.minimum(1.0, n / 2)


# --- era ----------------------------------------------------------------------------------------------------------

# A decade ("80s", "1980s", "'80s", "80er", "2000s") or a year ("1994").
_ERA = re.compile(r"(?<!\w)(?:(19|20)?(\d)0(?:'?s|’s|er)|(19\d\d|20\d\d))(?!\w)", re.IGNORECASE)


def era_filter(text, mask):
    """A decade or a year in the query keeps only the titles inside it (unless none would remain)."""
    m = _ERA.search(text)
    if not m:
        return mask
    if m.group(3):
        lo = hi = int(m.group(3))
    else:
        lo = int(m.group(1) or (19 if int(m.group(2)) >= 2 else 20)) * 100 + 10 * int(m.group(2))
        hi = lo + 9
    year = C.load().year
    m2 = mask & (year >= lo) & (year <= hi)
    return m2 if m2.any() else mask


# --- facets and coverage ------------------------------------------------------------------------------------------

def searched_phrases(ctx):
    return [p["phrase"] for p in ctx.reading.get("searchedPhrases") or []]


def facets(ctx, negated, skip, cfg):
    """Jev's searched phrases without negated words or the reference's words; [] when fewer than facet_min_n."""
    banned = {w for n in negated for w in words(n)} | skip
    out = [f for f in searched_phrases(ctx) if not (set(words(f)) & banned)]
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


def facet_units(ctx, negated, cfg):
    """Content units of Jev's searched phrases (collocations merged), deduplicated, not negated; [] below 2."""
    banned = {w for n in negated for w in words(n)}
    units = []
    for p in searched_phrases(ctx):
        ws = [correct_word(w) for w in words(p)]
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
    return units if len(units) >= 2 else []


def concrete_words(ctx):
    return {w["word"].lower() for w in (ctx.reading.get("concreteWords") or []) if w.get("isConcrete")}


# === references =======================================================================================================

@dataclass
class Reference:
    kind: str                 # "title" | "entity"
    intent: str               # like | filmography | style | both
    weights: dict             # row -> title weight in (0, 1] (its own titles and credits)
    seeds: list               # rows the profile is built from
    words: set                # words of the reference (dropped from facets)
    text: str                 # residual query: the query without the reference and filler words
    negated: list             # negated clauses of the residual
    era: str = None           # "early" | "late" (people)
    det: object = None        # the entity Detection (peers, mentions)
    own: set = field(default_factory=set)   # point ids of own titles (weight 1)


def resolve_reference(ctx, cfg, non_en):
    """The person, studio or "like X" title the query names, or None."""
    cat = C.load()
    det = detect(ctx.query, cfg)
    if det is not None:
        tw = title_weights(det, cfg)
        used = {i for e in det.entities for i in range(*e.span)}
        ws = set()
        for e in det.entities:
            ws |= set(det.tokens[e.span[0]:e.span[1]]) | set(fold(e.name).split())
        ref = Reference("entity", det.intent, tw, main_rows(tw, cfg["ref_k"]), ws,
                        *residual(det.tokens, used, non_en), era=det.era, det=det)
    else:
        toks = words(ctx.text)
        hit = find_reference(toks, cfg["ref_votes"])
        if hit is None:
            return None
        row, used = hit
        ws = {toks[i] for i in used} | set(words(cat.title[row]))
        ref = Reference("title", "like", {r: 1.0 for r in franchise_rows(row)}, [row], ws, *residual(toks, used, non_en))
    ref.own = {int(cat.ids[r]) for r, w in ref.weights.items() if w >= 1}
    if cfg["bound_codirected"] and ref.det is not None:
        ref.own |= {int(cat.ids[r]) for e in ref.det.entities if e.kind == "person" for pid in e.ids
                    for r, (_, role) in credits(cfg).get(pid, {}).items() if role == "co-director"}
    return ref


def residual(tokens, used, non_en):
    """(residual text, negated clauses): the tokens outside the reference, spell-corrected, negated clauses split
    off, filler words dropped; empty when no content word is left."""
    text = " ".join(w for i, w in enumerate(tokens) if i not in used)
    positive, negated = split_negation(text if non_en else spell(text))
    content = [w for w in S.tokens(positive) if w not in _FILLER and w not in S.STOP]
    return (" ".join(w for w in positive.split() if w not in _FILLER) if content else ""), negated


# --- "like X" titles ------------------------------------------------------------------------------------------------

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
                for key in {n, n.removeprefix("the ")}:
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
    stem = normalized(cat.title[ref_row]).removeprefix("the ")
    out = {int(ref_row)}
    if len(stem.split()) >= 2 or len(stem) >= 6:
        pat = f" {stem} "
        out |= {r for r, t, o in titles if pat in t or pat in o}
    return out


# === people and studios ===============================================================================================
#
# One name index for people and studios, one prior and one ambiguity test:
# - keys: a person's folded full name, original name and last name; the full name and the first word of a studio
#   name, all studios with the same key merged into one brand;
# - prior (mass): the votes of the entity's main-credit titles;
# - a key resolves to its heaviest entity when that entity outweighs both the next entity with the key
#   (name_dominance x) and the key's reading as an ordinary word (name_votes x (1 + the word's document frequency)).
#   People with the same last name who share most of their main credits merge into a team ("coen").
# Intent (filmography / style / both) is the nearest example phrase to the query with the names replaced by "X",
# in the multilingual embedding.

# Words of a reference query that carry no topic: what is left once they and the names are removed is the residual.
_FILLER = set("a an the and or und et y of in on for to me some any good great best top all every movie movies film "
              "films filme filmen show shows series tv starring stars star with featuring feat by directed "
              "director written produced voiced mit von avec de del con from filmography works work career "
              "early late later recent old older classic newer new s give want watch something anything "
              "vibe vibes vibey style styled stylish esque like feel feels feeling atmosphere atmospheric "
              "aesthetic aesthetics humor humour tone mood energy similar inspired vein sensibility touch "
              "flavor flavour spirit type sort kind way approach à la brothers bros sisters".split())
_ERA_WORDS = {"early": "early", "late": "late", "later": "late", "recent": "late", "new": "late", "newer": "late",
              "old": "early", "older": "early", "classic": "early", "frühe": "early", "frühen": "early"}
_STYLE_SUFFIX = re.compile(r"^(.{4,}?)(?:esque|ian|like|ish)$")

# Intent examples; "X" stands for the names. A query that is only names is "both" (a studio: "filmography").
INTENT_EXAMPLES = {
    "filmography": ["X movies", "X films", "films starring X", "movies directed by X", "X filmography",
                    "X's best films", "X comedies", "X crime thrillers", "X sci-fi movies", "old X films",
                    "X animated films", "X series", "shows created by X", "X's early work", "late X movies",
                    "Filme mit X", "les films de X", "películas de X"],
    "style": ["movies like X", "films similar to X", "in the style of X", "X-ish vibes", "reminds me of X",
              "something with a X aesthetic", "X-esque", "X kind of humor", "X feel", "the X tone", "X mood",
              "as if X made it", "X inspired", "X type of film", "X sort of thing", "un film comme X",
              "im Stil von X", "al estilo de X"],
    "both": ["X and films like theirs", "X plus similar picks", "X's work and others like it"],
}
INTENT_EMB = "me5s"


def fold(s):
    """Lowercase, strip diacritics, keep letters / digits, collapse spaces."""
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"['’`]s\b", "", s)            # possessive
    s = s.replace("&", " and ").replace("+", " ")
    return " ".join(_WORD.findall(s))


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
    """person id -> {row: (credit weight, role)}. Two classes: a main credit weighs 1, any other minor_credit
    (a film's co-director: role "co-director").
    Main: a film's director or writer (Writing department), a show's first-listed director or writer (shows list
    episode crew by episode count), a creator, and the first lead_billing + 1 billed actors (ensembles such as Snatch
    bill Brad Pitt fourth)."""
    def build():
        cat = C.load()
        per = defaultdict(dict)

        def put(pid, r, main, role):
            w = 1.0 if main else cfg["minor_credit"]
            cur = per[pid].get(r)
            if cur is None or w > cur[0]:
                per[pid][r] = (w, role)
        for t in _gz_lines(cfg["credits_file"]):
            r = cat.row_of.get(t["id"])
            if r is None:
                continue
            show = t["media_type"] == "show"
            for i, d in enumerate(t["directors"]):
                put(d["id"], r, i == 0 if show else d.get("job") == "Director",
                    "director" if show or d.get("job") == "Director" else "co-director")
            for d in t["creators"]:
                put(d["id"], r, t["creator_source"] == "creator" or cfg["fallback_creator"] == "main", "creator")
            for i, d in enumerate(t["writers"]):
                put(d["id"], r, d.get("department") == "Writing" and (i == 0 or not show), "writer")
            for d in t["cast"]:
                put(d["id"], r, (d.get("order") or 0) <= cfg["lead_billing"] and d.get("department") in (None, "Acting"),
                    "cast")
        return per
    return cached(("credits", cfg["minor_credit"], cfg["lead_billing"], cfg["credits_file"], cfg["fallback_creator"]),
                  build)


def studios(cfg):
    """(kind, id) -> (name, {row: weight}): production companies (the first company_main listed are main) and
    networks."""
    def build():
        cat = C.load()
        names, rows = {}, defaultdict(dict)
        for t in _gz_lines("companies.jsonl.gz"):
            r = cat.row_of.get(t["id"])
            if r is None:
                continue
            for i, c in enumerate(t["companies"] or []):
                names[("c", c["id"])] = c["name"]
                w = 1.0 if i < cfg["company_main"] else cfg["minor_credit"]
                rows[("c", c["id"])][r] = max(rows[("c", c["id"])].get(r, 0), w)
            for c in t["networks"] or []:
                names[("n", c["id"])] = c["name"]
                rows[("n", c["id"])][r] = 1.0
        return {k: (names[k], dict(rows[k])) for k in names}
    return cached(("studios", cfg["minor_credit"], cfg["company_main"]), build)


def _entity_key(cfg):
    return (cfg["minor_credit"], cfg["lead_billing"], cfg["team_overlap"], cfg["company_main"], cfg["credits_file"],
            cfg["fallback_creator"])


@dataclass
class Candidate:
    kind: str                 # "person" | "studio"
    name: str
    ids: tuple                # person ids (a team has several), or studio keys
    mass: float               # votes of the main-credit titles


def name_index(cfg):
    """key -> [Candidate], heaviest first."""
    def build():
        votes = C.load().votes.astype(np.float64)
        P, cr = persons(), credits(cfg)

        def mass(rw):
            return float(sum(votes[r] for r, w in rw.items() if w >= 1))
        idx = defaultdict(list)
        for pid, v in P.items():
            c = Candidate("person", v["name"], (pid,), mass({r: w for r, (w, _) in cr.get(pid, {}).items()}))
            keys = set()
            for n in {v["name"], v.get("original_name") or ""}:
                if fold(n):
                    keys |= {fold(n), fold(n).split()[-1]}
            for k in keys:
                idx[k].append(c)
        brand = defaultdict(set)
        st = studios(cfg)
        for key, (n, _) in st.items():
            ws = fold(n).split()
            for a in {" ".join(ws), *ws[:1]} if ws else ():
                brand[a].add(key)
        for a, keys in brand.items():
            rw = {}
            for k in keys:
                for r, w in st[k][1].items():
                    rw[r] = max(rw.get(r, 0), w)
            name = st[max(keys, key=lambda k: len(st[k][1]))][0]
            idx[a].append(Candidate("studio", name, tuple(sorted(keys)), mass(rw)))
        for k, cs in idx.items():
            cs.sort(key=lambda c: -c.mass)
            # a team: people with the key who share most of their main credits with the heaviest one
            if len(cs) > 1 and cs[0].kind == cs[1].kind == "person":
                main = [{r for r, (w, _) in cr.get(c.ids[0], {}).items() if w >= 1} for c in cs[:2]]
                if main[1] and len(main[0] & main[1]) >= cfg["team_overlap"] * len(main[1]):
                    team = Candidate("person", f"{cs[0].name} & {cs[1].name}", cs[0].ids + cs[1].ids,
                                     cs[0].mass + cs[1].mass)
                    idx[k] = [team] + cs[2:]
        return dict(idx)
    return cached(("name_index", *_entity_key(cfg)), build)


def resolves(cs, word_df, cfg):
    """The heaviest candidate outweighs the next one name_dominance times and the key's reading as a word."""
    second = cs[1].mass if len(cs) > 1 else 0.0
    return cs[0].mass >= cfg["name_dominance"] * second and cs[0].mass >= cfg["name_votes"] * (1 + word_df)


def resolve_key(key, cfg):
    """The entity a key names, or None."""
    cs = name_index(cfg).get(key)
    return cs[0] if cs and resolves(cs, word_freq()[0].get(key, 0), cfg) else None


def fuzzy_keys(cfg):
    """Multi-word keys (full names) that resolve on their own, for typo matching."""
    def build():
        return [k for k, cs in name_index(cfg).items() if " " in k and resolves(cs, 0, cfg)]
    return cached(("fuzzy_keys", *_entity_key(cfg), cfg["name_votes"], cfg["name_dominance"]), build)


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
    qvec: object = None       # INTENT_EMB vector of the query with the names as "X" (None when only names)


def detect(query, cfg):
    """People and studios named in the query (longest n-grams first) and the intent; None when there is none."""
    toks = fold(query).split()
    # the words that make a key common are English: in other languages only multi-word names count ("Bud Spencer")
    foreign = looks_foreign(query)
    ents, used = [], set()

    def take(c, i, j):
        ents.append(Entity(c.kind, c.name, list(c.ids), (i, j)))
        used.update(range(i, j))

    for n in range(cfg["name_max_words"], 0, -1):
        for i in range(0, len(toks) - n + 1):
            j = i + n
            if any(k in used for k in range(i, j)) or (n == 1 and foreign):
                continue
            key = " ".join(toks[i:j])
            c = resolve_key(key, cfg)
            if c is None and n == 1 and cfg["style_suffix"]:
                m = _STYLE_SUFFIX.match(key)       # "kubrickesque", "lynchian"
                c = resolve_key(m.group(1), cfg) if m else None
            if c is not None:
                take(c, i, j)
    if not ents and not foreign:
        # a typo: an n-gram with a word that appears nowhere in the catalog, one edit from a full name
        vocab = word_freq()[0]
        for n in range(cfg["name_max_words"], 1, -1):
            for i in range(0, len(toks) - n + 1):
                j = i + n
                if ents or not any(vocab.get(w, 0) == 0 for w in toks[i:j]):
                    continue
                hit = process.extractOne(" ".join(toks[i:j]), fuzzy_keys(cfg), scorer=Levenshtein.distance,
                                         score_cutoff=1)
                if hit:
                    take(name_index(cfg)[hit[0]][0], i, j)
    if not ents:
        return None
    ents.sort(key=lambda e: e.span)
    rest = [w for k, w in enumerate(toks) if k not in used]
    era = next((_ERA_WORDS[w] for w in rest if w in _ERA_WORDS), None) if cfg["career_w"] else None
    qvec = None
    if not rest:
        intent = "filmography" if all(e.kind == "studio" for e in ents) else "both"
    elif cfg["intent_thread"]:
        intent = intent_pool(cfg["intent_thread"]).submit(nearest_intent, toks, ents)   # a Future until settle()
    else:
        intent, qvec = nearest_intent(toks, ents)
    return Detection(ents, intent, era, toks, qvec)


def intent_pool(n):
    """One worker thread per torch thread count (torch's thread count is per calling thread)."""
    def build():
        import torch
        return ThreadPoolExecutor(1, initializer=torch.set_num_threads, initargs=(n,))
    return cached(("intent_pool", n), build)


def settle(ref):
    """Wait for an intent still being encoded in the worker thread (intent_thread)."""
    if ref is not None and isinstance(ref.intent, Future):
        ref.intent, ref.det.qvec = ref.intent.result()
        ref.det.intent = ref.intent


def intent_vectors():
    def build():
        labels = [c for c, ex in INTENT_EXAMPLES.items() for _ in ex]
        vecs = np.stack([embed(INTENT_EMB, t) for ex in INTENT_EXAMPLES.values() for t in ex])
        return labels, vecs
    return cached("intent_vectors", build)


def nearest_intent(toks, ents):
    """(intent, query vector): the intent of the nearest example phrase to the query with every name replaced by "X"."""
    out = list(toks)
    for e in sorted(ents, key=lambda e: -e.span[0]):
        out[e.span[0]:e.span[1]] = ["X"]
    labels, vecs = intent_vectors()
    v = embed(INTENT_EMB, " ".join(out))
    return labels[int(np.argmax(vecs @ v))], v


_emb_path = os.path.join(C.ARENA, "results", "simplify", "combo", "intent-emb-cache.json")
_emb_cache = None


def embed(model, text):
    """qemb.embed for texts it has cached; new texts are encoded locally and kept in a local cache (the shared qemb
    files are not written). Evaluation plumbing: production encodes the intent text with the residual."""
    global _emb_cache
    if qemb.NO_CACHE:
        return qemb.embed(model, text)
    hf = C.EMBEDDINGS[model][1]
    if hf not in qemb._cache:
        p = qemb._path(hf)
        qemb._cache[hf] = json.load(open(p)) if os.path.exists(p) else {}
    if text in qemb._cache[hf]:
        return np.array(qemb._cache[hf][text], np.float32)
    if _emb_cache is None:
        _emb_cache = json.load(open(_emb_path)) if os.path.exists(_emb_path) else {}
    key = f"{model}\t{text}"
    if key not in _emb_cache:
        if hf not in qemb._models:
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            from sentence_transformers import SentenceTransformer
            qemb._models[hf] = SentenceTransformer(hf, device="cpu")
        v = qemb._models[hf].encode([C.EMBEDDINGS[model][2] + text], normalize_embeddings=True)[0]
        _emb_cache[key] = [round(float(x), 6) for x in v]
        os.makedirs(os.path.dirname(_emb_path), exist_ok=True)
        json.dump(_emb_cache, open(_emb_path, "w"))
    return np.array(_emb_cache[key], np.float32)


def title_weights(det, cfg):
    """row -> weight in (0, 1]: the mean over entities of each entity's credit weight (a title with both Bud Spencer
    and Terence Hill scores 1, one of them 0.5); a team or a brand: any member counts."""
    per = []
    for e in det.entities:
        w = {}
        for k in e.ids:
            rw = studios(cfg)[k][1] if e.kind == "studio" else {r: x for r, (x, _) in credits(cfg).get(k, {}).items()}
            for r, x in rw.items():
                w[r] = max(w.get(r, 0), x)
        per.append(w)
    rows = set().union(*[set(w) for w in per])
    return {r: sum(w.get(r, 0) for w in per) / len(per) for r in rows}


def main_rows(tw, k):
    """The top k eligible titles by votes among the main credits (all credits when there are none)."""
    el = C.load().eligible()
    rows = [r for r, w in tw.items() if w >= 1 and el[r]] or [r for r in tw if el[r]]
    rows.sort(key=lambda r: -C.load().votes[r])
    return rows[:k]


# === ranking ==========================================================================================================

def rank_query(ctx, cfg, non_en, ref):
    """[(point id, score)] for every query: dense + Jev fingerprint + BM25 of the (residual) query, facets, facet
    coverage, negation, votes and GoodWatch score; with a reference also its profile and the title-weight boost."""
    cat = C.load()
    emb_main = "me5s" if non_en else cfg["emb"]
    positive, negated = split_negation(ctx.text if non_en else spell(ctx.text))
    dense_text = positive
    if ref is not None:
        positive, negated = ref.text, ref.negated
        # a title is known to the embedding model: the dense signal embeds the whole query ("like groundhog day")
        dense_text = dense_text if ref.kind == "title" else positive
    mask = era_filter(ctx.text, ctx.mask)
    rows = np.flatnonzero(mask)
    km, kp, sec = cfg["k_main"], cfg["k_part"], cfg["secondary"]

    ws_all = weighted_sum(ctx)
    parts = [top(rows, ws_all[rows], km)[0]]
    e_all, extra_neg = None, []
    ent_dense = cfg["entity_dense"] if ref is not None and ref.kind == "entity" else "residual"
    if ent_dense == "reuse":
        ent_dense = "intent" if emb_main == INTENT_EMB else "residual"
    if ent_dense == "intent":
        settle(ref)
    if dense_text and ent_dense == "intent" and ref.det.qvec is not None:
        # one encode per person / studio query: the intent vector is the dense query
        e_all = C.embeddings(INTENT_EMB) @ ref.det.qvec
    elif dense_text and ent_dense == "residual":
        e_all = sims(emb_main, dense_text)
    if e_all is not None:
        if non_en:
            en_pos, en_neg = english_from_chips(ctx)
            if en_pos:
                e_all = mix_z(e_all, sims(cfg["emb"], en_pos), rows, cfg["nonen_mix"])
                extra_neg = [sims(cfg["emb"], n) for n in en_neg]
        parts.append(top(rows, e_all[rows], km)[0])

    s_all = None
    if not non_en and positive:
        s_all, hits = sparse_top(positive, cfg["body"], mask, rows, kp)
        parts.append(hits)

    # facets: Jev's searched phrases without negated or reference words
    f_alls = []
    if positive:
        for f in facets(ctx, negated, ref.words if ref is not None else set(), cfg):
            f_alls.append(sims(emb_main, f))
            parts.append(top(rows, f_alls[-1][rows], kp)[0])

    # facet coverage: titles that match only the dominant facet drop
    units = []
    if ref is None and len(S.tokens(positive)) <= cfg["cov_max_tokens"]:
        units = facet_units(ctx, negated, cfg)
        concrete = concrete_words(ctx)
        if not any(set(u.split()) & concrete for u in units):
            units = []
    u_d, u_s = [], []
    for u in units:
        u_d.append(sims(emb_main, u))
        parts.append(top(rows, u_d[-1][rows], kp)[0])
        s, hits = sparse_top(u, cfg["body"], mask, rows, kp)
        u_s.append(s)
        parts.append(hits)

    # the reference: its titles and its profile's top lists join the pool
    profile, w_all = [], np.zeros(len(cat.ids))
    if ref is not None:
        for r, w in ref.weights.items():
            w_all[r] = w
        parts.append(np.array([r for r in ref.weights if mask[r]], dtype=np.int64))
        profile = reference_profile(ref, cfg, cat)
        for w, sc, kind in profile:
            if kind == "peer":
                parts.append(rows[sc[rows] > 0])
            else:
                tt, tv = top(rows, sc[rows], km if kind == "centroid" else kp)
                parts.append(tt[tv > 0])
    settle(ref)

    absent = np.zeros(len(cat.ids), bool)
    if negated and cfg["trope_abs"]:
        for n in negated:
            absent |= trope_negation(n)[1]
        parts.append(np.flatnonzero(absent & mask))
    cand = np.unique(np.concatenate(parts))
    wt = (lambda name: sec[name]) if isinstance(sec, dict) else (lambda name: sec)
    score = cfg["b"] * z(ws_all[cand])
    if e_all is not None:
        score += cfg["a"] * z(e_all[cand])
    if s_all is not None and s_all[cand].any():
        score += wt("bm25") * z(s_all[cand])
    if f_alls:
        score += wt("facet") * np.mean([z(fa[cand]) for fa in f_alls], axis=0)
    if units:
        score += wt("cov") * z(np.min([z(d[cand]) + cfg["cov_beta"] * z(s[cand]) for d, s in zip(u_d, u_s)], axis=0))
    pens = [sims(emb_main, n)[cand] for n in negated] + [x[cand] for x in extra_neg]
    if pens:
        score -= wt("neg") * z(np.max(pens, axis=0))
    if negated and cfg["neg_lex"]:
        # lexical evidence: titles labelled with the negated thing drop like a soft filter
        score -= cfg["neg_lex"] * np.max([label_negation(n, cfg["neg_tropes"])[cand] for n in negated], axis=0)
    if cfg["trope_abs"]:
        score += cfg["trope_abs"] * absent[cand]
    lv = np.log1p(cat.votes[cand]).astype(np.float64)
    score += wt("gw") * z(filled(cat.goodwatch_score[cand]))
    if ref is None:
        score += wt("votes") * z(lv)
    else:
        own = w_all[cand] >= 1
        strength = cfg["weak"] if ref.intent in ("like", "filmography") else 1.0
        zs = []
        for w, sc, kind in profile:
            zc = z(np.log1p(sc[cand])) if kind == "mention" else sc[cand] if kind == "peer" else z(sc[cand])
            score += strength * w * zc
            if kind in ("centroid", "terms"):
                zs.append(zc)
        if cfg["w_agree"]:
            score += strength * cfg["w_agree"] * np.min(zs, axis=0)
        score += (cfg["lead_boost"] if ref.intent == "filmography" else cfg["own_boost"]) * w_all[cand]
        if ref.intent in ("style", "both"):
            score -= cfg["damp"] * z(lv) * (~own)
        else:
            score += wt("votes") * z(lv)
        if ref.era:
            # "early" / "late" career: older / newer titles first
            score += cfg["career_w"] * z(filled(cat.year[cand])) * (1 if ref.era == "late" else -1)
    r, s = top(cand, score, TOP)
    return as_list(r, s)


# === reference profile ================================================================================================

def reference_profile(ref, cfg, cat):
    """Per-row profile signals of the reference: [(weight, scores, kind)] from its seed titles."""
    Eb = C.embeddings(cfg["emb"])
    fpc = centroid(cat.fp, ref.seeds, cat)
    sig = [(cfg["w_fp"], cat.fp @ fpc, "centroid"), (cfg["w_emb"], Eb @ centroid(Eb, ref.seeds, cat), "centroid"),
           (cfg["w_terms"], term_scores(ref.seeds, cfg), "terms")]
    if cfg["w_mention"] and ref.det is not None:
        sig.append((cfg["w_mention"], mention_scores(ref.det, cfg), "mention"))
    if cfg["w_peer"] and ref.det is not None:
        sig.append((cfg["w_peer"], peer_scores(ref.det, fpc, cfg), "peer"))
    return sig


def centroid(M, rows, cat):
    """L2-normalized centroid of M's rows, weighted by log votes."""
    rows = np.asarray(rows, np.int64)
    w = np.log1p(cat.votes[rows]).astype(np.float64)
    c = (M[rows] * (w / (w.sum() or 1))[:, None]).sum(0)
    return (c / (np.linalg.norm(c) or 1)).astype(np.float32)


def term_scores(seeds, cfg):
    """BM25 body scores of the seeds' term profile: stemmed terms that at least min(terms_min_df, seeds) of them share,
    weight = share of seeds x IDF, the top terms_n."""
    cat = C.load()
    rows_idx, _, X, idf = S.index(cfg["body"])

    def build():
        return {int(r): i for i, r in enumerate(rows_idx)}, X.tocsr()
    pos, Xr = cached(("body_rows", str(cfg["body"])), build)
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


def mention_scores(det, cfg):
    """BM25 body scores of the entity's names in other titles' texts (a person's last name too when it names them)."""
    names = []
    for e in det.entities:
        if e.kind == "studio":
            names.append(fold(e.name))
            continue
        for pid in e.ids:
            full = fold(persons()[pid]["name"])
            names.append(full)
            c = resolve_key(full.split()[-1], cfg) if " " in full else None
            if c is not None and pid in c.ids:
                names.append(full.split()[-1])
    return S.scores(" ".join(names), cfg["body"]).astype(np.float64)


def peer_index(cfg):
    """Fingerprint centroids of every director / creator with >= 3 eligible main-crew titles and >= 200k votes, and of
    every studio with >= 8 main titles and >= 200k votes: {ids, F, rows (by votes), kind}."""
    def build():
        cat = C.load()
        el = cat.eligible()
        groups = [(("p", pid), [r for r, (w, role) in d.items() if w >= 1 and role in ("director", "creator") and el[r]], 3)
                  for pid, d in credits(cfg).items()]
        groups += [(("s", key), [r for r, w in rw.items() if w >= 1 and el[r]], 8) for key, (_, rw) in studios(cfg).items()]
        ids, Fs, rows_l = [], [], []
        for key, rs, n in groups:
            if len(rs) < n or cat.votes[rs].sum() < 200_000:
                continue
            ids.append(key)
            Fs.append(centroid(cat.fp, rs, cat))
            rows_l.append(sorted(rs, key=lambda r: -cat.votes[r]))
        return dict(ids=ids, F=np.stack(Fs), rows=rows_l, kind=np.array([i[0] for i in ids]))
    return cached(("peer_index", *_entity_key(cfg)), build)


def peer_scores(det, fpc, cfg):
    """Per row: the similarity (z over people or studios, clipped at 0) of the nearest peer_k peers whose top
    peer_titles titles it is among."""
    pi = peer_index(cfg)
    kind = "s" if all(e.kind == "studio" for e in det.entities) else "p"
    mine = {("s" if e.kind == "studio" else "p", k) for e in det.entities for k in e.ids}
    sel = np.flatnonzero(pi["kind"] == kind)
    sim = z(pi["F"][sel] @ fpc)
    out = np.zeros(len(C.load().ids))
    n = 0
    for i in np.argsort(-sim):
        if pi["ids"][sel[i]] in mine:
            continue
        for r in pi["rows"][sel[i]][: cfg["peer_titles"]]:
            out[r] = max(out[r], float(max(sim[i], 0)))
        n += 1
        if n >= cfg["peer_k"]:
            break
    return out


# === own titles =======================================================================================================

def bound_own(blended, ref, cfg, n=10):
    """The top n holds bounds[intent] = (lo, hi) own titles; a title reference's own titles stay out of the first
    like_first ranks, and out of the top n when the query modifies the title ("like X but Y"). Extra own titles move
    below n; missing ones (from the rest of the list) are pulled up into every second rank."""
    lo, hi = cfg["bounds"][ref.intent]
    if ref.kind == "title" and ref.text:
        hi = 0
    first = cfg["like_first"] if ref.kind == "title" else 0
    is_own = [x["id"] in ref.own for x in blended]
    own_i = [i for i, o in enumerate(is_own) if o]
    other_i = [i for i, o in enumerate(is_own) if not o]
    k = min(max(sum(1 for i in own_i if i < n), lo), hi, len(own_i))
    keep_own = own_i[:k]
    base = sorted([i for i in keep_own if i < n] + other_i[: n - k])
    head = [i for i in base if not is_own[i]][:first]
    base = head + [i for i in base if i not in head]
    for i in (i for i in keep_own if i >= n):
        slot = next((s for s in range(first, n, 2) if s <= len(base) and not (s < len(base) and is_own[base[s]])),
                    len(base))
        base.insert(slot, i)
    ts = set(base[:n])
    return [blended[i] for i in base[:n]] + [x for i, x in enumerate(blended) if i not in ts]


# === alternate cuts ===================================================================================================

_CUT = re.compile(
    r"(?:\s*[:\-–(]\s*|\s+)(?:the\s+)?(?:redux|extended(?:\s+(?:edition|cut|version))?|director'?s\s+cut|final\s+cut|"
    r"special\s+edition|uncut|whole\s+bloody\s+affair|ultimate\s+(?:cut|edition)|unrated(?:\s+(?:cut|edition|version))?|"
    r"theatrical\s+cut|encore\s+cut|re-?edit|recut|[a-z]+\s+[a-z]+'?s\s+cut|remastered|deluxe\s+edition|"
    r"memorial\s+edition)\s*\)?\s*$", re.IGNORECASE)


def cut_edges():
    """point id -> ids of its alternate cuts. Titles are grouped by their normalized title with a cut suffix stripped
    ("Apocalypse Now Redux", "The Hateful Eight - Extended Version"). Two titles of a group are cuts when they share a
    director or one has no director credits, and either one carried a cut suffix or their years differ by at most 1
    (duplicate records of one release)."""
    def build():
        cat = C.load()
        dirs = cuts._directors()
        groups = defaultdict(list)
        for r in np.flatnonzero(cat.eligible()):
            t = cat.title[r] or ""
            m = _CUT.search(t)
            cut = bool(m and m.start())
            groups[normalized(t[: m.start()] if cut else t)].append((int(cat.ids[r]), int(cat.year[r]), cut))
        out = defaultdict(set)
        for ps in groups.values():
            for i, (p, yp, cp) in enumerate(ps):
                for q, yq, cq in ps[i + 1:]:
                    a, b = dirs.get(p, (set(), []))[0], dirs.get(q, (set(), []))[0]
                    if (a & b or bool(a) != bool(b)) and (cp or cq or (yp and yq and abs(yp - yq) <= 1)):
                        out[p].add(q)
                        out[q].add(p)
        return dict(out)
    return cached("cut_edges", build)


def fold_cuts(ids):
    """Keep the first title of every set of alternate cuts (ids in rank order)."""
    e = cut_edges()
    kept, out = set(), []
    for pid in ids:
        if e.get(pid, set()) & kept:
            continue
        kept.add(pid)
        out.append(pid)
    return out


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


def eligible_titles():
    def build():
        cat = C.load()
        names, owners = [], []
        for r in np.flatnonzero(cat.eligible()):
            for t in {cat.title[r], cat.original_title[r]}:
                n = normalized(t)
                if n:
                    names.append(n)
                    owners.append(r)
        return names, np.array(owners)
    return cached("eligible_titles", build)


def fuzzy_title(query, mask, cutoff):
    """A query with a word unknown to the catalog: the single most similar eligible title (>= cutoff), unless it is an
    exact title (the TMDB lookup handles those)."""
    q = normalized(query)
    if not q or all(w in word_freq()[0] for w in q.split()):
        return None
    names, owners = eligible_titles()
    hit = process.extractOne(q, names, scorer=fuzz.ratio, score_cutoff=cutoff * 100)
    if hit is None or hit[1] >= 100 or not mask[owners[hit[2]]]:
        return None
    return int(owners[hit[2]])


def blend(ctx, disc, cfg):
    """Production's title-lookup blend over the discovery list, with strict title matching, the title-word bonus,
    fuzzy titles and the imdb dedup: [{id, title, year, media_type, score}]."""
    cat = C.load()
    query = ctx.query
    concrete = concrete_words(ctx)
    q = normalized(query)

    def lexical(title, original):
        lex, src = title_match(title, query), title
        o_lex = title_match(original or "", query)
        if o_lex > lex:
            lex, src = o_lex, original
        if lex and lex < 2 and max(fuzz.ratio(normalized(t), q) for t in (title, original or "")) / 100 < cfg["strict"]:
            # a partial match that is not close to the whole title: kept (capped) only when it has every concrete word
            if cfg["kind"] and concrete and concrete <= set(words(query)) & set(words(src)):
                return min(lex, cfg["cap"])
            return 0.0
        return lex

    rows = {}
    for t in ctx.title_lookup:
        if t.get("type") not in ("movie", "tv"):
            continue
        pid = C.point_id(t["type"], t["id"])
        rows[pid] = dict(id=pid, title=t["title"], media_type="show" if t["type"] == "tv" else "movie",
                         year=str(t.get("year") or ""), popularity=float(t.get("popularity") or 0),
                         lexical=lexical(t["title"], t.get("original")), rank=None)
    r = fuzzy_title(query, ctx.mask, cfg["strict"])
    if r is not None:
        pid = int(cat.ids[r])
        if pid not in rows or rows[pid]["lexical"] < 1.05:
            rows[pid] = dict(id=pid, title=cat.title[r], media_type=cat.media_type(r), year=str(cat.year[r] or ""),
                             popularity=float(cat.popularity[r]), lexical=1.05, rank=None)
    for rank_, (pid, _) in enumerate(disc, 1):
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
    ordered = sorted(rows.values(), key=lambda r: (-r["score"], -r["popularity"], key(r)))[:100]
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

