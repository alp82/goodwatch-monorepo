# extra_requirements:
# qdrant-client==1.19.1

"""Embed titles for search: write `text_en_v1`, `text_multi_v1` and `terms_bm25f_v1`.

The flow writes only these three vectors, with `update_points` and no payload, so the
fingerprint publish keeps its vectors and payload. A title without a Qdrant point yet is
skipped; it's embedded once the publish has created its point.

Modes:

- `incremental` (scheduled): titles whose Crate `tmdb_details_updated_at`, `dna_updated_at`
  or `tvtropes_tags_updated_at` moved since the last run, minus an overlap for the copy
  flows' lag, plus every point that lacks one of the three vectors. A title is embedded
  only when its input hash (`f/search/title_text.input_hash`) differs from the stored one,
  because most timestamp changes are rating or popularity updates. Once a day it also
  checks every point's hash, whatever its timestamps: the title analysis copy's catch-up
  writes an analysis with its original, older `dna_updated_at`, so no timestamp shows
  that the title's text changed.
- `full`: every point, whatever its hash. Needed only for a new vector version. It
  checkpoints after every 1,000 points and resumes from there.

State lives in Crate:

- `search_embedding_inputs`: each point's input hash and when it was embedded.
- `search_terms`: the term vocabulary of `terms_bm25f_v1`. A term keeps its id forever and
  new terms get the next free ids, so the webapp can map query terms to ids with the term
  statistics the index build writes. Ids are handed out in blocks through a
  compare-and-set on `search_embedding_state`, so two runs never give one id to two terms.
- `search_embedding_state`: the next term id, the incremental checkpoint, the last daily
  sweep and the full-mode checkpoint.
"""

import json
import time
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from typing import Callable, Iterable

from qdrant_client import QdrantClient, models as qm

from f.db.cratedb import CrateConnector
from f.db.qdrant import QdrantConnector
from f.search import terms as bm25f
from f.search.text_encoder import BGE_BASE_EN, MULTILINGUAL_E5_SMALL, encode
from f.search.title_text import (
    CRATE_COLUMNS, PAYLOAD_FIELDS, TitleInputs, english_text, input_hash, multilingual_text, term_fields, title_inputs,
)
from f.sync.copy.qdrant_retry import (
    REQUEST_TIMEOUT_SECONDS, PublicationFailure, update_points, write_with_retry,
)
from f.sync.models.qdrant_schemas import MEDIA_COLLECTION, TERMS_BM25F_VECTOR, TEXT_EN_VECTOR, TEXT_MULTI_VECTOR

CHUNK_SIZE = 1000  # titles per embedding chunk and full-mode checkpoint
WRITE_BATCH_SIZE = 250  # points per Qdrant request
CRATE_BATCH_SIZE = 5000
# The copy flows write Crate rows with the source document's timestamp, up to 12 hours
# after it, and the fingerprint publish refreshes the payload every 4 hours. Looking back
# further than the last run catches titles whose rows arrived late; unchanged titles cost
# only a hash comparison.
INCREMENTAL_OVERLAP = timedelta(hours=72)
CHANGE_COLUMNS = ("tmdb_details_updated_at", "dna_updated_at", "tvtropes_tags_updated_at")
TEXT_VECTORS = (TEXT_EN_VECTOR, TEXT_MULTI_VECTOR, TERMS_BM25F_VECTOR)
MEDIA_TABLES = {"movie": "movie", "show": "show"}

TERMS_TABLE = "search_terms"
INPUTS_TABLE = "search_embedding_inputs"
STATE_TABLE = "search_embedding_state"
NEXT_TERM_ID = "terms_bm25f_v1.next_term_id"
INCREMENTAL_CHECKPOINT = "embed_titles.incremental"
FULL_CHECKPOINT = "embed_titles.full"
SWEEP_CHECKPOINT = "embed_titles.sweep"
SWEEP_EVERY = timedelta(hours=24)


# ---- Crate state ------------------------------------------------------------------------


def _epoch_ms(moment: datetime) -> int:
    return int(moment.timestamp() * 1000)


def _bulk(crate, sql: str, rows: list[list]) -> None:
    """executemany that fails on any failed row. ON CONFLICT DO NOTHING rows count 0."""
    for start in range(0, len(rows), CRATE_BATCH_SIZE):
        batch = rows[start:start + CRATE_BATCH_SIZE]
        results = crate.cur.executemany(sql, batch)
        if not isinstance(results, list) or len(results) != len(batch):
            raise RuntimeError(f"Incomplete bulk result: {sql}")
        failed = [r for r in results if r.get("error_message") or r.get("rowcount", -2) < 0]
        if failed:
            raise RuntimeError(f"{len(failed)} of {len(batch)} rows failed: {sql}; first: {failed[0]}")


def read_state(crate, name: str) -> dict | None:
    rows = crate.select(f"SELECT value FROM {STATE_TABLE} WHERE name = ?", (name,))
    return json.loads(rows[0]["value"]) if rows else None


def write_state(crate, name: str, value: dict) -> None:
    crate.run(
        f"INSERT INTO {STATE_TABLE} (name, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
        "ON CONFLICT (name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        (name, json.dumps(value)),
    )


class TermVocabulary:
    """Stable ids for `terms_bm25f_v1` terms. Existing terms keep their id; new ones get
    the next free ids."""

    def __init__(self, crate) -> None:
        self.crate = crate
        self.ids: dict[str, int] = {}
        self.new_terms = 0

    def _lookup(self, terms: list[str]) -> None:
        for start in range(0, len(terms), CRATE_BATCH_SIZE):
            batch = terms[start:start + CRATE_BATCH_SIZE]
            for row in self.crate.select(f"SELECT term, id FROM {TERMS_TABLE} WHERE term = ANY(?)", (batch,)):
                self.ids[row["term"]] = row["id"]

    def _reserve(self, count: int) -> int:
        """First id of a block of `count` ids, taken with a compare-and-set."""
        for _ in range(20):
            rows = self.crate.select(
                f"SELECT value, _seq_no, _primary_term FROM {STATE_TABLE} WHERE name = ?", (NEXT_TERM_ID,),
            )
            if not rows:
                raise RuntimeError(f"{STATE_TABLE} has no {NEXT_TERM_ID}; the vocabulary isn't initialized")
            first = json.loads(rows[0]["value"])["next_id"]
            self.crate.run(
                f"UPDATE {STATE_TABLE} SET value = ?, updated_at = CURRENT_TIMESTAMP "
                "WHERE name = ? AND _seq_no = ? AND _primary_term = ?",
                (json.dumps({"next_id": first + count}), NEXT_TERM_ID, rows[0]["_seq_no"], rows[0]["_primary_term"]),
            )
            if self.crate.cur.rowcount == 1:
                return first
            time.sleep(0.2)
        raise RuntimeError("Could not reserve term ids: the counter kept changing")

    def ids_for(self, terms: Iterable[str]) -> dict[str, int]:
        wanted = sorted(set(terms) - self.ids.keys())
        if wanted:
            self._lookup(wanted)
            missing = [t for t in wanted if t not in self.ids]
            if missing:
                first = self._reserve(len(missing))
                _bulk(self.crate,
                      f"INSERT INTO {TERMS_TABLE} (term, id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
                      "ON CONFLICT (term) DO NOTHING",
                      [[term, first + i] for i, term in enumerate(missing)])
                self.crate.run(f"REFRESH TABLE {TERMS_TABLE}")
                # Another run may have inserted a term first; its id wins and ours is unused.
                self._lookup(missing)
                lost = [t for t in missing if t not in self.ids]
                if lost:
                    raise RuntimeError(f"{len(lost)} new terms are missing after the insert, e.g. {lost[:3]}")
                self.new_terms += len(missing)
        return self.ids


def stored_hashes(crate, point_ids: list[int]) -> dict[int, str]:
    out: dict[int, str] = {}
    for start in range(0, len(point_ids), CRATE_BATCH_SIZE):
        batch = point_ids[start:start + CRATE_BATCH_SIZE]
        for row in crate.select(
            f"SELECT point_id, input_hash FROM {INPUTS_TABLE} WHERE point_id = ANY(?)", (batch,),
        ):
            out[row["point_id"]] = row["input_hash"]
    return out


def record_hashes(crate, hashes: dict[int, str], embedded_at: datetime) -> None:
    _bulk(crate,
          f"INSERT INTO {INPUTS_TABLE} (point_id, input_hash, embedded_at, updated_at) "
          "VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (point_id) DO UPDATE SET "
          "input_hash = excluded.input_hash, embedded_at = excluded.embedded_at, updated_at = excluded.updated_at",
          [[pid, h, _epoch_ms(embedded_at)] for pid, h in hashes.items()])


# ---- Reading titles -------------------------------------------------------------------


def point_id(media_type: str, tmdb_id: int) -> int:
    return (1_000_000_000_000 if media_type == "movie" else 2_000_000_000_000) + int(tmdb_id)


def changed_point_ids(crate, since: datetime) -> list[int]:
    """Titles whose Crate row changed since `since`, by the copy flows' source timestamps."""
    condition = " OR ".join(f"{column} >= ?" for column in CHANGE_COLUMNS)
    ids = []
    for media_type, table in MEDIA_TABLES.items():
        rows = crate.select(f"SELECT tmdb_id FROM {table} WHERE {condition}", (_epoch_ms(since),) * len(CHANGE_COLUMNS))
        ids += [point_id(media_type, row["tmdb_id"]) for row in rows]
    return sorted(set(ids))


def points_missing_vectors(client: QdrantClient) -> dict[int, dict]:
    """Points that lack any of the three vectors, with their payload."""
    missing = qm.Filter(should=[qm.Filter(must_not=[qm.HasVectorCondition(has_vector=v)]) for v in TEXT_VECTORS])
    out, offset = {}, None
    while True:
        points, offset = client.scroll(
            MEDIA_COLLECTION, scroll_filter=missing, limit=1000, offset=offset,
            with_payload=PAYLOAD_FIELDS + ["media_type", "tmdb_id"], with_vectors=False,
        )
        out.update({int(p.id): p.payload or {} for p in points})
        if offset is None:
            return out


def fetch_payloads(client: QdrantClient, point_ids: list[int]) -> dict[int, dict]:
    """Payloads of the points that exist. Missing points are simply absent."""
    records = client.retrieve(
        MEDIA_COLLECTION, point_ids, with_payload=PAYLOAD_FIELDS + ["media_type", "tmdb_id"], with_vectors=False,
    )
    return {int(r.id): r.payload or {} for r in records}


def fetch_crate_rows(crate, point_ids: list[int]) -> dict[int, dict]:
    out = {}
    for media_type, table in MEDIA_TABLES.items():
        base = point_id(media_type, 0)
        tmdb_ids = [pid - base for pid in point_ids if base <= pid < base + 1_000_000_000_000]
        for start in range(0, len(tmdb_ids), CRATE_BATCH_SIZE):
            batch = tmdb_ids[start:start + CRATE_BATCH_SIZE]
            for row in crate.select(f"SELECT {CRATE_COLUMNS} FROM {table} WHERE tmdb_id = ANY(?)", (batch,)):
                out[point_id(media_type, row["tmdb_id"])] = row
    return out


# ---- Embedding and writing ---------------------------------------------------------------


def sparse_vector(weights: dict[str, float], ids: dict[str, int]) -> qm.SparseVector:
    """A title without body terms gets an empty vector, so every point has all three."""
    pairs = sorted((ids[term], value) for term, value in weights.items())
    return qm.SparseVector(indices=[i for i, _ in pairs], values=[v for _, v in pairs])


def text_vectors(inputs: list[TitleInputs], vocabulary: TermVocabulary) -> list[dict]:
    """The three vectors per title. Loads one model at a time."""
    english = encode(BGE_BASE_EN, [english_text(i) for i in inputs])
    multilingual = encode(MULTILINGUAL_E5_SMALL, [multilingual_text(i) for i in inputs])
    weights = [bm25f.document_weights(term_fields(i)) for i in inputs]
    ids = vocabulary.ids_for(term for w in weights for term in w)
    return [
        {
            TEXT_EN_VECTOR: english[n].tolist(),
            TEXT_MULTI_VECTOR: multilingual[n].tolist(),
            TERMS_BM25F_VECTOR: sparse_vector(weights[n], ids),
        }
        for n in range(len(inputs))
    ]


def write_vectors(client: QdrantClient, vectors: dict[int, dict], stats: dict) -> set[int]:
    """Write the vectors of existing points; returns the ids written. A point deleted since
    it was read makes the batch fail with 404: drop it and retry the rest once."""
    written: set[int] = set()
    ids = sorted(vectors)
    for start in range(0, len(ids), WRITE_BATCH_SIZE):
        batch = ids[start:start + WRITE_BATCH_SIZE]
        for attempt in (1, 2):
            points = [qm.PointStruct(id=pid, vector=vectors[pid], payload=None) for pid in batch]
            try:
                result = write_with_retry(client, MEDIA_COLLECTION, update_points(points), lambda: None)
            except PublicationFailure:
                existing = set(fetch_payloads(client, batch))
                if attempt == 2 or len(existing) == len(batch):
                    raise
                stats["no_point"] += len(batch) - len(existing)
                batch = [pid for pid in batch if pid in existing]
                continue
            stats["write_attempts"] += result["attempts"]
            stats["write_retries"] += result["retries"]
            written.update(batch)
            break
    return written


def embed_points(
    crate, client: QdrantClient, vocabulary: TermVocabulary, payloads: dict[int, dict], *,
    force: set[int] | None, stats: dict, dry_run: bool,
) -> None:
    """Embed the given points whose input hash changed (every point when `force` is None).

    `payloads` holds only points that exist; `force` lists points that must be embedded
    even when their stored hash matches, such as points that lost their vectors.
    """
    ids = sorted(payloads)
    rows = fetch_crate_rows(crate, ids)
    stats["no_crate_row"] += sum(1 for pid in ids if pid not in rows)
    inputs = {pid: title_inputs(payloads[pid], rows[pid]) for pid in ids if pid in rows}
    hashes = {pid: input_hash(i) for pid, i in inputs.items()}
    stored = stored_hashes(crate, list(hashes)) if force is not None else {}
    todo = [pid for pid in hashes if force is None or pid in force or stored.get(pid) != hashes[pid]]
    stats["unchanged"] += len(hashes) - len(todo)
    stats["to_embed"] += len(todo)
    if dry_run or not todo:
        return
    started = time.monotonic()
    vectors = dict(zip(todo, text_vectors([inputs[pid] for pid in todo], vocabulary)))
    stats["embed_seconds"] += time.monotonic() - started
    written = write_vectors(client, vectors, stats)
    record_hashes(crate, {pid: hashes[pid] for pid in written}, datetime.now(timezone.utc))
    stats["embedded"] += len(written)


# ---- Modes -------------------------------------------------------------------------------


def _new_stats() -> dict:
    return {key: 0 for key in ("candidates", "no_point", "no_crate_row", "unchanged", "to_embed", "embedded",
                               "write_attempts", "write_retries")} | {"embed_seconds": 0.0}


def run_incremental(crate, client: QdrantClient, since: datetime | None, dry_run: bool) -> dict:
    started_at = datetime.now(timezone.utc)
    if since is None:
        checkpoint = read_state(crate, INCREMENTAL_CHECKPOINT)
        if checkpoint is None:
            raise RuntimeError(f"No {INCREMENTAL_CHECKPOINT} checkpoint yet; pass `since` for the first run")
        since = datetime.fromisoformat(checkpoint["started_at"]) - INCREMENTAL_OVERLAP
    stats = _new_stats() | {"since": since.isoformat()}
    changed = changed_point_ids(crate, since)
    missing = points_missing_vectors(client)
    stats["changed_in_crate"] = len(changed)
    stats["missing_vectors"] = len(missing)
    vocabulary = TermVocabulary(crate)
    candidates = sorted(set(changed) | set(missing))
    stats["candidates"] = len(candidates)
    for start in range(0, len(candidates), CHUNK_SIZE):
        chunk = candidates[start:start + CHUNK_SIZE]
        payloads = {pid: missing[pid] for pid in chunk if pid in missing}
        payloads |= fetch_payloads(client, [pid for pid in chunk if pid not in missing])
        stats["no_point"] += len(chunk) - len(payloads)
        embed_points(crate, client, vocabulary, payloads, force=set(missing) & set(chunk), stats=stats,
                     dry_run=dry_run)
        print(f"incremental: {start + len(chunk)}/{len(candidates)} {json.dumps(stats)}", flush=True)
    if sweep_due(crate, started_at):
        stats["sweep"] = sweep_changed(crate, client, vocabulary, dry_run)
    stats["new_terms"] = vocabulary.new_terms
    if not dry_run:
        write_state(crate, INCREMENTAL_CHECKPOINT, {"started_at": started_at.isoformat(), "stats": stats})
    return stats


def sweep_due(crate, now: datetime) -> bool:
    last = read_state(crate, SWEEP_CHECKPOINT)
    return last is None or now - datetime.fromisoformat(last["started_at"]) >= SWEEP_EVERY


def sweep_changed(crate, client: QdrantClient, vocabulary: TermVocabulary, dry_run: bool) -> dict:
    """Embed every point whose input hash differs from the stored one, whatever its timestamps."""
    started_at = datetime.now(timezone.utc)
    stats = _new_stats()
    offset = None
    while True:
        points, offset = client.scroll(
            MEDIA_COLLECTION, limit=CHUNK_SIZE, offset=offset,
            with_payload=PAYLOAD_FIELDS + ["media_type", "tmdb_id"], with_vectors=False,
        )
        stats["candidates"] += len(points)
        embed_points(crate, client, vocabulary, {int(p.id): p.payload or {} for p in points}, force=set(),
                     stats=stats, dry_run=dry_run)
        if offset is None:
            break
    print(f"sweep: {json.dumps(stats)}", flush=True)
    if not dry_run:
        write_state(crate, SWEEP_CHECKPOINT, {"started_at": started_at.isoformat(), "stats": stats})
    return stats


def run_full(crate, client: QdrantClient, restart: bool, max_minutes: float, dry_run: bool,
             clock: Callable[[], float] = time.monotonic) -> dict:
    started = clock()
    checkpoint = None if restart else read_state(crate, FULL_CHECKPOINT)
    if checkpoint and checkpoint.get("completed_at"):
        checkpoint = None
    offset = checkpoint["next_point_id"] if checkpoint else None
    run_started_at = checkpoint["started_at"] if checkpoint else datetime.now(timezone.utc).isoformat()
    stats = _new_stats() | {"resumed_from": offset}
    vocabulary = TermVocabulary(crate)
    while True:
        points, offset = client.scroll(
            MEDIA_COLLECTION, limit=CHUNK_SIZE, offset=offset,
            with_payload=PAYLOAD_FIELDS + ["media_type", "tmdb_id"], with_vectors=False,
        )
        stats["candidates"] += len(points)
        embed_points(crate, client, vocabulary, {int(p.id): p.payload or {} for p in points}, force=None,
                     stats=stats, dry_run=dry_run)
        done = offset is None
        state = {"started_at": run_started_at, "next_point_id": offset}
        if done:
            state["completed_at"] = datetime.now(timezone.utc).isoformat()
        if not dry_run:
            write_state(crate, FULL_CHECKPOINT, state)
        print(f"full: next point {offset} {json.dumps(stats)}", flush=True)
        if done:
            break
        if max_minutes and clock() - started > max_minutes * 60:
            stats["stopped_early"] = True
            break
    stats["next_point_id"] = offset
    stats["new_terms"] = vocabulary.new_terms
    return stats


def main(
    mode: str = "incremental",
    since: str | None = None,
    restart: bool = False,
    max_minutes: float = 0,
    dry_run: bool = False,
):
    """Embed titles for search.

    mode: `incremental` or `full`.
    since: incremental only; an ISO timestamp to start from instead of the checkpoint.
    restart: full only; start over instead of resuming from the checkpoint.
    max_minutes: full only; stop after the chunk that passes this many minutes (0: no limit).
    dry_run: count what would be embedded, write nothing.
    """
    started = time.monotonic()
    with ExitStack() as stack:
        crate = CrateConnector()
        stack.callback(crate.disconnect)
        qdrant = QdrantConnector(timeout=REQUEST_TIMEOUT_SECONDS)
        stack.callback(qdrant.close)
        if mode == "incremental":
            start = datetime.fromisoformat(since.replace("Z", "+00:00")) if since else None
            stats = run_incremental(crate, qdrant.client, start, dry_run)
        elif mode == "full":
            stats = run_full(crate, qdrant.client, restart, max_minutes, dry_run)
        else:
            raise ValueError(f"Unknown mode {mode!r}; use 'incremental' or 'full'")
    stats["embed_seconds"] = round(stats["embed_seconds"], 1)
    stats["seconds"] = round(time.monotonic() - started, 1)
    return {"mode": mode, "dry_run": dry_run, **stats}
