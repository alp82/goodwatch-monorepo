p='harness/simp_text.py'
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:70])
    s=s.replace(a,b)
rep('''            if cfg["avoid_chips"] and cfg["avoid_neg"] == "nonen":
                extra_neg = [Eb @ qemb.embed(cfg["emb"], n) for n in en_neg]''','''            if cfg["avoid_chips"] and cfg["avoid_neg"] == "nonen":
                extra_neg = [Eb @ qemb.embed(cfg["emb"], n) for n in en_neg]
            elif cfg["avoid_neg"] == "nonen-avoid":
                extra_neg = [Eb @ qemb.embed(cfg["emb"], n) for n in avoided(ctx)]''')
i=s.index('EXPLORE4 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''BEST_COVER = dict(facet_source="searched", facet_k=None, facet_min=0.0)
EXPLORE5 = {
    "text-v-avoid-only": variant(avoid_neg="nonen-avoid"),
    "text-v-avoid-none": variant(avoid_neg="none"),
    "text-v-tokens-marker-avoid-only": variant(neg_mode="tokens", less="marker", avoid_neg="nonen-avoid"),
    "text-v-entfacet-off": variant(ent_facet=False),
    "text-v-cons": variant(spell_mode="osa1", neg_mode="tokens", less="marker", avoid_neg="nonen-avoid",
                           era_mode="range", nonen_skip_cov=False, nonen_skip_ref=False, ent_facet=False,
                           **BEST_COVER),
}
'''+s[j:]
open(p,'w').write(s)
