"""The title snapshot publisher: its encoding round-trips through the webapp decoder's checks
(ported here, and the webapp's own code under Node when it is installed), it pages Crate, and it
publishes only when an analysis changed, keeping at most two versions in Redis."""
import json
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from unittest.mock import patch

import fakeredis

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import title_snapshot as ts

ROOT = Path(__file__).parents[1]
WEBAPP_KEYS = ROOT.parent / "goodwatch-webapp/app/server/utils/fingerprint.ts"


def decode(manifest: dict, chunks: list[bytes], key_order: list[str]) -> list[dict]:
    """A port of the webapp's checkManifest, joinChunks and checkRows (format.server.ts)."""
    assert manifest["format"] == 1
    assert isinstance(manifest["version"], str) and 1 <= len(manifest["version"]) <= 64
    assert all(c.isalnum() or c in "_.-" for c in manifest["version"])
    assert manifest["chunks"] == len(chunks) >= 1
    assert manifest["keyOrder"] == key_order
    assert len(manifest["genres"]) <= 32 and len(set(manifest["genres"])) == len(manifest["genres"])
    assert len(manifest["origins"]) <= 255 and len(set(manifest["origins"])) == len(manifest["origins"])
    datetime.fromisoformat(manifest["builtAt"].replace("Z", "+00:00"))
    data = b"".join(chunks)
    assert sha256(data).hexdigest() == manifest["sha256"]
    count = manifest["count"]
    assert len(data) == count * 101
    at = 0

    def take(fmt: str, width: int) -> tuple:
        nonlocal at
        values = struct.unpack_from(f"<{count}{fmt}", data, at)
        at += width * count
        return values

    point_ids, genres, days, votes = take("d", 8), take("I", 4), take("i", 4), take("I", 4)
    popularity = take("f", 4)
    fingerprints = data[at:at + 74 * count]
    at += 74 * count
    scores, origins, flags = take("B", 1), take("B", 1), take("B", 1)
    previous = float("-inf")
    for pid in point_ids:
        assert pid > previous, "point ids not ascending"
        tmdb_id = pid - 2e12 if pid >= 2e12 else pid - 1e12
        assert tmdb_id == int(tmdb_id) and 0 <= tmdb_id < 1e12
        previous = pid
    genre_bits = 0 if len(manifest["genres"]) >= 32 else ~((1 << len(manifest["genres"])) - 1) & 0xFFFFFFFF
    for r in range(count):
        assert not genres[r] & genre_bits
        assert origins[r] == 255 or origins[r] < len(manifest["origins"])
        assert scores[r] == 255 or scores[r] <= 100
    assert all(v <= 10 or v == 255 for v in fingerprints)
    return [{
        "point_id": point_ids[r],
        "genres": [g for i, g in enumerate(manifest["genres"]) if genres[r] >> i & 1],
        "release_day": days[r], "votes": votes[r], "popularity": popularity[r],
        "fingerprint": list(fingerprints[r * 74:(r + 1) * 74]), "score": scores[r],
        "origin": manifest["origins"][origins[r]] if origins[r] != 255 else None, "flags": flags[r],
    } for r in range(count)]


def record(tmdb_id: int, *, scores=None, genres=("Drama",), day=0, score=71.9, votes=1234, popularity=12.5,
           countries=("US",), language="en", poster="/p.jpg", backdrop=None, adult=False, anime=None) -> list:
    """One Crate record in the publisher's column order."""
    scores = list(scores) if scores is not None else [k % 11 for k in range(74)]
    return [tmdb_id, *scores, list(genres) if genres is not None else None, day, score, votes, popularity,
            list(countries) if countries is not None else None, language, poster, backdrop, adult, anime]


class FakeCrate:
    """Answers the publisher's two statements from in-memory records per table."""

    def __init__(self, tables: dict[str, list[list]], marks: dict[str, list[int]] | None = None):
        self.tables = tables
        self.marks = marks or {"movie": [1, 10], "show": [1, 20]}
        self.statements: list[str] = []

    def select(self, sql: str, params: list) -> list:
        self.statements.append(sql)
        table = sql.split(" FROM ")[1].split()[0]
        if sql.startswith("SELECT count(dna_updated_at)"):
            return [self.marks[table]]
        last = params[0]
        found = sorted((r for r in self.tables[table] if r[0] > last), key=lambda r: r[0])
        return found[:ts.PAGE_SIZE]


class EncodingTest(unittest.TestCase):
    def rows(self):
        return [
            ts.to_row(ts.SHOW_BASE, record(1396, genres=["Crime", "Drama"], day=1_380_000_000_000, countries=[],
                                           language="en", anime=True, backdrop="/b.jpg")),
            ts.to_row(ts.MOVIE_BASE, record(603, scores=[None] * 3 + [10.4] + [7] * 70, day=-86_400_000 * 3,
                                            score=None, votes=None, popularity=None, countries=["DE"], poster=None,
                                            adult=True)),
            ts.to_row(ts.MOVIE_BASE, record(27205, genres=["Action", "Science Fiction"], day=None, score=100.0,
                                            votes=2**40, countries=None, language=None)),
        ]

    def test_the_key_order_is_the_webapps(self):
        source = WEBAPP_KEYS.read_text()
        block = source.split("VALID_FINGERPRINT_KEYS: readonly (keyof CoreScores)[] = [")[1].split("] as const")[0]
        webapp_keys = [part.strip().strip('"') for line in block.splitlines() if not line.strip().startswith("//")
                       for part in line.split(",") if part.strip().strip('"')]
        self.assertEqual(ts.KEY_ORDER, webapp_keys)

    def test_rows_round_trip_through_the_decoder_checks(self):
        built_at = datetime(2026, 9, 27, 18, 0, tzinfo=timezone.utc)
        manifest, chunks = ts.encode_snapshot(self.rows(), ts.version_of(built_at), built_at, {"sourceMark": {}})

        decoded = decode(manifest, chunks, ts.KEY_ORDER)

        self.assertEqual(manifest["version"], "20260927T180000Z")
        self.assertEqual(manifest["builtAt"], "2026-09-27T18:00:00.000Z")
        self.assertEqual(manifest["genres"], ["Action", "Crime", "Drama", "Science Fiction"])
        self.assertEqual(manifest["origins"], ["DE", "en"])
        self.assertEqual([r["point_id"] for r in decoded], [1e12 + 603, 1e12 + 27205, 2e12 + 1396])
        matrix, inception, breaking_bad = decoded
        self.assertEqual(matrix["fingerprint"][:5], [255, 255, 255, 10, 7])
        self.assertEqual((matrix["release_day"], matrix["score"], matrix["votes"], matrix["popularity"]),
                         (-3, 255, 0, 0.0))
        self.assertEqual((matrix["origin"], matrix["flags"]), ("DE", ts.FLAG_ADULT))
        self.assertEqual((inception["release_day"], inception["score"], inception["votes"], inception["origin"]),
                         (ts.UNKNOWN_DAY, 100, 2**32 - 1, None))
        self.assertEqual(inception["genres"], ["Action", "Science Fiction"])
        self.assertEqual((breaking_bad["release_day"], breaking_bad["score"], breaking_bad["popularity"]),
                         (15972, 71, 12.5))
        self.assertEqual((breaking_bad["origin"], breaking_bad["flags"]),
                         ("en", ts.FLAG_POSTER | ts.FLAG_BACKDROP | ts.FLAG_ANIME))

    def test_titles_without_scores_are_left_out(self):
        self.assertIsNone(ts.to_row(ts.MOVIE_BASE, record(1, scores=[None] * 74)))

    def test_chunks_hold_at_most_one_megabyte(self):
        rows = [ts.to_row(ts.MOVIE_BASE, record(i)) for i in range(1, 12_001)]
        manifest, chunks = ts.encode_snapshot(rows, "v", datetime.now(timezone.utc))

        self.assertEqual([len(c) for c in chunks], [1024 * 1024] * 1 + [12_000 * 101 - 1024 * 1024])
        self.assertEqual(manifest["chunks"], 2)
        decode(manifest, chunks, ts.KEY_ORDER)

    def test_an_empty_catalog_is_one_empty_chunk(self):
        manifest, chunks = ts.encode_snapshot([], "v", datetime.now(timezone.utc))

        self.assertEqual((manifest["count"], chunks), (0, [b""]))

    @unittest.skipUnless(shutil.which("node"), "needs Node to run the webapp's decoder")
    def test_the_webapp_decodes_it_and_encodes_the_same_bytes(self):
        rows = self.rows()
        built_at = datetime(2026, 9, 27, 18, 0, tzinfo=timezone.utc)
        manifest, chunks = ts.encode_snapshot(rows, "20260927T180000Z", built_at, {"sourceMark": {}})
        out = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, out)
        (out / "manifest.json").write_text(json.dumps(manifest))
        for n, chunk in enumerate(chunks):
            (out / f"chunk-{n}.bin").write_bytes(chunk)
        (out / "rows.json").write_text(json.dumps([{
            "pointId": r["point_id"], "genres": r["genres"], "releaseDay": r["release_day"], "votes": r["votes"],
            "popularity": r["popularity"], "fingerprint": list(r["fingerprint"]), "score": r["score"],
            "origin": r["origin"], "hasPoster": r["poster"], "hasBackdrop": r["backdrop"], "adult": r["adult"],
            "anime": r["anime"],
        } for r in rows]))

        result = subprocess.run(["node", str(ROOT / "tests/fixtures/title_snapshot_check.ts"), str(out)],
                                capture_output=True, text=True, check=True)
        checked = json.loads(result.stdout)

        self.assertEqual(checked["count"], 3)
        self.assertEqual([r["pointId"] for r in checked["rows"]], [1e12 + 603, 1e12 + 27205, 2e12 + 1396])
        self.assertEqual(checked["rows"][0]["fingerprint"][:4], [255, 255, 255, 10])
        self.assertEqual(checked["rows"][2]["releaseDay"], 15972)
        self.assertTrue(checked["sameSha256"] and checked["sameGenres"] and checked["sameOrigins"])


class ReadingTest(unittest.TestCase):
    def test_pages_by_tmdb_id_and_keeps_titles_with_scores(self):
        movies = [record(i) for i in range(1, 2 * ts.PAGE_SIZE + 2)] + [record(99_999, scores=[None] * 74)]
        crate = FakeCrate({"movie": movies, "show": []})

        rows = ts.read_rows(crate.select, "movie")

        self.assertEqual(len(rows), 2 * ts.PAGE_SIZE + 1)
        self.assertEqual(len(crate.statements), 3)
        self.assertTrue(all("dna_updated_at IS NOT NULL AND tmdb_id > ?" in s for s in crate.statements))
        self.assertNotIn("fingerprint_scores IS NOT NULL", crate.statements[0])
        self.assertIn("fingerprint_scores['adrenaline']", crate.statements[0])

    def test_a_failed_page_is_retried(self):
        crate = FakeCrate({"movie": [record(1)], "show": []})
        calls = []

        def flaky(sql, params):
            calls.append(sql)
            if len(calls) == 1:
                raise ConnectionError("reset")
            return crate.select(sql, params)

        with patch.object(ts.time, "sleep"):
            self.assertEqual(len(ts.read_rows(flaky, "movie")), 1)


class PublishingTest(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.crate = FakeCrate({"movie": [record(603), record(604)], "show": [record(1396)]})
        self.clock = iter(datetime(2026, 9, 27, 18, minute, tzinfo=timezone.utc) for minute in range(60))

    def run_once(self, **kwargs):
        return ts.run(self.redis, self.crate.select, now=lambda: next(self.clock), **kwargs)

    def stored(self):
        manifest = json.loads(self.redis.get(ts.CURRENT_KEY))
        chunks = [self.redis.get(ts.chunk_key(manifest["version"], n)) for n in range(manifest["chunks"])]
        return manifest, chunks

    def versions(self):
        return sorted({key.decode().split(":")[1] for key in self.redis.scan_iter("title-snapshot:*:*")})

    def test_the_first_run_publishes_a_decodable_snapshot(self):
        result = self.run_once()

        manifest, chunks = self.stored()
        self.assertTrue(result["published"])
        self.assertEqual((manifest["count"], result["count"], result["source"]), (3, 3, "crate"))
        self.assertEqual(manifest["sourceMark"], {"movie": [1, 10], "show": [1, 20]})
        self.assertEqual(len(decode(manifest, chunks, ts.KEY_ORDER)), 3)
        self.assertIsNone(self.redis.get(ts.LOCK_KEY))

    def test_a_run_without_changed_analyses_publishes_nothing(self):
        self.run_once()
        statements = len(self.crate.statements)

        result = self.run_once()

        self.assertFalse(result["published"])
        self.assertEqual(result["version"], "20260927T180000Z")
        # Only the two mark aggregates ran; no title was read.
        self.assertEqual(len(self.crate.statements), statements + 2)

    def test_a_forced_run_or_a_changed_analysis_publishes(self):
        self.run_once()
        self.assertTrue(self.run_once(force=True)["published"])
        self.crate.marks["show"] = [2, 40]
        self.crate.tables["show"].append(record(1399))

        result = self.run_once()

        self.assertTrue(result["published"])
        self.assertEqual(self.stored()[0]["count"], 4)

    def test_at_most_two_versions_remain(self):
        self.redis.set("title-snapshot:dev-old:0", b"x")
        self.redis.set("title-snapshot:unrelated", b"kept")
        for _ in range(3):
            self.run_once(force=True)

        self.assertEqual(self.versions(), ["20260927T180100Z", "20260927T180200Z"])
        self.assertEqual(self.redis.get("title-snapshot:unrelated"), b"kept")

    def test_a_dry_run_writes_nothing(self):
        result = self.run_once(dry_run=True)

        self.assertFalse(result["published"])
        self.assertEqual(result["count"], 3)
        self.assertEqual(self.redis.keys("title-snapshot:*"), [])

    def test_a_dry_run_ignores_the_lock(self):
        self.redis.set(ts.LOCK_KEY, "other")

        self.assertEqual(self.run_once(dry_run=True)["count"], 3)
        self.assertEqual(self.redis.get(ts.LOCK_KEY), b"other")

    def test_a_run_while_another_publishes_leaves_it_alone(self):
        self.redis.set(ts.LOCK_KEY, "other")

        result = self.run_once()

        self.assertEqual(result["reason"], "another publish is running")
        self.assertEqual(self.redis.get(ts.LOCK_KEY), b"other")
        self.assertIsNone(self.redis.get(ts.CURRENT_KEY))


class VectorCopyTriggerTest(unittest.TestCase):
    def test_a_scheduled_copy_starts_the_publisher_and_a_targeted_one_does_not(self):
        from f.sync.copy import vector_data

        with patch.object(vector_data, "init_mongodb"), patch.object(vector_data, "close_mongodb"), \
                patch.object(vector_data, "QdrantConnector"), \
                patch.object(vector_data, "copy_to_qdrant", return_value={}), \
                patch("wmill.run_script_by_path_async", return_value="job-1") as start:
            scheduled = vector_data.main()
            targeted = vector_data.main(movie_ids=["603"])

        self.assertEqual(scheduled["title_snapshot"], "job-1")
        self.assertNotIn("title_snapshot", targeted)
        start.assert_called_once_with(path="f/sync/copy/title_snapshot", args={})


if __name__ == "__main__":
    unittest.main()
