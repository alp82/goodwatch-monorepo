"""Round 4 exploration: score simp_combo variants into results/simplify/round4/iter (not the shared lists/)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "harness"))
import evalsimp as ev, simp_combo as sc
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "iter")
ev.LISTS = os.path.join(D, "lists"); ev.SCORES = os.path.join(D, "scores")
B5 = dict(sc.DEFAULTS["bounds"], style=(3, 5))
V = {
    "combo": sc.FINAL["combo"],
    "combo-safe": sc.FINAL["combo-safe"],
    "x-max5": sc.variant(bounds=B5),
    "x-intent": sc.variant(entity_dense="intent"),
    "x-bcod": sc.variant(bound_codirected=True),
    "x-reuse": sc.variant(entity_dense="reuse"),
    "x-bcod-reuse": sc.variant(bound_codirected=True, entity_dense="reuse"),
    "x-safe-bcod-reuse": sc.variant(**dict(sc.SAFE, bound_codirected=True, entity_dense="reuse")),
    "x-nodense": sc.variant(entity_dense="none"),
    "x-safe-nodense": sc.variant(**dict(sc.SAFE, entity_dense="none")),
}
if __name__ != "__main__":
    FINAL = V
sel = sys.argv[1:] or list(V)
if "--overlay" in sel:
    sel.remove("--overlay"); ev._overlay = ev.OVERLAY
if __name__ == "__main__":
    ev.score({k: V[k] for k in sel if k in V}, ref=True, reps=1)
