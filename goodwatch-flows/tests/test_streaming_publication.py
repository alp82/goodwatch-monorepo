"""Publication boundary tests using Mongo collections and a recording Crate adapter."""
import ast
import time
from collections import defaultdict
from contextlib import contextmanager
from uuid import uuid4
from pymongo.errors import DuplicateKeyError
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, Optional
import unittest
import sys
from unittest.mock import Mock, patch
from html import escape

import mongomock
from pydantic import BaseModel, ConfigDict

ROOT = Path(__file__).parents[1] / "windmill" / "f"
sys.path.insert(0, str(ROOT.parent))
from f.tmdb_web.provider_identity import provider_name_from_url
from f.sync.copy.deleted_titles import flagged_among
from f.sync.availability_evidence import build_evidence, quarantine_evidence
from f.sync.models.crate_models import StreamingEvidence
from test_provider_identity import clickout_url


class Record(BaseModel):
    model_config = ConfigDict(extra="allow")


class Crate:
    def __init__(self, rows: Iterable[dict] = ()) -> None:
        self.rows = list(deepcopy(rows))
        self.media = {}
        self.evidence = {}
        self.cur = type("Cursor", (), {"rowcount": 1})()
        self.writes = []

    def select(self, sql: str, params: tuple | None = None) -> list[dict]:
        if "FROM streaming_service" in sql:
            return [{"tmdb_id": 8, "name": "Netflix"}, {"tmdb_id": 9, "name": "Amazon"}]
        assert params is not None
        if "FROM streaming_evidence" in sql:
            return deepcopy([r for r in self.evidence.values() if r["media_tmdb_id"] in params[0] and r["media_type"] == params[1]])
        return deepcopy([r for r in self.rows if r["media_tmdb_id"] in params[0] and r["media_type"] == params[1]])

    def upsert_many(self, table: str, records: list[BaseModel], **kwargs: Any) -> dict[str, int]:
        self.writes.append(table)
        for record in records:
            row = record.model_dump()
            if table == "streaming_evidence":
                self.evidence[(row["media_tmdb_id"], row["media_type"], row["country_code"])] = row
            elif table == "streaming_availability":
                self.rows = [old for old in self.rows if key(old) != key(row)]
                self.rows.append(row)
            else:
                self.media[row["tmdb_id"]] = row
        return {"records_received": len(records), "rows_upserted": len(records)}

    def run(self, sql: str, params: tuple | None = None) -> None:
        self.writes.append(sql)
        if sql.startswith("DELETE FROM streaming_evidence"):
            self.evidence = {key: value for key, value in self.evidence.items() if key[:2] != tuple(params)}
        elif sql.startswith("DELETE"):
            assert params is not None
            self.rows = [row for row in self.rows if key(row) != tuple(params)]


def key(row: dict) -> tuple:
    return tuple(row[k] for k in ("media_tmdb_id", "media_type", "country_code", "streaming_service_id", "streaming_type"))


def availability(country: str = "US", **fields: Any) -> dict:
    return dict(media_tmdb_id=42, media_type="show", country_code=country,
                streaming_type="flatrate", streaming_service_id=8,
                tmdb_link=None, display_priority=None, stream_url="https://old", price_dollar=2, quality="HD") | fields


def load_copy(db: Any) -> Callable[..., dict]:
    path = ROOT / "sync" / "copy" / "tmdb_streaming.py"
    tree = ast.parse(path.read_text())
    body = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.Assign, ast.ClassDef))]
    namespace = dict(defaultdict=defaultdict, datetime=datetime, timedelta=timedelta,
                     Optional=Optional, Any=Any, Callable=Callable, Iterator=Iterator,
                     contextmanager=contextmanager, uuid4=uuid4, DuplicateKeyError=DuplicateKeyError, time=time,
                     BaseModel=BaseModel, CrateConnector=Crate,
                     Movie=Record, Show=Record, StreamingAvailability=Record, StreamingEvidence=StreamingEvidence, build_evidence=build_evidence, quarantine_evidence=quarantine_evidence,
                     SCHEMAS={name: {"primary_key": ["tmdb_id"]} for name in ("movie", "show", "streaming_availability", "streaming_evidence")},
                     get_db=lambda: db, provider_name_from_url=provider_name_from_url,
                     flagged_among=flagged_among)
    model_tree = ast.parse((ROOT / "sync" / "models" / "crate_models.py").read_text())
    model = next(node for node in model_tree.body if isinstance(node, ast.ClassDef) and node.name == "StreamingAvailability")
    namespace["MediaType"] = str
    exec(compile(ast.Module(body=[model], type_ignores=[]), "crate_models.py", "exec"), namespace)
    exec(compile(ast.Module(body=body, type_ignores=[]), str(path), "exec"), namespace)
    namespace["refresh_unmapped_country"] = Mock(return_value={"outcome": "failed"})
    return namespace["copy_media"]


class StreamingPublicationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = mongomock.MongoClient().db
        self.now = datetime.utcnow()
        self.db.tmdb_tv_details.insert_one({"tmdb_id": 42})
        self.copy = load_copy(self.db)

    def publish(self, crate: Crate) -> dict:
        return self.copy(crate, {"tmdb_id": {"$in": [42]}}, "show", recent_only=False)

    def test_details_then_pending_streaming_preserves_published_child_aggregate_and_vector(self) -> None:
        import sys
        from unittest.mock import Mock, patch
        sys.path.insert(0, str(ROOT.parent))
        from f.sync.copy import tmdb_details, tmdb_streaming
        from test_priority_publish import VectorSerializationTests, written_points

        class PublishedCrate(Crate):
            def disconnect(self) -> None:
                pass

            def upsert_many(self, table: str, records: list[BaseModel], **kwargs: Any) -> dict[str, int]:
                if table not in ("movie", "show"):
                    return super().upsert_many(table, records, **kwargs)
                for record in records:
                    values = {key: value for key, value in record.model_dump().items() if value is not None}
                    self.media.setdefault(values["tmdb_id"], {}).update(values)
                return {"records_received": len(records), "rows_upserted": len(records)}

            def select(self, sql: str, params: tuple | None = None) -> list[dict]:
                if "FROM movie WHERE" in sql:
                    return list(self.media.values())
                return super().select(sql, params)

        self.db.tmdb_movie_details.insert_one({
            "tmdb_id": 42, "title": "Example", "updated_at": self.now,
            "watch_providers": {"results": {}},
        })
        self.db.tmdb_movie_providers.insert_one({"tmdb_id": 42, "country_code": "US"})
        child = availability(media_type="movie")
        crate = PublishedCrate([child])
        crate.media[42] = {"tmdb_id": 42, "streaming_country_codes": ["US"],
                           "streaming_service_ids": [8], "streaming_availabilities": ["US_8"]}
        with patch.object(tmdb_details, "get_db", return_value=self.db), patch.object(tmdb_streaming, "get_db", return_value=self.db):
            tmdb_details.copy_media(crate, {"tmdb_id": {"$in": [42]}}, "movie", recent_only=False)
            tmdb_streaming.copy_media(crate, {"tmdb_id": {"$in": [42]}}, "movie", recent_only=False)
        vector = VectorSerializationTests()
        vector.setUp()
        vector.db = self.db
        vector.crate = crate
        vector.publish()
        self.assertEqual(crate.rows, [child])
        self.assertEqual(crate.media[42]["streaming_availabilities"], ["US_8"])
        point = written_points(vector.qc.client)[0]
        self.assertEqual(point.payload["streaming_availability"], ["8_US"])

    def test_pending_provider_without_country_identity_is_explicitly_deferred(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "tmdb_watch_url": "https://example/watch"})
        crate = Crate([availability()])
        result = self.publish(crate)
        summary = result["publication"]["titles"]["42"]
        self.assertEqual(result["publication"]["status"], "partial_success")
        self.assertEqual(summary["deferred_country_count"], 1)
        self.assertEqual(summary["unidentified_country_count"], 1)
        self.assertEqual(crate.rows, [availability()])

    def test_all_pending_retains_existing_availability_without_freshness(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "created_at": self.now})
        crate = Crate([availability()])
        result = self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["US"])
        self.assertEqual(result["publication"]["status"], "partial_success")

    def test_pending_without_published_rows_is_unknown_not_confirmed_empty(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US"})
        crate = Crate()
        result = self.publish(crate)
        self.assertIsNone(result["publication"]["titles"]["42"]["streaming_availability"])
        self.assertEqual(crate.media, {})

    def test_mixed_success_replaces_only_verified_country_and_rebuilds_aggregate(self) -> None:
        self.db.tmdb_tv_providers.insert_many([
            {"tmdb_id": 42, "country_code": "US", "created_at": self.now, "updated_at": self.now,
             "streaming_links": [{"provider_name": "Amazon", "stream_type": "flatrate", "stream_url": "https://new"}]},
            {"tmdb_id": 42, "country_code": "DE", "created_at": self.now},
        ])
        crate = Crate([availability(), availability("DE")])
        result = self.publish(crate)
        self.assertEqual({(r["country_code"], r["streaming_service_id"]) for r in crate.rows}, {("US", 9), ("DE", 8)})
        self.assertIn(availability("DE"), crate.rows)
        self.assertEqual(set(crate.media[42]["streaming_availabilities"]), {"US_9", "DE_8"})
        self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["DE"])

    def test_old_resolvable_country_publishes_without_refresh(self) -> None:
        self.db.tmdb_tv_providers.insert_one({
            "tmdb_id": 42, "country_code": "CA", "updated_at": self.now - timedelta(days=480),
            "streaming_links": [{"provider_name": "Amazon", "stream_type": "buy", "stream_url": "https://old-valid"}],
        })
        crate = Crate()
        result = self.publish(crate)
        self.assertEqual(crate.rows[0]["stream_url"], "https://old-valid")
        self.assertEqual(result["publication"]["status"], "success")
        self.copy.__globals__["refresh_unmapped_country"].assert_not_called()

    def test_missing_provider_refreshes_outside_lease_and_reloads_before_publication(self) -> None:
        for age in (0, 480):
            with self.subTest(age=age):
                self.db.tmdb_tv_providers.delete_many({})
                identity = self.db.tmdb_tv_providers.insert_one({
                    "tmdb_id": 42, "country_code": "CA", "updated_at": self.now - timedelta(days=age),
                    "streaming_links": [{"provider_name": "Cineplex", "stream_type": "buy", "stream_url": clickout_url("Cineplex", 140)}],
                }).inserted_id
                crate = Crate([availability("CA")])
                def refresh(provider, media_type):
                    self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)
                    self.assertEqual(crate.rows, [availability("CA")])
                    self.assertEqual((provider["_id"], media_type), (identity, "show"))
                    self.db.tmdb_tv_providers.update_one({"_id": identity}, {"$set": {
                        "updated_at": self.now, "streaming_links": [{"provider_name": "Amazon", "stream_type": "buy", "stream_url": "https://refreshed"}],
                    }})
                    return {"outcome": "fetched"}
                with patch.dict(self.copy.__globals__, refresh_unmapped_country=Mock(side_effect=refresh)):
                    result = self.publish(crate)
                    self.copy.__globals__["refresh_unmapped_country"].assert_called_once()
                self.assertEqual(crate.rows[0]["stream_url"], "https://refreshed")
                self.assertEqual(result["publication"]["status"], "success")

    def test_refresh_adapter_uses_country_id_and_explicit_mapping_retry(self) -> None:
        from f.sync.copy.tmdb_streaming import refresh_unmapped_country
        import wmill
        for media_type, crawler_type in (("movie", "movie"), ("show", "tv")):
            with patch.object(wmill, "run_script", return_value={"outcome": "fetched"}) as run:
                result = refresh_unmapped_country({"_id": "country-document-id"}, media_type)
                self.assertEqual(result["outcome"], "fetched")
                run.assert_called_once_with(
                    path="f/tmdb_web/tmdb_crawl_providers/fetch",
                    args={"next_id": {"id": "country-document-id", "type": crawler_type}, "refresh_for_mapping": True},
                    timeout=90,
                )

    def test_failed_or_still_unmapped_refresh_defers_only_that_country(self) -> None:
        for outcome in ("failed", "deferred", "fetched", "exception"):
            with self.subTest(outcome=outcome):
                self.db.tmdb_tv_providers.delete_many({})
                self.db.tmdb_tv_providers.insert_many([
                    {"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []},
                    {"tmdb_id": 42, "country_code": "CA", "updated_at": self.now - timedelta(days=480),
                     "streaming_links": [{"provider_name": "Cineplex", "stream_type": "buy", "stream_url": clickout_url("Cineplex", 140)}]},
                ])
                retained = availability("CA")
                crate = Crate([availability(), retained])
                refresh = Mock(return_value={"outcome": outcome})
                if outcome == "exception":
                    refresh.side_effect = RuntimeError("fetch worker failed")
                with patch.dict(self.copy.__globals__, refresh_unmapped_country=refresh):
                    result = self.copy(crate, media_type="show")
                refresh.assert_called_once()
                self.assertEqual(crate.rows, [retained])
                self.assertEqual(crate.media[42]["streaming_availabilities"], ["CA_8"])
                self.assertEqual(result["publication"]["status"], "partial_success")

    def test_watch_page_provider_identity_survives_publication_and_vendor_namespace(self) -> None:
        from f.tmdb_web.tmdb_crawl_providers.fetch import crawl_tmdb_watch_page
        identities = [('U-NEXT', 84, 84), ('HBO Max on U-Next', 2284, 2284), ('Disney Plus', 2706, 337)]
        links = ''.join(f'<li class="ott_filter_best_price"><a title="Watch Smallville on {name}" href="{escape(clickout_url(name, vendor))}">Watch</a></li>' for name, vendor, _ in identities)
        response = type('Response', (), {'status_code': 200, 'headers': {}, 'text': '<div id="ott_offers_window"><div class="ott_provider"><h3>Stream</h3>' + links + '</div></div><script>$("#ott_country_filter").kendoDropDownList({value: "JP", dataValueField: "country_code"});</script>'})()
        with patch('f.tmdb_web.tmdb_crawl_providers.fetch.requests.get', return_value=response):
            result = crawl_tmdb_watch_page({'tmdb_watch_url': 'https://www.themoviedb.org/tv/4604/watch', 'country_code': 'JP'})
        self.assertEqual([link.provider_name for link in result.streaming_links], [name for name, _, _ in identities])
        self.db.tmdb_tv_providers.insert_one({'tmdb_id': 42, 'country_code': 'JP', 'updated_at': self.now,
                                              'streaming_links': [link.model_dump() for link in result.streaming_links]})
        crate = Crate()
        original_select = crate.select
        def select(sql: str, params: tuple | None = None) -> list[dict]:
            if 'FROM streaming_service' in sql:
                return [{'name': name, 'tmdb_id': tmdb} for name, _, tmdb in identities]
            return original_select(sql, params)
        crate.select = select
        self.publish(crate)
        self.assertEqual(set(crate.media[42]['streaming_availabilities']), {'JP_84', 'JP_2284', 'JP_337'})

    def test_retained_truncated_offer_uses_full_context_name_without_rescrape(self) -> None:
        self.db.tmdb_tv_providers.insert_one({'tmdb_id': 42, 'country_code': 'JP', 'updated_at': self.now,
            'streaming_links': [{'provider_name': 'U-Next', 'stream_type': 'flatrate', 'stream_url': clickout_url('HBO Max on U-Next', 2284)}]})
        crate = Crate()
        original_select = crate.select
        def select(sql: str, params: tuple | None = None) -> list[dict]:
            if 'FROM streaming_service' in sql:
                return [{'name': 'U-NEXT', 'tmdb_id': 84}, {'name': 'HBO Max on U-Next', 'tmdb_id': 2284}]
            return original_select(sql, params)
        crate.select = select
        self.publish(crate)
        self.assertEqual(crate.media[42]['streaming_availabilities'], ['JP_2284'])

    def test_invalid_context_fails_and_unknown_full_name_defers_without_data_loss(self) -> None:
        for url in ['https://click.justwatch.com/a?cx=bad!', clickout_url('Unknown full provider', 9)]:
            self.db.tmdb_tv_providers.delete_many({})
            self.db.tmdb_tv_providers.insert_one({'tmdb_id': 42, 'country_code': 'US', 'updated_at': self.now,
                'streaming_links': [{'provider_name': 'Amazon', 'stream_type': 'flatrate', 'stream_url': url}]})
            crate = Crate([availability()])
            if "cx=bad!" in url:
                with self.assertRaises(ValueError):
                    self.publish(crate)
            else:
                result = self.publish(crate)
                self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["US"])
            self.assertEqual(crate.rows, [availability()])
            self.assertEqual(crate.media, {})

    def test_exact_catalog_identity_accepts_duplicate_same_id_but_rejects_conflicts(self) -> None:
        self.db.tmdb_tv_providers.insert_one({'tmdb_id': 42, 'country_code': 'US', 'updated_at': self.now,
            'streaming_links': [{'provider_name': 'Amazon', 'stream_type': 'flatrate', 'stream_url': 'https://old-provider.example'}]})
        for second_id in [9, 10]:
            crate = Crate([availability()])
            original_select = crate.select
            def select(sql: str, params: tuple | None = None) -> list[dict]:
                if 'FROM streaming_service' in sql:
                    return [{'name': 'Amazon', 'tmdb_id': 9}, {'name': 'Amazon', 'tmdb_id': second_id}]
                return original_select(sql, params)
            crate.select = select
            if second_id == 9:
                self.publish(crate)
                self.assertEqual(crate.media[42]['streaming_availabilities'], ['US_9'])
            else:
                result = self.publish(crate)
                self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["US"])
                self.assertEqual(crate.rows, [availability()])
                self.assertEqual(crate.media, {})

    def test_duplicate_catalog_names_use_media_country_and_verified_api_scope(self) -> None:
        catalog = [
            {'name': 'Amazon Prime Video', 'tmdb_id': 9, 'media_type': 'show', 'order_by_country': {'US': 1, 'JP': 1}},
            {'name': 'Amazon Prime Video', 'tmdb_id': 119, 'media_type': 'show', 'order_by_country': {'AR': 1}},
            {'name': 'Amazon Prime Video', 'tmdb_id': 999, 'media_type': 'movie', 'order_by_country': {'US': 1}},
            {'name': 'HBO Max', 'tmdb_id': 384, 'media_type': 'show', 'order_by_country': {'BE': 1, 'NL': 1}},
            {'name': 'HBO Max', 'tmdb_id': 1899, 'media_type': 'show', 'order_by_country': {'BE': 1, 'NL': 1}},
        ]
        for country, name, api_ids, expected in [('US', 'Amazon Prime Video', [], 9), ('AR', 'Amazon Prime Video', [], 119), ('BE', 'HBO Max', [1899], 1899), ('BE', 'HBO Max', [384, 1899], None)]:
            with self.subTest(country=country, api_ids=api_ids):
                self.db.tmdb_tv_providers.delete_many({})
                self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {'updated_at': self.now, 'watch_providers': {'results': {country: {'flatrate': [{'provider_id': identity, 'provider_name': name} for identity in api_ids]}}}}})
                self.db.tmdb_tv_providers.insert_one({'tmdb_id': 42, 'country_code': country, 'updated_at': self.now,
                    'streaming_links': [{'provider_name': name, 'stream_type': 'flatrate', 'stream_url': 'https://old-provider.example'}]})
                crate = Crate([availability()])
                original_select = crate.select
                def select(sql: str, params: tuple | None = None) -> list[dict]:
                    if 'FROM streaming_service' in sql:
                        return catalog
                    return original_select(sql, params)
                crate.select = select
                if expected is None:
                    result = self.publish(crate)
                    self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], [country])
                    self.assertIn(availability(), crate.rows)
                    self.assertFalse(any(row.get("stream_url") == "https://old-provider.example" for row in crate.rows))
                else:
                    self.publish(crate)
                    offers = [row for row in crate.rows if row['country_code'] == country and row.get('stream_url') == 'https://old-provider.example']
                    self.assertEqual([row['streaming_service_id'] for row in offers], [expected])

    def test_duplicate_name_ignores_api_evidence_from_other_country_type_or_unverified_details(self) -> None:
        self.db.tmdb_tv_providers.insert_one({'tmdb_id': 42, 'country_code': 'BE', 'updated_at': self.now,
            'streaming_links': [{'provider_name': 'HBO Max', 'stream_type': 'flatrate', 'stream_url': 'https://old-provider.example'}]})
        for api_country, api_type, verified in [('NL', 'flatrate', True), ('BE', 'rent', True), ('BE', 'flatrate', False)]:
            self.db.tmdb_tv_details.update_one({'tmdb_id': 42}, {'$set': {'updated_at': self.now if verified else None,
                'watch_providers': {'results': {api_country: {api_type: [{'provider_id': 1899, 'provider_name': 'HBO Max'}]}}}}})
            crate = Crate([availability()])
            original_select = crate.select
            def select(sql: str, params: tuple | None = None) -> list[dict]:
                if 'FROM streaming_service' in sql:
                    return [{'name': 'HBO Max', 'tmdb_id': identity, 'media_type': 'show', 'order_by_country': {'BE': 1, 'NL': 1}} for identity in [384, 1899]]
                return original_select(sql, params)
            crate.select = select
            result = self.publish(crate)
            self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["BE"])
            self.assertIn(availability(), crate.rows)
            self.assertFalse(any(row.get("stream_url") == "https://old-provider.example" for row in crate.rows))

    def test_catalog_name_mismatch_uses_only_verified_scoped_api_identity(self) -> None:
        catalog = [
            {"name": "JustWatch TV", "tmdb_id": 2285, "media_type": "movie"},
            {"name": "Other", "tmdb_id": 99, "media_type": "movie"},
            {"name": "Show only", "tmdb_id": 100, "media_type": "show"},
        ]
        offer = {"provider_id": 2285, "provider_name": "JustWatchTV"}
        cases = [
            ("exact", "AU", "rent", [offer], self.now, True),
            ("duplicate same ID", "AU", "rent", [offer, offer], self.now, True),
            ("wrong country", "US", "rent", [offer], self.now, False),
            ("wrong offer type", "AU", "free", [offer], self.now, False),
            ("unverified details", "AU", "rent", [offer], None, False),
            ("different spelling", "AU", "rent", [offer | {"provider_name": "JustWatch TV"}], self.now, False),
            ("ambiguous", "AU", "rent", [offer, offer | {"provider_id": 99}], self.now, False),
            ("ambiguous uncatalogued", "AU", "rent", [offer, offer | {"provider_id": 999}], self.now, False),
            ("uncatalogued", "AU", "rent", [offer | {"provider_id": 999}], self.now, False),
            ("missing ID", "AU", "rent", [{"provider_name": "JustWatchTV"}], self.now, False),
            ("string ID", "AU", "rent", [offer | {"provider_id": "2285"}], self.now, False),
            ("wrong media", "AU", "rent", [offer | {"provider_id": 100}], self.now, False),
        ]
        for label, country, stream_type, offers, updated_at, succeeds in cases:
            with self.subTest(case=label):
                self.db.tmdb_movie_details.delete_many({})
                self.db.tmdb_movie_providers.delete_many({})
                self.db.tmdb_movie_details.insert_one({
                    "tmdb_id": 5, "updated_at": updated_at,
                    "watch_providers": {"results": {country: {stream_type: offers}}},
                })
                self.db.tmdb_movie_providers.insert_one({
                    "tmdb_id": 5, "country_code": "AU", "updated_at": self.now,
                    "streaming_links": [{"provider_name": "JustWatchTV", "stream_type": "rent",
                                         "stream_url": "https://www.justwatch.com/au/movie/four-rooms"}],
                })
                old = availability("AU", media_tmdb_id=5, media_type="movie")
                crate = Crate([old])
                original_select = crate.select
                def select(sql: str, params: tuple | None = None) -> list[dict]:
                    return catalog if "FROM streaming_service" in sql else original_select(sql, params)
                crate.select = select
                if succeeds:
                    self.copy(crate, {"tmdb_id": {"$in": [5]}}, "movie", recent_only=False)
                    self.assertEqual(len(crate.rows), 1)
                    self.assertEqual(crate.rows[0]["streaming_service_id"], 2285)
                    self.assertEqual(crate.rows[0]["streaming_type"], "rent")
                    self.assertEqual(crate.rows[0]["stream_url"], "https://www.justwatch.com/au/movie/four-rooms")
                    self.assertEqual(crate.media[5]["streaming_availabilities"], ["AU_2285"])
                else:
                    result = self.copy(crate, {"tmdb_id": {"$in": [5]}}, "movie", recent_only=False)
                    self.assertEqual(result["publication"]["titles"]["5"]["deferred_countries"], ["AU"])
                    self.assertIn(old, crate.rows)
                    self.assertFalse(any(row.get("stream_url") == "https://www.justwatch.com/au/movie/four-rooms" for row in crate.rows))

    def test_unknown_verified_provider_defers_without_clearing_previous_offers(self) -> None:
        self.db.tmdb_tv_providers.insert_one({
            "tmdb_id": 42, "country_code": "US", "updated_at": self.now,
            "streaming_links": [{"provider_name": "Unmapped Service", "stream_type": "flatrate",
                                 "stream_url": "https://new"}],
        })
        crate = Crate([availability()])
        result = self.publish(crate)
        self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["US"])
        self.copy.__globals__["refresh_unmapped_country"].assert_called_once()
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)

    def test_processed_empty_clears_scraped_fields_but_retains_api_and_other_countries(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        crate = Crate([availability(tmdb_link="https://tmdb", display_priority=1), availability("DE")])
        result = self.publish(crate)
        us = next(r for r in crate.rows if r["country_code"] == "US")
        self.assertEqual(us["tmdb_link"], "https://tmdb")
        self.assertIsNone(us["stream_url"])
        self.assertIsNone(us["price_dollar"])
        self.assertIsNone(us["quality"])
        self.assertEqual(crate.media[42]["streaming_availabilities"], ["DE_8", "US_8"])
        self.assertNotIn("tmdb_providers_created_at", crate.media[42])
        self.assertEqual(result["publication"]["status"], "success")

    def test_processed_empty_removes_obsolete_scrape_offer(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        crate = Crate([availability()])
        self.publish(crate)
        self.assertEqual(crate.rows, [])
        self.assertEqual(crate.media[42]["streaming_country_codes"], [])
        self.assertEqual(crate.media[42]["streaming_service_ids"], [])
        self.assertEqual(crate.media[42]["streaming_availabilities"], [])

    def test_absent_providers_publish_verified_api_without_inventing_scrape_freshness(self) -> None:
        self.db.tmdb_tv_details.update_one({"tmdb_id": 42}, {"$set": {"updated_at": self.now,
            "watch_providers": {"results": {"US": {"link": "https://tmdb", "flatrate": [{"provider_id": 9, "display_priority": 2}]}}}}})
        crate = Crate([availability(), availability("DE")])
        result = self.publish(crate)
        self.assertEqual(result["publication"]["titles"]["42"]["provider_state"], "absent")
        self.assertEqual(set(crate.media[42]["streaming_availabilities"]), {"US_8", "US_9", "DE_8"})
        self.assertNotIn("tmdb_providers_updated_at", crate.media[42])
        self.assertEqual(result["publication"]["status"], "partial_success")

    def test_absent_sources_are_explicit_and_do_not_write(self) -> None:
        crate = Crate([availability()])
        result = self.publish(crate)
        self.assertFalse(any(sql not in ("REFRESH TABLE streaming_availability", "REFRESH TABLE streaming_evidence", "streaming_evidence") for sql in crate.writes))
        self.assertEqual(result["publication"]["titles"]["42"]["provider_state"], "absent")

    def test_api_empty_clears_only_api_contribution_while_scrape_is_pending(self) -> None:
        self.db.tmdb_tv_details.update_one({"tmdb_id": 42}, {"$set": {"updated_at": self.now,
            "watch_providers": {"results": {"US": {"link": "https://tmdb"}}}}})
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US"})
        crate = Crate([availability(tmdb_link="https://oldtmdb", display_priority=1)])
        self.publish(crate)
        self.assertEqual(len(crate.rows), 1)
        self.assertIsNone(crate.rows[0]["tmdb_link"])
        self.assertIsNone(crate.rows[0]["display_priority"])
        self.assertEqual(crate.rows[0]["stream_url"], "https://old")

    def test_failed_country_retains_published_data_despite_previous_success(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now,
                                             "consecutive_failures": 1, "streaming_links": []})
        crate = Crate([availability()])
        result = self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(result["publication"]["titles"]["42"]["deferred_countries"], ["US"])

    def test_scheduled_catchup_publishes_api_updates_without_recent_scrapes(self) -> None:
        self.db.tmdb_tv_details.update_one({"tmdb_id": 42}, {"$set": {
            "updated_at": datetime.utcnow(), "watch_providers": {"results": {
                "US": {"link": "https://tmdb", "flatrate": [{"provider_id": 9, "display_priority": 1}]},
            }},
        }})
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "DE"})
        crate = Crate([availability("DE")])
        self.copy(crate, {}, "show")
        self.assertEqual(crate.media[42]["streaming_availabilities"], ["DE_8", "US_9"])

    def test_scheduled_pages_merge_overlapping_sources_without_skips_or_duplicates(self) -> None:
        self.copy.__globals__["BATCH_SIZE"] = 2
        for tmdb_id in (1, 3, 5):
            self.db.tmdb_tv_details.insert_one({
                "tmdb_id": tmdb_id, "updated_at": datetime.utcnow(), "watch_providers": {"results": {
                    "US": {"link": "https://tmdb", "flatrate": [{"provider_id": 9, "display_priority": 1}]},
                }},
            })
        for tmdb_id in (2, 3, 4):
            self.db.tmdb_tv_providers.insert_one({
                "tmdb_id": tmdb_id, "country_code": "US", "updated_at": datetime.utcnow(), "streaming_links": [],
            })
        crate = Crate()
        result = self.copy(crate, {}, "show")
        self.assertEqual(sorted(crate.media), [1, 2, 3, 4, 5])
        self.assertEqual(result["shows"]["records_received"], 5)
        self.assertEqual(crate.media[5]["streaming_availabilities"], ["US_9"])

    def test_provider_object_id_selector_does_not_expand_to_unrelated_details(self) -> None:
        provider_id = self.db.tmdb_tv_providers.insert_one({
            "tmdb_id": 42, "country_code": "US", "updated_at": datetime.utcnow(), "streaming_links": [],
        }).inserted_id
        self.db.tmdb_tv_details.insert_one({
            "tmdb_id": 17, "updated_at": datetime.utcnow(), "watch_providers": {"results": {"US": {}}},
        })
        crate = Crate([availability()])
        self.copy(crate, {"_id": {"$in": [provider_id]}}, "show")
        self.assertEqual(sorted(crate.media), [42])

    def test_scheduled_catchup_uses_same_country_retention(self) -> None:
        self.db.tmdb_tv_providers.insert_many([
            {"tmdb_id": 42, "country_code": "US", "updated_at": datetime.utcnow(), "streaming_links": []},
            {"tmdb_id": 42, "country_code": "DE"},
        ])
        crate = Crate([availability(), availability("DE")])
        result = self.copy(crate, {}, "show")
        self.assertEqual(crate.rows, [availability("DE")])
        self.assertEqual(crate.media[42]["streaming_availabilities"], ["DE_8"])
        self.assertEqual(result["publication"]["status"], "partial_success")
        self.assertEqual(result["publication"]["titles"], {})

    def test_concurrent_publication_fails_before_mutating_children_or_aggregate(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        self.db.streaming_publication_leases.insert_one({"_id": "show:42", "token": "other", "expires_at": datetime.utcnow() + timedelta(minutes=15)})
        crate = Crate([availability()])
        with self.assertRaisesRegex(RuntimeError, "publication.*busy"):
            self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})

    def test_waiting_lease_acquires_after_other_publisher_releases(self) -> None:
        leases = self.db.streaming_publication_leases
        leases.insert_one({"_id": "movie:122", "token": "other", "expires_at": datetime.utcnow() + timedelta(minutes=15)})
        publication_lease = load_copy(self.db).__globals__["publication_lease"]
        with patch("time.sleep", side_effect=lambda seconds: leases.delete_one({"_id": "movie:122"})) as sleep:
            with publication_lease(self.db, "movie", 122, 30) as check_owned:
                check_owned()
        sleep.assert_called_once()
        self.assertEqual(leases.count_documents({}), 0)

    def test_replaced_lease_prevents_writes_and_preserves_new_owner(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now, "streaming_links": []})
        crate = Crate([availability()])
        select = crate.select
        def replace_owner(sql, params=None):
            result = select(sql, params)
            if "FROM streaming_availability" in sql:
                self.db.streaming_publication_leases.update_one({"_id": "show:42"}, {"$set": {"token": "replacement"}})
            return result
        crate.select = replace_owner
        with self.assertRaisesRegex(RuntimeError, "lease lost"):
            self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(self.db.streaming_publication_leases.find_one({"_id": "show:42"})["token"], "replacement")

    def test_failed_child_write_does_not_publish_aggregate_and_releases_own_lease(self) -> None:
        self.db.tmdb_tv_providers.insert_one({"tmdb_id": 42, "country_code": "US", "updated_at": self.now,
            "streaming_links": [{"provider_name": "Amazon", "stream_type": "flatrate", "stream_url": "https://new"}]})
        crate = Crate([availability()])
        def fail(**kwargs):
            raise RuntimeError("child write failed")
        crate.upsert_many = fail
        with self.assertRaisesRegex(RuntimeError, "child write failed"):
            self.publish(crate)
        self.assertEqual(crate.rows, [availability()])
        self.assertEqual(crate.media, {})
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)


if __name__ == "__main__":
    unittest.main()
