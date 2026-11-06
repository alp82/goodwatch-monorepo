"""Regression coverage for bad external joins, poison scopes, and operational recovery."""

import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tvdb import crawl, health, ids, publish, repair

NOW = datetime(2026, 11, 6, 8)
BAD = 29028252902825


def category(key, winner=1):
    return {
        "_id": key,
        "award_id": 1,
        "award_name": "Oscars",
        "name": "Actor",
        "nominees": [{"id": winner, "isWinner": True}],
        "updated_at": NOW,
        "publish_pending": True,
    }


def title(key=1):
    return {
        "_id": f"movie:{key}",
        "media_type": "movie",
        "tmdb_id": key,
        "tvdb_id": 100 + key,
        "characters": [
            {
                "id": key,
                "peopleId": 30,
                "name": "Bond",
                "image": "https://images/bond.jpg",
            }
        ],
        "updated_at": NOW,
        "publish_pending": True,
    }


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.connector = Mock()
        self.connector.select.return_value = []

    def test_id_contracts_reject_bool_unicode_negative_huge_and_oversized(self):
        for value in [True, False, -1, 0, 1.5, "１", "1.2", "-1", "9" * 1000, BAD]:
            with self.subTest(value=str(value)[:30]):
                self.assertIsNone(ids.tmdb_id(value))
        self.assertEqual(ids.tmdb_id("2147483647"), 2147483647)
        self.assertIsNone(ids.tmdb_id(2147483648))
        self.assertEqual(
            ids.checked_id(BAD), BAD
        )  # TVDB has a separate BIGINT contract.
        self.assertIsNone(ids.checked_id(2**63))

    def test_bad_ingested_actor_id_preserves_evidence_and_clears_only_local_join(self):
        api = Mock()
        data = {"id": 30, "remoteIds": [{"type": 15, "id": str(BAD)}]}
        api.get.return_value = {"data": data}
        result = crawl.entity_data(self.db, api, {"kind": "person", "tvdb_id": 30})
        self.assertIsNone(result["tmdb_id"])
        self.assertEqual(result["remote_ids"], data["remoteIds"])
        self.assertEqual(result["rejected_tmdb_id"], str(BAD))
        self.assertEqual(result["mapping_error"], "invalid_tmdb_id")

    def test_legacy_bad_mapping_cannot_block_portrait_publication(self):
        self.db.tvdb_entities.insert_one(
            {"_id": "person:30", "status": "ok", "tmdb_id": BAD}
        )
        self.db.tvdb_titles.insert_one(title())
        result = publish.publish(self.db, self.connector)
        self.assertEqual((result["titles"], result["failed_scopes"]), (1, 0))
        insert = next(
            c
            for c in self.connector.run_many.call_args_list
            if c.args[0].startswith("INSERT")
        )
        columns = insert.args[0].split("(", 1)[1].split(")", 1)[0].split(", ")
        row = dict(zip(columns, insert.args[1][0]))
        self.assertIsNone(row["person_tmdb_id"])
        self.assertIsNone(row["credit_id"])
        self.assertEqual(row["image_url"], "https://images/bond.jpg")

    def test_invalid_required_source_id_quarantines_only_bad_title_and_awards_continue(
        self,
    ):
        bad = title()
        bad["characters"][0]["id"] = str(2**63)
        self.db.tvdb_titles.insert_many([bad, title(2)])
        self.db.tvdb_categories.insert_one(category(1))
        result = publish.publish(self.db, self.connector)
        self.assertEqual(
            (result["titles"], result["categories"], result["failed_scopes"]), (1, 1, 1)
        )
        failed = self.db.tvdb_titles.find_one({"_id": "movie:1"})
        self.assertTrue(failed["publish_pending"])
        self.assertNotIn("published_at", failed)
        self.assertEqual(failed["publish_failures"], 1)
        self.assertIsNotNone(failed["publish_retry_at"])
        self.assertFalse(
            self.db.tvdb_titles.find_one({"_id": "movie:2"})["publish_pending"]
        )
        # The failed title gets no stale-row deletion.
        deleted = [
            call.args[1]
            for call in self.connector.run_many.call_args_list
            if call.args[0].startswith("DELETE FROM tvdb_character")
        ]
        self.assertEqual(deleted[0][0][:2], ["movie", 2])

    def test_permanent_database_row_failure_bisects_scopes_without_discarding_healthy_data(
        self,
    ):
        from crate.client.exceptions import ProgrammingError

        self.db.tvdb_categories.insert_many([category(1), category(2)])

        def write(sql, rows):
            if sql.startswith("INSERT") and any(row[0] == 1 for row in rows):
                raise ProgrammingError("Cannot cast value")

        self.connector.run_many.side_effect = write
        result = publish.publish(self.db, self.connector)
        self.assertEqual((result["categories"], result["failed_scopes"]), (1, 1))
        self.assertFalse(
            self.db.tvdb_categories.find_one({"_id": 2})["publish_pending"]
        )
        self.assertTrue(self.db.tvdb_categories.find_one({"_id": 1})["publish_pending"])

    def test_outage_does_not_quarantine_every_scope_or_block_awards_attempt(self):
        self.db.tvdb_titles.insert_one(title())
        self.db.tvdb_categories.insert_one(category(1))
        self.connector.select.side_effect = RuntimeError("connection down")
        result = publish.publish(self.db, self.connector)
        self.assertEqual(result["categories"], 1)
        self.assertEqual(result["failed_scopes"], 0)
        self.assertEqual(
            result["system_errors"],
            [{"table": "tvdb_character", "type": "RuntimeError"}],
        )
        self.assertNotIn("publish_failures", self.db.tvdb_titles.find_one({}))

    def test_retry_waits_then_success_clears_quarantine(self):
        doc = category(1)
        doc.update(
            publish_failures=1,
            publish_retry_at=NOW + timedelta(minutes=15),
            publish_error={"type": "ScopeError"},
        )
        self.db.tvdb_categories.insert_one(doc)
        with patch.object(publish, "utc_now", return_value=NOW):
            self.assertEqual(publish.publish(self.db, self.connector)["categories"], 0)
        with patch.object(publish, "utc_now", return_value=NOW + timedelta(minutes=16)):
            self.assertEqual(publish.publish(self.db, self.connector)["categories"], 1)
        self.assertNotIn("publish_error", self.db.tvdb_categories.find_one({}))

    def test_crawler_reports_success_even_when_publication_callback_fails(self):
        self.db.tvdb_titles.insert_one(
            title() | {"due_at": datetime(1970, 1, 1), "tmdb_deleted": True}
        )
        result = crawl.run(
            self.db,
            Mock(requests=0),
            max_items=1,
            publish=Mock(side_effect=RuntimeError("down")),
        )
        self.assertEqual(result["ok"], 1)
        self.assertEqual(result["publication_errors"], 1)
        self.assertTrue(self.db.tvdb_titles.find_one({})["publish_pending"])

    def test_repair_is_idempotent_and_requeues_affected_roles_without_fetching(self):
        raw = [{"type": 15, "id": str(BAD)}]
        self.db.tvdb_entities.insert_one(
            {
                "_id": "person:30",
                "kind": "person",
                "tvdb_id": 30,
                "tmdb_id": BAD,
                "remote_ids": raw,
            }
        )
        self.db.tvdb_titles.insert_one(title() | {"publish_pending": False})
        self.assertEqual(repair.run(self.db)["invalid_mappings"], 1)
        self.assertEqual(self.db.tvdb_entities.find_one({})["tmdb_id"], BAD)
        self.assertEqual(repair.run(self.db, False)["repaired"], 1)
        self.assertIsNone(self.db.tvdb_entities.find_one({})["tmdb_id"])
        self.assertEqual(self.db.tvdb_entities.find_one({})["remote_ids"], raw)
        self.assertEqual(self.db.tvdb_repairs.find_one({})["rejected_tmdb_id"], BAD)
        self.assertTrue(self.db.tvdb_titles.find_one({})["publish_pending"])
        self.assertEqual(repair.run(self.db, False)["repaired"], 0)

    def test_health_detects_stalls_and_repeat_failures_even_when_other_table_advances(
        self,
    ):
        self.db.tvdb_titles.insert_one(title())
        self.db.tvdb_state.insert_one(
            {
                "_id": "publication-progress:tvdb_categories",
                "at": NOW + timedelta(hours=1),
            }
        )
        self.assertFalse(health.assess(self.db, NOW + timedelta(hours=1))["healthy"])
        self.db.tvdb_titles.update_one({}, {"$set": {"publish_failures": 3}})
        self.assertTrue(
            any("three" in p for p in health.assess(self.db, NOW)["problems"])
        )


if __name__ == "__main__":
    unittest.main()
