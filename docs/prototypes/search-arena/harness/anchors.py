"""Anchor metrics shared by run.py (dev sweeps) and metrics.py."""
import catalog as C


def anchor_ids(anchors, kind):
    return [C.point_id(a["media_type"], a["tmdb_id"]) for a in anchors.get(kind, [])]


def query_anchor_metrics(ctx, ranked_ids):
    """ranked_ids: blended list of point ids. Returns dict or None fields when there are no anchors."""
    must, avoid = anchor_ids(ctx.anchors, "must"), anchor_ids(ctx.anchors, "avoid")
    pos = {pid: i for i, pid in enumerate(ranked_ids)}
    out = {"must": len(must), "avoid": len(avoid)}
    if must:
        out["anchor10"] = sum(1 for m in must if pos.get(m, 999) < 10) / len(must)
        out["anchor50"] = sum(1 for m in must if pos.get(m, 999) < 50) / len(must)
    out["avoid5"] = sum(1 for a in avoid if pos.get(a, 999) < 5)
    return out


def summarize(ctxs, lists, split=None, exclude_types=()):
    """Macro anchor10/anchor50 over queries with anchors, total avoid5."""
    a10, a50, av, n = [], [], 0, 0
    for ctx in ctxs:
        if split and ctx.split != split or ctx.type in exclude_types or ctx.id not in lists:
            continue
        m = query_anchor_metrics(ctx, [x["id"] for x in lists[ctx.id]])
        n += 1
        av += m["avoid5"]
        if m["must"]:
            a10.append(m["anchor10"])
            a50.append(m["anchor50"])
    mean = lambda xs: sum(xs) / len(xs) if xs else float("nan")
    return {"n": n, "n_anchor": len(a10), "anchor10": mean(a10), "anchor50": mean(a50), "avoid5": av}
