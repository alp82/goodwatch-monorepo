p='harness/simp_text.py'
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:70])
    s=s.replace(a,b)
rep('''    if cfg["cover"] == "r6":
        units = facet_units(ctx, negated, cfg)
    else:''','''    if cfg["cover"] in ("r6", "merged2"):
        units = facet_units(ctx, negated, cfg)
        if cfg["cover"] == "merged2":   # Jev's multi-word phrases join as units of their own
            banned = {w for n in negated for w in words(n)}
            units += [p["phrase"] for p in ctx.reading.get("searchedPhrases") or [] if " " in p["phrase"]
                      and p["phrase"] not in units and not (set(words(p["phrase"])) & banned)]
    else:''')
rep('''    if cfg["cover"] in ("r6", "words", "merged") and cfg["cov_concrete"] and''','''    if cfg["cover"] in ("r6", "words", "merged", "merged2") and cfg["cov_concrete"] and''')
i=s.index('EXPLORE6 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''CONS = dict(EXPLORE5["text-v-cons"][0])
EXPLORE7 = {
    "text-t-nofacet": Variant({**CONS, "facet": 0}),
    "text-t-merged2": Variant({**CONS, "facet": 0, "cover": "merged2", "cover_mean": 0.5}),
    "text-t-merged2-min": Variant({**CONS, "facet": 0, "cover": "merged2"}),
    "text-t-merged2-nogate": Variant({**CONS, "facet": 0, "cover": "merged2", "cover_mean": 0.5,
                                      "cov_max_tokens": None}),
}
'''+s[j:]
open(p,'w').write(s)
