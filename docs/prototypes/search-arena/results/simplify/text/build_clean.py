"""Builds harness/simp_text.py from harness/simp.py: the text-area simplifications only, no switches back to r6."""
src = 'harness/simp.py'
dst = 'harness/simp_text.py'
s = open(src).read()


def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:90])
    s = s.replace(a, b)


def region(start, end, new):
    """Replace s[start_anchor : end_anchor) (end anchor searched after start)."""
    global s
    i = s.index(start)
    j = s.index(end, i)
    s = s[:i] + new + s[j:]


rep('''"""The baseline search ranking in one flat module: `rank(ctx) -> list`.

Same rankings as the round-6 baseline''', '''"""The flat search ranking (simp.py) with simpler general text rules: `rank(ctx) -> list`.

Text-area changes against simp.py (results/simplify/text/REPORT.md):
- spell: one edit (a transposition counts one) to a frequent vocabulary word; no long-word distance 2 or candidate
  limit; the shared word tokenizer.
- negation: one marker word list and one clause-end word list over whitespace tokens, no regexes. "than" and
  "less" / "fewer" are markers too, on every path, with the one negation weight.
- era: one regex for a decade or a year; a hard filter only (no recent / old prior, no minimum-rows rule).
- facets and coverage both read Jev's searched phrases (no probability floor, no caps); the facet term is the mean of
  z (no min), its candidates use cov_k; no facets on the filmography path.
- non-English: coverage and reference detection are no longer skipped (no effect); chip prefixes without regexes.

What follows is simp.py's description of the flat baseline; it still holds outside the text rules.

Same rankings as the round-6 baseline''')
rep('''Evaluation: `harness/evalsimp.py score simp:FINAL` (every entry of FINAL is callable as rank(ctx)).
Complexity: `harness/complexity.py --module simp --name simp --defaults simp.DEFAULTS` (entries unpack as (cfg, {})).''',
    '''Evaluation: `harness/evalsimp.py score simp_text:FINAL` (every entry of FINAL is callable as rank(ctx)).
Complexity: `harness/complexity.py --module simp_text --name text-cons --defaults simp_text.DEFAULTS`.''')
rep('from rapidfuzz.distance import Levenshtein', 'from rapidfuzz.distance import OSA')

# --- DEFAULTS
rep('''    native_routing=True,      # non-English queries: me5s, no BM25 / spell / reference / coverage, multi-word names only''',
    '''    native_routing=True,      # non-English queries: me5s, no BM25 / spell, multi-word names only''')
rep('''    # --- negation, era, facets, coverage -------------------------------------------------------------------------------
    neg=0.1,                  # negated clauses: - neg * z(max cosine)
    less=True,                # entity queries: "less / fewer X" joins the negated clauses
    less_neg=0.3,             # negation weight when a "less X" clause exists
    era=True,                 # a decade or year filters the candidates; "recent" / "old" add a prior
    era_w=0.3,                # weight of the recent / old prior
    facet=0.1,                # Jev phrase facets: facet * (0.5 mean + 0.5 min of z)
''', '''    # --- negation, era, facets, coverage -------------------------------------------------------------------------------
    neg=0.1,                  # negated clauses: - neg * z(max cosine)
    era=True,                 # a decade or year in the query filters the candidates
    facet=0.1,                # facets (Jev's searched phrases): facet * mean of z(cosine)
    facet_min_n=1,            # facets need at least this many phrases
''')
rep('''    cov_k=300,                # candidates per unit
''', '''    cov_k=300,                # candidates per unit and per facet
''')
rep('''    ent_facet=True,           # facets on the filmography path
''', '')

# --- FINAL
rep('''FINAL = {"simp": Variant(DEFAULTS)}''', '''FINAL = {
    "text-safe": variant(facet_min_n=2),              # facets only with 2+ phrases, as before
    "text-cons": variant(),                           # facets from one phrase on
    "text-agg": variant(collocations=False),          # coverage units are single words
}''')

# --- spell
region('def correct_word(w):', '# --- language', '''def correct_word(w):
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


''')
# region() found '# --- language' in DEFAULTS? check it is after correct_word: index search starts at start anchor.

# --- chips
rep('''        elif k == "avoid":
            neg.append(re.sub(r"^Low\\s+", "", t))
        elif k == "excluded":
            neg.append(re.sub(r"^Not\\s+", "", t))''', '''        elif k in ("avoid", "excluded"):
            neg.append(t.removeprefix("Low ").removeprefix("Not "))''')

# --- negation
region('# Markers that open a negated clause', '# --- era', '''# A marker word opens a negated clause; the clause runs to a clause-end word or a token ending in , . ; ! ?
# ("than": "more getaway driver than superheroes"; "less": "like david lynch but less weird").
NEG_WORDS = set("no not without except minus nothing than less fewer isn't aren't don't doesn't "
                "ohne nicht kein keine keinen keiner sans pas ni sin".split())
CLAUSE_END = set("but and aber und mais et pero y".split())


def split_negation(text):
    """(positive text, [negated clauses]) over whitespace tokens. No markers: (text, [])."""
    pos, negs, cur = [], [], None
    for tok in text.replace("’", "'").split():
        w = tok.strip(",.;:!?-()\\"").lower()
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


''')

# --- era
region('_DECADE = re.compile(', '# --- facets', '''# A decade ("80s", "1980s", "'80s", "80er", "2000s") or a year ("1994").
_ERA = re.compile(r"(?<!\\w)(?:(19|20)?(\\d)0(?:'?s|’s|er)|(19\\d\\d|20\\d\\d))(?!\\w)", re.IGNORECASE)


def era_filter(ctx, cfg, mask):
    """A decade or a year in the query keeps only the titles inside it (unless none would remain)."""
    m = _ERA.search(ctx.text) if cfg["era"] else None
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


''')

# --- facets and units
region('def facets(ctx, min_p=0.1, max_n=4):', '_GENERIC = set(', '''def searched_phrases(ctx):
    return [p["phrase"] for p in ctx.reading.get("searchedPhrases") or []]


def facets(ctx, negated, cfg):
    """Jev's searched phrases without negated words; [] when fewer than facet_min_n."""
    banned = {w for n in negated for w in words(n)}
    out = [f for f in searched_phrases(ctx) if not (set(words(f)) & banned)]
    return out if len(out) >= cfg["facet_min_n"] else []


''')
rep('''def facet_units(ctx, negated, cfg, min_p=0.1, max_n=4):
    """Content units of Jev's phrases (collocations merged), deduplicated, not negated; 2 to max_n or []."""
    banned = set()
    for n in negated:
        banned |= set(words(n))
    units = []
    for p in ctx.reading.get("phrases") or []:
        if p["probability"] < min_p:
            continue
        ws = [correct_word(w) for w in words(p["phrase"])]''', '''def facet_units(ctx, negated, cfg):
    """Content units of Jev's searched phrases (collocations merged), deduplicated, not negated; [] below 2."""
    banned = {w for n in negated for w in words(n)}
    units = []
    for p in searched_phrases(ctx):
        ws = [correct_word(w) for w in words(p)]''')
rep('''    return units[:max_n] if 2 <= len(units) <= max_n else []''', '''    return units if len(units) >= 2 else []''')

# --- rank_general
rep('''    positive, negated = split_negation(text) if cfg["neg"] else (text, [])
    mask, era = era_filter(ctx, cfg, ctx.mask)

    ref = find_reference(ctx.text, cfg["ref_votes"]) if cfg["ref"] and not non_en else None''', '''    positive, negated = split_negation(text) if cfg["neg"] else (text, [])
    mask = era_filter(ctx, cfg, ctx.mask)

    ref = find_reference(ctx.text, cfg["ref_votes"]) if cfg["ref"] else None''')
rep('''            f_alls = [r_all, ma]
            parts.append(top(rows, ma[rows], 200)[0])
        else:
            fcs = facets(ctx)''', '''            f_alls = [r_all, ma]
            parts.append(top(rows, ma[rows], cfg["cov_k"])[0])
        else:
            fcs = facets(ctx, negated, cfg)''')
rep('''                fcs = fcs if len(fcs) >= 2 else []
            for f in fcs:
                fa = E @ qemb.embed(emb_main, f)
                f_alls.append(fa)
                parts.append(top(rows, fa[rows], 200)[0])''', '''                fcs = fcs if len(fcs) >= cfg["facet_min_n"] else []
            for f in fcs:
                fa = E @ qemb.embed(emb_main, f)
                f_alls.append(fa)
                parts.append(top(rows, fa[rows], cfg["cov_k"])[0])''')
rep('''    if cfg["cov"] and not non_en and not ref and len(S.tokens(positive)) <= cfg["cov_max_tokens"]:''',
    '''    if cfg["cov"] and not ref and len(S.tokens(positive)) <= cfg["cov_max_tokens"]:''')
rep('''    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score += cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))''', '''    if f_alls:
        score += cfg["facet"] * np.mean([z(fa[cand]) for fa in f_alls], axis=0)''')
rep('''        score = score + p * z(lv) + q * z(gw)
    score = era_prior(score, era, cand, cfg)
    r, s = top(cand, score, LIMIT)''', '''        score = score + p * z(lv) + q * z(gw)
    r, s = top(cand, score, LIMIT)''')

# --- entity paths
rep('''def entity_query(ctx, det, cfg, non_en):
    """(residual query text, negated clauses, "less X" clauses) of an entity query."""''', '''def entity_query(ctx, det, cfg, non_en):
    """(residual query text, negated clauses) of an entity query."""''')
rep('''    less = [m.group(1) for m in _LESS.finditer(text)] if cfg["less"] else []
    if cfg["less"]:
        text = _LESS.sub(" ", text)
''', '')
rep('''    return (q_text if cfg["entity_residual"] else ""), negated + less, less


def negation_weight(cfg, less):
    return max(cfg["neg"], cfg["less_neg"] if less else 0)
''', '''    return (q_text if cfg["entity_residual"] else ""), negated
''')
rep('''    q_text, negated, less = entity_query(ctx, det, cfg, non_en)
    mask, era = era_filter(ctx, cfg, ctx.mask)''', '''    q_text, negated = entity_query(ctx, det, cfg, non_en)
    mask = era_filter(ctx, cfg, ctx.mask)''')
region('    # facets: Jev phrases without entity words\n', '    cand = np.unique(np.concatenate(parts))\n    mix = cfg["mix_fil"]', '')
rep('''    if f_alls:
        fz = np.stack([z(fa[cand]) for fa in f_alls])
        score = score + cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    if negated and cfg["neg"]:
        pens = [Em @ qemb.embed(emb_main, n) for n in negated]
        score = score - negation_weight(cfg, less) * z(''', '''    if negated and cfg["neg"]:
        pens = [Em @ qemb.embed(emb_main, n) for n in negated]
        score = score - cfg["neg"] * z(''')
rep('''        score = score + (p * z(lv) + q * z(gw))
    score = era_prior(score, era, cand, cfg)
''', '''        score = score + (p * z(lv) + q * z(gw))
''')
rep('''    q_text, negated, less = entity_query(ctx, det, cfg, non_en)

    tw = title_weights(det, cfg)''', '''    q_text, negated = entity_query(ctx, det, cfg, non_en)

    tw = title_weights(det, cfg)''')
rep('''        terms.append(-negation_weight(cfg, less) * z(''', '''        terms.append(-cfg["neg"] * z(''')
open(dst, 'w').write(s)
print("ok")
