"""Read-only pull of fuller credits, a person index and production companies for the eligible titles.

Writes (see data/people-schema.md):
- data/credits.jsonl.gz    one line per eligible title: directors, writers, creators, top-15 cast
- data/persons.json.gz     person id -> name, original name, department, credit counts, votes sum, popularity
- data/companies.jsonl.gz  one line per eligible title: production companies (+ networks for shows)

Eligible = catalog rows with votes >= 2000 (the snapshot has no adult titles).
Only SELECTs through scripts/readonly_stores.py. Raw query results are cached in data/.credits-raw.pkl.gz
(delete it to re-pull).

Usage: .venv/bin/python scripts/pull_credits.py
"""
import gzip, json, os, pickle, sys, time
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "harness"))
import catalog as C  # noqa: E402
from readonly_stores import sql  # noqa: E402

CHUNK = 1500
RAW = os.path.join(C.DATA, ".credits-raw.pkl.gz")
DIRECTOR_JOBS = ("Director", "Co-Director")
WRITER_JOBS = ("Writer", "Screenplay", "Story", "Novel", "Original Story", "Theatre Play", "Author", "Characters",
               "Idea", "Co-Writer", "Book", "Teleplay", "Short Story", "Comic Book", "Screenstory",
               "Scenario Writer", "Adaptation", "Dialogue", "Original Concept", "Graphic Novel")
CAST_N = 15
MAX_DIRECTORS, MAX_WRITERS, MAX_CREATORS = 5, 8, 4
KEEP_POPULARITY = 5.0   # people with a single eligible credit are kept when popularity >= this


def rows(stmt):
    for i in range(4):
        try:
            return sql(stmt)["rows"]
        except Exception as e:  # noqa: BLE001
            print("retry", i, str(e)[:200], flush=True)
            time.sleep(3)
    raise RuntimeError("failed: " + stmt[:200])


def inlist(xs):
    return ",".join(str(int(x)) for x in xs)


def pull(by_type):
    t0 = time.time()
    raw = {"crew": [], "cast": [], "media": [], "person": [], "company": [], "network": []}
    jobs = ",".join("'" + j + "'" for j in DIRECTOR_JOBS + WRITER_JOBS + ("Creator", "Executive Producer"))
    for mt, ids in by_type.items():
        for i in range(0, len(ids), CHUNK):
            ph = inlist(ids[i:i + CHUNK])
            for m, p, job, ep in rows(f"SELECT media_tmdb_id, person_tmdb_id, job, episode_count_job FROM person_worked_on "
                                      f"WHERE media_type='{mt}' AND job IN ({jobs}) AND media_tmdb_id IN ({ph})"):
                raw["crew"].append((mt, m, p, job, ep))
            cond = "order_default < 15" if mt == "movie" else "order_default < 40"
            for m, p, od, ch, ep in rows(f"SELECT media_tmdb_id, person_tmdb_id, order_default, character, "
                                         f"episode_count_character FROM person_appeared_in "
                                         f"WHERE media_type='{mt}' AND {cond} AND media_tmdb_id IN ({ph})"):
                raw["cast"].append((mt, m, p, od, ch, ep))
            ncol = "network_ids" if mt == "show" else "NULL"
            for m, pc, nw in rows(f"SELECT tmdb_id, production_company_ids, {ncol} FROM {mt} WHERE tmdb_id IN ({ph})"):
                raw["media"].append((mt, m, pc, nw))
            print(mt, i + CHUNK, "/", len(ids), f"{time.time() - t0:.0f}s", flush=True)
    persons = sorted({r[2] for r in raw["crew"]} | {r[2] for r in raw["cast"]})
    for i in range(0, len(persons), 3000):
        raw["person"] += rows(f"SELECT tmdb_id, name, original_name, known_for_department, popularity, gender "
                              f"FROM person WHERE tmdb_id IN ({inlist(persons[i:i + 3000])})")
    comp = sorted({c for r in raw["media"] for c in (r[2] or [])})
    nets = sorted({c for r in raw["media"] for c in (r[3] or [])})
    for i in range(0, len(comp), 3000):
        raw["company"] += rows(f"SELECT tmdb_id, name, origin_country FROM production_company "
                               f"WHERE tmdb_id IN ({inlist(comp[i:i + 3000])})")
    for i in range(0, len(nets), 3000):
        raw["network"] += rows(f"SELECT tmdb_id, name, origin_country FROM network WHERE tmdb_id IN ({inlist(nets[i:i + 3000])})")
    print({k: len(v) for k, v in raw.items()}, f"{time.time() - t0:.0f}s", flush=True)
    return raw


def main():
    cat = C.load()
    el = [r for r in range(len(cat.ids)) if cat.votes[r] >= 2000]
    by_type = {"movie": [], "show": []}
    for r in el:
        by_type[cat.media_type(r)].append(int(cat.tmdb_id[r]))
    if os.path.exists(RAW):
        raw = pickle.load(gzip.open(RAW, "rb"))
    else:
        raw = pull(by_type)
        pickle.dump(raw, gzip.open(RAW, "wb"))

    P = {r[0]: {"name": r[1], "original_name": r[2], "department": r[3], "popularity": r[4], "gender": r[5]}
         for r in raw["person"]}

    def pref(pid, **kw):
        p = P.get(pid, {})
        return {"id": pid, "name": p.get("name"), "department": p.get("department"),
                "popularity": round(p["popularity"], 3) if p.get("popularity") is not None else None, **kw}

    crew = defaultdict(list)
    for mt, m, p, job, ep in raw["crew"]:
        crew[(mt, m)].append((p, job, ep or 0))
    cast = defaultdict(list)
    for mt, m, p, od, ch, ep in raw["cast"]:
        cast[(mt, m)].append((od if od is not None else 999, p, ch, ep))

    credits = []
    for r in el:
        mt, m = cat.media_type(r), int(cat.tmdb_id[r])
        cr = crew.get((mt, m), [])
        # directors: Director before Co-Director, then most episodes (shows), dedup by person
        d, seen = [], set()
        for p, job, ep in sorted((x for x in cr if x[1] in DIRECTOR_JOBS), key=lambda x: (x[1] != "Director", -x[2], x[0])):
            if p not in seen:
                seen.add(p)
                d.append(pref(p, job=job, episodes=ep if mt == "show" else None))
        d = d[:MAX_DIRECTORS]
        # writers: most episodes first (shows), then job order in WRITER_JOBS; one entry per person, jobs merged
        wj = defaultdict(list)
        wep = Counter()
        for p, job, ep in cr:
            if job in WRITER_JOBS:
                wj[p].append(job)
                wep[p] = max(wep[p], ep)
        w = [pref(p, jobs=sorted(set(wj[p]), key=WRITER_JOBS.index), episodes=wep[p] if mt == "show" else None)
             for p in sorted(wj, key=lambda p: (-wep[p], min(WRITER_JOBS.index(j) for j in wj[p]), p))][:MAX_WRITERS]
        # creators: Creator credits; shows without one fall back to top 2 Executive Producer / Writer by episodes
        # (as scripts/pull_people.py does); movies: none (use directors)
        cp = sorted({p for p, job, _ in cr if job == "Creator"})
        src = "creator" if cp else None
        if not cp and mt == "show":
            best = Counter()
            for p, job, ep in cr:
                if job in ("Executive Producer", "Writer"):
                    best[p] = max(best[p], ep)
            cp = [p for p, _ in sorted(best.items(), key=lambda x: (-x[1], x[0]))][:2]
            src = "fallback_ep_writer" if cp else None
        c = [pref(p) for p in cp[:MAX_CREATORS]]
        ca, seen = [], set()
        for od, p, ch, ep in sorted(cast.get((mt, m), []), key=lambda x: (x[0], x[1])):
            if p not in seen:
                seen.add(p)
                ca.append(pref(p, order=od, character=ch, episodes=ep if mt == "show" else None))
        credits.append({"id": int(cat.ids[r]), "media_type": mt, "tmdb_id": m, "title": cat.title[r],
                        "year": int(cat.year[r]) or None, "votes": int(cat.votes[r]), "directors": d, "writers": w,
                        "creators": c, "creator_source": src, "cast": ca[:CAST_N]})
    with gzip.open(os.path.join(C.DATA, "credits.jsonl.gz"), "wt", encoding="utf-8") as f:
        for x in credits:
            f.write(json.dumps(x, ensure_ascii=False) + "\n")

    # coverage
    cov = {"titles": len(credits)}
    for mt in ("movie", "show"):
        xs = [x for x in credits if x["media_type"] == mt]
        cov[mt] = {"titles": len(xs), **{k: sum(bool(x[k]) for x in xs) for k in ("directors", "writers", "creators", "cast")},
                   "cast_ge5": sum(len(x["cast"]) >= 5 for x in xs), "cast_15": sum(len(x["cast"]) >= 15 for x in xs),
                   "creator_fallback": sum(x["creator_source"] == "fallback_ep_writer" for x in xs),
                   "named_pct": None}
        refs = [p for x in xs for k in ("directors", "writers", "creators", "cast") for p in x[k]]
        cov[mt]["named_pct"] = round(100 * sum(p["name"] is not None for p in refs) / max(1, len(refs)), 2)
    print("COVERAGE", json.dumps(cov, indent=1))

    # person index
    idx = {}
    for x in credits:
        roles = defaultdict(set)
        for k, role in (("cast", "cast"), ("directors", "director"), ("writers", "writer"), ("creators", "creator")):
            for p in x[k]:
                roles[p["id"]].add(role)
        for pid, rs in roles.items():
            e = idx.setdefault(pid, {"cast": 0, "director": 0, "writer": 0, "creator": 0, "titles": 0, "votes_sum": 0})
            for role in rs:
                e[role] += 1
            e["titles"] += 1
            e["votes_sum"] += x["votes"]
    persons = {}
    for pid, e in idx.items():
        p = P.get(pid)
        if not p or not p["name"]:
            continue
        pop = p["popularity"] or 0
        if e["titles"] >= 2 or pop >= KEEP_POPULARITY:
            on = p["original_name"] if p["original_name"] and p["original_name"] != p["name"] else None
            persons[str(pid)] = {"name": p["name"], "original_name": on, "department": p["department"],
                                 "popularity": round(pop, 3), "credits": {k: e[k] for k in ("cast", "director", "writer", "creator")},
                                 "titles": e["titles"], "votes_sum": e["votes_sum"]}
    with gzip.open(os.path.join(C.DATA, "persons.json.gz"), "wt", encoding="utf-8") as f:
        json.dump(persons, f, ensure_ascii=False)
    print("PERSONS referenced", len(idx), "kept", len(persons),
          "single-credit kept by popularity", sum(v["titles"] == 1 for v in persons.values()),
          "ge3", sum(v["titles"] >= 3 for v in persons.values()),
          "with original_name", sum(bool(v["original_name"]) for v in persons.values()))
    dep = Counter(v["department"] for v in persons.values())
    print("departments", dep.most_common(8))
    # collisions
    ge3 = [v for v in persons.values() if v["titles"] >= 3]
    suffix = {"jr.", "jr", "sr.", "sr", "ii", "iii", "iv"}

    def surname(n):
        ws = [w for w in n.lower().replace(",", " ").split() if w not in suffix]
        return ws[-1] if ws else None

    sur = Counter(s for s in (surname(v["name"]) for v in ge3) if s)
    print(f"ge3: {len(ge3)} people, {len(sur)} distinct surnames, {sum(c == 1 for c in sur.values())} unique surnames "
          f"({sum(c == 1 for c in sur.values()) / len(ge3):.1%} of people have a unique surname); top shared",
          sur.most_common(10))
    full = Counter(v["name"].lower() for v in persons.values())
    coll = {n: c for n, c in full.items() if c > 1}
    print(f"all kept: {len(full)} distinct full names, {len(coll)} names shared by 2+ people, "
          f"{sum(coll.values())} people involved; top", sorted(coll.items(), key=lambda x: -x[1])[:10])
    full3 = Counter(v["name"].lower() for v in ge3)
    print("ge3 full-name collisions:", sum(c > 1 for c in full3.values()), "names,",
          sum(c for c in full3.values() if c > 1), "people", [n for n, c in full3.items() if c > 1][:10])

    # companies
    CO = {r[0]: {"name": r[1], "country": r[2]} for r in raw["company"]}
    NW = {r[0]: {"name": r[1], "country": r[2]} for r in raw["network"]}
    media = {(mt, m): (pc, nw) for mt, m, pc, nw in raw["media"]}
    n_pc = n_nw = 0
    cc, nc = Counter(), Counter()
    with gzip.open(os.path.join(C.DATA, "companies.jsonl.gz"), "wt", encoding="utf-8") as f:
        for r in el:
            mt, m = cat.media_type(r), int(cat.tmdb_id[r])
            pc, nw = media.get((mt, m), (None, None))
            comps = [{"id": c, **CO.get(c, {"name": None, "country": None})} for c in (pc or [])]
            nets = [{"id": c, **NW.get(c, {"name": None, "country": None})} for c in (nw or [])] if mt == "show" else None
            n_pc += bool(comps)
            n_nw += bool(nets)
            for c in {c["id"] for c in comps}:
                cc[c] += 1
            for c in {c["id"] for c in nets or []}:
                nc[c] += 1
            f.write(json.dumps({"id": int(cat.ids[r]), "media_type": mt, "tmdb_id": m, "companies": comps,
                                "networks": nets}, ensure_ascii=False) + "\n")
    print(f"COMPANIES: {n_pc}/{len(el)} titles with companies, shows with networks {n_nw}/{len(by_type['show'])}, "
          f"{len(cc)} distinct companies ({sum(c in CO for c in cc)} named), {len(nc)} networks")
    print("top30 companies:", [(CO.get(c, {}).get("name"), n) for c, n in cc.most_common(30)])
    print("top15 networks:", [(NW.get(c, {}).get("name"), n) for c, n in nc.most_common(15)])
    for q in ("Studio Ghibli", "A24", "Pixar", "Marvel Studios", "Blumhouse Productions", "HBO", "Aardman", "Home Box Office"):
        hits = [(CO[c]["name"], n) for c, n in cc.items() if q.lower() in (CO.get(c, {}).get("name") or "").lower()]
        nh = [(NW[c]["name"], n) for c, n in nc.items() if q.lower() in (NW.get(c, {}).get("name") or "").lower()]
        print(" ", q, "companies:", sorted(hits, key=lambda x: -x[1])[:4], "networks:", sorted(nh, key=lambda x: -x[1])[:3])


if __name__ == "__main__":
    main()
