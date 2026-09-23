"""Search arena playground: type any query, compare production with the round-4 finalists side by side.

    .venv/bin/python playground/serve.py [--port 8765]

POST /search {"q": "..."} -> production list (from the capture), r6 (run6.FINAL: r5 with style neighbours for person /
studio style queries and alternate cuts folded), r5 (run5.FINAL: r4-combo-fast plus person and studio boosts),
r4-combo-fast and r4-combo (run4.FINAL), top 20 each, with the Jev reading chips, timings and per-title score components.

Captures: a query from queries.json (matched by normalized text) uses data/captures/<id>.json. Any other query
uses data/captures/adhoc/<hash>.json, and on a miss runs goodwatch-webapp/scripts/arena-capture.ts --adhoc once
(read-only against production; a fresh Jev reading costs about $0.0003 and is then cached in that file).
New query embeddings go to playground/cache/, never to data/query-emb-*.json.
"""
import hashlib, json, os, re, subprocess, sys, threading, time, unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ARENA, "harness"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import numpy as np  # noqa: E402

import blend as B  # noqa: E402
import blend2 as B2  # noqa: E402
import blend3 as B3  # noqa: E402
import catalog as C  # noqa: E402
import context as X  # noqa: E402
import metrics as M  # noqa: E402
import qemb  # noqa: E402
import entities as ENT  # noqa: E402
import rankers4 as R4  # noqa: E402
import rankers5 as R5  # noqa: E402
import rankers6 as R6  # noqa: E402
import cuts  # noqa: E402
import run4  # noqa: E402
import run5  # noqa: E402
import run6  # noqa: E402

WEBAPP = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(ARENA))), "goodwatch-webapp")
ADHOC = os.path.join(X.CAPTURES, "adhoc")
CACHE = os.path.join(HERE, "cache")
TOP = 20
RANKERS = ["r6", "r5", "r4-combo-fast", "r4-combo"]
CAPTURE_TIMEOUT_S = 90


def normalized(q):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", q or "").strip().lower())


def qhash(q):
    return hashlib.sha1(normalized(q).encode()).hexdigest()[:16]


# --- query embeddings: read the harness caches, write new texts to playground/cache ------------

_emb_new, _emb_lock = {}, threading.Lock()


def _pg_path(hf):
    return os.path.join(CACHE, f"query-emb-{hf.split('/')[-1]}.json")


def embed(emb_name, text):
    _, hf, prefix = C.EMBEDDINGS[emb_name]
    if hf not in qemb._cache:
        p = qemb._path(hf)
        qemb._cache[hf] = json.load(open(p)) if os.path.exists(p) else {}
    if hf not in _emb_new:
        p = _pg_path(hf)
        _emb_new[hf] = json.load(open(p)) if os.path.exists(p) else {}
    v = qemb._cache[hf].get(text) or _emb_new[hf].get(text)
    if v is None:
        with _emb_lock:
            if hf not in qemb._models:
                from sentence_transformers import SentenceTransformer
                qemb._models[hf] = SentenceTransformer(hf, device="cpu")
            e = qemb._models[hf].encode([prefix + text], normalize_embeddings=True)[0]
            v = [round(float(x), 6) for x in e]
            _emb_new[hf][text] = v
            os.makedirs(CACHE, exist_ok=True)
            json.dump(_emb_new[hf], open(_pg_path(hf), "w"))
    return np.array(v, np.float32)


qemb.embed = embed  # rankers call qemb.embed at call time


# --- blend4.blend with the title-bonus fields kept (list order is identical) -------------------

def blend_debug(ctx, discovery, strict=0.9, fuzzy=0.88, kind=True, cap=None, kind_all=False, exclude=None, limit=100):
    cat = C.load()
    names = X.outside_names()
    query = ctx.query
    exclude = exclude or set()
    concrete = {w["word"].lower() for w in (ctx.reading.get("concreteWords") or []) if w.get("isConcrete")}
    creator = B3.names_creator(query) if kind else None
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
                ok = (matched >= concrete) if kind_all else bool(matched & concrete)
                if kind and (creator or (concrete and ok and matched & concrete)):
                    return (min(lex, cap) if cap else lex), match + " (kind)"
                return 0.0, "Catalog suggestion"
        return lex, match

    for t in ctx.title_lookup:
        if t.get("type") not in ("movie", "tv"):
            continue
        pid = C.point_id(t["type"], t["id"])
        if pid in exclude:
            continue
        lex, match = lexical(t["title"], t.get("original"))
        rows[pid] = dict(id=pid, title=t["title"], media_type="show" if t["type"] == "tv" else "movie",
                         year=str(t.get("year") or ""), popularity=float(t.get("popularity") or 0), lexical=lex,
                         match=match, rank=None)
    if fuzzy:
        r = B2.fuzzy_hit(query, ctx.mask, fuzzy)
        if r is not None and int(cat.ids[r]) not in exclude:
            pid = int(cat.ids[r])
            if pid not in rows or rows[pid]["lexical"] < 1.05:
                rows[pid] = dict(id=pid, title=cat.title[r], media_type=cat.media_type(r), year=str(cat.year[r] or ""),
                                 popularity=float(cat.popularity[r]), lexical=1.05, match="Fuzzy title", rank=None)
    for pid, rank, score in discovery:
        if pid in exclude:
            continue
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
                        score=round(row["score"], 4), source=row["source"], lexical=row["lexical"],
                        match=row["match"], disc_rank=row["rank"]))
    return out


# --- state loaded once -------------------------------------------------------------------------

class State:
    pass


S = State()


def _names_from(cap):
    for p in cap.get("prod") or []:
        X._names[p["point_id"]] = (p["title"], p["year"], p["media_type"])
    for t in cap.get("titleLookup") or []:
        if t.get("type") in ("movie", "tv"):
            X._names.setdefault(C.point_id(t["type"], t["id"]),
                                (t["title"], t.get("year"), "show" if t["type"] == "tv" else "movie"))


def startup():
    t0 = time.perf_counter()
    steps = {}

    def mark(name, t):
        steps[name] = round(time.perf_counter() - t, 2)
        print(f"  {name}: {steps[name]}s", flush=True)
        return time.perf_counter()

    t = time.perf_counter()
    S.cat = C.load()
    t = mark("catalog", t)
    for e in ("bgeb-notitle", "me5s"):
        C.embeddings(e)
    t = mark("embeddings", t)
    S.queries = X.queries()
    S.by_norm = {normalized(q["query"]): q for q in S.queries}
    S.grades = M.load_grades() or {}
    X.outside_names()
    if os.path.isdir(ADHOC):
        for f in os.listdir(ADHOC):
            if f.endswith(".json"):
                _names_from(json.load(open(os.path.join(ADHOC, f))))
    t = mark("queries, grades, names", t)
    from sentence_transformers import SentenceTransformer
    for e in ("bgeb-notitle", "me5s"):
        hf = C.EMBEDDINGS[e][1]
        qemb._models.setdefault(hf, SentenceTransformer(hf, device="cpu"))
    t = mark("query models", t)
    # Warm the sparse indexes (default and body-only weights), spell vocabulary and fuzzy-title index.
    warm = next(q for q in S.queries if q["split"] == "dev" and q["type"] != "title_lookup")
    rank(X.load_query(warm, S.cat), warm["id"])
    import sparse as SP
    SP.index(dict(R4.BODY))  # facet-coverage index (body fields only)
    R4._title_index(run4.FINAL["r4-combo-fast"][0].get("ref_votes", R4.DEFAULTS["ref_votes"]))
    R4._df()
    ENT.warm()
    R6.peer_index({**R6.DEFAULTS6, **run6.FINAL["r6"][0]}["emb"])
    cuts.edges()
    t = mark("sparse index + warm-up ranking", t)
    S.lock = threading.Lock()
    S.session_usd = 0.0
    S.session_new = 0
    S.startup_s = round(time.perf_counter() - t0, 1)
    S.steps = steps
    print(f"startup {S.startup_s}s", flush=True)


# --- capture -----------------------------------------------------------------------------------

def adhoc_usd_total():
    tot = 0.0
    if os.path.isdir(ADHOC):
        for f in os.listdir(ADHOC):
            if f.endswith(".json"):
                c = json.load(open(os.path.join(ADHOC, f)))
                if (c.get("reading") or {}).get("source") == "fresh":
                    tot += ((c["reading"].get("jev") or {}).get("usd") or 0)
    return tot


def get_capture(q):
    """-> (capture dict, ctx query dict, capture info)."""
    known = S.by_norm.get(normalized(q))
    if known:
        path = os.path.join(X.CAPTURES, f"{known['id']}.json")
        return json.load(open(path)), dict(known), dict(kind="arena", id=known["id"], fresh=False, ms=0)
    h = qhash(q)
    path = os.path.join(ADHOC, f"{h}.json")
    qd = dict(id=f"adhoc/{h}", query=q.strip(), type="adhoc", split="adhoc", intent="", anchors={})
    if os.path.exists(path):
        cap = json.load(open(path))
        qd["query"] = cap["query"]
        return cap, qd, dict(kind="adhoc", id=h, fresh=False, ms=0)
    os.makedirs(ADHOC, exist_ok=True)
    t = time.perf_counter()
    cmd = [os.path.join(WEBAPP, "node_modules", ".bin", "vite-node"), "--config", "scripts/arena-vite.config.mjs",
           "scripts/arena-capture.ts", "--adhoc", q.strip(), "--out", path]
    p = subprocess.run(cmd, cwd=WEBAPP, env={**os.environ, "ARENA_CAPTURE_FETCH": "1"}, capture_output=True,
                       text=True, timeout=CAPTURE_TIMEOUT_S)
    ms = round((time.perf_counter() - t) * 1000)
    if not os.path.exists(path):
        raise RuntimeError(f"capture failed (exit {p.returncode}): {(p.stderr or p.stdout)[-1500:]}")
    cap = json.load(open(path))
    _names_from(cap)
    usd = 0.0
    for line in p.stdout.splitlines():
        if line.startswith("{") and "jevUsdThisRun" in line:
            usd = json.loads(line)["jevUsdThisRun"]
    S.session_usd += usd
    S.session_new += 1
    return cap, qd, dict(kind="adhoc", id=h, fresh=True, ms=ms, usd=usd, log=p.stdout.strip().splitlines()[-3:])


# --- ranking -----------------------------------------------------------------------------------

COMP_LABELS = {"dense": "emb", "fp": "fp", "text": "sparse/text", "facet": "facet", "cov": "coverage",
               "agree": "ref agree / style agree", "prior": "prior", "entity": "person/studio boost", "neg": "negation",
               "style_fp": "style fp centroid", "style_emb": "style emb centroid", "style_terms": "style term profile",
               "mention": "name mention", "peer": "similar people"}


def rank(ctx, qid):
    out = {}
    for name in RANKERS:
        info = {}
        t = time.perf_counter()
        if name == "r6":
            kw, bk = run6.FINAL[name]
            disc = R6.hyb6(ctx, debug=info, **kw)
            bk = {**bk, **(dict(kind=False) if info.get("entity") else {})}  # as run6.run
        elif name == "r5":
            kw, bk = run5.FINAL[name]
            disc = R5.hyb5(ctx, debug=info, **kw)
            bk = {**bk, **(dict(kind=False) if info.get("entity") else {})}  # as run5.run
        else:
            kw, bk = run4.FINAL[name]
            disc = R4.hyb4(ctx, debug=info, **kw)
            bk = {**run4.STRICT, **bk}
        blended = blend_debug(ctx, [(pid, i + 1, s) for i, (pid, s, _) in enumerate(disc)],
                              exclude=info.get("exclude"), **bk)
        if name == "r6":  # alternate cuts folded and the own-title cap re-applied (run6.run)
            keep = set(cuts.fold([x["id"] for x in blended]))
            blended = [x for x in blended if x["id"] in keep]
            ent = info.get("entity")
            if ent and ent.get("intent") == "style" and ent.get("own_max") is not None:
                blended = run6.cap_own(blended, ent["own_ids"], ent["own_max"])
        ms = (time.perf_counter() - t) * 1000
        pos = {int(r): i for i, r in enumerate(info["cand"])}
        comp, total = info["comp"], info["score"]
        items = []
        for i, x in enumerate(blended[:TOP]):
            r = S.cat.row_of.get(x["id"])
            d = {}
            j = pos.get(r) if r is not None else None
            if j is not None:
                parts = {COMP_LABELS.get(k, k): round(float(v[j]), 3) for k, v in comp.items()}
                resid = float(total[j]) - sum(float(v[j]) for v in comp.values())
                ent = info.get("entity")
                if ent and ent["intent"] != "filmography":
                    resid = 0.0  # style / both: the discovery score is the capped order, not a sum
                if abs(resid) > 1e-3:
                    parts["era/neg"] = round(resid, 3)
                d = dict(parts=parts, disc_score=round(float(total[j]), 3))
            reasons = []
            if x["source"] == "title":
                reasons.append("title lookup only")
            if x["lexical"]:
                reasons.append(f"title bonus {x['lexical']:.2f}: {x['match']}")
            items.append(dict(**describe(x["id"], x), rank=i + 1, score=x["score"], source=x["source"],
                              disc_rank=x["disc_rank"], title_bonus=x["lexical"], match=x["match"], debug=d,
                              reasons=reasons, grade=grade(qid, x["id"])))
        ref = info.get("ref")
        excl = sorted(info.get("exclude") or [])
        out[name] = dict(
            items=items, ms=round(ms, 1),
            query_debug=dict(
                spell_fixes=info.get("fixes"), era=info.get("era"), non_english=bool(info.get("non_en")),
                coverage_units=info.get("units"), candidates=info.get("n_cand"),
                reference=dict(title=ref[0], span=ref[1], modifier=ref[2]) if ref else None,
                excluded=[f"{describe(p)['title']} ({describe(p)['year']})" for p in excl][:12],
                entity={k: v for k, v in info["entity"].items() if k != "own_ids"} if info.get("entity") else None,
            ),
        )
    return out


def describe(pid, fallback=None):
    r = S.cat.row_of.get(pid)
    if r is not None:
        return dict(id=pid, title=S.cat.title[r], year=str(S.cat.year[r] or ""), media_type=S.cat.media_type(r),
                    genres=S.cat.genres[r][:4], essence=S.cat.essence_text[r], tags=S.cat.essence_tags[r][:8],
                    tmdb_id=int(S.cat.tmdb_id[r]), votes=int(S.cat.votes[r]), in_catalog=True)
    fb = fallback or {}
    name = X._names.get(pid) if X._names else None
    return dict(id=pid, title=fb.get("title") or (name[0] if name else str(pid)),
                year=str(fb.get("year") or (name[1] if name else "") or ""),
                media_type=fb.get("media_type") or ("show" if pid >= 2_000_000_000_000 else "movie"),
                genres=[], essence="", tags=[], tmdb_id=pid % 1_000_000_000_000, votes=None, in_catalog=False)


def grade(qid, pid):
    return S.grades.get(qid, {}).get(pid)


def prod_items(cap, qid):
    out = []
    for p in cap["prod"][:TOP]:
        d = p.get("discovery") or {}
        reasons = [x["text"] for x in (p.get("reasons") or [])][:10]
        if p.get("evidence"):
            reasons.insert(0, "text evidence: " + ", ".join(p["evidence"][:4]))
        if p.get("lexical"):
            reasons.insert(0, f"title bonus {p['lexical']:.2f}: {p.get('match')}")
        out.append(dict(**describe(p["point_id"], p), rank=p["rank"], score=p["score"], source=p["source"],
                        disc_rank=d.get("rank"), title_bonus=p.get("lexical"), match=p.get("match"),
                        debug=dict(parts={k: d[k] for k in ("cosine", "weightedSum", "combined", "text") if d.get(k) is not None}),
                        reasons=reasons, grade=grade(qid, p["point_id"])))
    return out


def search(q):
    t0 = time.perf_counter()
    with S.lock:
        cap, qd, info = get_capture(q)
        capture_ms = round((time.perf_counter() - t0) * 1000)
        r = cap.get("reading") or {}
        base = dict(query=cap["query"], normalized=normalized(q), capture=dict(info, path=cap.get("path"),
                    reading_source=r.get("source"), reading_cache=r.get("cache"), errors=cap.get("errors"),
                    prod_total_ms=(cap.get("timings") or {}).get("totalMs"), captured_at=cap.get("capturedAt")),
                    arena=dict(id=qd["id"], split=qd["split"], type=qd["type"], intent=qd.get("intent"),
                               graded=qd["id"] in S.grades) if info["kind"] == "arena" else None,
                    chips=r.get("chips") or [], phrases=[p for p in (r.get("phrases") or []) if p["probability"] >= 0.1][:6],
                    concrete=[w["word"] for w in (r.get("concreteWords") or []) if w.get("isConcrete")],
                    flags=[f"{f['id']}: {f['decision']}" for f in (r.get("flags") or []) if f.get("decision")],
                    spend=dict(session_usd=round(S.session_usd, 6), session_new=S.session_new,
                               adhoc_total_usd=round(adhoc_usd_total(), 6)),
                    prod=prod_items(cap, qd["id"]))
        if not r.get("dimensions"):
            base.update(error=f"no Jev reading in this capture ({r.get('basic') or 'unknown'}); production fell back "
                              "to basic search, so only its list is shown", lists={})
            base["timings"] = dict(capture_ms=capture_ms, rank_ms=0, total_ms=round((time.perf_counter() - t0) * 1000))
            return base
        t = time.perf_counter()
        ctx = X.load_query(qd, S.cat)
        lists = rank(ctx, qd["id"])
        rank_ms = round((time.perf_counter() - t) * 1000)
    base.update(lists=lists, timings=dict(capture_ms=capture_ms, rank_ms=rank_ms,
                                          per_ranker_ms={k: v["ms"] for k, v in lists.items()},
                                          total_ms=round((time.perf_counter() - t0) * 1000)))
    return base


# --- HTTP --------------------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if "json" in ctype or "html" in ctype else ""))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, open(os.path.join(HERE, "index.html"), "rb").read(), "text/html")
        elif self.path == "/presets":
            groups = {}
            for q in S.queries:
                groups.setdefault(q["split"], []).append(dict(id=q["id"], query=q["query"], type=q["type"]))
            self._send(200, dict(groups=groups, startup_s=S.startup_s,
                                 spend=dict(session_usd=round(S.session_usd, 6), session_new=S.session_new,
                                            adhoc_total_usd=round(adhoc_usd_total(), 6))))
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/search":
            return self._send(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            q = (body.get("q") or "").strip()
            if not q or len(q) > 300:
                return self._send(400, {"error": "q must be 1-300 characters"})
            self._send(200, search(q))
        except subprocess.TimeoutExpired:
            self._send(504, {"error": f"capture timed out after {CAPTURE_TIMEOUT_S}s"})
        except Exception as e:  # noqa: BLE001
            import traceback
            traceback.print_exc()
            self._send(500, {"error": f"{type(e).__name__}: {e}"})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8765
    print("loading ...", flush=True)
    startup()
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"playground on http://localhost:{port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
