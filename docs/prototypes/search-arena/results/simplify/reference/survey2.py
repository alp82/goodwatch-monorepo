import sys; sys.path.insert(0,'harness')
import evalsimp as E, simp_ref as R
cfg=R.DEFAULTS
for c in E.contexts():
    non_en = cfg["native_routing"] and (c.non_english or (cfg["nonen"] and R.looks_foreign(c.text)))
    r=R.resolve_reference(c,cfg,non_en)
    if r: print(c.id, repr(c.query),'|',r.kind,r.intent,'| text:',repr(r.text),'neg',r.negated,'| seeds',[R.C.load().title[x] for x in r.seeds[:3]],'| own',len(r.own))
