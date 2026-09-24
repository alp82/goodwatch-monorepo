"""Title-strict blend (round 2): the production blend, but a lexical title bonus only for near-full title
matches, plus fuzzy matching of the query against eligible catalog titles for typos.

- strict: a title keeps its lexical score only when the normalized similarity between the whole query and
  the title (or the part before ":" / " - ", or the original name) is >= `strict` (rapidfuzz ratio / 100).
  "funny" no longer lifts "Funny Games"; "code geass" still matches "Code Geass: Lelouch of the Rebellion".
- fuzzy: short queries (<= 4 words, >= 5 letters) with at least one word outside the catalog vocabulary are matched against every eligible catalog title with
  rapidfuzz ratio; the best match >= `fuzzy` (ties by votes), when it isn't an exact hit, is added as a title
  hit with lexical 1.05 ("Fuzzy title"), i.e. above discovery rows.
"""
import re
import time

import numpy as np
from rapidfuzz import fuzz, process

import blend as B
import catalog as C
import context as X

_SPLIT = re.compile(r"\s*(?::| - | – )\s*")
_index = {}


def title_similarity(title, query):
    q = B.normalized(query)
    if not q or not title:
        return 0.0
    heads = {B.normalized(title), B.normalized(_SPLIT.split(title)[0])}
    return max(fuzz.ratio(h, q) for h in heads if h) / 100


def eligible_titles():
    """Normalized titles (and original titles) of eligible catalog rows: (strings, rows)."""
    if "t" not in _index:
        cat = C.load()
        rows = np.flatnonzero(cat.eligible())
        names, owners = [], []
        for r in rows:
            for t in {cat.title[r], cat.original_title[r]}:
                n = B.normalized(t)
                if n:
                    names.append(n)
                    owners.append(r)
        _index["t"] = (names, np.array(owners))
    return _index["t"]


FUZZY_MS = []


def vocabulary():
    """Words of eligible titles, essence texts, tags and keywords. A query word outside it is a likely typo."""
    if "v" not in _index:
        cat = C.load()
        v = set()
        for r in np.flatnonzero(cat.eligible()):
            for s in (cat.title[r], cat.original_title[r], cat.essence_text[r], " ".join(cat.essence_tags[r]),
                      " ".join(cat.keywords[r])):
                v.update(B.words(s))
        _index["v"] = v
    return _index["v"]


def fuzzy_hit(query, mask, cutoff):
    q = B.normalized(query)
    if len(q.split()) > 4 or len(q.replace(" ", "")) < 5:
        return None
    vocab = vocabulary()
    if all(w in vocab for w in q.split()):
        return None  # every word is a known word: not a typo
    names, owners = eligible_titles()
    t = time.perf_counter()
    hits = process.extract(q, names, scorer=fuzz.ratio, score_cutoff=cutoff * 100, limit=20)
    FUZZY_MS.append((time.perf_counter() - t) * 1000)
    cat = C.load()
    best = None
    for name, score, i in hits:
        r = owners[i]
        if not mask[r]:
            continue
        if score >= 100:
            return None  # an exact title exists: the TMDB lookup already handles it
        key = (score, cat.votes[r])
        if best is None or key > best[0]:
            best = (key, r)
    return None if best is None else int(best[1])


def blend(title_lookup, discovery, query, strict=0.9, fuzzy=0.88, mask=None, limit=100):
    cat = C.load()
    names = X.outside_names()
    rows = {}

    def lexical(title, original):
        lex, match = B.title_match(title, query)
        o_lex, o_match = B.title_match(original or "", query)
        if o_lex > lex:
            lex, match = o_lex, f"{o_match} (original name)"
        if lex and lex < 2 and strict:
            sim = max(title_similarity(title, query), title_similarity(original or "", query))
            if sim < strict:
                return 0.0, "Catalog suggestion"
        return lex, match

    for t in title_lookup:
        if t.get("type") not in ("movie", "tv"):
            continue
        pid = C.point_id(t["type"], t["id"])
        lex, match = lexical(t["title"], t.get("original"))
        rows[pid] = dict(id=pid, title=t["title"], media_type="show" if t["type"] == "tv" else "movie",
                         year=str(t.get("year") or ""), popularity=float(t.get("popularity") or 0), lexical=lex,
                         match=match, rank=None)
    if fuzzy and mask is not None:
        r = fuzzy_hit(query, mask, fuzzy)
        if r is not None:
            pid = int(cat.ids[r])
            if pid not in rows or rows[pid]["lexical"] < 1.05:
                rows[pid] = dict(id=pid, title=cat.title[r], media_type=cat.media_type(r), year=str(cat.year[r] or ""),
                                 popularity=float(cat.popularity[r]), lexical=1.05, match="Fuzzy title", rank=None)
    for pid, rank, score in discovery:
        row = rows.get(pid)
        if row is None:
            r = cat.row_of.get(pid)
            if r is not None:
                title, orig, year, mt = cat.title[r], cat.original_title[r], str(cat.year[r] or ""), cat.media_type(r)
            else:
                (title, year, mt), orig = names.get(pid, (str(pid), "", "show" if pid >= 2_000_000_000_000 else "movie")), None
            lex, match = lexical(title, orig)
            row = dict(id=pid, title=title, media_type=mt, year=str(year or ""), popularity=0.0, lexical=lex,
                       match=match, rank=None)
            rows[pid] = row
        row["rank"] = rank
    for row in rows.values():
        fingerprint = 10 / (9 + row["rank"]) if row["rank"] else 0
        lex = row["lexical"]
        row["score"] = 3 + 0.1 * fingerprint if lex == 2 else max(lex * 1.0, fingerprint * 0.9) + min(lex, fingerprint) * 0.15
        row["source"] = "title" if row["rank"] is None else "discovery"
    key = lambda r: f"{r['media_type']}:{r['id'] % 1_000_000_000_000}"
    ordered = sorted(rows.values(), key=lambda r: (-r["score"], -r["popularity"], key(r)))[:limit]
    out, seen = [], set()
    for row in ordered:
        r = cat.row_of.get(row["id"])
        imdb = cat.imdb_id[r] if r is not None else None
        ident = f"imdb:{imdb}" if imdb else key(row)
        if ident in seen:
            continue
        seen.add(ident)
        out.append(dict(id=row["id"], title=row["title"], year=row["year"], media_type=row["media_type"],
                        score=round(row["score"], 4), source=row["source"]))
    return out
