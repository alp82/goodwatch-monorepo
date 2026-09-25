"""Export the prototype's ranking of every graded query, with the intermediate values the parity check compares.

The ranker is simp_combo.FINAL["combo-safe-v3"] (the #137 fixes included), run on the arena snapshot of
2026-09-23 06:48 UTC. Per query the output holds:
  top50       the final list after the blend, cut folding and own-title bounds: [[point id, score], ...]
  discovery   rank_query's top 50 before the blend: [[point id, score], ...]
  candidates  every candidate of the pool with its discovery score: {point id: score}
  texts       every (model, text) encoded, in order
  reference   kind, intent, names, seeds (point ids), residual, negated, era, own titles; null without one
  terms       the reference profile's top terms ([term, weight]), when there is a reference
  non_english, era (the year range applied, or null), mask (filtered titles)

Usage (with the arena's .venv; ARENA_DIR is an arena checkout with the data, default: this repository's arena):
  ARENA_DIR=.../search-arena .venv/bin/python bench/parity/export_prototype.py --out=<file.json> [--only=id,id]
    [--variant=combo-safe-v3] [--patch=<module>]
--patch names Python files (comma-separated) whose `apply(M)` changes simp_combo before the run (for example, to feed it production
inputs); it is how the parity check attributes a difference to its cause.
"""
import importlib.util, json, os, sys, time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.environ.get("ARENA_DIR", os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ARENA, "harness"))

import catalog as C  # noqa: E402
import context as X  # noqa: E402
import simp_combo as M  # noqa: E402


def arg(name, default=None):
    for a in sys.argv:
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


class Recorder:
    """Wraps simp_combo's helpers to record one query's intermediate values."""

    def __init__(self):
        self.cur = None
        self._top, self._sims, self._top_terms, self._resolve = M.top, M.sims, M.top_terms, M.resolve_reference
        self._era = M.era_filter
        M.top, M.sims, M.top_terms, M.resolve_reference, M.era_filter = self.top, self.sims, self.top_terms, \
            self.resolve_reference, self.era_filter

    def start(self):
        self.cur = {"texts": [], "terms": None, "candidates": None, "reference": None, "era": None}

    def top(self, rows, score, k):
        if k == M.TOP and self.cur is not None and self.cur["candidates"] is None:
            ids = C.load().ids[np.asarray(rows)]
            self.cur["candidates"] = {int(i): float(s) for i, s in zip(ids, score)}
        return self._top(rows, score, k)

    def sims(self, model, text):
        if (model, text) not in M._sims and self.cur is not None:
            self.cur["texts"].append([model, text])
        return self._sims(model, text)

    def top_terms(self, w, cfg):
        cols = self._top_terms(w, cfg)
        vocab = M.S.index(cfg["body"])[1]
        inv = M.cached("term_names", lambda: {j: t for t, j in vocab.items()})
        if self.cur is not None:
            self.cur["terms"] = [[inv[int(j)], float(w[j])] for j in cols]
        return cols

    def resolve_reference(self, ctx, cfg, non_en):
        ref = self._resolve(ctx, cfg, non_en)
        if ref is not None and self.cur is not None:
            self.cur["reference_obj"] = ref
        return ref

    def era_filter(self, text, mask):
        out = self._era(text, mask)
        if self.cur is not None:
            m = M._ERA.search(text)
            self.cur["era"] = None if out is mask else m.group(0)
            self.cur["mask"] = int(out.sum())
        return out


def reference_info(ref):
    cat = C.load()
    if ref is None:
        return None
    names = [e.name for e in ref.det.entities] if ref.det is not None else [cat.title[ref.seeds[0]]]
    intent = ref.intent
    return {"kind": ref.kind, "intent": intent, "names": names, "seeds": [int(cat.ids[r]) for r in ref.seeds],
            "residual": ref.text, "negated": ref.negated, "era": ref.era, "own": sorted(int(i) for i in ref.own),
            "weights": {int(cat.ids[r]): float(w) for r, w in ref.weights.items()}}


def main():
    variant = arg("variant", "combo-safe-v3")
    cfg = M.FINAL[variant][0]
    for i, path in enumerate(filter(None, (arg("patch") or "").split(","))):
        spec = importlib.util.spec_from_file_location(f"parity_patch{i}", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.apply(M)
    only = set(arg("only").split(",")) if arg("only") else None
    rec = Recorder()
    ctxs = [c for c in X.contexts() if only is None or c.id in only]
    out = {}
    t0 = time.time()
    for ctx in ctxs:
        rec.start()
        cfg_q = cfg
        disc_holder = {}
        orig_blend = M.blend

        def blend(c, disc, cf):
            disc_holder["disc"] = disc
            return orig_blend(c, disc, cf)
        M.blend = blend
        try:
            ranked = M.rank(ctx, cfg_q)
        finally:
            M.blend = orig_blend
        cur = rec.cur
        ref = cur.pop("reference_obj", None)
        out[ctx.id] = {
            "query": ctx.query, "split": ctx.split, "type": ctx.type,
            "non_english": bool(ctx.non_english or M.looks_foreign(ctx.text)),
            "top50": [[int(x["id"]), float(x["score"])] for x in ranked],
            "discovery": [[int(i), float(s)] for i, s in disc_holder["disc"]],
            "candidates": cur["candidates"], "texts": cur["texts"], "terms": cur["terms"] if ref else None,
            "reference": reference_info(ref), "era": cur["era"], "mask": cur.get("mask"),
        }
    json.dump({"variant": variant, "patch": arg("patch"), "queries": out}, open(arg("out"), "w"))
    print(f"{len(out)} queries in {time.time() - t0:.0f} s -> {arg('out')}")


if __name__ == "__main__":
    main()
