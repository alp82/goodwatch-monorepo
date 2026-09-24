import sys, json; sys.path.insert(0, 'harness')
import evalsimp as E, simp, sparse as S
ctxs = E.contexts()
cfg = simp.DEFAULTS
for c in ctxs:
    if c.type == 'title_lookup': continue
    det = simp.detect(c.query, cfg)
    if det is not None: continue
    non_en = c.non_english or simp.looks_foreign(c.text)
    text = simp.spell(c.text) if not non_en else c.text
    pos, neg = simp.split_negation(text)
    fcs = simp.facets(c)
    units = simp.facet_units(c, neg, cfg) if (not non_en and len(S.tokens(pos)) <= 5) else []
    conc = simp.concrete_words(c)
    if units and not any(set(u.split()) & conc for u in units): units = ['X'] + units
    sp = [p['phrase'] for p in c.reading.get('searchedPhrases') or []]
    print(f"{c.id:8} {c.query[:60]!r:64} nonEN={int(c.non_english)}{int(simp.looks_foreign(c.text))} era={simp.parse_era(c.text)}")
    print(f"     searched={sp} facets={fcs} units={units}")
