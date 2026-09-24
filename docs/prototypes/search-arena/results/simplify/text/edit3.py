p='harness/simp_text.py'
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:70])
    s=s.replace(a,b)
rep('''    phrases = []
    for p in ctx.reading.get("phrases") or []:
        if p["probability"] >= min_p and p["phrase"] not in phrases:
            phrases.append(p["phrase"])
    out = [f for f in phrases if not (content_words(f) & banned)][:max_n]''','''    phrases = []
    if cfg["facet_source"] == "searched":
        phrases = [p["phrase"] for p in ctx.reading.get("searchedPhrases") or []]
        max_n = None
    for p in ctx.reading.get("phrases") or [] if cfg["facet_source"] == "r6" else []:
        if p["probability"] >= min_p and p["phrase"] not in phrases:
            phrases.append(p["phrase"])
    out = [f for f in phrases if not (content_words(f) & banned)][:max_n]''')
rep('''            for f in fcs:
                fa = E @ qemb.embed(emb_main, f)
                f_alls.append(fa)
                parts.append(top(rows, fa[rows], 200)[0])

    # facet coverage''','''            for f in fcs:
                fa = E @ qemb.embed(emb_main, f)
                f_alls.append(fa)
                parts.append(top(rows, fa[rows], cfg["facet_k"] or cfg["cov_k"])[0])

    # facet coverage''')
rep('''        score += cfg["facet"] * (0.5 * fz.mean(0) + 0.5 * fz.min(0))
    if units:
        cov = np.stack([z(d[cand]) + cfg["cov_beta"] * z(s[cand]) for d, s in zip(u_d, u_s)]).min(0)
        score += cfg["cov"] * z(cov)''','''        score += cfg["facet"] * ((1 - cfg["facet_min"]) * fz.mean(0) + cfg["facet_min"] * fz.min(0))
    if units:
        uz = np.stack([z(d[cand]) + cfg["cov_beta"] * z(s[cand]) for d, s in zip(u_d, u_s)])
        score += cfg["cov"] * z((1 - cfg["cover_mean"]) * uz.min(0) + cfg["cover_mean"] * uz.mean(0))''')
rep('''    cover_min=2,              # coverage needs at least this many units
''','''    cover_min=2,              # coverage needs at least this many units
    cover_mean=0.0,           # coverage = z((1 - cover_mean) min + cover_mean mean) over units
    facet_source="r6",        # "r6": Jev phrases p >= 0.1, at most 4 | "searched": Jev's searched phrases
    facet_k=200,              # candidates per facet (None: cov_k)
    facet_min=0.5,            # facet term = (1 - facet_min) mean + facet_min min of z
''')
rep('''        elif cfg["cover"] == "words":
            for p in ctx.reading.get("searchedPhrases") or []:''','''        if cfg["cover"] in ("words", "merged"):
            if cfg["cover"] == "merged":
                units = [p["phrase"] for p in ctx.reading.get("searchedPhrases") or []
                         if " " in p["phrase"] and not (set(words(p["phrase"])) & banned)]
            for p in ctx.reading.get("searchedPhrases") or []:''')
rep('''        else:
            for w in (ctx.reading.get("concreteWords") or []):''','''        elif cfg["cover"] == "concrete":
            for w in (ctx.reading.get("concreteWords") or []):''')
rep('''    if cfg["cover"] in ("r6", "words") and cfg["cov_concrete"] and''','''    if cfg["cover"] in ("r6", "words", "merged") and cfg["cov_concrete"] and''')
i=s.index('EXPLORE2 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''EXPLORE3 = {
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
'''+s[j:]
open(p,'w').write(s)
