"""Primary actor photos are separate from role portraits and preserve TMDB fallbacks."""

import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tvdb import actor_photos, crawl, health, photos

NOW = datetime(2026, 11, 6, 9)
IMAGE = "https://artworks.thetvdb.com/banners/person/30/primary.jpg"
ROLE = "https://artworks.thetvdb.com/banners/actors/role.jpg"


class ActorPhotoTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db

        def bulk(operations, **kwargs):
            for op in operations:
                self.db.tvdb_entities.update_one(
                    op._filter, op._doc, upsert=bool(op._upsert)
                )

        shim = patch.object(self.db.tvdb_entities, "bulk_write", side_effect=bulk)
        shim.start()
        self.addCleanup(shim.stop)

    def person(self, **fields):
        return {
            "_id": "person:30",
            "kind": "person",
            "tvdb_id": 30,
            "tmdb_id": 8784,
            "status": "ok",
            "image_url": IMAGE,
            "image_observed_at": NOW,
            "updated_at": NOW,
            "publish_pending": True,
            **fields,
        }

    def test_crawl_enqueues_actor_without_role_portrait_and_reuses_actor_url(self):
        photos.seed_actors(
            self.db, [{"peopleId": 30, "image": None, "personImgURL": IMAGE}], NOW
        )
        person = self.db.tvdb_entities.find_one({})
        self.assertEqual(person["image_url"], IMAGE)
        self.assertEqual(person["image_source"], "cast")
        self.assertEqual(person["due_at"], datetime(1970, 1, 1))

    def test_person_api_persists_primary_photo_not_character_image(self):
        api = Mock()
        api.get.return_value = {
            "data": {
                "id": 30,
                "image": IMAGE,
                "remoteIds": [{"type": 15, "id": "8784"}],
                "characters": [{"image": ROLE}],
            }
        }
        person = crawl.entity_data(self.db, api, {"kind": "person", "tvdb_id": 30})
        self.assertEqual(person["image_url"], IMAGE)
        self.assertEqual(person["image_source"], "person")

    def test_cast_seed_never_overwrites_an_observed_person_photo_or_absence(self):
        self.db.tvdb_entities.insert_one(
            self.person(image_url=None, image_source="person")
        )
        photos.seed_actors(self.db, [{"peopleId": 30, "personImgURL": IMAGE}], NOW)
        self.assertIsNone(self.db.tvdb_entities.find_one({})["image_url"])

    def test_photo_url_rejects_other_hosts_credentials_and_invalid_transport(self):
        self.assertEqual(photos.photo_url(IMAGE), IMAGE)
        for image in [
            ROLE.replace("https:", "http:"),
            IMAGE.replace("artworks.thetvdb.com", "example.com"),
            "https://user:password@artworks.thetvdb.com/banners/photo.jpg",
            "javascript:alert(1)",
            None,
        ]:
            self.assertIsNone(photos.photo_url(image))

    def test_publication_sets_tvdb_fields_and_does_not_write_tmdb_fallback(self):
        self.db.tvdb_entities.insert_one(self.person())
        connector = Mock()
        connector.select.return_value = [{"tmdb_id": 8784}]
        result = actor_photos.run(self.db, connector)
        sql, rows = connector.run_many.call_args.args
        assignments = sql.split("SET ")[1].split("WHERE")[0]
        self.assertIn("tvdb_profile_url = ?", assignments)
        self.assertNotIn("profile_path", assignments)
        self.assertEqual(rows[0][:4], [30, IMAGE, NOW, 8784])
        self.assertIn("tvdb_profile_updated_at <= ?", sql)
        self.assertEqual(result["published"], 1)
        self.assertFalse(self.db.tvdb_entities.find_one({})["publish_pending"])

    def test_missing_tvdb_photo_clears_only_its_own_primary_link(self):
        self.db.tvdb_entities.insert_one(self.person(image_url=None))
        connector = Mock()
        connector.select.return_value = [{"tmdb_id": 8784}]
        actor_photos.run(self.db, connector)
        sql, rows = connector.run_many.call_args.args
        self.assertIsNone(rows[0][1])
        self.assertFalse(rows[0][5])
        self.assertIn("OR tvdb_id = ?", sql)

    def test_missing_local_person_defers_without_ack_or_health_alarm(self):
        self.db.tvdb_entities.insert_one(self.person())
        connector = Mock()
        connector.select.return_value = []
        result = actor_photos.run(self.db, connector)
        self.assertEqual(result["missing_people"], 1)
        connector.run_many.assert_not_called()
        person = self.db.tvdb_entities.find_one({})
        self.assertTrue(person["publish_pending"])
        self.assertTrue(person["photo_waiting_for_person"])
        self.assertTrue(health.assess(self.db, NOW + timedelta(days=1))["healthy"])

    def test_bad_mapping_cannot_enter_person_photo_update(self):
        self.db.tvdb_entities.insert_one(self.person(tmdb_id=29028252902825))
        connector = Mock()
        self.assertEqual(actor_photos.run(self.db, connector)["published"], 0)
        connector.select.assert_not_called()

    def test_write_failure_leaves_saved_photo_pending(self):
        self.db.tvdb_entities.insert_one(self.person())
        connector = Mock()
        connector.select.return_value = [{"tmdb_id": 8784}]
        connector.run_many.side_effect = RuntimeError("database offline")
        with self.assertRaises(RuntimeError):
            actor_photos.run(self.db, connector)
        self.assertTrue(self.db.tvdb_entities.find_one({})["publish_pending"])


if __name__ == "__main__":
    unittest.main()
