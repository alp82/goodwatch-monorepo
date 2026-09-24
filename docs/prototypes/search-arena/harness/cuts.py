"""Round 6: alternate cuts of one film (Redux, Extended, Director's Cut, "The Whole Bloody Affair", ...).

`edges()` -> {point id: set of point ids} over eligible catalog titles. Two titles are cuts of each other when
- one title is the other plus a cut suffix ("Apocalypse Now Redux", "The Hateful Eight - Extended Version",
  "Blade Runner: The Final Cut", "Caligula: The Ultimate Cut"), or a director's possessive prefix ("Zack Snyder's
  Justice League"), and the two share a director (or either has no director credits), or
- the suffix-stripped base is the other title minus a part marker ("Kill Bill: The Whole Bloody Affair" and
  "Kill Bill: Vol. 1" / "Vol. 2"), with a shared director. The parts themselves are not cuts of each other: the
  relation is pairwise, not a partition, or
- the titles normalize to the same text (after stripping cut suffixes), their years differ by at most 1 and they
  share a director, or exactly one of them has no director credits (duplicate entries of one release, e.g. a
  sparse "Reservoir Dogs" 1991 record next to the 1992 film).

`fold(ids)` keeps the first title of every set of cuts in a ranked list (a title is dropped when it is a cut of a
title already kept). `second_cuts(ids, k)` returns the positions in the top k that are a 2nd+ cut, which the round-6
metrics grade 0 (contract note, round 6).
"""
import gzip, json, os, re
from collections import defaultdict

import numpy as np

import blend as B
import catalog as C

_CUT = re.compile(
    r"(?:\s*[:\-–(]\s*|\s+)(?:the\s+)?(?:redux|extended(?:\s+(?:edition|cut|version))?|director'?s\s+cut|final\s+cut|"
    r"special\s+edition|uncut|whole\s+bloody\s+affair|ultimate\s+(?:cut|edition)|unrated(?:\s+(?:cut|edition|version))?|"
    r"theatrical\s+cut|encore\s+cut|re-?edit|recut|[a-z]+\s+[a-z]+'?s\s+cut|remastered|deluxe\s+edition|"
    r"memorial\s+edition)\s*\)?\s*$", re.IGNORECASE)
_PART = re.compile(r"^(?:vol(?:ume)?|part|chapter)\s+(?:\d+|i{1,3}|iv|one|two)$")
_state = {}


def base(title):
    """Normalized title without a trailing cut suffix (None when there is no suffix)."""
    t = (title or "").strip()
    m = _CUT.search(t)
    if not m or m.start() == 0:
        return None
    return B.normalized(t[: m.start()])


def _directors():
    if "dirs" not in _state:
        d = {}
        with gzip.open(os.path.join(C.DATA, "credits.jsonl.gz"), "rt", encoding="utf-8") as f:
            for line in f:
                t = json.loads(line)
                d[t["id"]] = ({x["id"] for x in t["directors"]}, [x["name"] for x in t["directors"]])
        _state["dirs"] = d
    return _state["dirs"]


def edges():
    if "edges" in _state:
        return _state["edges"]
    cat = C.load()
    dirs = _directors()
    rows = np.flatnonzero(cat.eligible())
    by_norm = defaultdict(list)
    for r in rows:
        by_norm[B.normalized(cat.title[r])].append(int(r))
    out = defaultdict(set)

    def share(r1, r2):
        a, b = dirs.get(int(cat.ids[r1]), (set(), []))[0], dirs.get(int(cat.ids[r2]), (set(), []))[0]
        return not a or not b or bool(a & b)

    def link(r1, r2):
        if r1 != r2:
            p1, p2 = int(cat.ids[r1]), int(cat.ids[r2])
            out[p1].add(p2)
            out[p2].add(p1)

    for r in rows:
        t = cat.title[r]
        bs = base(t)
        pid = int(cat.ids[r])
        names = dirs.get(pid, (set(), []))[1]
        # director's possessive prefix: "Zack Snyder's Justice League"
        n = B.normalized(t)
        for name in names:
            k = B.normalized(name)
            if k and n.startswith(k + " s "):
                bs = n[len(k) + 3:]
        if bs is None:
            continue
        for r2 in by_norm.get(bs, []):
            if share(r, r2):
                link(r, r2)
        # "Kill Bill: The Whole Bloody Affair" -> "Kill Bill: Vol. 1", "Kill Bill: Vol. 2"
        for r2 in rows_with_prefix(bs, by_norm):
            if share(r, r2) and dirs.get(int(cat.ids[r2]), (set(), []))[0]:
                link(r, r2)
    # duplicates: same normalized text (cut suffix stripped), years within 1, a shared director
    groups = defaultdict(list)
    for r in rows:
        groups[base(cat.title[r]) or B.normalized(cat.title[r])].append(int(r))
    for key, rs in groups.items():
        if len(rs) < 2:
            continue
        for i, r1 in enumerate(rs):
            for r2 in rs[i + 1:]:
                y1, y2 = int(cat.year[r1]), int(cat.year[r2])
                d1 = dirs.get(int(cat.ids[r1]), (set(), []))[0]
                d2 = dirs.get(int(cat.ids[r2]), (set(), []))[0]
                # a shared director, or one entry without director credits (a sparse duplicate record)
                if y1 and y2 and abs(y1 - y2) <= 1 and (d1 & d2 or (bool(d1) != bool(d2))):
                    link(r1, r2)
    _state["edges"] = dict(out)
    return _state["edges"]


def rows_with_prefix(bs, by_norm):
    if "prefix" not in _state:
        idx = defaultdict(list)
        for n, rs in by_norm.items():
            ws = n.split()
            for k in range(1, len(ws)):
                rest = " ".join(ws[k:])
                if _PART.match(rest):
                    idx[" ".join(ws[:k])].extend(rs)
        _state["prefix"] = idx
    return _state["prefix"].get(bs, [])


def fold(ids):
    """Keep the first title of every set of cuts (ids in rank order)."""
    e = edges()
    kept, out = set(), []
    for pid in ids:
        if e.get(pid, set()) & kept:
            continue
        kept.add(pid)
        out.append(pid)
    return out


def second_cuts(ids, k=10):
    """Positions (0-based) in the first k whose title is a cut of a title ranked above it."""
    e = edges()
    seen, pos = set(), []
    for i, pid in enumerate(ids[:k]):
        if e.get(pid, set()) & seen:
            pos.append(i)
        seen.add(pid)
    return pos


if __name__ == "__main__":
    cat = C.load()
    e = edges()
    done = set()
    for p, qs in sorted(e.items()):
        if p in done:
            continue
        grp = {p} | qs
        done |= grp
        print(" | ".join(f"{cat.title[cat.row_of[x]]} ({cat.year[cat.row_of[x]]})" for x in sorted(grp)))
    print(len(done), "titles in", sum(1 for _ in done), "linked")
