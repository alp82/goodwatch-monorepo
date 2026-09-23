"""Port of `blend()` in goodwatch-webapp/app/ui/search/search-model.tsx (policy "balanced"),
plus the imdb-id dedup that combinedSearch applies after it.

Every ranker's discovery list goes through this with the captured TMDB title lookup, so the
title_lookup guardrail is comparable across rankers.
"""
import re

import catalog as C
import context as X

_WORD = re.compile(r"[^\W_]+", re.UNICODE)


def words(s):
    return _WORD.findall((s or "").lower())


def normalized(s):
    return " ".join(words(s))


def title_match(title, query):
    name, request = normalized(title), normalized(query)
    if not name or not request:
        return 0.0, ""
    if name == request:
        return 2.0, "Exact title"
    target, wanted = words(title), words(query)
    uniq = set(wanted)
    hits = sum(1 for w in uniq if w in target)
    coverage = hits / len(uniq)
    if f" {request} " in f" {name} ":
        return 1.05, "Exact phrase in title"
    if coverage == 1:
        return 0.9, "All search words in title"
    if hits:
        return 0.65 * coverage, "Words in title"
    if wanted and len(wanted[-1]) >= 2 and any(w.startswith(wanted[-1]) for w in target):
        return 0.15, "Partial word in title"
    return 0.0, "Catalog suggestion"


def blend(title_lookup, discovery, query, limit=100):
    """title_lookup: captured eligible TMDB rows. discovery: [(point_id, rank, score)] ranked 1..n.

    Returns [{id, title, year, media_type, score, source}] sorted like production.
    """
    cat = C.load()
    names = X.outside_names()
    rows = {}
    for t in title_lookup:
        if t.get("type") not in ("movie", "tv"):
            continue
        pid = C.point_id(t["type"], t["id"])
        lex, match = title_match(t["title"], query)
        rows[pid] = dict(id=pid, title=t["title"], original=t.get("original"), media_type="show" if t["type"] == "tv" else "movie",
                         year=str(t.get("year") or ""), popularity=float(t.get("popularity") or 0), lexical=lex, match=match,
                         rank=None, dscore=None)
    for pid, rank, score in discovery:
        row = rows.get(pid)
        if row is None:
            r = cat.row_of.get(pid)
            if r is not None:
                title, year, mt = cat.title[r], str(cat.year[r] or ""), cat.media_type(r)
            else:
                title, year, mt = names.get(pid, (str(pid), "", "show" if pid >= 2_000_000_000_000 else "movie"))
            lex, match = title_match(title, query)
            row = dict(id=pid, title=title, original=None, media_type=mt, year=str(year or ""), popularity=0.0,
                       lexical=lex, match=match, rank=None, dscore=None)
            rows[pid] = row
        row["rank"], row["dscore"] = rank, score
    for row in rows.values():
        o_lex, o_match = title_match(row["original"] or "", query)
        if o_lex > row["lexical"]:
            row["lexical"], row["match"] = o_lex, f"{o_match} (original name)"
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
