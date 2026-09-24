p='harness/simp_text.py'
s=open(p).read()
i=s.index('EXPLORE9 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''# The candidates of this round (see results/simplify/text/REPORT.md).
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
'''+s[j:]
s=s.replace('FINAL = {"text-base": Variant(DEFAULTS)}\n','BASE = {"text-base": Variant(DEFAULTS)}\n',1)
open(p,'w').write(s)
