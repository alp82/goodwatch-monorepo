"""Metrics per ranker, per split and per query type. Writes results/<round>/metrics.md.

Usage: .venv/bin/python harness/metrics.py [round1]

- Anchor metrics (always): anchor10 / anchor50 (macro share of anchors.must, queries with anchors),
  avoid5 (total anchors.avoid in the top 5). title_lookup queries are excluded from these and reported
  as a guardrail instead: the expected title at rank 1.
- Graded metrics (when results/grades.json exists, {query_id: {point_id: grade}}): ndcg10 (gain 2^g - 1,
  ideal from every graded title of the query), good10 (grade >= 2 in the top 10), bad5 (grade 0 in the
  top 5, total). Ungraded titles count as 0 and are reported as `unj10` (unjudged in the top 10).
"""
import json, math, os, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anchors as A  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402

ORDER = ["prod", "prod-replay", "fp-count", "emb-e5s", "emb-e5s-notitle", "emb-bgeb", "hyb-lin", "hyb-rrf",
         "emb-then-fp", "nojev-knn", "hyb-lin+prior",
         "neg", "facet", "prior-gated", "title-strict", "notext", "bgeb-notitle", "r2-combo", "r2-combo-bgeb",
         "r2-combo-strict", "r2-combo-bgeb-strict",
         "title-kind", "era", "nonen", "spell", "reweight", "notext-r2", "sparse", "sparse-fast", "r3-combo",
         "r3-combo-fast"]
# Estimated app-server p50 per stage (ms); see rankers.STAGES and results/baseline-cost-latency.md.
# Round 2: qemb_extra = negated clause / facet texts embedded in the same batch (+5 ms) plus their candidate
# cosines (in-process vectors or parallel Qdrant calls, +5 ms); fuzzy_title = rapidfuzz over ~65k eligible
# titles on the app-server CPU (measured ~2 ms here, only for short queries with an out-of-vocabulary word).
STAGE_MS = {"crate_text": 150, "qdrant_fp2000": 85, "fp_full": 4, "qemb": 8, "qdrant_emb": 15, "fp_payload": 20,
            "qemb_extra": 10, "fuzzy_title": 2, "qdrant_sparse": 10, "qdrant_batch": 20, "spell": 1}
# Round 3: qdrant_sparse = BM25F sparse query on a new collection (ids + scores, top 300), runs in parallel with
# the query embedding (text path). qdrant_batch = one Qdrant batch request after the embedding: dense top 500,
# facet / negation top 200 each and sparse top 300, ids + scores only (replaces qdrant_emb; ~8 ms measured for a
# 100-point query without payload, a few such lists in one request is taken as 20 ms). spell = rapidfuzz edit
# distance over ~30k frequent words, only for words outside the vocabulary. The non-English variant embeds a
# second text with bge-base for non-English queries only (+15 ms on those, not in p50).
QEMB_MS = {"emb-bgeb": 15, "bgeb-notitle": 15, "r2-combo-bgeb": 15, "r2-combo-bgeb-strict": 15,
           **{n: 15 for n in ("title-kind", "era", "nonen", "spell", "reweight", "notext-r2", "sparse", "sparse-fast",
                              "r3-combo", "r3-combo-fast")}}


def load_lists(rnd):
    d = os.path.join(C.ARENA, "results", rnd, "lists")
    out = {}
    for f in sorted(os.listdir(d)):
        if f.endswith(".json"):
            out[f[:-5]] = json.load(open(os.path.join(d, f)))
    return out


def load_grades():
    p = os.path.join(C.ARENA, "results", "grades.json")
    if not os.path.exists(p):
        return None
    return {q: {int(pid): g for pid, g in gs.items()} for q, gs in json.load(open(p)).items()}


def graded_query(ids, grades):
    gain = lambda g: 2 ** g - 1
    dcg = sum(gain(grades.get(pid, 0)) / math.log2(i + 2) for i, pid in enumerate(ids[:10]))
    ideal = sorted(grades.values(), reverse=True)[:10]
    idcg = sum(gain(g) / math.log2(i + 2) for i, g in enumerate(ideal))
    return {
        "ndcg10": dcg / idcg if idcg else 0.0,
        "good10": sum(1 for pid in ids[:10] if grades.get(pid, 0) >= 2),
        "bad5": sum(1 for pid in ids[:5] if pid in grades and grades[pid] == 0),
        "unj10": sum(1 for pid in ids[:10] if pid not in grades),
    }


def title_guardrail(ctxs, lists, split):
    ok, n = 0, 0
    for ctx in ctxs:
        if ctx.split != split or ctx.type != "title_lookup":
            continue
        n += 1
        must = A.anchor_ids(ctx.anchors, "must")
        if lists[ctx.id] and lists[ctx.id][0]["id"] in must:
            ok += 1
    return ok, n


def fmt(x, d=3):
    return "–" if x is None or (isinstance(x, float) and math.isnan(x)) else (f"{x:.{d}f}" if isinstance(x, float) else str(x))


def main(rnd="round1"):
    ctxs = X.contexts()
    lists = load_lists(rnd)
    names = [n for n in ORDER if n in lists] + [n for n in lists if n not in ORDER]
    grades = load_grades()
    out_dir = os.path.join(C.ARENA, "results", rnd)
    timings = json.load(open(os.path.join(out_dir, "timings.json"))) if os.path.exists(os.path.join(out_dir, "timings.json")) else {}
    stages = json.load(open(os.path.join(out_dir, "stages.json")))["stages"] if os.path.exists(os.path.join(out_dir, "stages.json")) else {}
    choices = json.load(open(os.path.join(out_dir, "choices.json"))) if os.path.exists(os.path.join(out_dir, "choices.json")) else {}
    lines = [f"# {rnd} metrics", ""]
    if choices and "e5_variant" in choices:
        lines += [f"- e5-small variant used by the hybrids: `{choices['e5_variant']['chosen']}` (chosen on dev anchors).",
                  f"- hyb-lin weights: `{choices['hyb_lin']['chosen']}` (swept on dev anchors only, see sweep-hyb-lin.md).",
                  "- Holdout numbers are computed for information; nothing was tuned on them.", ""]
    elif choices and rnd == "round3":
        lines += ["Round-3 rankers: r2-combo-bgeb-strict (bge-base no-title, a 0.4 / b 0.42 / c 0.18, prior 0.1/0.1, neg 0.1, "
                  "facet 0.1 phrases, Crate text, title-strict blend 0.9 / fuzzy 0.88) with one change each, plus two "
                  "combinations, chosen on dev only (proxy sweeps in sweeps.md). Round-1 and round-2 lists are included "
                  "unchanged. Holdout ndcg is not computed (holdout is not graded).", "",
                  "| ranker | changes vs r2-combo-bgeb-strict | blend changes |", "|---|---|---|"]
        base = {"emb": "bgeb-notitle", "a": 0.4, "b": 0.42, "c": 0.18, "prior": [0.1, 0.1], "neg": 0.1, "facet": 0.1,
                "facet_source": "phrases", "text": "crate", "sparse_w": None, "sparse_k": 300, "sparse_tf": "raw",
                "sparse_bigram": 1.0, "trunc": None, "era": False, "era_mode": "filter", "era_w": 0.3, "nonen": False,
                "nonen_mix": 0.5, "spell": False}
        for n, ch in choices.items():
            d = {k: v for k, v in ch["discovery"].items() if k not in ("k_emb", "k_fp")}
            diff = {k: v for k, v in d.items() if (list(v) if isinstance(v, tuple) else v) != base.get(k)}
            bdiff = {k: v for k, v in ch["blend"].items() if {"strict": 0.9, "fuzzy": 0.88, "kind": False}.get(k) != v}
            lines.append(f"| {n} | `{diff}` | `{bdiff or '-'}` |")
        lines.append("")
    elif choices:
        lines += ["Round-2 rankers: hyb-lin+prior (round 1: e5s-notitle, a 0.4 / b 0.42 / c 0.18, prior 0.1/0.1 additive) "
                  "with one change each, chosen on dev only (proxy sweeps in sweeps.md). Round-1 lists are included "
                  "unchanged. Holdout ndcg is not computed (holdout is not graded).", "",
                  "| ranker | changes vs hyb-lin+prior | blend |", "|---|---|---|"]
        for n, ch in choices.items():
            d = {k: v for k, v in ch["discovery"].items() if k not in ("k_emb", "k_fp")}
            base = {"emb": "e5s-notitle", "a": 0.4, "b": 0.42, "c": 0.18, "text": True, "prior": [0.1, 0.1],
                    "prior_mode": "add", "gate_k": 30, "neg": 0.0, "neg_pos": False, "facet": 0.0,
                    "facet_source": "auto", "avoid": 0.0}
            diff = {k: v for k, v in d.items() if (list(v) if isinstance(v, tuple) else v) != base.get(k)}
            lines.append(f"| {n} | `{diff}` | `{ch['blend']}` |")
        lines.append("")

    for split in ("dev", "holdout"):
        lines += [f"## {split}: anchors", "",
                  "Anchor metrics exclude title_lookup queries. `title@1`: title_lookup queries with the expected title at rank 1.", ""]
        head = "| ranker | queries | anchor10 | anchor50 | avoid5 | title@1 |"
        sep = "|---|---|---|---|---|---|"
        if grades:
            head += " ndcg10 | good10 | bad5 | unj10 |"
            sep += "---|---|---|---|"
        lines += [head, sep]
        for n in names:
            s = A.summarize(ctxs, lists[n], split, ("title_lookup",))
            ok, tn = title_guardrail(ctxs, lists[n], split)
            row = f"| {n} | {s['n']} | {fmt(s['anchor10'])} | {fmt(s['anchor50'])} | {s['avoid5']} | {ok}/{tn} |"
            if grades:
                ms = [graded_query([x["id"] for x in lists[n][c.id]], grades[c.id]) for c in ctxs
                      if c.split == split and c.type != "title_lookup" and c.id in grades]
                if ms:
                    row += (f" {fmt(sum(m['ndcg10'] for m in ms) / len(ms))} | {fmt(sum(m['good10'] for m in ms) / len(ms), 2)} |"
                            f" {sum(m['bad5'] for m in ms)} | {sum(m['unj10'] for m in ms)} |")
                else:
                    row += " – | – | – | – |"
            lines.append(row)
        lines.append("")

        # Per query type: anchor10 / anchor50 per ranker.
        types = sorted({c.type for c in ctxs if c.split == split and c.type != "title_lookup"})
        lines += [f"### {split}: anchor10 / anchor50 by query type", "",
                  "| type (queries) | " + " | ".join(names) + " |", "|---|" + "---|" * len(names)]
        for t in types:
            tc = [c for c in ctxs if c.split == split and c.type == t]
            cells = []
            for n in names:
                s = A.summarize(tc, lists[n])
                cells.append(f"{fmt(s['anchor10'], 2)} / {fmt(s['anchor50'], 2)}")
            lines.append(f"| {t} ({len(tc)}) | " + " | ".join(cells) + " |")
        lines.append("")

    # Graded dev detail: ndcg10 by query type (top 4 rankers by dev ndcg10, plus prod) and per query.
    if grades:
        dev = [c for c in ctxs if c.split == "dev" and c.type != "title_lookup" and c.id in grades]
        per_q = {n: {c.id: graded_query([x["id"] for x in lists[n][c.id]], grades[c.id])["ndcg10"] for c in dev}
                 for n in names}
        mean = lambda n, cs: sum(per_q[n][c.id] for c in cs) / len(cs)
        ranked = sorted((n for n in names if n not in ("prod", "prod-replay")), key=lambda n: -mean(n, dev))
        cols = ranked[:4] + [n for n in ("prod",) if n in names]
        lines += ["## dev: ndcg10 by query type", "",
                  f"Top 4 rankers by dev ndcg10, plus prod. Graded dev queries: {len(dev)}.", "",
                  "| type (queries) | " + " | ".join(cols) + " |", "|---|" + "---|" * len(cols)]
        for t in sorted({c.type for c in dev}):
            tc = [c for c in dev if c.type == t]
            lines.append(f"| {t} ({len(tc)}) | " + " | ".join(fmt(mean(n, tc)) for n in cols) + " |")
        lines.append(f"| all ({len(dev)}) | " + " | ".join(fmt(mean(n, dev)) for n in cols) + " |")
        lines.append("")
        best = ranked[0]
        lines += [f"## dev: ndcg10 per query ({best} vs prod, sorted by difference)", "",
                  f"| query | type | {best} | prod | diff |", "|---|---|---|---|---|"]
        for c in sorted(dev, key=lambda c: per_q[best][c.id] - per_q["prod"][c.id]):
            b, p = per_q[best][c.id], per_q["prod"][c.id]
            lines.append(f"| {c.id} {c.query[:60]} | {c.type} | {fmt(b)} | {fmt(p)} | {b - p:+.3f} |")
        lines.append("")

        lines += [f"## dev: grade-0 titles in the top 5 of {best}", "",
                  "| query | rank | title | year |", "|---|---|---|---|"]
        for c in dev:
            for i, x in enumerate(lists[best][c.id][:5]):
                if grades[c.id].get(x["id"]) == 0:
                    lines.append(f"| {c.id} {c.query[:50]} | {i + 1} | {x['title']} | {x['year']} |")
        lines.append("")

    # Per query anchor10 (dev) for quick diagnosis.
    lines += ["## Per query anchor hits in the top 10 / top 50 (all splits)", "",
              "| query | split | type | " + " | ".join(names) + " |", "|---|---|---|" + "---|" * len(names)]
    for c in ctxs:
        if c.type == "title_lookup" or not c.anchors.get("must"):
            continue
        cells = []
        for n in names:
            m = A.query_anchor_metrics(c, [x["id"] for x in lists[n][c.id]])
            k = m["must"]
            cells.append(f"{round(m['anchor10'] * k)}/{round(m['anchor50'] * k)}")
        lines.append(f"| {c.id} {c.query[:40]} | {c.split} | {c.type} | " + " | ".join(cells) + f" |")
    lines.append("")

    # Compute and latency.
    lines += ["## Offline compute and estimated production latency", "",
              "Offline ms: this machine, numpy over the full 191k catalog, query embedding cached (informative only).",
              "Added p50: estimated app-server stage time on top of the Jev reading, text pool and embedding path run in parallel; prod ≈ 235 ms.",
              "", "| ranker | offline mean ms | offline p95 ms | stages | est. p50 after reading (ms) | vs prod |", "|---|---|---|---|---|---|"]

    def est(n):
        st = stages.get(n, [])
        ms = {k: STAGE_MS[k] for k in st}
        if "qemb" in ms:
            ms["qemb"] = QEMB_MS.get(n, STAGE_MS["qemb"])
        emb_path = ms.get("spell", 0) + ms.get("qemb", 0) + ms.get("qdrant_emb", 0) + ms.get("qemb_extra", 0) + ms.get("qdrant_batch", 0)
        text_path = max(ms.get("crate_text", 0) + ms.get("qdrant_fp2000", 0), ms.get("qdrant_sparse", 0))
        return max(emb_path, text_path) + ms.get("fp_full", 0) + ms.get("fp_payload", 0) + ms.get("fuzzy_title", 0)

    base = est("prod")
    for n in names:
        t = timings.get(n, {})
        e = est(n)
        lines.append(f"| {n} | {fmt(t.get('mean_ms'), 1)} | {fmt(t.get('p95_ms'), 1)} | {', '.join(stages.get(n, []))} | {e} | {e - base:+d} |")
    lines.append("")
    path = os.path.join(out_dir, "metrics.md")
    open(path, "w").write("\n".join(lines))
    print("\n".join(lines[:60]))
    print("wrote", path)


if __name__ == "__main__":
    main(*(sys.argv[1:] or []))
