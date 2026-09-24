"""Detection probes: negatives (frequent tags / keywords as queries) and positives (well-known names), r6 vs new."""
import sys, json, re
sys.path.insert(0, "harness")
import numpy as np, simp, simp_entity as E
from collections import Counter
over = dict(a.split("=", 1) for a in sys.argv[1:])
cfg = dict(E.DEFAULTS); cfg.update({k: eval(v) for k, v in over.items()}); cfg["intent"] = "both"
cat = simp.C.load()
cnt = Counter()
for r in np.flatnonzero(cat.eligible()):
    cnt.update(set(t.lower() for t in list(cat.keywords[r]) + list(cat.essence_tags[r])))
neg = [t for t, c in cnt.most_common(3000)]
def ents(d): return [] if d is None else sorted((e.kind, e.name) for e in d.entities)
fp_r6 = fp_new = 0; lines = []
for q in neg:
    a, b = ents(simp.detect(q, simp.DEFAULTS)), ents(E.detect(q, cfg))
    fp_r6 += bool(a); fp_new += bool(b)
    if a != b: lines.append(f"NEG {q!r}: r6 {a} new {b}")
# positives: famous directors / creators / actors by main-title votes, full name and last name
cr = E.credits(cfg); P = E.persons(); votes = cat.votes
def mm(pid, roles): return sum(votes[r] for r, (w, role) in cr.get(pid, {}).items() if w >= 1 and role in roles)
crew = sorted(P, key=lambda p: -mm(p, ("director", "creator")))[:150]
cast = sorted(P, key=lambda p: -mm(p, ("cast",)))[:150]
pos = []
for p in crew: pos += [(P[p]["name"], p), (E.surname(P[p]["name"]) or P[p]["name"], p)]
for p in cast: pos += [(P[p]["name"], p)]
hit_r6 = hit_new = 0
for q, p in pos:
    d0, d1 = simp.detect(q, simp.DEFAULTS), E.detect(q, cfg)
    h0 = d0 is not None and any(p in e.ids for e in d0.entities)
    h1 = d1 is not None and any(p in e.ids for e in d1.entities)
    hit_r6 += h0; hit_new += h1
    if h0 != h1: lines.append(f"POS {q!r} ({P[p]['name']}): r6 {ents(d0)} new {ents(d1)}")
studios = ["pixar", "disney", "marvel", "dreamworks", "a24", "hbo", "netflix", "blumhouse", "aardman", "studio ghibli",
           "ghibli", "warner bros", "universal", "paramount", "lionsgate", "amc", "bbc", "fx", "illumination", "laika",
           "neon", "miramax", "toho", "cartoon network", "nickelodeon", "hulu", "showtime", "apple tv", "amazon", "legendary"]
for q in studios:
    lines.append(f"STU {q!r}: r6 {ents(simp.detect(q + ' movies', simp.DEFAULTS))} new {ents(E.detect(q + ' movies', cfg))}")
print("\n".join(lines))
print(f"negatives {len(neg)}: r6 fp {fp_r6}, new fp {fp_new}; positives {len(pos)}: r6 {hit_r6}, new {hit_new}")
# typos: the last name of well-known people with its 3rd-last letter dropped; negatives: tag phrases with one
# letter dropped from their longest word
import random
random.seed(0)
def typo(w): return w[:-3] + w[-2:] if len(w) >= 5 else w
th0 = th1 = 0; tq = 0
for p in crew[:100] + cast[:100]:
    n = E.fold(P[p]["name"]).split()
    if len(n) < 2: continue
    q = " ".join(n[:-1] + [typo(n[-1])]) + " movies"; tq += 1
    d0, d1 = simp.detect(q, simp.DEFAULTS), E.detect(q, cfg)
    th0 += d0 is not None and any(p in e.ids for e in d0.entities)
    th1 += d1 is not None and any(p in e.ids for e in d1.entities)
tf0 = tf1 = 0; fl = []
for q in neg[:1500]:
    ws = q.split(); k = max(range(len(ws)), key=lambda i: len(ws[i])); ws[k] = typo(ws[k]); q2 = " ".join(ws)
    a, b = ents(simp.detect(q2, simp.DEFAULTS)), ents(E.detect(q2, cfg))
    tf0 += bool(a); tf1 += bool(b)
    if b and not a: fl.append(f"{q2!r}: {b}")
print("typo FP new-only:", "; ".join(fl[:15]))
print(f"typo names {tq}: r6 {th0}, new {th1}; typo negatives 1500: r6 fp {tf0}, new fp {tf1}")
