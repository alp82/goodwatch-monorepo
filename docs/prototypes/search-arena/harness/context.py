"""Per-query context: the captured Jev reading, text pool, title lookup and production list.

`contexts()` returns one QueryCtx per query in queries.json, in file order.
"""
import json, os
from dataclasses import dataclass, field

import numpy as np

import catalog as C

QUERIES = os.path.join(C.ARENA, "queries.json")
CAPTURES = os.path.join(C.DATA, "captures")

# Mirrors of d4.server.ts: TEXT_EVIDENCE_WEIGHT, TEXT_EVIDENCE_CAP.
TEXT_EVIDENCE_WEIGHT = 0.5
TEXT_EVIDENCE_CAP = 4
MEDIA_FLAGS = {"movie": "movie", "show": "show"}


@dataclass
class QueryCtx:
    id: str
    query: str               # what the person typed
    text: str                # language.text: the text production read (same as query today)
    type: str
    split: str
    intent: str
    anchors: dict
    non_english: bool        # language.detectedNonEnglish: production ran native vector-only
    path: str                # "phrase" or "vector-only"
    weights: dict            # used fingerprint dimensions: key -> weight (2 * (want - avoid))
    want: np.ndarray         # (74,) Jev want probabilities
    avoid: np.ndarray        # (74,) Jev avoid probabilities
    flags: list              # [(flag id, "required" | "excluded", kind)]
    text_pool: dict          # point id -> summed text evidence (production's `text`, before cap)
    text_fp: dict            # point id -> {dim: score} for pool rows (Crate fingerprint_scores, used dims)
    title_lookup: list       # eligible TMDB title-lookup rows, as captured
    prod: list               # production blended list, as captured
    mask: np.ndarray = field(default=None, repr=False)  # eligible catalog rows after hard filters
    reading: dict = field(default=None, repr=False)  # the captured Jev reading (phrases, concrete words, ...)

    @property
    def wvec(self):
        v = np.zeros(74, np.float32)
        for k, w in self.weights.items():
            v[C.DIM_INDEX[k]] = w
        return v


def hard_filter(cat, flags, lesser_known=False):
    """Production's qdrantFilter over the local catalog.

    Vote floor (unless lesser_known), adult (absent from the snapshot), and every flag decision except
    excluded audience/context flags. Required audience/context flags DO filter in production.
    """
    m = cat.eligible(lesser_known).copy()
    for fid, decision, kind in flags:
        wanted = decision == "required"
        soft = fid.startswith("suitability_") or fid.startswith("context_")
        if not wanted and soft:
            continue
        if fid in MEDIA_FLAGS:
            has = cat.is_show if fid == "show" else ~cat.is_show
        elif fid == "animated":
            has = np.array([p == "Animation" for p in cat.production_method])
        elif fid == "live_action":
            has = np.array([p == "Live-Action" for p in cat.production_method])
        else:
            has = cat.flags[fid] == 1
        m &= has if wanted else ~has
    return m


def text_evidence(raw):
    """Production's evidence term: 0.5 * min(text, 4)."""
    return TEXT_EVIDENCE_WEIGHT * min(raw, TEXT_EVIDENCE_CAP)


def load_query(q, cat):
    cap = json.load(open(os.path.join(CAPTURES, f"{q['id']}.json")))
    r = cap["reading"]
    dims = r["dimensions"]
    flags = [(f["id"], f["decision"], f["kind"]) for f in r["flags"] if f["decision"]]
    pool, pool_fp = {}, {}
    if cap.get("textPool"):
        for row in cap["textPool"]["candidates"]:
            pid = C.point_id(row["media_type"], row["tmdb_id"])
            pool[pid] = float(row["text"] or 0)
            pool_fp[pid] = row.get("fp") or {}
    ctx = QueryCtx(
        id=q["id"], query=q["query"], text=cap["language"]["text"], type=q["type"], split=q["split"],
        intent=q.get("intent", ""), anchors=q["anchors"], non_english=bool(cap["language"]["detectedNonEnglish"]),
        path=cap["path"], weights=dict(dims["weights"]),
        want=np.array([dims["want"][k] for k in C.DIMS], np.float32),
        avoid=np.array([dims["avoid"][k] for k in C.DIMS], np.float32),
        flags=flags, text_pool=pool, text_fp=pool_fp,
        title_lookup=[t for t in (cap.get("titleLookup") or []) if t.get("eligible")],
        prod=cap["prod"], reading=r,
    )
    ctx.mask = hard_filter(cat, flags)
    return ctx


def queries():
    return json.load(open(QUERIES))


def contexts(ids=None):
    cat = C.load()
    return [load_query(q, cat) for q in queries() if ids is None or q["id"] in ids]


# Titles for point ids outside the catalog snapshot (TMDB lookups, Crate-only text rows).
_names = None


def outside_names():
    global _names
    if _names is None:
        _names = {}
        for q in queries():
            cap = json.load(open(os.path.join(CAPTURES, f"{q['id']}.json")))
            for p in cap["prod"]:
                _names[p["point_id"]] = (p["title"], p["year"], p["media_type"])
            for t in cap.get("titleLookup") or []:
                if t.get("type") in ("movie", "tv"):
                    _names.setdefault(C.point_id(t["type"], t["id"]), (t["title"], t.get("year"), "show" if t["type"] == "tv" else "movie"))
    return _names
