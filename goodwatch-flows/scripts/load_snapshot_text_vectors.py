"""First load of the search text vectors from the catalog snapshot of 2026-09-23.

The ranker was tuned on a catalog snapshot whose titles were embedded on a GPU. Those
vectors equal the CPU fp32 output of f/search/embed_titles (cosine 1.0), so loading them
saves the 4 to 8 hours a full embedding run takes. This script:

1. Seeds the term vocabulary (`search_terms`) with every body term of the snapshot, in
   first-seen order. These are the ids the performance benchmark used.
2. Writes `text_en_v1`, `text_multi_v1` and `terms_bm25f_v1` for every snapshot title that
   has a point, with `update_points` and no payload: the payload and the fingerprint
   vectors stay as they are. The sparse vectors are computed with f/search/terms.
3. Records each title's input hash in `search_embedding_inputs`, so the incremental run
   afterwards re-embeds only titles whose text changed since the snapshot.

Inputs are the snapshot files in `--data`: `catalog.jsonl.gz`,
`emb-bge-base-en-v1.5-notitle.npy`, `emb-multilingual-e5-small.npy` and `emb-ids.json`
(gitignored, on the machine that built them: docs/prototypes/search-arena/data).

Credentials come from the environment: QDRANT_URL (REST or gRPC port), QDRANT_API_KEY,
CRATE_HOSTS, CRATE_USER and CRATE_PASS. Without `--apply` the script only counts. It can
run again safely: every write is idempotent.
"""
import argparse
import gzip
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from crate import client as crate_client
from qdrant_client import QdrantClient, models as qm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.search import embed_titles as flow  # noqa: E402
from f.search import terms as bm25f  # noqa: E402
from f.search.title_text import input_hash, term_fields, title_inputs  # noqa: E402
from f.sync.copy.qdrant_retry import REQUEST_TIMEOUT_SECONDS, update_points, write_with_retry  # noqa: E402
from f.sync.models.qdrant_schemas import (  # noqa: E402
    MEDIA_COLLECTION, TERMS_BM25F_VECTOR, TEXT_EN_VECTOR, TEXT_MULTI_VECTOR,
)

BATCH_SIZE = 500
# catalog.jsonl.gz was written at 06:48:04 UTC; its reads started about 8 minutes earlier.
SNAPSHOT_AT = datetime(2026, 9, 23, 6, 48, 4, tzinfo=timezone.utc)


class CrateSession:
    """The subset of f/db/cratedb.CrateConnector that the flow's helpers use."""

    def __init__(self) -> None:
        self.con = crate_client.connect(os.environ["CRATE_HOSTS"].split(","), username=os.environ["CRATE_USER"],
                                        password=os.environ["CRATE_PASS"], timeout=180)
        self.cur = self.con.cursor()

    def run(self, sql, params=None):
        self.cur.execute(sql, params or ())

    def select(self, sql, params=None):
        self.run(sql, params)
        columns = [c[0] for c in self.cur.description]
        return [dict(zip(columns, row)) for row in self.cur.fetchall()]


def snapshot_inputs(row: dict):
    """A catalog row holds the payload fields and Crate columns the flow reads."""
    payload = {"title": row["title"], "original_title": row["original_title"], "release_year": row["year"],
               "genres": row["genres"], "tropes": row["tropes"]}
    crate_row = {k: row[k] for k in ("essence_text", "essence_tags", "synopsis", "keywords")}
    return title_inputs(payload, crate_row)


def seed_vocabulary(crate, inputs, apply: bool) -> dict[str, int]:
    """First-seen order over all snapshot titles, as the benchmark numbered the terms."""
    ids: dict[str, int] = {}
    for item in inputs:
        for field, spans in term_fields(item).items():
            for span in spans:
                for term in bm25f.terms(span):
                    ids.setdefault(term, len(ids))
    if flow.read_state(crate, flow.NEXT_TERM_ID) is not None:
        # Already seeded: check that the stored ids are the snapshot's.
        vocabulary = flow.TermVocabulary(crate)
        stored = vocabulary.ids_for(ids) if apply else {}
        wrong = sum(1 for t, i in stored.items() if ids.get(t) != i)
        print(f"vocabulary already seeded; {wrong} snapshot terms have another id", flush=True)
        if wrong:
            raise SystemExit("the stored vocabulary doesn't match the snapshot")
        return ids
    print(f"seeding {len(ids):,} terms", flush=True)
    if apply:
        flow._bulk(crate, f"INSERT INTO {flow.TERMS_TABLE} (term, id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
                          "ON CONFLICT (term) DO NOTHING", [[t, i] for t, i in ids.items()])
        crate.run(f"REFRESH TABLE {flow.TERMS_TABLE}")
        count = crate.select(f"SELECT count(*) AS n FROM {flow.TERMS_TABLE}")[0]["n"]
        if count != len(ids):
            raise SystemExit(f"{flow.TERMS_TABLE} has {count} rows, expected {len(ids)}")
        flow.write_state(crate, flow.NEXT_TERM_ID, {"next_id": len(ids)})
    return ids


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--start-row", type=int, default=0, help="resume from this catalog row")
    args = parser.parse_args()

    rows = [json.loads(line) for line in gzip.open(args.data / "catalog.jsonl.gz", "rt", encoding="utf-8")]
    ids = json.load(open(args.data / "emb-ids.json"))
    english = np.load(args.data / "emb-bge-base-en-v1.5-notitle.npy", mmap_mode="r")
    multilingual = np.load(args.data / "emb-multilingual-e5-small.npy", mmap_mode="r")
    if ids != [r["id"] for r in rows] or english.shape != (len(rows), 768) or multilingual.shape != (len(rows), 384):
        raise SystemExit("the vector files don't match the catalog's rows")
    inputs = [snapshot_inputs(r) for r in rows]

    crate = CrateSession()
    qdrant = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ.get("QDRANT_API_KEY"),
                          timeout=REQUEST_TIMEOUT_SECONDS, prefer_grpc=os.environ["QDRANT_URL"].endswith(":6334"))
    vocabulary = seed_vocabulary(crate, inputs, args.apply)

    written = "written" if args.apply else "would_write"
    report = {"rows": len(rows), "no_point": 0, written: 0, "attempts": 0, "retries": 0, "empty_terms": 0}
    started = time.monotonic()
    for start in range(args.start_row, len(rows), BATCH_SIZE):
        batch = range(start, min(start + BATCH_SIZE, len(rows)))
        existing = {int(p.id) for p in qdrant.retrieve(MEDIA_COLLECTION, [ids[i] for i in batch],
                                                        with_payload=False, with_vectors=False)}
        points, hashes = [], {}
        for i in batch:
            if ids[i] not in existing:
                report["no_point"] += 1
                continue
            weights = bm25f.document_weights(term_fields(inputs[i]))
            report["empty_terms"] += not weights
            points.append(qm.PointStruct(id=ids[i], payload=None, vector={
                TEXT_EN_VECTOR: english[i].astype(np.float32).tolist(),
                TEXT_MULTI_VECTOR: multilingual[i].astype(np.float32).tolist(),
                TERMS_BM25F_VECTOR: flow.sparse_vector(weights, vocabulary),
            }))
            hashes[ids[i]] = input_hash(inputs[i])
        if args.apply and points:
            result = write_with_retry(qdrant, MEDIA_COLLECTION, update_points(points), lambda: None)
            report["attempts"] += result["attempts"]
            report["retries"] += result["retries"]
            flow.record_hashes(crate, hashes, SNAPSHOT_AT)
        report[written] += len(points)
        if (start // BATCH_SIZE) % 20 == 0:
            print(f"row {batch[-1] + 1}/{len(rows)} {json.dumps(report)} {time.monotonic() - started:.0f}s", flush=True)
    report["seconds"] = round(time.monotonic() - started)
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
