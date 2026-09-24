p='harness/simp_text.py'
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:70])
    s=s.replace(a,b)
rep('''    return out if len(out) >= 2 else []''','''    return out if len(out) >= cfg["facet_min_n"] else []''')
rep('''        ws = [w for w in ws if w not in S.STOP and w not in _GENERIC and w not in banned and len(w) > 1 and not w[0].isdigit()]''','''        ws = [w for w in ws if w not in S.STOP and (w not in _GENERIC or not cfg["generic"]) and w not in banned
              and len(w) > 1 and not w[0].isdigit()]''')
rep('''    facet_min=0.5,            # facet term = (1 - facet_min) mean + facet_min min of z
''','''    facet_min=0.5,            # facet term = (1 - facet_min) mean + facet_min min of z
    facet_min_n=2,            # facets need at least this many phrases
    generic=True,             # coverage units skip a hand list of generic words
''')
rep('''    return units[:max_n] if 2 <= len(units) <= max_n else []''','''    return units[:max_n] if cfg["cover_min"] <= len(units) <= max_n else []''')
i=s.index('EXPLORE8 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''CONS2 = {**CONS, "less": "global"}
EXPLORE9 = {
    "text-r-nogeneric": Variant({**CONS2, "generic": False}),
    "text-r-facet1": Variant({**CONS2, "facet_min_n": 1}),
    "text-r-cover1": Variant({**CONS2, "cover_min": 1}),
}
'''+s[j:]
open(p,'w').write(s)
