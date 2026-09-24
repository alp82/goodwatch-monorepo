p='harness/simp_text.py'
s=open(p).read()
i=s.index('def cover_units(ctx, negated, cfg):')
a=s[i:s.index('# --- "like X" reference titles', i)]
b=open('results/simplify/text/cover_units.txt').read()
s=s.replace(a,b)
s=s.replace('''    cover_min=2,              # coverage needs at least this many units
''','''    cover_min=2,              # coverage needs at least this many units
    cover_max=None,           # ... and at most this many (None: no cap; "r6" has its own cap of 4)
''')
i=s.index('EXPLORE = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''EXPLORE2 = {
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
'''+s[j:]
open(p,'w').write(s)
