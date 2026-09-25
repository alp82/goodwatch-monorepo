"""f/search: the search index builders and the build's storage (blob files, build rows, cleanup)."""

import gzip
import hashlib
import json
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
for name in ("onnxruntime", "tokenizers"):
    try:
        __import__(name)
    except ImportError:
        sys.modules[name] = types.SimpleNamespace(Tokenizer=None)

from f.search import build_indexes as flow  # noqa: E402
from f.search import index_builders as ib  # noqa: E402


def title(point_id, media_type="movie", votes=10_000, **kw) -> ib.Title:
    values = dict(point_id=point_id, media_type=media_type, tmdb_id=point_id % 1_000_000_000_000, title=f"T{point_id}",
                  original_title="", year=2000, votes=votes, goodwatch_score=70.0, popularity=1.0, imdb_id=None)
    return ib.Title(**(values | kw))


def sources(titles, crew=(), cast=(), people=None, media=None, companies=None, networks=None) -> ib.Sources:
    n = len(titles)
    rng = np.random.default_rng(0)

    def unit(d):
        m = rng.normal(size=(n, d)).astype(np.float32)
        return m / np.linalg.norm(m, axis=1, keepdims=True)
    return ib.Sources(titles=list(titles), fingerprints=unit(74), text_en=unit(768), text_multi=unit(384),
                      crew=list(crew), cast=list(cast), people=people or {}, media_companies=media or {},
                      company_names=companies or {}, network_names=networks or {}, term_ids={})


MOVIE = 1_000_000_000_000
SHOW = 2_000_000_000_000


class CreditTests(unittest.TestCase):
    def test_show_without_creator_takes_writers_never_pure_producers(self) -> None:
        show = title(SHOW + 7, "show")
        crew = [("show", 7, 1, "Executive Producer", 50), ("show", 7, 2, "Writer", 3),
                ("show", 7, 3, "Teleplay", 9), ("show", 7, 3, "Executive Producer", 1)]
        (tc,) = ib.title_credits(sources([show], crew=crew))
        self.assertEqual(tc.creators, [3, 2])   # producer-writer first, the pure producer never
        self.assertEqual(tc.creator_source, "fallback_writer")

    def test_creator_credit_wins(self) -> None:
        show = title(SHOW + 7, "show")
        crew = [("show", 7, 5, "Creator", None), ("show", 7, 5, "Creator", 10), ("show", 7, 2, "Writer", 30)]
        (tc,) = ib.title_credits(sources([show], crew=crew))
        self.assertEqual((tc.creators, tc.creator_source), ([5], "creator"))

    def test_credit_weights(self) -> None:
        film = title(MOVIE + 1)
        people = {10: ib.Person("Dir", None, "Directing", 1), 11: ib.Person("Co", None, "Directing", 1),
                  12: ib.Person("Writer", None, "Writing", 1), 13: ib.Person("Novelist", None, "Directing", 1),
                  20: ib.Person("Lead", None, "Acting", 1), 21: ib.Person("Extra", None, "Acting", 1)}
        crew = [("movie", 1, 10, "Director", None), ("movie", 1, 11, "Co-Director", None),
                ("movie", 1, 12, "Screenplay", None), ("movie", 1, 13, "Novel", None)]
        cast = [("movie", 1, 20, 0, None), ("movie", 1, 21, 4, None), ("movie", 1, 22, 20, None)]
        src = sources([film], crew=crew, cast=cast, people=people)
        credits = ib.person_credits(src, ib.title_credits(src))
        self.assertEqual({p: d[0] for p, d in credits.items()},
                         {10: (1.0, "director"), 11: (0.5, "co-director"), 12: (1.0, "writer"),
                          13: (0.5, "writer"), 20: (1.0, "cast"), 21: (0.5, "cast")})


class NameTests(unittest.TestCase):
    def test_fold(self) -> None:
        self.assertEqual(ib.fold("Pedro Almodóvar's"), "pedro almodovar")
        self.assertEqual(ib.fold("Simon & Schuster+Co"), "simon and schuster co")

    def test_resolution_needs_dominance_and_votes_above_the_word_reading(self) -> None:
        heavy = ib.Candidate("person", "A", (1,), 600_000)
        light = ib.Candidate("person", "B", (2,), 150_000)
        self.assertTrue(ib.resolves([heavy, light], 0))
        self.assertFalse(ib.resolves([heavy, ib.Candidate("person", "C", (3,), 250_000)], 0))
        self.assertFalse(ib.resolves([heavy], 4))       # 600k < 150k x (1 + 4)

    def test_people_who_share_their_titles_form_a_team(self) -> None:
        titles = [title(MOVIE + i, votes=100_000) for i in range(4)]
        people = {1: ib.Person("Joel Coen", None, "Directing", 5), 2: ib.Person("Ethan Coen", None, "Directing", 5)}
        crew = [("movie", i, p, "Director", None) for i in range(4) for p in (1, 2)]
        src = sources(titles, crew=crew, people=people)
        tc = ib.title_credits(src)
        credits = ib.person_credits(src, tc)
        votes = np.array([t.votes for t in titles])
        idx = ib.name_index(votes, ib.kept_persons(src, tc), credits, {})
        self.assertEqual(idx["coen"][0].kind, "team")
        self.assertEqual(sorted(idx["coen"][0].members), [1, 2])
        self.assertEqual(idx["joel coen"][0].members, (1,))

    def test_studio_brand_merges_companies_by_first_word(self) -> None:
        titles = [title(MOVIE + 1), title(MOVIE + 2)]
        media = {("movie", 1): ([100], None), ("movie", 2): ([200, 300, 100], None)}
        src = sources(titles, media=media, companies={100: "Pixar", 200: "Pixar Animation Studios", 300: "Disney"})
        st = ib.studios(src)
        self.assertEqual(st[("c", 100)], ("Pixar", {0: 1.0, 1: 0.5}))
        idx = ib.name_index(np.array([10, 20]), {}, {}, st)
        self.assertEqual(idx["pixar"][0].members, (("c", 100), ("c", 200)))
        self.assertEqual(idx["pixar"][0].mass, 30.0)


class ProfileTests(unittest.TestCase):
    def test_terms_are_tie_broken_by_term(self) -> None:
        ti = ib.TermIndex(terms=["b", "a", "c"], ids=np.array([1, 2, 3]), df=np.array([5, 5, 1]),
                          idf=ib.idf(np.array([5, 5, 1]), 100), n=100,
                          rows=[np.array([0, 1, 2]), np.array([0, 1])], missing=0)
        self.assertEqual([t for t, _ in ib.profile_terms([0, 1], ti)], ["a", "b"])   # "c" is in one seed only

    def test_seeds_are_top_main_titles_by_votes(self) -> None:
        votes = np.array([10, 30, 20, 30])
        self.assertEqual(ib.seed_rows({0: 1.0, 1: 0.5, 2: 1.0, 3: 1.0}, votes, np.array([4, 3, 2, 1])), [3, 2, 0])
        self.assertEqual(ib.seed_rows({1: 0.5}, votes, np.arange(4)), [1])

    def test_centroid_is_log_vote_weighted_and_normalized(self) -> None:
        m = np.array([[1, 0], [0, 1]], np.float32)
        c = ib.centroid(m, [0, 1], np.array([np.e - 1, np.e ** 3 - 1]))
        np.testing.assert_allclose(c, np.array([1, 3]) / np.sqrt(10), rtol=1e-6)


class CutTests(unittest.TestCase):
    def test_cuts(self) -> None:
        titles = [title(1, title="Apocalypse Now", year=1979), title(2, title="Apocalypse Now Redux", year=2001),
                  title(3, title="Heat", year=1995), title(4, title="Heat", year=1972)]
        self.assertEqual(ib.cut_edges(titles, [{9}, {9}, {8}, {7}]), [(0, 1)])


class BuildTests(unittest.TestCase):
    def test_build_is_deterministic_and_json_safe(self) -> None:
        titles = [title(MOVIE + 1, keywords=["time loop"], essence_tags=["Dark"], essence_text="A loop"),
                  title(MOVIE + 2, keywords=["time loop"])]
        src = sources(titles)
        src.term_ids = {"time": 1, "loop": 2, "time_loop": 3, "dark": 4}
        a = {k: flow.serialize(v) for k, v in ib.build_indexes(src).files.items()}
        b = {k: flow.serialize(v) for k, v in ib.build_indexes(src).files.items()}
        self.assertEqual(a, b)
        doc = json.loads(gzip.decompress(a["term_statistics"]))
        self.assertEqual(doc["n"], 2)
        self.assertEqual(dict(zip(doc["terms"], doc["df"])), {"dark": 1, "loop": 2, "time": 2, "time_loop": 2})
        labels = json.loads(gzip.decompress(a["negation_labels"]))
        self.assertEqual(labels["labels"], ["dark", "time loop"])
        self.assertEqual(labels["stems"], [["dark"], ["loop", "time"]])


# ---- storage -------------------------------------------------------------------------------------


class FakeBlobs:
    def __init__(self):
        self.data = {}
        self.puts = 0

    def exists(self, digest):
        return digest in self.data

    def put(self, digest, data):
        assert hashlib.sha1(data).hexdigest() == digest
        self.puts += 1
        created = digest not in self.data
        self.data[digest] = data
        return created

    def delete(self, digest):
        return self.data.pop(digest, None) is not None


class FakeCrate:
    """The build rows as a dict, with the compare-and-set of the current row."""

    def __init__(self):
        self.rows = {}
        self.blobs = FakeBlobs()
        self.cur = types.SimpleNamespace(rowcount=0)

    def run(self, sql, params=()):
        if sql.startswith("REFRESH"):
            return
        if sql.startswith("INSERT") and "'current'" in sql:
            build_id, manifest, started, finished = params
            self.cur.rowcount = 0 if build_id in self.rows else 1
            if self.cur.rowcount:
                self.rows[build_id] = dict(build_id=build_id, status="current", manifest=manifest, started_at=0, seq=0)
        elif sql.startswith("INSERT"):
            build_id, status, manifest, started, finished = params
            row = self.rows.setdefault(build_id, dict(build_id=build_id, seq=0))
            started_ms = int(datetime.fromisoformat(started).timestamp() * 1000)
            row.update(status=status, manifest=manifest, started_at=started_ms)
            row["seq"] += 1
            self.cur.rowcount = 1
        elif sql.startswith("UPDATE"):
            manifest, finished, build_id, seq, term = params
            row = self.rows.get(build_id)
            self.cur.rowcount = int(row is not None and row["seq"] == seq)
            if self.cur.rowcount:
                row.update(manifest=manifest, seq=seq + 1)
        elif sql.startswith("DELETE"):
            self.rows.pop(params[0], None)
        else:
            raise AssertionError(sql)

    def select(self, sql, params=()):
        if "blob." in sql:
            return [{"digest": d} for d in self.blobs.data]
        if "WHERE build_id = ?" in sql:
            row = self.rows.get(params[0])
            return [] if row is None else [{"manifest": row["manifest"], "_seq_no": row["seq"], "_primary_term": 1}]
        return [dict(r) for r in self.rows.values()]


def publish_build(crate, files: dict[str, bytes], now: datetime, running_before_publish=None) -> dict:
    """The storage half of flow.run: build row, files, publish, cleanup (no Qdrant)."""
    stats = {}
    entries = flow.file_entries(files)
    seen = flow.read_current(crate)
    build_id = flow.new_build_id(now)
    manifest = {"build_id": build_id, "created_at": now.isoformat(),
                "previous_build_id": seen[0]["build_id"] if seen[0] else None, "files": entries}
    flow.write_build_row(crate, build_id, "building", manifest)
    flow.store_files(crate.blobs, files, entries, stats)
    flow.write_build_row(crate, build_id, "complete", manifest)
    if running_before_publish:
        running_before_publish()
    flow.publish(crate, manifest, seen)
    flow.cleanup(crate, crate.blobs, None, now, stats)
    return stats


class StorageTests(unittest.TestCase):
    def test_unchanged_files_are_not_written_again_and_two_builds_are_kept(self) -> None:
        crate = FakeCrate()
        t0 = datetime(2026, 9, 25, 2, tzinfo=timezone.utc)
        s1 = publish_build(crate, {"a": b"1", "b": b"2"}, t0)
        self.assertEqual((s1["files_written"], s1["files_unchanged"]), (2, 0))
        s2 = publish_build(crate, {"a": b"1", "b": b"3"}, t0 + timedelta(days=1))
        self.assertEqual((s2["files_written"], s2["files_unchanged"]), (1, 1))
        self.assertEqual(len(crate.blobs.data), 3)   # b"2" still belongs to the previous build
        s3 = publish_build(crate, {"a": b"1", "b": b"4"}, t0 + timedelta(days=2))
        self.assertEqual(sorted(crate.blobs.data), sorted(hashlib.sha1(x).hexdigest() for x in (b"1", b"3", b"4")))
        self.assertEqual(sorted(crate.rows), ["20260926T020000Z", "20260927T020000Z", "current"])
        self.assertEqual(s3["cleanup"]["deleted_builds"], ["20260925T020000Z"])
        current = json.loads(crate.rows["current"]["manifest"])
        self.assertEqual((current["build_id"], current["previous_build_id"]), ("20260927T020000Z", "20260926T020000Z"))

    def test_a_concurrent_publish_wins_and_the_later_one_fails(self) -> None:
        crate = FakeCrate()
        t0 = datetime(2026, 9, 25, 2, tzinfo=timezone.utc)
        publish_build(crate, {"a": b"1"}, t0)
        other = lambda: publish_build(crate, {"a": b"2"}, t0 + timedelta(hours=1))  # noqa: E731
        with self.assertRaises(RuntimeError):
            publish_build(crate, {"a": b"3"}, t0 + timedelta(hours=2), running_before_publish=other)
        self.assertEqual(json.loads(crate.rows["current"]["manifest"])["build_id"], "20260925T030000Z")

    def test_cleanup_keeps_the_files_of_a_running_build(self) -> None:
        crate = FakeCrate()
        t0 = datetime(2026, 9, 25, 2, tzinfo=timezone.utc)
        publish_build(crate, {"a": b"1"}, t0)
        running = {"build_id": "running", "created_at": (t0 + timedelta(hours=1)).isoformat(),
                   "files": flow.file_entries({"a": b"9"})}
        flow.write_build_row(crate, "running", "building", running)
        crate.blobs.put(hashlib.sha1(b"9").hexdigest(), b"9")
        publish_build(crate, {"a": b"2"}, t0 + timedelta(hours=2))
        publish_build(crate, {"a": b"3"}, t0 + timedelta(hours=3))
        self.assertIn(hashlib.sha1(b"9").hexdigest(), crate.blobs.data)
        publish_build(crate, {"a": b"4"}, t0 + timedelta(hours=8))   # the running build is now stale
        self.assertNotIn(hashlib.sha1(b"9").hexdigest(), crate.blobs.data)
        self.assertNotIn("running", crate.rows)


class BlobStoreTests(unittest.TestCase):
    """The blob client against a fake cluster: node a holds no shard of the blob, node b does."""

    def store(self, stored: set):
        blobs = flow.BlobStore(["http://a:4200", "b:4200"], "user", "secret")
        calls = []

        def request(method, url, body=None):
            calls.append((method, url, None if body is None else len(body)))
            if url.startswith("http://a:4200"):
                return 307, url.replace("http://a:4200", "http://b:4200")
            digest = url.rsplit("/", 1)[1]
            if method == "HEAD":
                return (200 if digest in stored else 404), None
            if method == "PUT":
                created = digest not in stored
                stored.add(digest)
                return (201 if created else 409), None
            if method == "DELETE":
                found = digest in stored
                stored.discard(digest)
                return (204 if found else 404), None
            raise AssertionError(method)
        blobs._request = request
        return blobs, calls

    def test_a_write_goes_to_the_node_the_head_request_names(self) -> None:
        blobs, calls = self.store(set())
        self.assertTrue(blobs.put("d1", b"xyz"))
        self.assertEqual(calls, [("HEAD", "http://a:4200/_blobs/search_index_files/d1", None),
                                 ("HEAD", "http://b:4200/_blobs/search_index_files/d1", None),
                                 ("PUT", "http://b:4200/_blobs/search_index_files/d1", 3)])

    def test_a_stored_blob_isnt_sent_again(self) -> None:
        blobs, calls = self.store({"d1"})
        self.assertFalse(blobs.put("d1", b"xyz"))
        self.assertNotIn("PUT", [c[0] for c in calls])
        self.assertTrue(blobs.exists("d1"))
        self.assertTrue(blobs.delete("d1"))
        self.assertFalse(blobs.exists("d1"))

    def test_the_host_list_takes_bare_hosts(self) -> None:
        self.assertEqual(flow.BlobStore(["10.0.0.11:4200", " http://x:1 "], "u", "p").hosts,
                         ["http://10.0.0.11:4200", "http://x:1"])


if __name__ == "__main__":
    unittest.main()
