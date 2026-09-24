import sys, json, time
sys.path.insert(0, "harness")
import simp_entity as E
over = dict(a.split("=", 1) for a in sys.argv[1:])
cfg = dict(E.DEFAULTS); cfg.update({k: eval(v) for k, v in over.items()})
ref = json.load(open("results/simplify/entity/det_r6.json"))
t = time.time(); E.detect("warm up", cfg); print("build", round(time.time() - t, 1), file=sys.stderr)
n = 0; ts = []
for qid, v in ref.items():
    t = time.perf_counter(); d = E.detect(v["query"], cfg); ts.append(time.perf_counter() - t)
    mine = None if d is None else dict(ents=[(e.kind, e.name) for e in d.entities], intent=d.intent, era=d.era)
    r = v["det"]
    same = (mine is None and r is None) or (mine and r and sorted(map(tuple, r["ents"])) == sorted(mine["ents"]) and r["intent"] == mine["intent"] and r["era"] == mine["era"])
    if not same:
        n += 1; print(qid, repr(v["query"]), "\n   r6 ", r, "\n   new", mine)
ts.sort(); print("disagree", n, "p50 ms", round(ts[len(ts)//2]*1000, 2), "max", round(ts[-1]*1000, 1))
