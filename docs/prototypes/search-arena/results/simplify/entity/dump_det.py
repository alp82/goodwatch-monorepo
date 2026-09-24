import sys, json, time
sys.path.insert(0, "harness")
import simp
q = json.load(open("queries.json"))
t = time.time()
out = {}
for x in q:
    d = simp.detect(x["query"], simp.DEFAULTS)
    out[x["id"]] = dict(query=x["query"], split=x["split"], intent_label=x.get("intent"),
                        det=None if d is None else dict(ents=[(e.kind, e.name) for e in d.entities], intent=d.intent, era=d.era))
print(time.time() - t, file=sys.stderr)
json.dump(out, open("results/simplify/entity/det_r6.json", "w"), indent=1, ensure_ascii=False)
for k, v in out.items():
    print(k, "|", v["query"], "|", v["intent_label"], "|", v["det"])
