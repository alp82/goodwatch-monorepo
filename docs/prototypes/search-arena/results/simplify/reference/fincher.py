import sys; sys.path.insert(0,'harness')
import simp, catalog as C
from collections import Counter
cfg=simp.DEFAULTS; cat=C.load()
d=simp.detect('fincher vibes but a series',cfg)
pid=d.entities[0].ids[0]
cr=simp.credits(cfg)[pid]
for r,(w,role) in sorted(cr.items(), key=lambda x:-cat.votes[x[0]])[:40]:
    print(round(w,2),role,cat.title[r],cat.year[r],cat.media_type(r),cat.votes[r])
# creator sources overall
cnt=Counter()
for t in simp._gz_lines("credits.jsonl.gz"):
    cnt[t.get("creator_source")]+=1
print(cnt)
