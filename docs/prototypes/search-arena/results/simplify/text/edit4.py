p='harness/simp_text.py'
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:70])
    s=s.replace(a,b)
rep('''    units = []
    for p in ctx.reading.get("phrases") or []:
        if p["probability"] < min_p:
            continue
        ws = [correct_word(w, cfg["spell_mode"]) for w in words(p["phrase"])]''','''    units = []
    if cfg["facet_source"] == "searched":
        phrases, max_n = ctx.reading.get("searchedPhrases") or [], cfg["cover_max"] or 99
    else:
        phrases = [p for p in ctx.reading.get("phrases") or [] if p["probability"] >= min_p]
    for p in phrases:
        ws = [correct_word(w, cfg["spell_mode"]) for w in words(p["phrase"])]''')
i=s.index('EXPLORE3 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''EXPLORE4 = {
    "text-w-searched": variant(facet_source="searched"),
    "text-w-searched-k-mean": variant(facet_source="searched", facet_k=None, facet_min=0.0),
    "text-w-searched-k-mean-nocol": variant(facet_source="searched", facet_k=None, facet_min=0.0,
                                            collocations=False),
    "text-w-searched-k-mean-nogate": variant(facet_source="searched", facet_k=None, facet_min=0.0,
                                             cov_max_tokens=None),
}
'''+s[j:]
open(p,'w').write(s)
