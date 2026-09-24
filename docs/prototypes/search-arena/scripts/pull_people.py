"""Read-only pull of people for eligible catalog titles (round 3, `sparse` lexical index).

Writes data/people.jsonl.gz: one line per eligible title (votes >= 2000)
{"id", "creators": [names], "cast": [names]}.

- movie creators: every `Director` credit (at most 3).
- show creators: `Creator` credits, else the top 2 people by episodes as Executive Producer or Writer
  (TMDB's created_by is not in person_worked_on for most shows).
- cast: order_default < 5 (movies), top 5 by order_default (shows, billing order).

Only SELECTs through scripts/readonly_stores.py.

Usage: .venv/bin/python scripts/pull_people.py
"""
import gzip, json, os, sys, time
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "harness"))
import catalog as C  # noqa: E402
from readonly_stores import sql  # noqa: E402

CHUNK = 1500


def rows(stmt, args=None):
    for i in range(3):
        try:
            return sql(stmt, args)["rows"]
        except Exception as e:  # noqa: BLE001
            print("retry", i, str(e)[:200], flush=True)
            time.sleep(2)
    raise RuntimeError("failed")


def main():
    cat = C.load()
    el = [r for r in range(len(cat.ids)) if cat.votes[r] >= 2000]
    by_type = {"movie": [], "show": []}
    for r in el:
        by_type[cat.media_type(r)].append(int(cat.tmdb_id[r]))
    creators = defaultdict(list)   # (type, tmdb) -> [(rank key, person)]
    cast = defaultdict(list)
    t0 = time.time()
    for mt, ids in by_type.items():
        for i in range(0, len(ids), CHUNK):
            chunk = ids[i:i + CHUNK]
            ph = ",".join(str(x) for x in chunk)
            jobs = "('Director')" if mt == "movie" else "('Creator','Executive Producer','Writer')"
            for m, p, job, ep in rows(f"SELECT media_tmdb_id, person_tmdb_id, job, episode_count_job FROM person_worked_on "
                                      f"WHERE media_type='{mt}' AND job IN {jobs} AND media_tmdb_id IN ({ph})"):
                key = (0 if job in ("Creator", "Director") else 1, -(ep or 0))
                creators[(mt, m)].append((key, p))
            cond = "order_default < 5" if mt == "movie" else "order_default < 12"
            for m, p, od, ep in rows(f"SELECT media_tmdb_id, person_tmdb_id, order_default, episode_count_character "
                                     f"FROM person_appeared_in WHERE media_type='{mt}' AND {cond} AND media_tmdb_id IN ({ph})"):
                cast[(mt, m)].append(((od if od is not None else 999), p))
            print(mt, i + len(chunk), "/", len(ids), f"{time.time() - t0:.0f}s", flush=True)
    chosen = {}
    persons = set()
    for mt, ids in by_type.items():
        for m in ids:
            cr = sorted(set(creators.get((mt, m), [])))
            if mt == "movie":
                cp = [p for k, p in cr if k[0] == 0][:3]
            else:
                cp = [p for k, p in cr if k[0] == 0][:3] or []
                if not cp:
                    seen = []
                    for k, p in cr:
                        if p not in seen:
                            seen.append(p)
                    cp = seen[:2]
            seen_c = []
            for _, p in sorted(set(cast.get((mt, m), []))):
                if p not in seen_c and p not in cp:
                    seen_c.append(p)
            ca = seen_c[:5]
            chosen[(mt, m)] = (cp, ca)
            persons.update(cp)
            persons.update(ca)
    names = {}
    plist = sorted(persons)
    for i in range(0, len(plist), 3000):
        ph = ",".join(str(x) for x in plist[i:i + 3000])
        for pid, name in rows(f"SELECT tmdb_id, name FROM person WHERE tmdb_id IN ({ph})"):
            names[pid] = name
    print("persons", len(plist), "named", len(names), flush=True)
    out = os.path.join(C.DATA, "people.jsonl.gz")
    n_c = n_a = 0
    with gzip.open(out, "wt", encoding="utf-8") as f:
        for (mt, m), (cp, ca) in chosen.items():
            cr = [names[p] for p in cp if p in names]
            cs = [names[p] for p in ca if p in names]
            n_c += bool(cr)
            n_a += bool(cs)
            f.write(json.dumps({"id": C.point_id(mt, m), "creators": cr, "cast": cs}, ensure_ascii=False) + "\n")
    print(f"wrote {out}: {len(chosen)} titles, {n_c} with creators, {n_a} with cast, {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
