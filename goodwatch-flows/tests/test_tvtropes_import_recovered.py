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
            record("movie", 1491, "WesternAnimation/TheIllusionist2010"),
            record("show", 3, "Series/HasTropes"),
            record("show", 4, "Series/Changed"),
            record("show", 5, "Series/NoDoc"),
            record("show", 6, "Series/HasUrl"),
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
                ],
            }
        )
        self.lines = []
        self.rollback_path = Path(self.tmp.name) / "rollback.json"

    def run_import(self, apply, deny=()):
        return imp.run_import(
            [self.run_dir], self.manifest, deny, self.store, apply, self.rollback_path, self.lines.append
        )

    def reasons(self, skips):
        return {key: reason for key, reason in skips}

    def test_refusals(self):
        totals, skips = self.run_import(apply=True)
        reasons = self.reasons(skips)
        self.assertEqual(totals, {"import": 2, "skip": 6})
        self.assertEqual(reasons[("movie", 1491)], "denied")  # built in, although allow-listed
        self.assertEqual(reasons[("movie", 2)], "not in allow-file")
        self.assertIn("already has tropes", reasons[("show", 3)])
        self.assertIn("sha256", reasons[("show", 4)])
        self.assertIn("no Mongo document", reasons[("show", 5)])
        self.assertIn("source url", reasons[("show", 6)])
        self.assertEqual(self.store.writes, 2)
        self.assertEqual(self.store.docs["show"][0]["tropes"], tropes("old"))

    def test_explicit_deny(self):
        _, skips = self.run_import(apply=True, deny=[("movie", 1)])
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
        self.assertEqual(totals["import"], 2)
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
        self.assertEqual((restored, skipped), (2, 0))
        self.assertEqual(self.store.docs, before)

    def test_rollback_leaves_documents_changed_since_the_import(self):
        self.run_import(apply=True)
        self.store.docs["movie"][0]["tvtropes_url"] = PREFIX + "Film/CrawledLater"
        restored, skipped = imp.run_rollback(self.rollback_path, self.store, self.lines.append)
        self.assertEqual((restored, skipped), (1, 1))
        self.assertEqual(self.store.docs["movie"][0]["tvtropes_url"], PREFIX + "Film/CrawledLater")


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
