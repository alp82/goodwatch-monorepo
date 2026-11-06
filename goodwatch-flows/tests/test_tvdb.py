"""TVDB contracts: identity, incomplete upstream data, leases, replay and source ownership."""

import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tvdb import api, awards, crawl, publish, store

NOW = datetime(2026, 11, 6, 12)


def title():
    return {
        "id": 330,
        "name": "Casino Royale",
        "remoteIds": [{"type": 10, "id": "36557"}, {"type": 2, "id": "tt0381061"}],
        "characters": [
            {
                "id": 12147091,
                "peopleId": 273998,
                "peopleType": "Actor",
                "name": "James Bond",
                "image": "https://image/bond.jpg",
                "movieId": 330,
            },
            {"id": 2, "peopleId": 3, "peopleType": "Director"},
        ],
    }


def queued():
    return {
        "_id": "movie:36557",
        "media_type": "movie",
        "tmdb_id": 36557,
        "imdb_id": "tt0381061",
        "source_tvdb_id": 330,
        "priority": 1,
    }


class TvdbTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.client = Mock(requests=0)

        # mongomock has not adopted PyMongo's UpdateOne sort keyword yet.
        def bulk(operations, **kwargs):
            for op in operations:
                self.db.tvdb_entities.update_one(op._filter, op._doc, upsert=op._upsert)

        compatibility = patch.object(
            self.db.tvdb_entities, "bulk_write", side_effect=bulk
        )
        compatibility.start()
        self.addCleanup(compatibility.stop)

    def test_title_requires_external_identity_and_filters_crew(self):
        self.client.get.return_value = {"data": title()}
        data = crawl.title_data(self.db, self.client, queued())
        self.assertEqual(len(data["characters"]), 1)
        self.assertEqual(self.db.tvdb_entities.count_documents({}), 1)
        wrong = title()
        wrong["remoteIds"][0]["id"] = "999"
        self.client.get.return_value = {"data": wrong}
        with self.assertRaises(crawl.IdentityError):
            crawl.title_data(self.db, self.client, queued())

    def test_short_or_malformed_credit_payload_cannot_be_published(self):
        data = title()
        data.pop("characters")
        self.client.get.return_value = {"data": data}
        with self.assertRaises(ValueError):
            crawl.title_data(self.db, self.client, queued())
        data["characters"] = [{"peopleType": "Actor", "peopleId": 273998}]
        with self.assertRaises(ValueError):
            crawl.title_data(self.db, self.client, queued())

    def test_actor_mapping_is_cached_and_no_name_guess_is_made(self):
        self.client.get.return_value = {
            "data": {"id": 273998, "remoteIds": [{"type": 15, "id": "8784"}]}
        }
        mapped = crawl.entity_data(
            self.db, self.client, {"kind": "person", "tvdb_id": 273998}
        )
        self.assertEqual(mapped["tmdb_id"], 8784)
        self.client.get.return_value = {"data": {"id": 273998, "name": "Daniel Craig"}}
        self.assertIsNone(
            crawl.entity_data(
                self.db, self.client, {"kind": "person", "tvdb_id": 273998}
            )["tmdb_id"]
        )

    def test_search_rejects_ambiguous_titles(self):
        q = queued()
        q.pop("source_tvdb_id")
        self.client.get.return_value = {
            "data": [{"movie": {"id": 330}}, {"movie": {"id": 12}}]
        }
        with self.assertRaises(crawl.IdentityError):
            crawl.title_data(self.db, self.client, q)

    def test_lease_prevents_double_claim_and_stale_writer(self):
        store.enqueue(self.db.tvdb_titles, "one", {"tmdb_id": 1})
        doc = store.claim(self.db.tvdb_titles, NOW)
        self.assertIsNone(store.claim(self.db.tvdb_titles, NOW))
        replacement = store.claim(self.db.tvdb_titles, NOW + timedelta(minutes=11))
        with self.assertRaises(RuntimeError):
            store.finish(self.db.tvdb_titles, doc, {"status": "ok"})
        store.finish(self.db.tvdb_titles, replacement, {"status": "ok"})

    def test_worker_retains_success_on_404_and_stops_on_auth(self):
        self.db.tvdb_titles.insert_one(
            queued()
            | {
                "due_at": store.EPOCH,
                "characters": ["previous"],
                "updated_at": NOW,
                "publish_pending": True,
            }
        )
        self.client.get.side_effect = api.ApiError(404)
        result = crawl.run(self.db, self.client, max_items=1)
        self.assertEqual(result["not_found"], 1)
        self.assertEqual(self.db.tvdb_titles.find_one({})["characters"], ["previous"])
        self.db.tvdb_titles.update_one({}, {"$set": {"due_at": store.EPOCH}})
        self.client.get.side_effect = api.ApiError(401)
        with self.assertRaises(api.ApiError):
            crawl.run(self.db, self.client, max_items=1)
        self.assertNotIn("lease_token", self.db.tvdb_titles.find_one({}))

    def test_award_nominees_preserve_unknown_recipient_and_duplicate_evidence(self):
        n = {
            "id": 1,
            "year": "2026",
            "isWinner": False,
            "movie": {"id": 330},
            "character": None,
        }
        doc = {
            "_id": 2,
            "award_id": 1,
            "award_name": "Academy Awards",
            "name": "Actor",
            "nominees": [n, n | {"id": 2}],
            "updated_at": NOW,
            "publish_pending": True,
        }
        rows = publish.nomination_rows(self.db, doc)
        self.assertEqual([r["nominee_id"] for r in rows], [1, 2])
        self.assertEqual(rows[0]["dedupe_key"], rows[1]["dedupe_key"])
        self.assertIsNone(rows[0]["recipient_name"])
        self.assertIsNone(rows[0]["media_tmdb_id"])

    def test_category_validation_rejects_partial_data_before_replacement(self):
        doc = {"_id": 2, "award_id": 1}
        data = {"id": 2, "award": {"id": 1}, "nominees": []}
        self.client.get.return_value = {"data": data, "links": {"next": "/page/2"}}
        with self.assertRaises(ValueError):
            awards.fetch_category(self.db, self.client, doc)
        self.client.get.return_value = {"data": data}
        self.assertEqual(awards.fetch_category(self.db, self.client, doc), [])
        data["award"]["id"] = 99
        with self.assertRaises(ValueError):
            awards.fetch_category(self.db, self.client, doc)

    def test_publisher_failure_does_not_delete_or_acknowledge(self):
        self.db.tvdb_categories.insert_one(
            {
                "_id": 2,
                "award_id": 1,
                "award_name": "Oscars",
                "name": "Actor",
                "nominees": [{"id": 1, "isWinner": True}],
                "updated_at": NOW,
                "publish_pending": True,
            }
        )
        connector = Mock()
        connector.run_many.side_effect = RuntimeError("unavailable")
        result = publish.publish(self.db, connector)
        self.assertEqual(
            result["system_errors"],
            [{"table": "tvdb_nomination", "type": "RuntimeError"}],
        )
        connector.run.assert_not_called()
        self.assertNotIn("published_at", self.db.tvdb_categories.find_one({}))
        connector.run_many.side_effect = None
        self.assertEqual(publish.publish(self.db, connector)["rows"], 1)
        self.assertEqual(publish.publish(self.db, connector)["rows"], 0)

    def test_role_attaches_only_to_unique_exact_actor_character_credit(self):
        credits = [
            {"person_tmdb_id": 8784, "character": "James Bond", "credit_id": "credit"}
        ]
        self.assertEqual(publish.exact_credit(credits, 8784, " James  Bond "), "credit")
        self.assertIsNone(publish.exact_credit(credits, 1, "James Bond"))
        self.assertIsNone(publish.exact_credit(credits + credits, 8784, "James Bond"))

    def test_successful_empty_snapshot_removes_obsolete_source_rows(self):
        self.db.tvdb_categories.insert_one(
            {"_id": 2, "nominees": [], "updated_at": NOW, "publish_pending": True}
        )
        connector = Mock()
        self.assertEqual(publish.publish(self.db, connector)["categories"], 1)
        self.assertIn(
            "DELETE FROM tvdb_nomination", connector.run_many.call_args.args[0]
        )


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.session = Mock()
        self.client = api.Client(
            self.db,
            "fake-private-key",
            self.session,
            clock=lambda: NOW,
            sleep=lambda _: None,
        )
        self.client.token = "private-token"

    def response(self, status, body=None, headers=None):
        return Mock(status_code=status, headers=headers or {}, json=lambda: body)

    def test_shared_429_cooldown_and_no_secret_in_error(self):
        self.session.request.return_value = self.response(
            429, headers={"Retry-After": "120"}
        )
        with self.assertRaises(api.Deferred) as error:
            self.client.get("/awards")
        self.assertNotIn("private", str(error.exception))
        with self.assertRaises(api.Deferred):
            self.client.get("/awards")
        self.assertEqual(self.session.request.call_count, 1)
        self.assertEqual(
            self.db.tvdb_state.find_one({})["blocked_until"],
            NOW + timedelta(seconds=120),
        )

    def test_401_refreshes_token_once(self):
        self.session.request.side_effect = [
            self.response(401),
            self.response(200, {"data": {"token": "new"}}),
            self.response(200, {"status": "success", "data": []}),
        ]
        self.assertEqual(self.client.get("/awards")["data"], [])
        self.assertEqual(self.client.token, "new")

    def test_api_failure_is_distinct_from_successful_empty_data(self):
        self.session.request.return_value = self.response(
            200, {"status": "failure", "data": []}
        )
        with self.assertRaises(ValueError):
            self.client.get("/awards")


if __name__ == "__main__":
    unittest.main()


class FeedTests(unittest.TestCase):
    def test_failed_second_page_does_not_advance_checkpoint_and_resumes(self):
        from f.tvdb import changes

        db = mongomock.MongoClient().db
        db.tvdb_titles.insert_one(
            {"_id": "show:1396", "media_type": "show", "tvdb_id": 81189, "due_at": NOW}
        )
        client = Mock(requests=0)
        client.get.side_effect = [
            {"data": [{"recordId": 81189, "methodInt": 2}], "links": {"next": "page1"}},
            api.ApiError(500),
        ]
        with self.assertRaises(api.ApiError):
            changes.run(db, client)
        state = db.tvdb_state.find_one({"_id": "updates:movies"})
        self.assertNotIn("through", state)
        self.assertEqual(state["page"], 1)
        self.assertEqual(client.get.call_args.args[0].split("page=")[-1], "1")
        client.get.side_effect = None
        client.get.return_value = {"data": [], "links": {"next": None}}
        changes.run(db, client)
        self.assertIn("through", db.tvdb_state.find_one({"_id": "updates:movies"}))
        self.assertNotIn("page", db.tvdb_state.find_one({"_id": "updates:movies"}))

    def test_feed_routes_known_character_edits_without_enumerating_world_cast(self):
        from f.tvdb import changes

        db = mongomock.MongoClient().db
        db.tvdb_titles.insert_one(
            {"_id": "movie:36557", "characters": [{"id": 12147091}], "due_at": NOW}
        )
        client = Mock(requests=0)
        client.get.side_effect = lambda path: {
            "data": [{"recordId": 12147091, "methodInt": 3}]
            if "type=seriespeople" in path
            else [],
            "links": {"next": None},
        }
        changes.run(db, client)
        self.assertEqual(db.tvdb_titles.find_one({})["due_at"], store.EPOCH)


class SeedAndReplayTests(unittest.TestCase):
    def test_seed_resumes_after_budget_and_never_requires_title_name_matching(self):
        from unittest.mock import patch

        from f.tvdb import seed

        db = mongomock.MongoClient().db
        db.tmdb_movie_details.insert_many(
            [
                {"_id": 1, "tmdb_id": 10, "imdb_id": "tt10"},
                {"_id": 2, "tmdb_id": 11, "imdb_id": "tt11"},
                {"_id": 3, "tmdb_id": 12, "title": "Ambiguous name"},
            ]
        )

        def bulk(operations, **kwargs):
            for op in operations:
                db.tvdb_titles.update_one(op._filter, op._doc, upsert=op._upsert)

        ticks = iter([NOW, NOW, NOW + timedelta(seconds=20)])
        with patch.object(db.tvdb_titles, "bulk_write", side_effect=bulk):
            self.assertTrue(
                seed.run(db, max_seconds=10, clock=lambda: next(ticks))["incomplete"]
            )
            self.assertEqual(db.tvdb_titles.count_documents({}), 1)
            self.assertEqual(
                db.tvdb_state.find_one({"_id": "seed:movie"})["scan_after"], 1
            )
            seed.run(db, clock=lambda: NOW + timedelta(minutes=1))
        self.assertEqual(db.tvdb_titles.count_documents({}), 2)
        self.assertEqual(db.tvdb_state.find_one({"_id": "seed:movie"})["through"], NOW)

    def test_a_new_source_revision_during_publish_stays_pending(self):
        db = mongomock.MongoClient().db
        db.tvdb_categories.insert_one(
            {"_id": 1, "nominees": [], "updated_at": NOW, "publish_pending": True}
        )
        connector = Mock()

        def concurrent_change(*args):
            db.tvdb_categories.update_one(
                {"_id": 1}, {"$set": {"updated_at": NOW + timedelta(seconds=1)}}
            )

        connector.run_many.side_effect = concurrent_change
        publish.publish(db, connector)
        self.assertTrue(db.tvdb_categories.find_one({})["publish_pending"])
        self.assertNotIn("published_at", db.tvdb_categories.find_one({}))
