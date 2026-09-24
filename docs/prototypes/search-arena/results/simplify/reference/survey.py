import sys; sys.path.insert(0,'harness')
import evalsimp as E, simp
ctxs=E.contexts()
cfg=simp.DEFAULTS
for c in ctxs:
    d=simp.detect(c.query,cfg)
    r=simp.find_reference(c.text,cfg["ref_votes"])
    sty=E.run6.qmeta(c).get("person_intent")
    if d or r:
        print(c.split,c.id,repr(c.query),'|',d and d.intent, d and [(e.kind,e.name) for e in d.entities],'|ref:',r and (simp.C.load().title[r[0]],r[2]),'| meta:',sty)
