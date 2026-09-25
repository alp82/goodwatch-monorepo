"""Attribute every top-10 difference between the TypeScript ranker and the prototype to a cause, from runs that
change one input at a time.

Runs (paths given as name=file):
  proto          the prototype on the arena snapshot (export_prototype.py)
  proto_norm     the prototype with normalized title embeddings (patch_normalize.py)
  proto_norm_pp  proto_norm scoring the port's pool from the exact mirror (patch_port_pool.py)
  port_exact     the port on the exact mirror (mirror.py --layout=exact)
  port_mprod     the port on the production-layout mirror (mirror.py --layout=prod)
  proto_votes    proto_norm with production's vote counts and live eligibility (patch_production_votes.py)
  port_prod      the port on production
  port_excl      the port on production, with the eligible titles missing from the index build excluded (experiment)

Usage: python bench/parity/attribute.py proto=... proto_norm=... ... [--out=<file.json>]

Same data (the exact mirror), a difference is explained by:
  normalization  gone when the prototype normalizes its stored embeddings (proto_norm);
  pool           gone when the prototype scores the port's pool (proto_norm_pp): which titles made a list's cut, a tie
                 or a float-level near tie at the cut (pool_diff.py classifies each title);
  near tie       left over: two titles whose scores differ by less than the float noise, or a sparse list whose kept
                 hits differ by a tie at its cut (signals.py shows which signal).
Production data, a difference is explained by:
  approximation  the port's list already differs on the production-layout mirror (HNSW, float16, shards) in the same
                 way;
  votes          gone when the prototype uses production's vote counts and eligibility (proto_votes);
  new titles     gone when also the titles published after the build are excluded (port_excl);
  credits        the reference's seeds, own titles or profile terms differ (production's credits);
  other drift    none of the above: changed vectors, fingerprints or term statistics; listed for inspection.
"""
import json, sys
from collections import Counter

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from compare import as_reference  # noqa: E402


def arg(name, default=None):
    for a in sys.argv:
        if a.startswith(f"--{name}="):
            return a.split("=", 1)[1]
    return default


def top10(run, qid):
    return [i for i, _ in run[qid]["top50"][:10]]


def main():
    runs = {}
    for a in sys.argv[1:]:
        if a.startswith("--"):
            continue
        name, path = a.split("=", 1)
        runs[name] = as_reference(path)
    proto = runs["proto"]
    same_data, prod = {}, {}
    for qid in proto:
        p = top10(proto, qid)
        e = top10(runs["port_exact"], qid)
        if p != e:
            if top10(runs["proto_norm"], qid) == e:
                same_data[qid] = "normalization"
            elif top10(runs["proto_norm_pp"], qid) == e:
                same_data[qid] = "pool"
            else:
                same_data[qid] = "near tie"
        q = top10(runs["port_prod"], qid)
        if p == q:
            continue
        ref_p, ref_q = runs["proto_votes"][qid]["reference"], runs["port_prod"][qid]["reference"]
        if top10(runs["port_mprod"], qid) == q:
            prod[qid] = "approximation"
        elif top10(runs["proto_votes"], qid) == q:
            prod[qid] = "votes"
        elif "port_excl" in runs and top10(runs["proto_votes"], qid) == top10(runs["port_excl"], qid):
            prod[qid] = "new titles"
        elif ref_p and ref_q and (ref_p["seeds"] != ref_q["seeds"] or set(ref_p["own"]) != set(ref_q["own"])
                                  or {t for t, _ in runs["proto_votes"][qid]["terms"] or []}
                                  != {t for t, _ in runs["port_prod"][qid]["terms"] or []}):
            prod[qid] = "credits"
        elif top10(runs["port_mprod"], qid) != p:
            prod[qid] = "approximation and drift"
        else:
            prod[qid] = "other drift"
    summary = {"same data": dict(Counter(same_data.values())), "production": dict(Counter(prod.values())),
               "queries": len(proto)}
    print(json.dumps(summary, indent=1))
    for qid, why in prod.items():
        if why in ("other drift",):
            p, q = top10(proto, qid), top10(runs["port_prod"], qid)
            print(qid, why, proto[qid]["query"], "shared", len(set(p) & set(q)))
    if arg("out"):
        json.dump({"summary": summary, "same_data": same_data, "production": prod}, open(arg("out"), "w"), indent=1)


if __name__ == "__main__":
    main()
