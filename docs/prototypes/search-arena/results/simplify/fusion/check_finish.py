import sys; sys.path.insert(0, "results/simplify/fusion"); sys.path.insert(0, "harness")
import fit, evalsimp as ES, simp_fusion as F
ctxs = ES.contexts(); cfg = F.variant()[0]
caps = fit.capture(cfg, ctxs)
ref = ES.load_lists("simp")
W0 = {n: F.weight(cfg, n) / cfg["a"] for n in F.SIGNALS}
bad = [c.id for c in ctxs if c.id in caps and fit.finish(c, cfg, caps[c.id], W0) != [x["id"] for x in ref[c.id]]]
print(len(caps), "captured;", len(bad), "differ", bad)
