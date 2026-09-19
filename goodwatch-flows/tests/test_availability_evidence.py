"""Source proof and publication contract, without live network dependencies."""
import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from unittest.mock import patch
import unittest

import mongomock
from test_streaming_publication import Crate, availability, load_copy
from f.tmdb_api.provider_evidence import capture_provider_check, utc_ms, validated_results


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = datetime.utcnow()
        self.db.tmdb_tv_details.insert_one({"tmdb_id": 42})
        self.copy = load_copy(self.db)

    def publish(self, crate):
        return self.copy(crate, {"tmdb_id": {"$in": [42]}}, "show", recent_only=False)

    def envelope(self, crate, country="US", media="show"):
        return json.loads(crate.evidence[(42, media, country)]["payload"])

    def provider(self, country="US", **extra):
        return {"tmdb_id": 42, "country_code": country, "updated_at": self.now, "streaming_links": []} | extra

    def api(self, results):
        payload = {"results": results}
        proof = capture_provider_check({"id": 42, "watch/providers": payload}, 42, self.now)
        self.db.tmdb_tv_details.update_one({"tmdb_id": 42}, {"$set": {
            "updated_at": self.now, "watch_providers": payload, "watch_providers_check": proof}})

    def test_independent_countries_empty_and_mixed_ages(self):
        self.db.tmdb_tv_providers.insert_many([self.provider(), self.provider("DE", updated_at=self.now - timedelta(days=60))])
        self.api({"US": {"flatrate": [{"provider_id": 8}]}})
        crate = Crate()
        self.publish(crate)
        us = self.envelope(crate)
        de = self.envelope(crate, "DE")
        self.assertEqual(us["checks"][0]["offers"], [])
        self.assertEqual(us["checks"][0]["checked_at"], utc_ms(self.now))
        self.assertEqual(de["checks"][0]["checked_at"], utc_ms(self.now - timedelta(days=60)))
        self.assertEqual(de["checks"][1]["state"], "unknown")
        self.assertEqual(us["checks"][1]["offers"][0]["service_id"], 8)
        self.assertEqual(us["checks"][1]["state"], "usable")
        self.assertNotEqual(us["checks"][0]["snapshot_id"], us["checks"][1]["snapshot_id"])

    def test_legacy_api_title_refresh_is_not_provider_proof(self):
        self.db.tmdb_tv_details.update_one({"tmdb_id": 42}, {"$set": {"updated_at": self.now, "watch_providers": {"results": {"US": {"flatrate": [{"provider_id": 8}]}}}}})
        self.db.tmdb_tv_providers.insert_one(self.provider())
        crate = Crate()
        self.publish(crate)
        api = self.envelope(crate)["checks"][1]
        self.assertIsNone(api["checked_at"])
        self.assertEqual(api["state"], "unknown")

    def test_success_failure_pending_mapping_and_legacy(self):
        for flags, reason in [({"consecutive_failures": 2}, "failed"), ({"identity_repair_pending": "repair-plan"}, "identity_pending"), ({"streaming_links": [{"provider_name": "Unknown", "stream_type": "free"}]}, "mapping_incomplete")]:
            with self.subTest(reason=reason):
                self.db.tmdb_tv_providers.delete_many({})
                self.db.tmdb_tv_providers.insert_one(self.provider(**flags))
                crate = Crate([availability(stream_url=None, price_dollar=None, quality=None)])
                self.publish(crate)
                record = self.envelope(crate)
                self.assertEqual(record["checks"][0]["reason"], reason)
                self.assertTrue(record["unknown_contributions"])
        self.db.tmdb_tv_providers.delete_many({})
        self.db.tmdb_tv_providers.insert_one(self.provider(failed_at=self.now - timedelta(days=2)))
        crate = Crate()
        self.publish(crate)
        self.assertEqual(self.envelope(crate)["checks"][0]["state"], "usable")

    def test_failure_only_schedule_invalidates_previous_evidence(self):
        self.db.tmdb_tv_providers.insert_one(self.provider(updated_at=self.now - timedelta(days=10), failed_at=self.now, consecutive_failures=1))
        crate = Crate()
        self.copy(crate, media_type="show")
        self.assertEqual(self.envelope(crate)["checks"][0]["reason"], "failed")

    def test_quarantine_invalidates_evidence_without_erasing_legacy(self):
        self.db.tmdb_tv_providers.insert_one(self.provider())
        crate = Crate([availability()])
        self.publish(crate)
        self.db.provider_identity_unresolved.insert_one({"media": "tv", "tmdb_id": 42, "status": "resolved_alias", "source_country_count": 1, "source_document_count": 1})
        self.copy(crate, media_type="show")
        self.assertTrue(all(check["reason"] == "identity_quarantined" for check in self.envelope(crate)["checks"]))

    def test_corrupt_retained_failed_source_cannot_abort_invalidation(self):
        self.db.tmdb_tv_providers.insert_one(self.provider(consecutive_failures=1,
            streaming_links=[{"stream_url": "https://click.justwatch.com/a?cx=bad!", "stream_type": "free"}]))
        crate = Crate([availability()])
        self.publish(crate)
        self.assertEqual(self.envelope(crate)["checks"][0]["state"], "unknown")
        self.assertEqual(len(crate.rows), 1)

    def test_removed_country_cannot_keep_previous_empty_proof(self):
        self.db.tmdb_tv_providers.insert_one(self.provider())
        self.api({"US": {}})
        crate = Crate()
        self.publish(crate)
        self.assertTrue(all(c["state"] == "usable" for c in self.envelope(crate)["checks"]))
        self.db.tmdb_tv_providers.delete_many({})
        self.api({})
        self.publish(crate)
        self.assertTrue(all(c["state"] == "unknown" for c in self.envelope(crate)["checks"]))

    def test_movie_scope_and_exact_offer_provenance(self):
        self.db.tmdb_movie_providers.insert_one(self.provider(streaming_links=[{"provider_name": "Netflix", "stream_type": "flatrate", "stream_url": "https://example.test", "quality": "HD"}]))
        crate = Crate()
        self.copy(crate, {"tmdb_id": {"$in": [42]}}, "movie", recent_only=False)
        evidence = self.envelope(crate, media="movie")
        source = evidence["checks"][0]
        self.assertEqual(source["offers"][0]["snapshot_id"], source["snapshot_id"])
        self.assertEqual(source["offers"][0]["quality"], "HD")
        self.assertEqual(evidence["checks"][1]["offers"], [])


class APIProofTests(unittest.TestCase):
    def test_identity_structure_empty_and_utc(self):
        now = datetime(2026, 9, 19, 0, 0)
        self.assertEqual(utc_ms(now), utc_ms(now.replace(tzinfo=timezone.utc)))
        for payload in [None, {}, {"results": []}, {"results": {"US": {"free": None}}}, {"results": {"US": {"free": [{"provider_id": True}]}}}]:
            self.assertIsNone(capture_provider_check({"id": 42, "watch/providers": payload}, 42, now))
        proof = capture_provider_check({"id": 42, "watch/providers": {"results": {"US": {}}}}, 42, now)
        self.assertEqual(proof["countries"], ["US"])
        self.assertEqual(proof["checked_at"], 1789776000000)
        with self.assertRaises(ValueError):
            capture_provider_check({"id": 43}, 42, now)

    def test_fetch_retains_proof_on_omission_and_rejects_wrong_identity(self):
        from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
        with patch("wmill.get_variable", return_value="unused"):
            from f.tmdb_api.tmdb_fetch_details_from_api.fetch import convert_and_save_details
        for model in (TmdbMovieDetails, TmdbTvDetails):
            entry = model(tmdb_id=42)
            with patch.object(model, "save"), patch.object(model, "update") as update:
                asyncio.run(convert_and_save_details(entry, {"id": 42, "watch/providers": {"results": {"US": {"link": "", "free": [{"provider_id": 8}]}}}}))
                proof = deepcopy(entry.watch_providers_check)
                payload = entry.watch_providers.to_mongo().to_dict()
                from f.tmdb_api.provider_evidence import snapshot_id
                self.assertEqual(proof["payload_hash"], snapshot_id(payload))
                asyncio.run(convert_and_save_details(entry, {"id": 42}))
                self.assertEqual(entry.watch_providers_check, proof)
                self.assertEqual(entry.watch_providers.to_mongo().to_dict(), payload)
                self.assertTrue(entry.watch_providers_error)
                with self.assertRaises(ValueError):
                    asyncio.run(convert_and_save_details(entry, {"id": 43}))
                self.assertEqual(update.call_args.kwargs["set__watch_providers_error"], "identity_mismatch")


if __name__ == "__main__":
    unittest.main()
