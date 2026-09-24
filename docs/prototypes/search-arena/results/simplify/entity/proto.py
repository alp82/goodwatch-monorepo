import sys, json, re, math
sys.path.insert(0, "harness")
import simp, numpy as np
from collections import defaultdict, Counter
C = simp.C
cat = C.load()

MINOR = 0.5
def credit_w():
    per = defaultdict(dict)
    def put(pid, r, w):
        if w > per[pid].get(r, 0): per[pid][r] = w
    for t in simp._gz_lines("credits.jsonl.gz"):
        r = cat.row_of.get(t["id"])
        if r is None: continue
        show = t["media_type"] == "show"
        for i, d in enumerate(t["directors"]):
            put(d["id"], r, 1.0 if (i == 0 if show else d.get("job") == "Director") else MINOR)
        for d in t["creators"]:
            put(d["id"], r, 1.0)
        for d in t["writers"]:
            put(d["id"], r, 1.0 if d.get("department") == "Writing" else MINOR)
        for d in t["cast"]:
            put(d["id"], r, 1.0 if (d.get("order") or 0) <= 3 and d.get("department") in (None, "Acting") else MINOR)
    return per
cr = credit_w()
P = simp.persons()
low = simp.common_words(simp.DEFAULTS)[2]
votes = cat.votes.astype(np.float64)
def mass(rw): return float(sum(votes[r] * w for r, w in rw.items()))

keys = defaultdict(list)   # key -> [(mass, kind, ids, name)]
pm = {pid: mass(rw) for pid, rw in cr.items()}
for pid, v in P.items():
    m = pm.get(pid, 0)
    ks = set()
    for n in {v["name"], v.get("original_name") or ""}:
        f = simp.fold(n)
        if f:
            ks.add(f); ks.add(f.split()[-1])
    for k in ks: keys[k].append((m, "person", (pid,), v["name"]))
# studios
names, rows = {}, defaultdict(dict)
for t in simp._gz_lines("companies.jsonl.gz"):
    r = cat.row_of.get(t["id"])
    if r is None: continue
    for i, c in enumerate(t["companies"] or []):
        names[("c", c["id"])] = c["name"]; rows[("c", c["id"])][r] = max(rows[("c", c["id"])].get(r,0), 1.0 if i <= 1 else MINOR)
    for c in t["networks"] or []:
        names[("n", c["id"])] = c["name"]; rows[("n", c["id"])][r] = 1.0
brand = defaultdict(set)
for k, n in names.items():
    ws = simp.fold(n).split()
    for i in range(1, len(ws) + 1):
        brand[" ".join(ws[:i])].add(k)
for a, ks in brand.items():
    rw = {}
    for k in ks:
        for r, w in rows[k].items(): rw[r] = max(rw.get(r, 0), w)
    big = max(ks, key=lambda k: len(rows[k]))
    keys[a].append((mass(rw), "studio", tuple(sorted(ks)), names[big]))
for k in keys: keys[k].sort(key=lambda x: -x[0])
print("keys", len(keys))
json.dump({}, open("/dev/null","w"))
import pickle; pickle.dump((dict(keys),), open("results/simplify/entity/keys.pkl","wb"))

def resolve(query, D=3.0, c=2e5, N=4):
    toks = simp.fold(query).split()
    used, ents = set(), []
    for n in range(N, 0, -1):
        for i in range(len(toks) - n + 1):
            if any(k in used for k in range(i, i+n)): continue
            g = " ".join(toks[i:i+n])
            cands = keys.get(g)
            if not cands: continue
            word = c * (1 + min(low.get(w, 0) for w in toks[i:i+n]))
            second = cands[1][0] if len(cands) > 1 else 0
            if cands[0][0] >= D * max(second, word):
                ents.append((cands[0][1], cands[0][3], g)); used.update(range(i, i+n))
    return ents
if __name__ == "__main__":
    D = float(sys.argv[1]) if len(sys.argv) > 1 else 3.0
    c = float(sys.argv[2]) if len(sys.argv) > 2 else 2e5
    ref = json.load(open("results/simplify/entity/det_r6.json"))
    bad = 0
    for qid, v in ref.items():
        mine = resolve(v["query"], D, c)
        r = [(k, n) for k, n in v["det"]["ents"]] if v["det"] else []
        m = [(k, n) for k, n, g in mine]
        if sorted(r) != sorted(m):
            bad += 1; print(qid, v["query"], "| r6", r, "| new", mine)
    print("disagree", bad)
