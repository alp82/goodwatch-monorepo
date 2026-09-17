"""Compare Jev scoring runs with the recorded Qwen baselines. Writes jev/results.json."""

import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
BENCH = ROOT / "docs/benchmarks/fingerprint"
POC = BENCH / "poc"
RUNS = BENCH / "jev/private/runs"
USD_PER_INPUT_TOKEN = 0.042 / 1_000_000
PANEL = {6: "F", 7: "D", 9: "B", 10: "E", 12: "A"}


def load_keys():
    keys = json.loads((BENCH / "score-keys.json").read_text())
    return keys["score_keys"] if isinstance(keys, dict) else keys


def load_baselines(keys):
    data = json.loads((POC / "evidence-first/normalized-scores.json").read_text())
    first = {}
    for rec in data["results"]:
        label = PANEL.get(rec["candidate_index"])
        if label and rec["full_response_outcome"] == "valid":
            first.setdefault(label, {})[rec["benchmark_id"]] = dict(zip(data["score_keys"], rec["scores_in_schema_order"]))
    repeat, highlights = {}, {}
    for row in json.loads((POC / "repeat-cost/comparison.json").read_text()):
        parsed = json.loads((POC / "repeat-cost" / row["repeat_artifact"] / "parsed.json").read_text())
        scores = parsed["results"][0]["analysis"]["fingerprint"]["scores"]
        repeat.setdefault(row["model_label"], {})[row["benchmark_id"]] = {k: scores[k] for k in keys}
        highlights.setdefault(row["model_label"], {})[row["benchmark_id"]] = row["first_highlights"]
    ids = sorted(first["F"])
    first["panel"] = {
        b: {k: statistics.median(first[m][b][k] for m in PANEL.values()) for k in keys} for b in ids
    }
    return first, repeat, highlights


def ranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            out[order[k]] = (i + j) / 2
        i = j + 1
    return out


def spearman(a, b):
    ra, rb = ranks(a), ranks(b)
    ma, mb = statistics.mean(ra), statistics.mean(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** 0.5
    return num / den if den else 0.0


def compare(cand, ref, keys, ref_highlights=None):
    """cand/ref: {benchmark_id: {key: 0-10}}."""
    deltas, rhos, overlaps, bias = [], [], [], []
    for b in sorted(set(cand) & set(ref)):
        deltas += [abs(cand[b][k] - ref[b][k]) for k in keys]
        bias += [cand[b][k] - ref[b][k] for k in keys]
        rhos.append(spearman([cand[b][k] for k in keys], [ref[b][k] for k in keys]))
        if ref_highlights:
            want = ref_highlights[b]
            top = sorted(keys, key=lambda k: -cand[b][k])[: len(want)]
            overlaps.append(len(set(top) & set(want)) / len(want))
    return {
        "mean_abs_delta": round(statistics.mean(deltas), 3),
        "mean_signed_delta": round(statistics.mean(bias), 3),
        "deltas_ge_3": sum(d >= 3 for d in deltas),
        "deltas_ge_5": sum(d >= 5 for d in deltas),
        "cells": len(deltas),
        "median_title_spearman": round(statistics.median(rhos), 3),
        "min_title_spearman": round(min(rhos), 3),
        "mean_highlight_overlap": round(statistics.mean(overlaps), 3) if overlaps else None,
    }


def to_scale(arm_records, design, mode="mean", pres=None):
    """Map Jev answers to the 0-10 integer scale."""
    top = 9 if design == "l10" else 5
    out = {}
    for rec in arm_records:
        scores = {}
        for qid, ans in rec["answers"].items():
            d, key = qid.split(".", 1)
            if d != design:
                continue
            if mode == "mean":
                level = ans["score"]
            else:
                level = int(max(ans["probabilities"], key=lambda p: ans["probabilities"][p]))
            scores[key] = round(level * 10 / top)
        if pres:
            for key in scores:
                p = pres[rec["benchmark_id"]][key]
                scores[key] = 0 if p < 0.5 else max(1, scores[key])
        out[rec["benchmark_id"]] = scores
    return out


def pct(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(q * (len(values) - 1))))]


def speed_cost(arm_records):
    walls = [r["wall_seconds"] for r in arm_records]
    reqs = [a["seconds"] for r in arm_records for attempts in r["requests"] for a in attempts if a.get("status") == 200]
    upstream = [a["upstream_ms"] for r in arm_records for attempts in r["requests"] for a in attempts if a.get("upstream_ms") is not None]
    tokens = [r["input_tokens"] for r in arm_records]
    failures = sum(1 for r in arm_records for attempts in r["requests"] for a in attempts if a.get("status") != 200)
    return {
        "titles": len(arm_records),
        "complete_titles": sum(r["answered"] == r["question_count"] for r in arm_records),
        "questions_per_title": arm_records[0]["question_count"],
        "requests_per_title": arm_records[0]["request_count"],
        "median_title_seconds": round(statistics.median(walls), 3),
        "p95_title_seconds": round(pct(walls, 0.95), 3),
        "median_request_seconds": round(statistics.median(reqs), 3),
        "p95_request_seconds": round(pct(reqs, 0.95), 3),
        "median_upstream_ms": statistics.median(upstream) if upstream else None,
        "failed_or_retried_requests": failures,
        "mean_input_tokens_per_title": round(statistics.mean(tokens)),
        "usd_per_1000_titles": round(statistics.mean(tokens) * USD_PER_INPUT_TOKEN * 1000, 4),
    }


def main():
    keys = load_keys()
    first, repeat, highlights = load_baselines(keys)
    arms, extra = {}, {}
    for path in sorted(RUNS.glob("*.json")):
        for rec in json.loads(path.read_text())["records"]:
            if "answers" in rec:
                arms.setdefault(rec["arm"], []).append(rec)
            else:
                extra[rec["arm"]] = rec

    result = {"price_usd_per_million_input_tokens": 0.042, "baseline_noise": {}, "arms": {}, "batch_independence": {}, "extra": extra}
    result["baseline_noise"] = {
        "F_repeat_vs_F_first": compare(repeat["F"], first["F"], keys, highlights["F"]),
        "D_repeat_vs_D_first": compare(repeat["D"], first["D"], keys, highlights["D"]),
        "D_first_vs_F_first": compare(first["D"], first["F"], keys, highlights["F"]),
        "F_first_vs_panel": compare(first["F"], first["panel"], keys),
    }

    pres = None
    if "pres-b74" in arms:
        pres = {r["benchmark_id"]: {q.split(".", 1)[1]: a["noul"] for q, a in r["answers"].items()} for r in arms["pres-b74"]}

    scaled = {}
    for arm, recs in sorted(arms.items()):
        entry = {"speed_cost": speed_cost(recs)}
        designs = {q.split(".", 1)[0] for q in recs[0]["answers"]} - {"pres"}
        for design in sorted(designs):
            variants = {"mean": to_scale(recs, design), "argmax": to_scale(recs, design, "argmax")}
            if pres and design == "l10" and arm == "l10-b74":
                variants["mean_gated"] = to_scale(recs, design, pres=pres)
            for mode, cand in variants.items():
                name = f"{design}:{mode}"
                scaled[(arm, name)] = cand
                entry[name] = {
                    "vs_F": compare(cand, first["F"], keys, highlights["F"]),
                    "vs_D": compare(cand, first["D"], keys, highlights["D"]),
                    "vs_panel": compare(cand, first["panel"], keys),
                }
        result["arms"][arm] = entry

    # Does an answer depend on what else is in the request?
    base = {r["benchmark_id"]: r["answers"] for r in arms.get("l10-b74", [])}
    for arm, recs in sorted(arms.items()):
        if arm == "l10-b74" or not base:
            continue
        diffs = [abs(a["score"] - base[r["benchmark_id"]][q]["score"]) for r in recs if r["state_variant"] == "parity"
                 for q, a in r["answers"].items() if q.startswith("l10.") and q in base.get(r["benchmark_id"], {})]
        if diffs:
            result["batch_independence"][arm] = {
                "cells": len(diffs),
                "max_abs_level_diff": round(max(diffs), 3),
                "mean_abs_level_diff": round(statistics.mean(diffs), 4),
                "cells_diff_gt_0.25": sum(d > 0.25 for d in diffs),
            }

    confidences = [a["confidence"] for r in arms.get("l10-b74", []) for a in r["answers"].values()]
    if confidences:
        result["l10_b74_confidence"] = {"median": statistics.median(confidences), "share_below_0.5": round(sum(c < 0.5 for c in confidences) / len(confidences), 3)}

    out = BENCH / "jev/results.json"
    out.write_text(json.dumps(result, indent=1))
    table = {f"{a}|{n}": s for (a, n), s in scaled.items() if a in ("l10-b74", "l6-b74", "l10-blind-b74")}
    (BENCH / "jev/scores.json").write_text(json.dumps({"score_keys": keys, "baselines": {"F": first["F"], "D": first["D"], "panel": first["panel"]}, "jev": table}, indent=1))
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
