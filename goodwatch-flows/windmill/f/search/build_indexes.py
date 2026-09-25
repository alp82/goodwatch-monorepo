# extra_requirements:
# qdrant-client==1.19.1

"""Build the search indexes: the index files the webapp loads, and the reference profiles.

Runs nightly and by hand after a full `f/search/embed_titles` run. One run:

1. Reads the eligible titles (`goodwatch_overall_score_voting_count >= 2000`, not adult)
   from Qdrant (payload, `fingerprint_v1`, `text_en_v1`, `text_multi_v1`) and Crate (text
   fields, companies), plus their credits, people and studios from Crate and their term ids
   from `search_terms`.
2. Builds every index with `f/search/index_builders` and encodes the intent examples with
   multilingual-e5-small.
3. Records the build in `search_index_builds` (status `building`, with its file list), then
   writes each file, gzipped JSON, to the Crate blob table `search_index_files` under the
   SHA-1 of its bytes. A file whose digest is already stored isn't written again.
4. Rewrites `search_reference_profiles` in Qdrant: one point per person, team and studio,
   with the build id in its payload.
5. Marks the build `complete` and moves the `current` row of `search_index_builds` to it
   with a compare-and-set, so the webapp never sees a partial build.
6. Cleans up: keeps the current and the previous build (and builds still running), deletes
   every other build row, blob and profile point.

The webapp reads `SELECT manifest FROM search_index_builds WHERE build_id = 'current'` and
downloads each file from `/_blobs/search_index_files/<sha1>`. Formats:
docs/implementation/search-ranking/README.md ("Index files").
"""

import base64
import gzip
import hashlib
import http.client
import json
import time
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import numpy as np
import wmill
from qdrant_client import QdrantClient, models as qm

from f.db.cratedb import CrateConnector
from f.db.qdrant import QdrantConnector
from f.search import index_builders as ib
from f.search.text_encoder import MULTILINGUAL_E5_SMALL, encode
from f.search.title_text import CRATE_COLUMNS, title_inputs
from f.sync.copy.qdrant_retry import REQUEST_TIMEOUT_SECONDS, insert_points, update_points, write_with_retry
from f.sync.models.qdrant_schemas import (
    FINGERPRINT_VECTOR, MEDIA_COLLECTION, REFERENCE_PROFILES_COLLECTION, TEXT_EN_VECTOR, TEXT_MULTI_VECTOR,
)

FILES_TABLE = "search_index_files"          # blob table
BUILDS_TABLE = "search_index_builds"
CURRENT = "current"                         # build_id of the pointer row
FORMAT_VERSION = 1
# A build still running this long after it started is treated as failed by the cleanup.
BUILDING_GRACE = timedelta(hours=6)

SCROLL_PAGE = 1000
CRATE_CHUNK = 1500                          # titles per credits query
CRATE_ID_CHUNK = 5000
PROFILE_BATCH = 256
PAYLOAD_FIELDS = ["tmdb_id", "media_type", "title", "original_title", "release_year", "tropes", "adult",
                  "goodwatch_overall_score_voting_count", "goodwatch_overall_score_normalized_percent",
                  "production_method", *ib.BOOL_FLAGS]
TEXT_DIMENSIONS = {TEXT_EN_VECTOR: 768, TEXT_MULTI_VECTOR: 384}


# ---- Reading -------------------------------------------------------------------------------


def _chunks(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def eligible_filter() -> qm.Filter:
    return qm.Filter(
        must=[qm.FieldCondition(key="goodwatch_overall_score_voting_count", range=qm.Range(gte=ib.ELIGIBLE_VOTES))],
        must_not=[qm.FieldCondition(key="adult", match=qm.MatchValue(value=True))],
    )


def read_points(client: QdrantClient, stats: dict) -> tuple[list[dict], dict[str, np.ndarray]]:
    """Payloads and vectors of the eligible points, in point id order."""
    payloads, ids = [], []
    vectors = {FINGERPRINT_VECTOR: [], TEXT_EN_VECTOR: [], TEXT_MULTI_VECTOR: []}
    sizes = {FINGERPRINT_VECTOR: 74, **TEXT_DIMENSIONS}
    stats["missing_vectors"] = {name: 0 for name in vectors}
    offset = None
    while True:
        points, offset = client.scroll(
            MEDIA_COLLECTION, scroll_filter=eligible_filter(), limit=SCROLL_PAGE, offset=offset,
            with_payload=PAYLOAD_FIELDS, with_vectors=list(vectors),
        )
        for p in points:
            ids.append(int(p.id))
            payloads.append(p.payload or {})
            for name, rows in vectors.items():
                v = (p.vector or {}).get(name)
                if v is None:
                    stats["missing_vectors"][name] += 1
                    v = np.zeros(sizes[name], np.float32)
                rows.append(np.asarray(v, np.float32))
        if offset is None:
            break
    order = np.argsort(np.array(ids, np.int64), kind="stable")
    payloads = [payloads[i] | {"_point_id": ids[i]} for i in order]
    return payloads, {name: np.stack(rows)[order] if rows else np.zeros((0, sizes[name]), np.float32)
                      for name, rows in vectors.items()}


def read_media_rows(crate, payloads: list[dict]) -> dict[tuple[str, int], dict]:
    columns = CRATE_COLUMNS + ", adult, imdb_id, popularity, production_company_ids"
    out = {}
    for media_type in ("movie", "show"):
        tmdb_ids = [p["tmdb_id"] for p in payloads if p.get("media_type") == media_type]
        extra = ", network_ids" if media_type == "show" else ""
        for batch in _chunks(tmdb_ids, CRATE_ID_CHUNK):
            for row in crate.select(f"SELECT {columns}{extra} FROM {media_type} WHERE tmdb_id = ANY(?)", (batch,)):
                out[(media_type, row["tmdb_id"])] = row
    return out


def eligible_titles(payloads: list[dict], rows: dict, stats: dict) -> tuple[list[ib.Title], list[int]]:
    """Titles as the catalog the ranker was tuned on built them; drops titles Crate marks adult.
    Returns the titles and their positions in `payloads`."""
    titles, keep = [], []
    stats["adult_in_crate"] = stats["no_crate_row"] = 0
    for i, p in enumerate(payloads):
        key = (p.get("media_type"), p.get("tmdb_id"))
        row = rows.get(key)
        if row is None:
            stats["no_crate_row"] += 1
        elif row.get("adult") is True:
            stats["adult_in_crate"] += 1
            continue
        row = row or {}
        inputs = title_inputs(p, row)
        titles.append(ib.Title(
            point_id=p["_point_id"], media_type=p["media_type"], tmdb_id=int(p["tmdb_id"]),
            title=p.get("title") or inputs.original_title or "", original_title=inputs.original_title or "",
            year=int(p.get("release_year") or 0), votes=int(p.get("goodwatch_overall_score_voting_count") or 0),
            goodwatch_score=p.get("goodwatch_overall_score_normalized_percent"),
            popularity=float(row.get("popularity") or 0), imdb_id=(row.get("imdb_id") or "").strip() or None,
            flags={f: p.get(f) for f in ib.BOOL_FLAGS}, production_method=p.get("production_method"),
            essence_text=inputs.essence_text or "", essence_tags=list(inputs.essence_tags),
            keywords=list(inputs.keywords), tropes=list(inputs.tropes),
        ))
        keep.append(i)
    return titles, keep


def read_credit_rows(crate, titles: list[ib.Title]) -> tuple[list, list]:
    crew, cast = [], []
    for media_type in ("movie", "show"):
        tmdb_ids = [t.tmdb_id for t in titles if t.media_type == media_type]
        for batch in _chunks(tmdb_ids, CRATE_CHUNK):
            for r in crate.select(
                "SELECT media_tmdb_id, person_tmdb_id, job, episode_count_job FROM person_worked_on "
                "WHERE media_type = ? AND job = ANY(?) AND media_tmdb_id = ANY(?)",
                (media_type, list(ib.CREW_JOBS), batch),
            ):
                crew.append((media_type, r["media_tmdb_id"], r["person_tmdb_id"], r["job"], r["episode_count_job"]))
            for r in crate.select(
                "SELECT media_tmdb_id, person_tmdb_id, order_default, episode_count_character FROM person_appeared_in "
                "WHERE media_type = ? AND order_default < ? AND media_tmdb_id = ANY(?)",
                (media_type, ib.CAST_ORDER_LIMIT[media_type], batch),
            ):
                cast.append((media_type, r["media_tmdb_id"], r["person_tmdb_id"], r["order_default"],
                             r["episode_count_character"]))
    return crew, cast


def read_names(crate, table: str, ids: set[int], columns: str) -> list[dict]:
    out = []
    for batch in _chunks(sorted(ids), CRATE_ID_CHUNK):
        out += crate.select(f"SELECT {columns} FROM {table} WHERE tmdb_id = ANY(?)", (batch,))
    return out


def read_term_ids(crate, terms: set[str]) -> dict[str, int]:
    out = {}
    for batch in _chunks(sorted(terms), CRATE_ID_CHUNK):
        for row in crate.select("SELECT term, id FROM search_terms WHERE term = ANY(?)", (batch,)):
            out[row["term"]] = row["id"]
    return out


def read_sources(crate, client: QdrantClient, stats: dict) -> ib.Sources:
    started = time.monotonic()
    payloads, vectors = read_points(client, stats)
    rows = read_media_rows(crate, payloads)
    titles, keep = eligible_titles(payloads, rows, stats)
    crew, cast = read_credit_rows(crate, titles)
    person_ids = {r[2] for r in crew} | {r[2] for r in cast}
    people = {r["tmdb_id"]: ib.Person(r["name"], r["original_name"], r["known_for_department"], r["popularity"])
              for r in read_names(crate, "person", person_ids,
                                  "tmdb_id, name, original_name, known_for_department, popularity")}
    media = {}
    for t in titles:
        row = rows.get((t.media_type, t.tmdb_id)) or {}
        media[(t.media_type, t.tmdb_id)] = (row.get("production_company_ids"), row.get("network_ids"))
    company_ids = {c for pc, _ in media.values() for c in (pc or [])}
    network_ids = {c for _, nw in media.values() for c in (nw or [])}
    companies = {r["tmdb_id"]: r["name"] for r in read_names(crate, "production_company", company_ids, "tmdb_id, name")}
    networks = {r["tmdb_id"]: r["name"] for r in read_names(crate, "network", network_ids, "tmdb_id, name")}
    terms = set()
    for t in titles:
        terms |= ib.title_terms(t)
    term_ids = read_term_ids(crate, terms)
    stats |= {"eligible_points": len(payloads), "crew_rows": len(crew), "cast_rows": len(cast), "people": len(people),
              "read_seconds": round(time.monotonic() - started, 1)}
    keep = np.array(keep, np.int64)
    return ib.Sources(
        titles=titles, fingerprints=vectors[FINGERPRINT_VECTOR][keep], text_en=vectors[TEXT_EN_VECTOR][keep],
        text_multi=vectors[TEXT_MULTI_VECTOR][keep], crew=crew, cast=cast, people=people, media_companies=media,
        company_names=companies, network_names=networks, term_ids=term_ids,
    )


# ---- Files and builds --------------------------------------------------------------------------


def serialize(doc: dict) -> bytes:
    """Gzipped compact JSON. Same content, same bytes: gzip's timestamp is fixed at 0."""
    raw = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    return gzip.compress(raw, compresslevel=9, mtime=0)


def file_entries(files: dict[str, bytes]) -> dict[str, dict]:
    return {name: {"sha1": hashlib.sha1(data).hexdigest(), "bytes": len(data)} for name, data in files.items()}


def new_build_id(now: datetime) -> str:
    return now.strftime("%Y%m%dT%H%M%SZ")


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def write_build_row(crate, build_id: str, status: str, manifest: dict) -> None:
    crate.run(
        f"INSERT INTO {BUILDS_TABLE} (build_id, status, manifest, started_at, finished_at, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (build_id) DO UPDATE SET "
        "status = excluded.status, manifest = excluded.manifest, finished_at = excluded.finished_at, "
        "updated_at = excluded.updated_at",
        (build_id, status, json.dumps(manifest), manifest["created_at"],
         _now_ms() if status != "building" else None),
    )


class BlobStore:
    """Crate's blob HTTP API (`/_blobs/<table>/<sha1>`).

    A node that doesn't hold a blob's shard answers `307` with a node that does, and for a
    write it answers before reading the body, which breaks a large upload sent to it. So a
    write first asks with `HEAD` which node to send the body to."""

    MAX_REDIRECTS = 5

    def __init__(self, hosts: list[str], username: str, password: str, table: str = FILES_TABLE,
                 timeout: float = 300) -> None:
        self.hosts = [h if "//" in h else f"http://{h}" for h in (x.strip() for x in hosts) if h]
        self.auth = "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()
        self.table = table
        self.timeout = timeout

    @classmethod
    def from_windmill(cls) -> "BlobStore":
        return cls(wmill.get_variable("u/Alp/CRATE_HOSTS").split(","), wmill.get_variable("u/Alp/CRATE_USER"),
                   wmill.get_variable("u/Alp/CRATE_PASS"))

    def _request(self, method: str, url: str, body: bytes | None = None) -> tuple[int, str | None]:
        parts = urlsplit(url)
        conn = http.client.HTTPConnection(parts.hostname, parts.port or 4200, timeout=self.timeout)
        try:
            conn.request(method, parts.path, body=body, headers={"Authorization": self.auth})
            response = conn.getresponse()
            response.read()
            return response.status, response.getheader("Location")
        finally:
            conn.close()

    def _follow(self, method: str, digest: str) -> tuple[int, str]:
        """(status, url) of a body-less request after following redirects."""
        url = f"{self.hosts[0]}/_blobs/{self.table}/{digest}"
        for _ in range(self.MAX_REDIRECTS):
            status, location = self._request(method, url)
            if status != 307:
                return status, url
            url = location
        raise RuntimeError(f"Too many redirects for blob {digest}")

    def exists(self, digest: str) -> bool:
        status, _ = self._follow("HEAD", digest)
        if status not in (200, 404):
            raise RuntimeError(f"HEAD blob {digest}: HTTP {status}")
        return status == 200

    def put(self, digest: str, data: bytes) -> bool:
        """True when written, False when the blob was already stored."""
        status, url = self._follow("HEAD", digest)
        if status == 200:
            return False
        if status != 404:
            raise RuntimeError(f"HEAD blob {digest}: HTTP {status}")
        status, _ = self._request("PUT", url, data)
        if status not in (201, 409):
            raise RuntimeError(f"PUT blob {digest}: HTTP {status}")
        return status == 201

    def delete(self, digest: str) -> bool:
        status, _ = self._follow("DELETE", digest)
        if status not in (204, 404):
            raise RuntimeError(f"DELETE blob {digest}: HTTP {status}")
        return status == 204


def store_files(blobs, files: dict[str, bytes], entries: dict[str, dict], stats: dict) -> None:
    """Write each file to the blob table unless its digest is already stored."""
    stats["files_written"] = stats["files_unchanged"] = stats["bytes_written"] = 0
    started = time.monotonic()
    for name, data in files.items():
        digest = entries[name]["sha1"]
        if not blobs.put(digest, data):
            stats["files_unchanged"] += 1
            continue
        if not blobs.exists(digest):
            raise RuntimeError(f"Blob {digest} ({name}) is missing after the write")
        stats["files_written"] += 1
        stats["bytes_written"] += len(data)
    stats["store_seconds"] = round(time.monotonic() - started, 1)


def read_current(crate) -> tuple[dict | None, int | None, int | None]:
    rows = crate.select(
        f"SELECT manifest, _seq_no, _primary_term FROM {BUILDS_TABLE} WHERE build_id = ?", (CURRENT,),
    )
    if not rows:
        return None, None, None
    return json.loads(rows[0]["manifest"]), rows[0]["_seq_no"], rows[0]["_primary_term"]


def publish(crate, manifest: dict, seen: tuple) -> None:
    """Move the current-build row to `manifest`, unless another build moved it since `seen`."""
    _, seq_no, primary_term = seen
    if seq_no is None:
        crate.run(
            f"INSERT INTO {BUILDS_TABLE} (build_id, status, manifest, started_at, finished_at, created_at, updated_at) "
            "VALUES (?, 'current', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (build_id) DO NOTHING",
            (CURRENT, json.dumps(manifest), manifest["created_at"], _now_ms()),
        )
    else:
        crate.run(
            f"UPDATE {BUILDS_TABLE} SET manifest = ?, finished_at = ?, updated_at = CURRENT_TIMESTAMP "
            "WHERE build_id = ? AND _seq_no = ? AND _primary_term = ?",
            (json.dumps(manifest), _now_ms(), CURRENT, seq_no, primary_term),
        )
    if crate.cur.rowcount != 1:
        raise RuntimeError("Another build moved the current-build row first; this build stays unpublished")
    crate.run(f"REFRESH TABLE {BUILDS_TABLE}")


def cleanup(crate, blobs, client: QdrantClient | None, now: datetime, stats: dict) -> None:
    """Keep the current and the previous build, and builds that are still running; delete the
    rest: build rows, blobs and profile points."""
    crate.run(f"REFRESH TABLE {BUILDS_TABLE}")
    current, _, _ = read_current(crate)
    if current is None:
        return
    keep_builds = {current["build_id"]} | ({current["previous_build_id"]} if current.get("previous_build_id") else set())
    keep_digests = set()
    delete_rows = []
    for row in crate.select(f"SELECT build_id, status, manifest, started_at FROM {BUILDS_TABLE}"):
        if row["build_id"] == CURRENT:
            continue
        manifest = json.loads(row["manifest"])
        running = (row["status"] == "building"
                   and now - datetime.fromtimestamp(row["started_at"] / 1000, timezone.utc) < BUILDING_GRACE)
        if row["build_id"] in keep_builds or running:
            keep_digests |= {f["sha1"] for f in manifest["files"].values()}
            if running:
                keep_builds.add(row["build_id"])
        else:
            delete_rows.append(row["build_id"])
    keep_digests |= {f["sha1"] for f in current["files"].values()}
    deleted = 0
    for row in crate.select(f"SELECT digest FROM blob.{FILES_TABLE}"):
        if row["digest"] not in keep_digests:
            blobs.delete(row["digest"])
            deleted += 1
    for build_id in delete_rows:
        crate.run(f"DELETE FROM {BUILDS_TABLE} WHERE build_id = ?", (build_id,))
    crate.run(f"REFRESH TABLE {BUILDS_TABLE}")
    stats["cleanup"] = {"kept_builds": sorted(keep_builds), "deleted_builds": sorted(delete_rows),
                        "deleted_blobs": deleted}
    if client is not None:
        stale = qm.Filter(must_not=[qm.FieldCondition(key="build_id", match=qm.MatchAny(any=sorted(keep_builds)))])
        stats["cleanup"]["stale_profiles"] = client.count(REFERENCE_PROFILES_COLLECTION, count_filter=stale,
                                                          exact=True).count
        client.delete(REFERENCE_PROFILES_COLLECTION, points_selector=qm.FilterSelector(filter=stale), wait=True)


# ---- Reference profiles -----------------------------------------------------------------------


def write_profiles(client: QdrantClient, profiles: list[dict], build_id: str, stats: dict) -> None:
    attempts = 0
    for batch in (profiles[i:i + PROFILE_BATCH] for i in range(0, len(profiles), PROFILE_BATCH)):
        points = [
            qm.PointStruct(
                id=p["id"],
                vector={FINGERPRINT_VECTOR: p["fingerprint_v1"].tolist(), TEXT_EN_VECTOR: p["text_en_v1"].tolist()},
                payload=p["payload"] | {"build_id": build_id},
            )
            for p in batch
        ]
        result = write_with_retry(client, REFERENCE_PROFILES_COLLECTION, insert_points(points) + update_points(points),
                                  lambda: None)
        attempts += result["attempts"]
    stats["profiles_written"] = len(profiles)
    stats["profile_write_attempts"] = attempts


# ---- Main ------------------------------------------------------------------------------------------


def run(crate, blobs, client: QdrantClient, *, dry_run: bool, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    build_id = new_build_id(now)
    stats: dict = {"build_id": build_id}
    src = read_sources(crate, client, stats)
    started = time.monotonic()
    build = ib.build_indexes(src, encode_intents=lambda texts: encode(MULTILINGUAL_E5_SMALL, texts))
    stats["build_seconds"] = round(time.monotonic() - started, 1)
    stats["indexes"] = build.stats
    files = {name: serialize(doc) for name, doc in build.files.items()}
    entries = file_entries(files)
    stats["files"] = entries
    if dry_run:
        return stats
    seen = read_current(crate)
    previous = seen[0]["build_id"] if seen[0] else None
    manifest = {
        "format": FORMAT_VERSION,
        "build_id": build_id,
        "created_at": now.isoformat(),
        "previous_build_id": previous,
        "files": entries,
        "profiles": {"collection": REFERENCE_PROFILES_COLLECTION, "points": len(build.profiles)},
        "stats": build.stats,
    }
    write_build_row(crate, build_id, "building", manifest)
    try:
        store_files(blobs, files, entries, stats)
        write_profiles(client, build.profiles, build_id, stats)
        write_build_row(crate, build_id, "complete", manifest)
        publish(crate, manifest, seen)
    except Exception:
        # The next cleanup deletes a failed build's row, and the files and profiles only it has.
        write_build_row(crate, build_id, "failed", manifest)
        raise
    stats["published"] = True
    cleanup(crate, blobs, client, now, stats)
    return stats


def main(dry_run: bool = False):
    """Build the search indexes.

    dry_run: build everything and report sizes and counts, but write nothing.
    """
    started = time.monotonic()
    with ExitStack() as stack:
        crate = CrateConnector()
        stack.callback(crate.disconnect)
        qdrant = QdrantConnector(timeout=REQUEST_TIMEOUT_SECONDS)
        stack.callback(qdrant.close)
        stats = run(crate, BlobStore.from_windmill(), qdrant.client, dry_run=dry_run)
    stats["seconds"] = round(time.monotonic() - started, 1)
    return stats
