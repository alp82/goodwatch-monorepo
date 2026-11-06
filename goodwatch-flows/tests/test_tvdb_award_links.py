"""Award joins require source IDs, consistent title evidence, and live local targets."""

import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tvdb import award_links, crawl, publish, store

NOW = datetime(2026, 11, 6, 12)


class AwardLinksTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.n = {
            "id": 1,
            "movie": {"id": 330},
            "isWinner": True,
            "character": {
                "id": 55,
                "peopleId": 273998,
                "movieId": 330,
                "name": "James Bond",
            },
        }
        self.doc = {
            "_id": 2,
            "award_id": 1,
            "award_name": "BAFTA",
            "name": "Actor",
            "nominees": [self.n],
            "updated_at": NOW,
        }
        self.db.tvdb_entities.insert_many(
            [
                {
                    "_id": "movie:330",
                    "kind": "movie",
                    "tvdb_id": 330,
                    "tmdb_id": 36557,
                    "status": "ok",
                    "remote_ids": [
                        {"type": 10, "id": "36557"},
                        {"type": 2, "id": "tt0381061"},
                    ],
                },
                {
                    "_id": "person:273998",
                    "kind": "person",
                    "tvdb_id": 273998,
                    "tmdb_id": 8784,
                    "status": "ok",
                    "remote_ids": [{"type": 15, "id": "8784"}],
                },
            ]
        )
        self.db.tmdb_movie_details.insert_one(
            {"tmdb_id": 36557, "imdb_id": "tt0381061"}
        )
        self.db.tvdb_titles.insert_one(
            {
                "_id": "movie:36557",
                "media_type": "movie",
                "tmdb_id": 36557,
                "tvdb_id": 330,
                "characters": [dict(self.n["character"])],
            }
        )
        self.connector = Mock(select=self.select)
        self.missing_table = None

    def select(self, sql, args):
        if f"FROM {self.missing_table} WHERE" in sql:
            return []
        if "FROM person_appeared_in" in sql:
            return [
                {
                    "person_tmdb_id": 8784,
                    "character": "James Bond",
                    "credit_id": "bond-credit",
                }
            ]
        return [{"tmdb_id": 8784 if "FROM person WHERE" in sql else 36557}]

    def row(self):
        return publish.nomination_rows(self.db, self.doc, self.connector)[0]

    def test_explicit_actor_character_and_title_get_verified_ids(self):
        row = self.row()
        self.assertEqual(
            (
                row["media_tmdb_id"],
                row["person_tmdb_id"],
                row["tvdb_person_id"],
                row["tvdb_character_id"],
                row["credit_id"],
            ),
            (36557, 8784, 273998, 55, "bond-credit"),
        )
        self.assertEqual(
            [row[k + "_link_status"] for k in ["title", "actor", "character"]],
            ["verified"] * 3,
        )

    def test_actor_can_resolve_from_explicit_character_id_and_verified_cast(self):
        self.n["character"] = {"id": 55}
        self.assertEqual(self.row()["person_tmdb_id"], 8784)

    def test_absent_recipient_never_awards_entire_cast_or_title_name(self):
        self.n["character"] = None
        self.n["name"] = "Daniel Craig"
        row = self.row()
        self.assertIsNone(row["person_tmdb_id"])
        self.assertIsNone(row["tvdb_character_id"])
        self.assertEqual(row["actor_link_status"], "missing_source_identity")
        self.assertEqual(row["media_tmdb_id"], 36557)

    def test_conflicting_actor_or_parent_refuses_local_links(self):
        for change in [{"peopleId": 999}, {"movieId": 999}, {"seriesId": 999}]:
            with self.subTest(change=change):
                self.n["character"] = {
                    "id": 55,
                    "peopleId": 273998,
                    "movieId": 330,
                    "name": "James Bond",
                } | change
                row = self.row()
                self.assertIsNone(row["person_tmdb_id"])
                self.assertIn(
                    "conflict", [row["character_link_status"], row["title_link_status"]]
                )

    def test_person_remote_id_must_agree_and_local_person_must_exist(self):
        self.missing_table = "person"
        self.assertEqual(self.row()["actor_link_status"], "missing_local_person")
        self.missing_table = None
        self.db.tvdb_entities.update_one(
            {"kind": "person"}, {"$set": {"remote_ids": [{"type": 15, "id": "999"}]}}
        )
        self.assertEqual(self.row()["actor_link_status"], "conflict")

    def test_title_remote_id_imdb_and_tvdb_conflicts_never_link(self):
        for update in [
            {"remote_ids": [{"type": 10, "id": "999"}]},
            {"remote_ids": [{"type": 10, "id": "36557"}, {"type": 2, "id": "tt999"}]},
        ]:
            with self.subTest(update=update):
                self.db.tvdb_entities.update_one({"kind": "movie"}, {"$set": update})
                row = self.row()
                self.assertIsNone(row["media_tmdb_id"])
                self.assertIsNone(row["person_tmdb_id"])
                self.assertEqual(row["title_link_status"], "conflict")

    def test_missing_serving_title_and_deleted_source_never_link(self):
        self.missing_table = "movie"
        self.assertEqual(self.row()["title_link_status"], "missing_local_title")
        self.missing_table = None
        self.db.tmdb_movie_details.update_one({}, {"$set": {"tmdb_deleted": True}})
        self.assertEqual(self.row()["title_link_status"], "missing_local_title")

    def test_movie_and_show_with_same_numeric_id_stay_separate(self):
        self.n["movie"] = None
        self.n["series"] = {"id": 330}
        self.n["character"] = None
        self.assertEqual(self.row()["title_link_status"], "unmapped")
        self.n["movie"] = {"id": 330}
        self.assertEqual(self.row()["title_link_status"], "conflict")

    def test_explicit_character_parent_can_supply_the_missing_title(self):
        self.n["movie"] = None
        self.assertEqual(self.row()["media_tmdb_id"], 36557)
        self.assertEqual(self.row()["person_tmdb_id"], 8784)

    def test_episode_parent_cannot_override_a_conflicting_title(self):
        self.n["episode"] = {"id": 1, "seriesId": 330}
        self.assertEqual(self.row()["title_link_status"], "conflict")
        self.assertIsNone(self.row()["media_tmdb_id"])

    def test_replay_preserves_raw_nominees_and_is_idempotent(self):
        self.db.tvdb_categories.insert_one(self.doc)
        self.assertEqual(award_links.run(self.db)["categories_requeued"], 1)
        self.assertNotIn("publish_pending", self.db.tvdb_categories.find_one({}))
        self.assertEqual(award_links.run(self.db, False)["categories_requeued"], 1)
        self.assertEqual(award_links.run(self.db, False)["categories_requeued"], 0)
        self.assertEqual(self.db.tvdb_categories.find_one({})["nominees"], [self.n])

    def test_mapping_being_cleared_requeues_awards_and_removes_stale_actor_link(self):
        self.db.tvdb_categories.insert_one(self.doc | {"publish_pending": False})
        self.db.tvdb_entities.update_one(
            {"kind": "person"}, {"$set": {"due_at": store.EPOCH}}
        )
        api = Mock(requests=0)
        with unittest.mock.patch.object(
            crawl,
            "entity_data",
            return_value={"tmdb_id": None, "status": "ok", "remote_ids": []},
        ):
            crawl.run(self.db, api, mode="mappings", max_items=1)
        self.assertTrue(self.db.tvdb_categories.find_one({})["publish_pending"])
        self.assertIsNone(self.row()["person_tmdb_id"])


if __name__ == "__main__":
    unittest.main()
