"""General trope catalog import: attribution, preservation, dry runs and idempotence."""
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.tvtropes_catalog.catalog import (
    FIELDS, canonical_url, evidence_by_url, import_records, merged_record,
    normalize_record, records_from_document, schema_sql,
)

URL = "https://tvtropes.org/pmwiki/pmwiki.php/Main/RedHerring"
TEXT = "A clue that leads the audience away from the real explanation."


def record(**patch):
    return normalize_record({"name": "Red Herring", "url": URL, "text": TEXT, **patch})


class Database:
    def __init__(self, rows=(), *, exists=True):
        self.rows = {row["name"]: dict(row) for row in rows}
        self.exists = exists
        self.writes = []

    def select(self, sql, params=()):
        if "information_schema.tables" in sql:
            return [{"table_name": "trope_catalog"}] if self.exists else []
        return [self.rows[name] for name in params if name in self.rows]

    def run(self, sql, params=()):
        self.writes.append((sql, params))
        if sql.startswith("CREATE TABLE"):
            self.exists = True


class TropeCatalogTests(unittest.TestCase):
    def test_seed_map_and_record_batches_have_the_same_exact_text(self):
        mapped = records_from_document({"Red Herring": {"text": TEXT, "url": URL}})
        batch = records_from_document({"records": [{"name": "Red Herring", "description": TEXT, "url": URL}]})
        self.assertEqual(mapped, batch)
        self.assertEqual(mapped[0]["description_hash"], hashlib.sha256(TEXT.encode()).hexdigest())
        self.assertIsNone(mapped[0]["source_hash"])
        self.assertIsNone(mapped[0]["fetched_at"])
        self.assertEqual(mapped[0]["source"], "tvtropes")

    def test_source_evidence_preserves_real_page_hash_and_date(self):
        digest = "a" * 64
        evidence = evidence_by_url({"log": [{"status": 200, "url": URL, "sha256": digest, "started_at": "2026-10-25T08:04:35.818594+00:00"}]})
        normalized = normalize_record({"name": "Red Herring", "url": URL, "text": TEXT}, evidence=evidence)
        self.assertEqual(normalized["source_hash"], digest)
        self.assertEqual(normalized["fetched_at"], 1792915475818)
        self.assertNotEqual(normalized["description_hash"], digest)
        self.assertEqual(evidence_by_url({"log": [{"status": 403, "url": URL, "sha256": digest}]}), {})

    def test_only_canonical_main_pages_can_be_imported(self):
        self.assertEqual(canonical_url(URL.replace("https:", "http:")), URL)
        self.assertEqual(canonical_url(URL.replace("RedHerring", "Time_Slip")), URL.replace("RedHerring", "Time_Slip"))
        for url in ("https://evil.test/Main/RedHerring", URL + "?x=y", URL + "#main", "https://tvtropes.org@evil.test/pmwiki/pmwiki.php/Main/RedHerring", URL.replace("Main/", "Film/")):
            with self.subTest(url=url), self.assertRaises(ValueError):
                canonical_url(url)

    def test_validation_rejects_ambiguous_or_unattributed_source_data(self):
        for patch in ({"name": " Red Herring"}, {"name": ""}, {"text": ""}, {"text": "<p>HTML</p>"}, {"source": "invented"}, {"source_hash": "not-a-sha"}, {"fetched_at": "2026-10-25T08:00:00"}, {"url": None}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                record(**patch)
        with self.assertRaises(ValueError):
            records_from_document([{"name": "Red Herring", "url": URL}, {"name": "Red Herring", "url": URL}])
        with self.assertRaises(ValueError):
            records_from_document({"Red Herring": None})

    def test_inventory_only_import_keeps_existing_description_and_source(self):
        old = record(source_hash="a" * 64, fetched_at="2026-10-25T08:00:00Z")
        metadata = normalize_record({"name": "Red Herring", "url": URL.replace("RedHerring", "AnotherCanonicalName")})
        self.assertEqual(merged_record(old, metadata), old)
        self.assertEqual(merged_record(old, metadata, replace_descriptions=True), old)

    def test_literal_source_placeholders_are_preserved_but_html_is_rejected(self):
        text = 'The character says "Here is <Proper Noun>" in the original source.'
        self.assertEqual(record(text=text)["description"], text)
        for text in ('<SCRIPT>alert(1)</SCRIPT>', '<img src=x>', '<span>text</span>', '<br/>'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                record(text=text)

    def test_descriptions_fill_gaps_and_replacements_require_an_explicit_option(self):
        old = normalize_record({"name": "Red Herring"})
        self.assertEqual(merged_record(old, record()), record())
        replacement = record(text="A reviewed replacement.")
        self.assertEqual(merged_record(record(), replacement), record())
        self.assertEqual(merged_record(record(), replacement, replace_descriptions=True), replacement)

    def test_dry_run_does_not_create_schema_or_write_data(self):
        db = Database(exists=False)
        result = import_records(db, [record()])
        self.assertEqual(result["insert"], 1)
        self.assertTrue(result["schema_missing"])
        self.assertEqual(db.writes, [])

    def test_a_repeated_import_performs_no_writes_or_timestamp_updates(self):
        db = Database([record()])
        result = import_records(db, [record()], apply=True)
        self.assertEqual(result["unchanged"], 1)
        self.assertEqual(db.writes, [])

    def test_empty_inventory_cannot_erase_existing_descriptions(self):
        db = Database([record()])
        incoming = normalize_record({"name": "Red Herring", "url": URL})
        result = import_records(db, [incoming], apply=True)
        self.assertEqual(result["unchanged"], 1)
        self.assertEqual(db.writes, [])

    def test_python_driver_dates_and_http_dates_compare_identically(self):
        incoming = record(fetched_at="2026-10-25T08:00:00Z")
        stored = dict(incoming, fetched_at=datetime(2026, 10, 25, 8, tzinfo=timezone.utc))
        db = Database([stored])
        result = import_records(db, [incoming], apply=True)
        self.assertEqual(result["unchanged"], 1)
        self.assertEqual(db.writes, [])

    def test_schema_uses_exact_names_and_separate_general_description(self):
        sql = schema_sql()
        self.assertIn("name TEXT", sql)
        self.assertNotIn("FULLTEXT", sql)
        self.assertIn("PRIMARY KEY (name)", sql)
        self.assertIn("description TEXT INDEX OFF", sql)
        self.assertNotIn("media_tmdb_id", sql)


if __name__ == "__main__":
    unittest.main()
