"""Round-3 blend: title-strict (blend2) with a title-word bonus by query kind.

Strict matching stays for mood and adjective queries. A partial title match keeps (part of) its lexical score
when a query word it matched is one Jev marks concrete (`concreteWords[].isConcrete`), or when the query names
a creator (all its content words are tokens of one director / show creator name in data/people.jsonl.gz with
2+ eligible titles). `cap` limits that kept score (None: production's lexical score).
"""
import gzip, json, os

import numpy as np

import blend as B
import blend2 as B2
import catalog as C
import context as X
import sparse as S

_creators = {}


def creator_tokens():
    """Name token -> count of eligible titles by creators with that token (creators with 2+ titles)."""
    if "t" not in _creators:
        per = {}
        p = os.path.join(C.DATA, "people.jsonl.gz")
        with gzip.open(p, "rt", encoding="utf-8") as f:
            for line in f:
                for n in json.loads(line)["creators"]:
                    per[n] = per.get(n, 0) + 1
        names = {}
        for n, c in per.items():
            if c < 2:
                continue
            names[n] = set(B.words(n))
        _creators["t"] = names
    return _creators["t"]


def names_creator(query):
    ws = [w for w in B.words(query) if w not in S.STOP]
    if not ws or len(ws) > 3 or max(len(w) for w in ws) < 4:
        return None
    for n, toks in creator_tokens().items():
        if all(w in toks for w in ws):
            return n
    return None


def blend(ctx, discovery, strict=0.9, fuzzy=0.88, kind=True, cap=None, limit=100):
    cat = C.load()
    names = X.outside_names()
    query = ctx.query
    concrete = {w["word"].lower() for w in (ctx.reading.get("concreteWords") or []) if w.get("isConcrete")}
    creator = names_creator(query) if kind else None
    rows = {}

    def lexical(title, original):
        lex, match = B.title_match(title, query)
        src = title
        o_lex, o_match = B.title_match(original or "", query)
        if o_lex > lex:
            lex, match, src = o_lex, f"{o_match} (original name)", original
        if lex and lex < 2 and strict:
            sim = max(B2.title_similarity(title, query), B2.title_similarity(original or "", query))
            if sim < strict:
                matched = set(B.words(query)) & set(B.words(src))
                if kind and (creator or (matched & concrete)):
                    return (min(lex, cap) if cap else lex), match + " (kind)"
                return 0.0, "Catalog suggestion"
        return lex, match

    for t in ctx.title_lookup:
        if t.get("type") not in ("movie", "tv"):
            continue
        pid = C.point_id(t["type"], t["id"])
        lex, match = lexical(t["title"], t.get("original"))
        rows[pid] = dict(id=pid, title=t["title"], media_type="show" if t["type"] == "tv" else "movie",
                         year=str(t.get("year") or ""), popularity=float(t.get("popularity") or 0), lexical=lex,
                         match=match, rank=None)
    if fuzzy:
        r = B2.fuzzy_hit(query, ctx.mask, fuzzy)
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
