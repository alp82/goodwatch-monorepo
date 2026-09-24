"""Rank every query with simp_fusion's default config and compare with the saved simp (= r6) lists."""
import sys, json; sys.path.insert(0, "harness")
import evalsimp as ES, simp_fusion as F
ctxs = ES.contexts()
ref = ES.load_lists("simp")
over = eval(sys.argv[1]) if len(sys.argv) > 1 else {}
ls, _ = ES.run({"x": F.variant(**over)}, ctxs, timed=False)
diff = [c.id for c in ctxs if [x["id"] for x in ls["x"][c.id]] != [x["id"] for x in ref[c.id]]]
print(len(diff), "of", len(ctxs), "lists differ", diff[:20])
