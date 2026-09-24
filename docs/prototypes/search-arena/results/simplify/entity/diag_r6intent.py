"""Diagnostic: the new resolver and credits, but r6's intent and era per query (isolates the intent change)."""
import sys, json; sys.path.insert(0, "harness")
import simp_entity as E
R6 = {v["query"]: v["det"] for v in json.load(open("results/simplify/entity/det_r6.json")).values()}
_detect = E.detect
def detect(query, cfg):
    d = _detect(query, cfg)
    if d is not None and R6.get(query):
        d.intent, d.era = R6[query]["intent"], R6[query]["era"]
    return d
E.detect = detect
FINAL = {"entity-diag-r6intent": E.variant()}
