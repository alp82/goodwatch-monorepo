"""Load the catalog into one CrateDB table, `doc.search_title`, with the ranker's BM25F text fields full-text indexed.

The ranker's BM25F (harness/sparse.py, harness/simp_combo.py) reads these fields; the main query, coverage units,
term profile and mention scores use the "body" weights (tags 2, keywords 2, tropes 1, essence 1); sparse.py's full
field set adds title 1, creators 4, cast 1.5. Every text field is a FULLTEXT column with the english analyzer.
Label lists (tags, keywords, tropes, creators, cast) are newline-joined TEXT for MATCH plus raw <name>_list arrays.

Also stored: the filter columns (media type, year, decade, adult, anime, production method, suitability / context
flags), the priors the ranker reads per title (votes, goodwatch_score, popularity) and the raw 0..10 fingerprint
scores (object keyed by dimension, and `fps` as a 74-element array in harness/catalog.py DIMS order).

Usage: .venv/bin/python bench/stores/load_crate.py
"""
import time

import common as K

FT = "INDEX USING FULLTEXT WITH (analyzer = 'english')"
# CrateDB cannot MATCH on ARRAY(TEXT): each label list is one FULLTEXT TEXT column (labels joined by newlines) plus the
# raw list in <name>_list (plain index, exact matches such as `? = ANY(keywords_list)`).
LISTS = ("tags", "keywords", "tropes", "creators", "cast_names")
SEP = "\n"

DDL = f"""
CREATE TABLE {K.CRATE_TABLE} (
  id BIGINT PRIMARY KEY,
  tmdb_id BIGINT,
  media_type TEXT,
  title TEXT {FT},
  original_title TEXT {FT},
  release_year INTEGER,
  release_decade INTEGER,
  adult BOOLEAN,
  genres ARRAY(TEXT),
  production_method TEXT,
  {", ".join(f"{f} BOOLEAN" for f in K.BOOL_FLAGS)},
  tags TEXT {FT},
  keywords TEXT {FT},
  tropes TEXT {FT},
  essence_text TEXT {FT},
  creators TEXT {FT},
  cast_names TEXT {FT},
  {", ".join(f"{c}_list ARRAY(TEXT)" for c in LISTS)},
  votes BIGINT,
  goodwatch_score REAL,
  popularity REAL,
  fingerprint_scores OBJECT(STRICT) AS ({", ".join(f"{d} SMALLINT" for d in K.DIMS)}),
  fps ARRAY(SMALLINT)
) WITH (number_of_replicas = 0, refresh_interval = 1000)
"""

COLS = (["id", "tmdb_id", "media_type", "title", "original_title", "release_year", "release_decade", "adult", "genres",
         "production_method"] + K.BOOL_FLAGS +
        ["tags", "keywords", "tropes", "essence_text", "creators", "cast_names"] + [f"{c}_list" for c in LISTS] + ["votes", "goodwatch_score",
         "popularity", "fingerprint_scores", "fps"])


def row(r):
    fl = r.get("flags") or {}
    y = r.get("year")
    fs = r.get("fingerprint_scores") or {}
    scores = {d: int(fs.get(d) or 0) for d in K.DIMS}
    lists = [r.get("essence_tags") or [], r.get("keywords") or [], r.get("tropes") or [], r.get("creators") or [],
             r.get("cast") or []]
    return ([r["id"], r["tmdb_id"], r["media_type"], r.get("title") or r.get("original_title") or "",
             r.get("original_title") or "", int(y) if y else None, int(y) // 10 * 10 if y else None, False,
             r.get("genres") or [], fl.get("production_method")] + [fl.get(f) for f in K.BOOL_FLAGS] +
            [SEP.join(lists[0]), SEP.join(lists[1]), SEP.join(lists[2]), r.get("essence_text") or "",
             SEP.join(lists[3]), SEP.join(lists[4])] + lists + [int(r.get("votes") or 0), r.get("goodwatch_score"),
             r.get("popularity"), scores, [scores[d] for d in K.DIMS]])


def sql(http, stmt, args=None, bulk=None):
    body = {"stmt": stmt}
    if bulk is not None:
        body["bulk_args"] = bulk
    elif args is not None:
        body["args"] = args
    r = http.post("/_sql", json=body)
    if r.status_code != 200:
        raise RuntimeError(r.text[:1000])
    return r.json()


def main():
    rows = K.catalog()
    http = K.client(K.CRATE_URL)
    sql(http, f"DROP TABLE IF EXISTS {K.CRATE_TABLE}")
    sql(http, DDL)
    ins = f"INSERT INTO {K.CRATE_TABLE} ({', '.join(COLS)}) VALUES ({', '.join('?' * len(COLS))})"
    before = K.docker_stats(K.CRATE_CONTAINER)
    t0 = time.time()
    B = 2000
    for i in range(0, len(rows), B):
        res = sql(http, ins, bulk=[row(r) for r in rows[i:i + B]])
        bad = [x for x in res["results"] if x["rowcount"] != 1]
        assert not bad, bad[:3]
    load_s = time.time() - t0
    t1 = time.time()
    sql(http, f"REFRESH TABLE {K.CRATE_TABLE}")
    sql(http, f"OPTIMIZE TABLE {K.CRATE_TABLE} WITH (max_num_segments = 1)")
    sql(http, f"REFRESH TABLE {K.CRATE_TABLE}")
    finalize_s = time.time() - t1
    n = sql(http, f"SELECT count(*) FROM {K.CRATE_TABLE}")["rows"][0][0]
    assert n == len(rows), n
    shards = sql(http, "SELECT count(*), sum(size), sum(num_docs) FROM sys.shards WHERE schema_name = 'doc' "
                       "AND table_name = 'search_title' AND primary")["rows"][0]
    heap = sql(http, "SELECT heap['used'], heap['max'] FROM sys.nodes")["rows"][0]
    time.sleep(3)
    out = dict(
        table=K.CRATE_TABLE, rows=n, load_s=round(load_s, 1), refresh_optimize_s=round(finalize_s, 1),
        shards=shards[0], disk_bytes=shards[1], docs=shards[2], heap_used_bytes=heap[0], heap_max_bytes=heap[1],
        docker_before=before, docker_after=K.docker_stats(K.CRATE_CONTAINER), rss_after=K.container_rss(K.CRATE_CONTAINER),
        version=sql(http, "SELECT version['number'] FROM sys.nodes")["rows"][0][0], ddl=DDL.strip(),
    )
    print({k: v for k, v in out.items() if k != "ddl"}, flush=True)
    K.update_results("crate", out)


if __name__ == "__main__":
    main()
