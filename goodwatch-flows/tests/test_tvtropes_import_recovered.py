"""Safety rules of the reviewed TV Tropes import (fake store, no database)."""

import copy
import json
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import import_tvtropes_recovered as imp

PREFIX = imp.URL_PREFIX


def matches(doc, query):
    for field, condition in query.items():
        if field == "$or":
            if not any(matches(doc, option) for option in condition):
                return False
        elif isinstance(condition, dict) and "$in" in condition:
            if doc.get(field) not in condition["$in"]:
                return False
        elif isinstance(condition, dict) and "$exists" in condition:
            if (field in doc) != condition["$exists"]:
                return False
        elif doc.get(field) != condition:
            return False
    return True


class FakeStore:
    def __init__(self, docs):
        self.docs = docs  # media_type -> list of documents
        self.writes = 0

    def find(self, media_type, tmdb_id):
        return [copy.deepcopy(d) for d in self.docs[media_type] if d["tmdb_id"] == tmdb_id]

    def find_by_id(self, media_type, doc_id):
        return next((copy.deepcopy(d) for d in self.docs[media_type] if d["_id"] == doc_id), None)

    def update(self, media_type, query, set_fields, unset_fields):
        for doc in self.docs[media_type]:
            if matches(doc, query):
                self.writes += 1
                doc.update(copy.deepcopy(set_fields))
                for name in unset_fields:
                    doc.pop(name, None)
                return 1
        return 0


def tropes(tag):
    return [{"name": f"Trope {tag}", "url": PREFIX + "Main/Trope" + tag, "html": f"<li>{tag}</li>"}]


def record(media_type, tmdb_id, page, status="recovered"):
    return {
        "media_type": media_type,
        "tmdb_id": tmdb_id,
        "title": page,
        "release_year": 2000,
        "status": status,
        "result": {"url": PREFIX + page, "tropes": tropes(page), "rate_limit_reached": False},
    }


def empty_doc(doc_id, tmdb_id, **extra):
    doc = {
        "_id": doc_id,
        "tmdb_id": tmdb_id,
        "tropes": [],
        "is_selected": True,
        "failed_at": datetime(2026, 1, 1),
        "error_message": "boom",
        "updated_at": datetime(2025, 1, 1),
    }
    doc.update(extra)
    return doc


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.run_dir = Path(self.tmp.name) / "run"
        self.run_dir.mkdir()
        self.records = [
            record("movie", 1, "Film/Good"),
            record("movie", 2, "Film/NotAllowed"),
            record("movie", 1491, "Film/TheIllusionist2006"),
            record("show", 3, "Series/HasTropes"),
            record("show", 4, "Series/Changed"),
            record("show", 5, "Series/NoDoc"),
            record("show", 6, "Series/HasUrl"),
            record("show", 8, "Series/SameUrl"),
            record("show", 9, "Series/NewWithTropes"),
            record("movie", 7, "Film/Stale", status="unresolved"),
            record("movie", 7, "Film/Latest"),
        ]
        (self.run_dir / "results.jsonl").write_text("".join(json.dumps(r) + "\n" for r in self.records))
        self.manifest = {
            (r["media_type"], r["tmdb_id"]): {
                "media_type": r["media_type"],
                "tmdb_id": r["tmdb_id"],
                "title": r["title"],
                "url": r["result"]["url"],
                "tropes_sha256": imp.tropes_sha256(r["result"]["tropes"]),
            }
            for r in self.records[2:]
            if r["status"] == "recovered"
        }
        self.manifest[("movie", 1)] = dict(
            self.manifest[("movie", 7)], tmdb_id=1, url=PREFIX + "Film/Good",
            tropes_sha256=imp.tropes_sha256(tropes("Film/Good")),
        )
        self.manifest[("show", 4)]["tropes_sha256"] = "0" * 64
        self.store = FakeStore(
            {
                "movie": [empty_doc("m1", 1), empty_doc("m2", 2), empty_doc("m1491", 1491), empty_doc("m7", 7)],
                "show": [
                    empty_doc("s3", 3, tropes=tropes("old")),
                    empty_doc("s4", 4),
                    empty_doc("s6", 6, tvtropes_url=PREFIX + "Series/Old"),
                    {"_id": "s8", "tmdb_id": 8, "tvtropes_url": PREFIX + "Series/SameUrl", "error_message": None},
                    empty_doc("s9", 9, tvtropes_url=PREFIX + "Series/OldWithTropes", tropes=tropes("kept")),
                ],
            }
        )
        self.lines = []
        self.rollback_path = Path(self.tmp.name) / "rollback.json"

    def run_import(self, apply, deny=(), expect_count=5):
        return imp.run_import(
            [self.run_dir], self.manifest, deny, self.store, apply, self.rollback_path, self.lines.append,
            expect_count=expect_count,
        )

    def reasons(self, skips):
        return {key: reason for key, reason in skips}

    def test_refusals(self):
        totals, skips = self.run_import(apply=True)
        reasons = self.reasons(skips)
        self.assertEqual(
            totals,
            {"import": 5, "skip": 5, "url-replaced": 1, "url-same": 1, "no-previous-url": 3},
        )
        self.assertEqual(reasons[("movie", 2)], "not in allow-file")
        self.assertIn("already has tropes", reasons[("show", 3)])
        self.assertIn("sha256", reasons[("show", 4)])
        self.assertIn("no Mongo document", reasons[("show", 5)])
        self.assertNotIn(("show", 6), reasons)
        self.assertIn("already has tropes", reasons[("show", 9)])
        self.assertEqual(self.store.docs["show"][4]["tropes"], tropes("kept"))
        self.assertEqual(self.store.docs["show"][4]["tvtropes_url"], PREFIX + "Series/OldWithTropes")
        self.assertEqual(self.store.writes, 5)
        self.assertEqual(self.store.docs["show"][0]["tropes"], tropes("old"))

    def test_nothing_is_denied_without_an_explicit_deny(self):
        # The owner lifted the #120 deny list for The Illusionist and House of Cards (2026-09-26).
        totals, skips = self.run_import(apply=False, expect_count=None)
        self.assertNotIn(("movie", 1491), self.reasons(skips))
        self.assertEqual(totals["import"], 5)

    def test_explicit_deny(self):
        _, skips = self.run_import(apply=True, deny=[("movie", 1)], expect_count=4)
        self.assertEqual(self.reasons(skips)[("movie", 1)], "denied")
        self.assertEqual(self.store.docs["movie"][0]["tropes"], [])

    def test_latest_record_wins_and_written_shape_matches_store_result(self):
        self.run_import(apply=True)
        doc = self.store.docs["movie"][3]
        self.assertEqual(doc["tvtropes_url"], PREFIX + "Film/Latest")
        self.assertEqual(doc["tropes"], tropes("Film/Latest"))
        self.assertEqual(set(doc["tropes"][0]), {"name", "url", "html"})
        self.assertIs(doc["is_selected"], False)
        self.assertNotIn("failed_at", doc)
        self.assertNotIn("error_message", doc)
        self.assertGreater(doc["updated_at"], datetime(2026, 1, 1))

    def test_dry_run_performs_no_writes(self):
        before = copy.deepcopy(self.store.docs)
        totals, _ = self.run_import(apply=False)
        self.assertEqual(totals["import"], 5)
        self.assertEqual(self.store.writes, 0)
        self.assertEqual(self.store.docs, before)
        self.assertFalse(self.rollback_path.exists())
        self.assertTrue(any(line.startswith("would-import") for line in self.lines))
        with self.assertRaises(RuntimeError):
            imp.ReadOnlyStore(self.store).update("movie", {}, {}, [])

    def test_rollback_round_trip(self):
        before = copy.deepcopy(self.store.docs)
        self.run_import(apply=True)
        self.assertNotEqual(self.store.docs, before)
        restored, skipped = imp.run_rollback(self.rollback_path, self.store, self.lines.append)
        self.assertEqual((restored, skipped), (5, 0))
        self.assertEqual(self.store.docs, before)

    def test_stale_url_is_importable_and_reported(self):
        totals, _ = self.run_import(apply=False, expect_count=None)
        self.assertEqual((totals["url-replaced"], totals["url-same"], totals["no-previous-url"]), (1, 1, 3))
        replaced = next(l for l in self.lines if l.startswith("would-import") and "show:6 " in l)
        self.assertIn("url-replaced", replaced)
        self.assertIn(PREFIX + "Series/Old", replaced)
        same = next(l for l in self.lines if l.startswith("would-import") and "show:8 " in l)
        self.assertIn("url-same", same)
        self.assertTrue(any("url-replaced: 1" in l and "url-same: 1" in l for l in self.lines))
        self.run_import(apply=True)
        self.assertEqual(self.store.docs["show"][2]["tvtropes_url"], PREFIX + "Series/HasUrl")
        self.assertEqual(self.store.docs["show"][2]["tropes"], tropes("Series/HasUrl"))

    def test_rollback_restores_old_url_and_absent_versus_null_exactly(self):
        self.run_import(apply=True)
        self.assertNotIn("error_message", self.store.docs["show"][3])
        imp.run_rollback(self.rollback_path, self.store, self.lines.append)
        self.assertEqual(self.store.docs["show"][2]["tvtropes_url"], PREFIX + "Series/Old")
        self.assertEqual(self.store.docs["show"][2]["tropes"], [])
        self.assertEqual(
            self.store.docs["show"][3],
            {"_id": "s8", "tmdb_id": 8, "tvtropes_url": PREFIX + "Series/SameUrl", "error_message": None},
        )
        self.assertNotIn("tvtropes_url", self.store.docs["movie"][0])

    def test_apply_aborts_before_first_write_on_unexpected_count(self):
        for wrong in (None, 4, 6):
            with self.assertRaises(SystemExit):
                self.run_import(apply=True, expect_count=wrong)
        self.assertEqual(self.store.writes, 0)
        self.assertFalse(self.rollback_path.exists())

    def test_rollback_leaves_documents_changed_since_the_import(self):
        self.run_import(apply=True)
        self.store.docs["movie"][0]["tvtropes_url"] = PREFIX + "Film/CrawledLater"
        self.store.docs["show"][3]["updated_at"] = datetime(2030, 1, 1)  # url-same doc touched later
        restored, skipped = imp.run_rollback(self.rollback_path, self.store, self.lines.append)
        self.assertEqual((restored, skipped), (3, 2))
        self.assertEqual(self.store.docs["movie"][0]["tvtropes_url"], PREFIX + "Film/CrawledLater")
        self.assertEqual(self.store.docs["show"][3]["tropes"], tropes("Series/SameUrl"))


class ManifestTests(unittest.TestCase):
    def build(self, report_rows, records, deny=frozenset(), expected=1):
        with tempfile.TemporaryDirectory() as tmp:
            run_dir = Path(tmp)
            (run_dir / "results.jsonl").write_text("".join(json.dumps(r) + "\n" for r in records))
            report = run_dir / "report.md"
            report.write_text("## Recovered titles\n\n" + "\n".join(report_rows) + "\n")
            return imp.build_manifest([run_dir], report, set(deny), expected)

    def test_country_suffixed_page_needs_an_ok_review(self):
        records = [record("movie", 1, "Film/Good"), record("show", 9, "Series/RemakeUK")]
        rows = ["| movie | 1 | Good | 2000 | Film/Good | 1 | 1 | ok |"]
        with self.assertRaises(SystemExit):
            self.build(rows + ["| show | 9 | Remake | 2000 | Series/RemakeUK | 1 | 1 | **WRONG PAGE** |"], records)
        manifest = self.build(rows, records, deny={("show", 9)})
        self.assertEqual([e["tmdb_id"] for e in manifest["entries"]], [1])

    def test_reviewed_page_must_match_recovered_url(self):
        with self.assertRaises(SystemExit):
            self.build(["| movie | 1 | Good | 2000 | Film/Other | 1 | 1 | ok |"], [record("movie", 1, "Film/Good")])


if __name__ == "__main__":
    unittest.main()
