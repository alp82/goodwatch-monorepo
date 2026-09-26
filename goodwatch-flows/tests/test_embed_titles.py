"""f/search: embedding text, BM25F document weights, and the embed-titles flow's bookkeeping."""

import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
# The encoder's runtime isn't needed here; stub it where it isn't installed.
for name in ("onnxruntime", "tokenizers"):
    try:
        __import__(name)
    except ImportError:
        sys.modules[name] = types.SimpleNamespace(Tokenizer=None)

from f.search import embed_titles as flow  # noqa: E402
from f.search import terms as bm25f  # noqa: E402
from f.search.title_text import (  # noqa: E402
    TitleInputs, english_text, input_hash, multilingual_text, term_fields, title_inputs,
)
from f.sync.copy.qdrant_retry import PublicationFailure  # noqa: E402


class TermTests(unittest.TestCase):
    def test_stemmer(self) -> None:
        self.assertEqual([bm25f.stem(w) for w in ["stories", "loops", "looping", "chases", "boxes", "glass", "bus"]],
                         ["story", "loop", "loop", "chase", "box", "glass", "bus"])

    def test_terms_drop_stopwords_and_add_bigrams_within_a_span(self) -> None:
        self.assertEqual(bm25f.terms("The Time Loop movie"), ["time", "loop", "time_loop"])

    def test_document_weights_follow_bm25f(self) -> None:
        weights = bm25f.document_weights({"tags": ["time loop"], "essence": ["A loop."]})
        f32 = np.float32
        tags = f32(2.0) / (f32(0.25) + f32(0.75) * f32(2) / bm25f.AVG_FIELD_LENGTHS["tags"])
        essence = f32(1.0) / (f32(0.25) + f32(0.75) * f32(1) / bm25f.AVG_FIELD_LENGTHS["essence"])
        loop = tags + essence
        self.assertEqual(set(weights), {"time", "loop", "time_loop"})
        self.assertEqual(weights["time"], float(tags / (f32(1.2) + tags)))
        self.assertEqual(weights["loop"], float(loop / (f32(1.2) + loop)))

    def test_empty_fields_have_no_terms(self) -> None:
        self.assertEqual(bm25f.document_weights({"tags": [], "essence": [""]}), {})


def inputs(**overrides) -> TitleInputs:
    values = dict(title="Groundhog Day", original_title=None, year=1993, genres=["Comedy", "Romance"],
                  essence_text="A weatherman relives one day. ", essence_tags=["time loop"], synopsis="Phil wakes up.",
                  keywords=[f"k{i}" for i in range(30)], tropes=[f"t{i}" for i in range(20)])
    return TitleInputs(**(values | overrides))


class TitleTextTests(unittest.TestCase):
    def test_texts(self) -> None:
        keywords = ", ".join(f"k{i}" for i in range(25))
        tropes = ", ".join(f"t{i}" for i in range(15))
        body = f"Comedy, Romance. time loop. A weatherman relives one day. Keywords: {keywords}. Tropes: {tropes}."
        self.assertEqual(english_text(inputs()), f"(1993). {body}")
        self.assertEqual(multilingual_text(inputs()), f"passage: Groundhog Day (1993). {body}")

    def test_synopsis_replaces_a_missing_essence_and_empty_parts_drop(self) -> None:
        item = inputs(year=None, genres=[], essence_text=None, essence_tags=[], keywords=[], tropes=[])
        self.assertEqual(english_text(item), "Phil wakes up.")
        self.assertEqual(multilingual_text(item), "passage: Groundhog Day. Phil wakes up.")

    def test_payload_first_crate_as_fallback(self) -> None:
        item = title_inputs({"title": "A", "original_title": None, "tropes": []},
                            {"original_title": "B", "tropes": ["X"], "keywords": None})
        self.assertEqual((item.original_title, item.tropes, item.keywords), ("B", ["X"], []))

    def test_terms_use_all_keywords_but_not_the_synopsis(self) -> None:
        fields = term_fields(inputs(essence_text=None))
        self.assertEqual(len(fields["keywords"]), 30)
        self.assertEqual(fields["essence"], [""])

    def test_hash_follows_every_input(self) -> None:
        base = input_hash(inputs())
        self.assertEqual(base, input_hash(inputs()))
        for change in [dict(title="Other"), dict(year=1994), dict(tropes=["t0"]), dict(keywords=["k0"])]:
            self.assertNotEqual(base, input_hash(inputs(**change)), change)


class FakeCrate:
    """Just enough SQL for the flow's state helpers."""

    def __init__(self, terms=None, next_id=0, conflicts=0):
        self.terms = dict(terms or {})
        self.state = {flow.NEXT_TERM_ID: json.dumps({"next_id": next_id})}
        self.seq_no = 0
        self.conflicts = conflicts
        self.hashes: dict[int, str] = {}
        self.rows: dict[int, dict] = {}
        self.cur = self

    def select(self, sql, params=()):
        if sql.startswith("SELECT term, id"):
            return [{"term": t, "id": self.terms[t]} for t in params[0] if t in self.terms]
        if sql.startswith("SELECT value, _seq_no"):
            return [{"value": self.state[params[0]], "_seq_no": self.seq_no, "_primary_term": 1}]
        if sql.startswith("SELECT value FROM"):
            return [{"value": self.state[params[0]]}] if params[0] in self.state else []
        if sql.startswith("SELECT point_id, input_hash"):
            return [{"point_id": p, "input_hash": self.hashes[p]} for p in params[0] if p in self.hashes]
        if " FROM movie " in sql or " FROM show " in sql:
            base = 1_000_000_000_000 if " FROM movie " in sql else 2_000_000_000_000
            return [dict(self.rows[base + t], tmdb_id=t) for t in params[0] if base + t in self.rows]
        raise AssertionError(sql)

    def run(self, sql, params=()):
        self.rowcount = 1
        if sql.startswith("UPDATE"):
            if self.conflicts:
                self.conflicts -= 1
                self.seq_no += 1
                self.rowcount = 0
                return
            self.state[params[1]] = params[0]
            self.seq_no += 1
        elif sql.startswith("INSERT INTO search_embedding_state"):
            self.state[params[0]] = params[1]

    def executemany(self, sql, rows):
        if "search_terms" in sql:
            for term, term_id in rows:
                self.terms.setdefault(term, term_id)
        elif "search_embedding_inputs" in sql:
            for point_id, hash_, _ in rows:
                self.hashes[point_id] = hash_
        return [{"rowcount": 1} for _ in rows]


class VocabularyTests(unittest.TestCase):
    def test_known_terms_keep_ids_and_new_terms_get_the_next_ones(self) -> None:
        crate = FakeCrate(terms={"loop": 0, "time": 1}, next_id=2)
        ids = flow.TermVocabulary(crate).ids_for(["time", "zebra", "loop", "apple"])
        self.assertEqual({t: ids[t] for t in ["loop", "time", "apple", "zebra"]},
                         {"loop": 0, "time": 1, "apple": 2, "zebra": 3})
        self.assertEqual(json.loads(crate.state[flow.NEXT_TERM_ID]), {"next_id": 4})

    def test_reservation_retries_when_another_run_moved_the_counter(self) -> None:
        crate = FakeCrate(next_id=10, conflicts=2)
        with patch.object(flow.time, "sleep"):
            ids = flow.TermVocabulary(crate).ids_for(["a", "b"])
        self.assertEqual(ids, {"a": 10, "b": 11})

    def test_a_term_inserted_by_another_run_keeps_that_runs_id(self) -> None:
        crate = FakeCrate(next_id=5)
        vocabulary = flow.TermVocabulary(crate)
        original = crate.executemany

        def race(sql, rows):
            crate.terms["b"] = 99
            return original(sql, rows)

        crate.executemany = race
        self.assertEqual(vocabulary.ids_for(["a", "b"]), {"a": 5, "b": 99})


def point(tmdb_id: int) -> int:
    return 1_000_000_000_000 + tmdb_id


class EmbedPointsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.crate = FakeCrate()
        self.payloads = {point(i): {"title": f"T{i}", "release_year": 2000} for i in (1, 2, 3)}
        self.crate.rows = {point(i): {"essence_text": f"story {i}"} for i in (1, 2)}  # 3 has no Crate row
        item = title_inputs(self.payloads[point(1)], self.crate.rows[point(1)])
        self.crate.hashes[point(1)] = input_hash(item)  # 1 is unchanged
        self.written = []
        fake_vectors = lambda items, vocabulary: [{"v": n} for n in range(len(items))]
        fake_write = lambda client, vectors, stats: self.written.append(sorted(vectors)) or set(vectors)
        self.patches = [patch.object(flow, "text_vectors", fake_vectors), patch.object(flow, "write_vectors", fake_write)]
        for p in self.patches:
            p.start()

    def tearDown(self) -> None:
        for p in self.patches:
            p.stop()

    def run_embed(self, force):
        stats = flow._new_stats()
        flow.embed_points(self.crate, None, None, self.payloads, force=force, stats=stats, dry_run=False)
        return stats

    def test_only_changed_titles_are_embedded(self) -> None:
        stats = self.run_embed(force=set())
        self.assertEqual(self.written, [[point(2)]])
        self.assertEqual((stats["unchanged"], stats["no_crate_row"], stats["embedded"]), (1, 1, 1))
        self.assertIn(point(2), self.crate.hashes)

    def test_forced_titles_are_embedded_even_when_unchanged(self) -> None:
        self.run_embed(force={point(1)})
        self.assertEqual(self.written, [[point(1), point(2)]])

    def test_full_mode_embeds_everything(self) -> None:
        self.run_embed(force=None)
        self.assertEqual(self.written, [[point(1), point(2)]])


class WriteVectorsTests(unittest.TestCase):
    def test_a_point_deleted_meanwhile_is_skipped(self) -> None:
        calls = []

        def write(client, collection, operations, check):
            ids = [p.id for p in operations[0].update_vectors.points]
            calls.append(ids)
            if len(calls) == 1:
                raise PublicationFailure({"classification": "permanent_error"})
            return {"attempts": 1, "retries": 0}

        stats = flow._new_stats()
        vectors = {point(1): {"text_en_v1": [1.0]}, point(2): {"text_en_v1": [1.0]}}
        with patch.object(flow, "write_with_retry", write), \
                patch.object(flow, "fetch_payloads", lambda client, ids: {point(2): {}}):
            written = flow.write_vectors(None, vectors, stats)
        self.assertEqual(written, {point(2)})
        self.assertEqual(calls, [[point(1), point(2)], [point(2)]])
        self.assertEqual(stats["no_point"], 1)


class FullModeTests(unittest.TestCase):
    def test_resumes_from_the_checkpoint_and_stops_after_the_budget(self) -> None:
        crate = FakeCrate()
        crate.state[flow.FULL_CHECKPOINT] = json.dumps({"started_at": "2026-09-24T00:00:00+00:00",
                                                         "next_point_id": point(3)})
        pages = {point(3): ([types.SimpleNamespace(id=point(3), payload={})], point(4)),
                 point(4): ([types.SimpleNamespace(id=point(4), payload={})], None)}
        client = types.SimpleNamespace(scroll=lambda collection, limit, offset, **kw: pages[offset])
        seen = []
        ticks = iter([0, 61, 62])
        with patch.object(flow, "embed_points", lambda crate, client, vocab, payloads, **kw: seen.append(list(payloads))):
            stats = flow.run_full(crate, client, restart=False, max_minutes=1, dry_run=False, clock=lambda: next(ticks))
        self.assertEqual(seen, [[point(3)]])
        self.assertTrue(stats["stopped_early"])
        self.assertEqual(json.loads(crate.state[flow.FULL_CHECKPOINT])["next_point_id"], point(4))

        with patch.object(flow, "embed_points", lambda crate, client, vocab, payloads, **kw: seen.append(list(payloads))):
            flow.run_full(crate, client, restart=False, max_minutes=0, dry_run=False)
        self.assertEqual(seen, [[point(3)], [point(4)]])
        self.assertIn("completed_at", json.loads(crate.state[flow.FULL_CHECKPOINT]))


class SweepTests(unittest.TestCase):
    """The daily sweep embeds titles whose text changed without a recent timestamp (#171)."""

    def test_due_without_a_sweep_or_after_a_day(self) -> None:
        crate = FakeCrate()
        now = flow.datetime(2026, 9, 26, 12, tzinfo=flow.timezone.utc)
        self.assertTrue(flow.sweep_due(crate, now))
        crate.state[flow.SWEEP_CHECKPOINT] = json.dumps({"started_at": (now - flow.timedelta(hours=23)).isoformat()})
        self.assertFalse(flow.sweep_due(crate, now))
        self.assertTrue(flow.sweep_due(crate, now + flow.timedelta(hours=1)))

    def test_checks_every_point_by_hash_and_records_the_sweep(self) -> None:
        crate = FakeCrate()
        pages = {None: ([types.SimpleNamespace(id=point(1), payload={"title": "A"})], point(2)),
                 point(2): ([types.SimpleNamespace(id=point(2), payload={"title": "B"})], None)}
        client = types.SimpleNamespace(scroll=lambda collection, limit, offset, **kw: pages[offset])
        calls = []
        with patch.object(flow, "embed_points",
                          lambda crate, client, vocab, payloads, force, **kw: calls.append((list(payloads), force))):
            stats = flow.sweep_changed(crate, client, None, dry_run=False)
        self.assertEqual(calls, [([point(1)], set()), ([point(2)], set())])
        self.assertEqual(stats["candidates"], 2)
        self.assertIn(flow.SWEEP_CHECKPOINT, crate.state)


if __name__ == "__main__":
    unittest.main()
