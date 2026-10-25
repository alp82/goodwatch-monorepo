"""General trope catalog import: attribution, preservation, dry runs and idempotence."""
import hashlib
import os
from unittest.mock import patch
from urllib.parse import urlsplit
from uuid import uuid4
from datetime import datetime, timezone
from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.tvtropes_catalog.catalog import (
    ARCHIVE_COLUMN_TYPES, FIELDS, canonical_url, evidence_by_url, import_records, merged_record,
    normalize_record, normalize_archive, records_from_document, schema_sql,
)

URL = "https://tvtropes.org/pmwiki/pmwiki.php/Main/RedHerring"
TEXT = "A clue that leads the audience away from the real explanation."


def record(**patch):
    return normalize_record({"name": "Red Herring", "url": URL, "text": TEXT, **patch})


def archive(**patch):
    revision="a" * 40
    return {
        "provider":"huggingface", "dataset":"KaraKaraWitch/TvTroper-2025", "revision":revision,
        "provider_url":f"https://huggingface.co/datasets/KaraKaraWitch/TvTroper-2025/resolve/{revision}/data/part1.jsonl",
        "file_sha256":"b" * 64, "record_sha256":"c" * 64, "article_sha256":"d" * 64,
        "payload_kind":"article_html_fragment", "retrieved_at":"2026-10-25T20:58:39Z", **patch,
    }


class Database:
    def __init__(self, rows=(), *, exists=True):
        self.rows = {row["name"]: dict(row) for row in rows}
        self.exists = exists
        self.writes = []

    def select(self, sql, params=()):
        if "information_schema.columns" in sql:
            return [{"column_name": f"source_archive['{key}']", "data_type": kind.lower()} for key, kind in ARCHIVE_COLUMN_TYPES.items()]
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

    def test_balanced_double_quotes_and_code_keep_literal_tag_spellings_byte_exact(self):
        samples = [
            'A tattoo reads "</head> <body>" on the character’s neck.',
            'A tattoo reads “</head> <body>” on the character’s neck.',
            'The tags "<p>" and "<p>" and "</p>" are quoted separately.',
            'Inline code `<a href="example">text</a>` remains literal prose.',
            'Code with a backtick ``<p> ` example </p>`` stays inside the paired run.',
            'A fenced example follows: ```html\n<div>Example</div>\n```.',
            'The phrase "a \\"quote\\" and <p> tag" preserves escapes.',
        ]
        for text in samples:
            with self.subTest(text=text):
                self.assertEqual(record(text=text)["description"], text)

    def test_literal_spans_do_not_allow_unquoted_markup_or_attribute_quotes(self):
        samples = [
            '<p title="a quote">HTML</p>', '<img alt="<p>" src="example">',
            '<custom-tag title="<p>">', '<custom-tag title=`<p>`>',
            '<a href="example">HTML</a>', '<script>const example = "<p>";</script>',
            'Quoted "<p>" followed by actual <p>HTML</p>.',
            'Unclosed "<p>HTML</p>', 'Unclosed “<p>HTML</p>', 'Unclosed `<p>HTML</p>',
            'Mismatched “<p>" delimiters.', "It's normal prose, and it's still <p>HTML</p>.",
            "A single-quoted '<p>' is not an explicitly supported literal span.",
            'The <p> tag has a later "unrelated quote".',
        ]
        for text in samples:
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

    def test_archive_preserves_proof_without_claiming_an_original_http_capture(self):
        normalized=record(source_archive=archive())
        self.assertEqual(normalized["source"],"tvtropes")
        self.assertIsNone(normalized["source_hash"])
        self.assertIsNone(normalized["fetched_at"])
        self.assertEqual(normalized["source_archive"]["article_sha256"],"d"*64)
        self.assertEqual(normalized["source_archive"]["retrieved_at"],1792961919000)
        self.assertEqual(normalized["description_hash"],hashlib.sha256(TEXT.encode()).hexdigest())

    def test_an_http_evidence_log_does_not_invent_archive_page_provenance(self):
        evidence={URL:{"sha256":"f"*64,"started_at":"2026-10-25T08:00:00Z"}}
        row=normalize_record({"name":"Red Herring","url":URL,"text":TEXT,"source_archive":archive()},evidence=evidence)
        self.assertIsNone(row["source_hash"])
        self.assertIsNone(row["fetched_at"])
        for patch in ({"source_hash":"f"*64},{"fetched_at":"2026-10-25T08:00:00Z"}):
            with self.subTest(patch=patch),self.assertRaisesRegex(ValueError,"cannot claim"):
                record(source_archive=archive(),**patch)

    def test_archive_metadata_requires_a_description_and_cannot_be_attached_by_inventory(self):
        with self.assertRaisesRegex(ValueError,"requires a description"):
            normalize_record({"name":"Red Herring","url":URL,"source_archive":archive()})
        incoming=normalize_record({"name":"Red Herring","url":URL})
        self.assertIsNone(incoming["source_archive"])
        archived=record(source_archive=archive())
        self.assertEqual(merged_record(archived,incoming),archived)

    def test_archive_missing_only_import_preserves_existing_http_text_and_all_provenance(self):
        original=record(source_hash="f"*64,fetched_at="2026-10-25T08:00:00Z")
        incoming=record(text="An older archived definition.",source_archive=archive())
        self.assertEqual(merged_record(original,incoming),original)
        db=Database([original])
        report=import_records(db,[incoming],apply=True)
        self.assertEqual(report["unchanged"],1)
        self.assertEqual(db.writes,[])
        self.assertIsNone(original["source_archive"])

    def test_archive_metadata_requires_pinned_public_file_references_and_valid_hashes(self):
        good=archive()
        invalid=[{"provider":"other"},{"payload_kind":"full_http_response"},{"dataset":"../repo"},
                 {"revision":"main"},{"provider_url":good["provider_url"].replace(good["revision"],"main")},
                 {"provider_url":good["provider_url"].replace("TvTroper-2025/resolve","Other/resolve")},
                 {"provider_url":good["provider_url"]+"?token=secret"},
                 {"provider_url":good["provider_url"].replace("huggingface.co","user:secret@huggingface.co")},
                 {"provider_url":good["provider_url"].replace("https:","http:")},
                 {"provider_url":good["provider_url"]+"/../other.jsonl"},
                 {"provider_url":good["provider_url"]+"#fragment"},
                 {"provider_url":good["provider_url"]+" raw.html"},
                 {"file_sha256":"bad"},{"record_sha256":"c"*63},{"article_sha256":"D"*64},
                 {"retrieved_at":None},{"retrieved_at":True},{"retrieved_at":1.2},
                 {"retrieved_at":"2026-10-25T20:58:39"},{"retrieved_at":-1},
                 {"article":"<h1>raw HTML does not belong in metadata</h1>"}]
        for patch in invalid:
            with self.subTest(patch=patch),self.assertRaises(ValueError):
                normalize_archive(archive(**patch))
        missing=deepcopy(good);del missing["record_sha256"]
        with self.assertRaises(ValueError):normalize_archive(missing)

    def test_archive_byte_locator_is_an_optional_strict_pair(self):
        valid=normalize_archive(archive(byte_offset=4_300_000_000,byte_length=1234))
        self.assertEqual(valid["byte_offset"],4_300_000_000)
        self.assertEqual(valid["byte_length"],1234)
        self.assertEqual(normalize_archive(valid),valid)
        for patch in ({"byte_offset":0},{"byte_length":12},{"byte_offset":-1,"byte_length":1},
                      {"byte_offset":True,"byte_length":1},{"byte_offset":0,"byte_length":0},
                      {"byte_offset":"0","byte_length":1},{"byte_offset":2**63,"byte_length":1}):
            with self.subTest(patch=patch),self.assertRaises(ValueError):normalize_archive(archive(**patch))

    def test_old_direct_http_records_remain_idempotent_with_new_nullable_archive_field(self):
        old=record();old.pop("source_archive")
        db=Database([old])
        report=import_records(db,[record()],apply=True)
        self.assertEqual(report["unchanged"],1)
        self.assertEqual(db.writes,[])

    def test_archive_import_fails_before_upsert_if_nested_mapping_is_unknown(self):
        class UnmappedDatabase(Database):
            def select(self, sql, params=()):
                return [] if "information_schema.columns" in sql else super().select(sql, params)
        db = UnmappedDatabase([normalize_record({"name": "Red Herring", "url": URL})])
        with self.assertRaisesRegex(RuntimeError, "explicitly declared nested column types"):
            import_records(db, [record(source_archive=archive())], apply=True)
        self.assertEqual(db.writes, [])

    def test_silent_archive_object_loss_never_reports_success(self):
        incoming = record(source_archive=archive())
        class LossyDatabase(Database):
            def run(self, sql, params=()):
                super().run(sql, params)
                if sql.startswith("INSERT"):
                    self.rows[incoming["name"]] = {**incoming, "source_archive": None}
            def select(self, sql, params=()):
                rows = super().select(sql, params)
                if "_doc AS actual_doc" in sql:
                    return [{"name": row["name"], "actual_doc": row} for row in rows]
                return rows
        db = LossyDatabase([normalize_record({"name": "Red Herring", "url": URL})])
        with self.assertRaisesRegex(RuntimeError, "stored-document verification failed"):
            import_records(db, [incoming], apply=True)
        self.assertEqual(sum(sql.startswith("INSERT") for sql, _ in db.writes), 1)

    def test_archive_schema_declares_every_nested_field_before_first_write(self):
        sql = schema_sql()
        self.assertIn("source_archive OBJECT(DYNAMIC) AS (", sql)
        for key, kind in ARCHIVE_COLUMN_TYPES.items():
            self.assertIn(f"{key} {kind.upper()}", sql)

    def test_schema_uses_exact_names_and_separate_general_description(self):
        sql = schema_sql()
        self.assertIn("name TEXT", sql)
        self.assertNotIn("FULLTEXT", sql)
        self.assertIn("PRIMARY KEY (name)", sql)
        self.assertIn("description TEXT INDEX OFF", sql)
        self.assertNotIn("media_tmdb_id", sql)


@unittest.skipUnless(os.environ.get("TROPE_TEST_CRATE_URL"), "Set TROPE_TEST_CRATE_URL to an isolated local CrateDB")
class ArchiveBulkCrateTests(unittest.TestCase):
    def setUp(self):
        from f.tvtropes_catalog import catalog
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
        from import_trope_catalog import Crate
        url = os.environ["TROPE_TEST_CRATE_URL"]
        if urlsplit(url).hostname not in ("127.0.0.1", "localhost", "::1"):
            raise ValueError("Archive regression requires isolated local CrateDB")
        self.db = Crate({"CRATE_HOSTS": url, "CRATE_USER": "crate", "CRATE_PASS": ""})
        self.table = "test_archive_bulk_" + uuid4().hex
        self.catalog = catalog
        self.create_sql = schema_sql().replace("trope_catalog", self.table)
        self.addCleanup(lambda: self.db.run(f"DROP TABLE IF EXISTS {self.table}"))
        self.addCleanup(patch.stopall)
        patch.object(catalog, "TABLE", self.table).start()
        self.rows = [normalize_record({"name": f"Trope {i:04}", "url": URL,
                     "description": TEXT, "source_archive": archive(byte_offset=4_300_000_000 + i, byte_length=100)})
                     for i in range(400)]

    def metadata_rows(self, sql):
        self.db.run(sql)
        self.db.run_many(f"INSERT INTO {self.table} (name,url) VALUES (?,?)", [(r["name"], r["url"]) for r in self.rows])
        self.db.run(f"REFRESH TABLE {self.table}")

    def test_existing_null_metadata_first_and_second_bulk_preserve_all_archive_objects(self):
        self.metadata_rows(self.create_sql)
        result = import_records(self.db, self.rows, apply=True, batch_size=200)
        self.assertEqual(result["update"], 400)
        stored = self.db.select(f"SELECT name,_doc AS actual_doc FROM {self.table} ORDER BY name")
        for expected, actual in zip(self.rows, stored):
            self.assertEqual(actual["actual_doc"]["source_archive"], expected["source_archive"])
            self.assertEqual(actual["actual_doc"]["description_hash"], expected["description_hash"])
        self.assertEqual(import_records(self.db, self.rows, apply=True)["unchanged"], 400)

    def test_altered_empty_dynamic_object_is_rejected_before_first_bulk(self):
        typed = self.create_sql[self.create_sql.index("source_archive OBJECT"):self.create_sql.index(", imported_at")]
        self.metadata_rows(self.create_sql.replace(typed + ", ", ""))
        self.db.run(f"ALTER TABLE {self.table} ADD COLUMN source_archive OBJECT(DYNAMIC)")
        with self.assertRaisesRegex(RuntimeError, "explicitly declared nested column types"):
            import_records(self.db, self.rows, apply=True)
        stored = self.db.select(f"SELECT description FROM {self.table}")
        self.assertTrue(all(row["description"] is None for row in stored))
        # The standard initializer's additive migration must make that same old root usable.
        from test_trope_catalog_initializer import initializer
        from f.sync.models.crate_schemas import SCHEMAS
        database = self.db
        class LocalConnector:
            def table_exists(self, table):
                return True
            def get_existing_columns(self, table):
                return {row["column_name"]: row["data_type"] for row in database.select(
                    "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='doc' AND table_name=?", (table,))}
            def run(self, sql, params=None):
                return database.run(sql, params or ())
            def disconnect(self):
                pass
        with patch.object(initializer, "SCHEMAS", {self.table: SCHEMAS["trope_catalog"]}), patch.object(initializer, "BLOB_TABLES", {}), patch.object(initializer, "CrateConnector", LocalConnector):
            initializer.init_database()
        self.assertEqual(import_records(self.db, self.rows, apply=True)["update"], 400)
        for stored, expected in zip(self.db.select(f"SELECT _doc AS actual_doc FROM {self.table} ORDER BY name"), self.rows):
            self.assertEqual(stored["actual_doc"]["source_archive"], expected["source_archive"])


if __name__ == "__main__":
    unittest.main()
