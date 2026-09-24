"""Quick untimed probes: python probe.py '<name>=dict(...)' ... ; prints evalsimp rows (r6 = saved simp lists)."""
import sys, json, os; sys.path.insert(0, "harness")
import evalsimp as ES, simp_fusion as F, metrics as M
ctxs = ES.contexts(); grades = M.load_grades()
cands = {}
for a in sys.argv[1:]:
    n, e = a.split("=", 1)
    cands[n] = F.variant(**eval(e))
ls, _ = ES.run(cands, ctxs, timed=False)
out = os.path.join("results/simplify/fusion/probe_lists"); os.makedirs(out, exist_ok=True)
print(ES.header())
s, _ = ES.summarize(ctxs, ES.load_lists("simp"), grades); print(ES.row("r6(simp)", s))
for n in cands:
    json.dump(ls[n], open(f"{out}/{n}.json", "w"))
    s, _ = ES.summarize(ctxs, ls[n], grades); print(ES.row(n, s))
