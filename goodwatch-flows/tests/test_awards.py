"""Awards contracts: evidence, identity, replay, ambiguity and atomic publication."""

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.awards import models, publish, reconcile, store, wikidata
from f.awards.registry import Registry


def observation(
    source="wikidata",
    record="one",
    basis="person",
    people=None,
    works=None,
    ceremony="oscars:96",
    outcome="won",
):
    return models.Observation(
        source=source,
        record_id=record,
        program_key="oscars",
        category_key="oscars/actor-leading",
        category_name="Actor in a Leading Role",
        year=2024,
        outcome=outcome,
        ceremony_key=ceremony,
        entry_basis=basis,
        recipients=people
        if people is not None
        else [
            {
                "identity": "person:2037",
                "kind": "person",
                "person_tmdb_id": 2037,
                "link_status": "verified",
            }
        ],
        works=works
        if works is not None
        else [
            {
                "identity": "movie:872585",
                "kind": "movie",
                "role": "recognized_work",
                "media_type": "movie",
                "media_tmdb_id": 872585,
                "link_status": "verified",
            }
        ],
    ).to_dict() | {"observation_key": source + ":" + record}


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        for name in [
            "award_observations",
            "award_entries",
            "award_source_identities",
            "award_title_projection",
            "award_person_projection",
            "award_coverage",
        ]:
            col = self.db[name]

            def bulk(ops, col=col, **kwargs):
                for op in ops:
                    col.update_one(op._filter, op._doc, upsert=op._upsert)

            patcher = patch.object(col, "bulk_write", side_effect=bulk)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_snapshot_is_idempotent_and_withdraws_only_its_own_observations(self):
        a = observation()
        b = observation("tvdb")
        self.assertTrue(store.save_scope(self.db, "wikidata", "cat", [a])["changed"])
        self.assertFalse(store.save_scope(self.db, "wikidata", "cat", [a])["changed"])
        store.save_scope(self.db, "tvdb", "cat", [b])
        store.save_scope(self.db, "wikidata", "cat", [])
        active = list(store.active_observations(self.db))
        self.assertEqual([d["source"] for d in active], ["tvdb"])
        self.assertEqual(self.db.award_observations.count_documents({}), 2)

    def test_failed_scope_never_advances_previous_committed_snapshot(self):
        store.save_scope(self.db, "wikidata", "cat", [observation()])
        previous = self.db.award_scopes.find_one({})["active_revision"]
        with (
            patch.object(
                self.db.award_observations,
                "bulk_write",
                side_effect=RuntimeError("outage"),
            ),
            self.assertRaises(RuntimeError),
        ):
            store.save_scope(self.db, "wikidata", "cat", [observation(record="new")])
        self.assertEqual(self.db.award_scopes.find_one({})["active_revision"], previous)
        self.assertEqual(len(list(store.active_observations(self.db))), 1)

    def test_rebuild_preserves_internal_entry_id_and_has_independent_checkpoint(self):
        store.save_scope(self.db, "wikidata", "cat", [observation()])
        first = reconcile.run(self.db)
        entry = self.db.award_entries.find_one({})["entry_id"]
        self.assertFalse(reconcile.run(self.db)["changed"])
        store.save_scope(self.db, "tvdb", "cat", [observation("tvdb")])
        second = reconcile.run(self.db)
        self.assertNotEqual(first["generation"], second["generation"])
        self.assertEqual(
            self.db.award_entries.find_one({"generation": second["generation"]})[
                "entry_id"
            ],
            entry,
        )
        self.assertFalse(self.db.award_state.find_one({"_id": "reconcile"})["pending"])

    def test_resolved_identity_keeps_id_and_split_does_not_redirect_live_entry(self):
        original = observation()
        store.save_scope(self.db, "wikidata", "cat", [original])
        first = reconcile.run(self.db)
        original_id = self.db.award_entries.find_one(
            {"generation": first["generation"]}
        )["entry_id"]
        resolved = original | {
            "category_key": "internal-category-uuid",
            "ceremony_key": "internal-ceremony-uuid",
        }
        store.save_scope(self.db, "wikidata", "cat", [resolved])
        second = reconcile.run(self.db)
        self.assertEqual(
            self.db.award_entries.find_one({"generation": second["generation"]})[
                "entry_id"
            ],
            original_id,
        )
        other = resolved | {"record_id": "second", "observation_key": "wikidata:second"}
        store.save_scope(self.db, "wikidata", "cat", [resolved, other])
        reconcile.run(self.db)
        other = other | {"recipients": [{"identity": "person:99", "kind": "person"}]}
        store.save_scope(self.db, "wikidata", "cat", [resolved, other])
        split = reconcile.run(self.db)
        live = list(self.db.award_entries.find({"generation": split["generation"]}))
        self.assertEqual(len({row["entry_id"] for row in live}), 2)
        self.assertIn(original_id, {row["entry_id"] for row in live})
        self.assertIsNone(self.db.award_entry_redirects.find_one({"_id": original_id}))

    def test_source_category_names_do_not_merge_historical_combined_categories(self):
        registry = Registry(self.db)
        original = registry.category(
            "tvdb", 1, "oscars", "Writing (Original Screenplay)"
        )
        adapted = registry.category("tvdb", 2, "oscars", "Writing (Adapted Screenplay)")
        combined = registry.category(
            "wikidata", "Q922379", "oscars", "Best Original and Adapted Screenplay"
        )
        self.assertEqual(len({original["id"], adapted["id"], combined["id"]}), 3)
        self.assertEqual(
            registry.category(
                "wikidata", "Q103916", "oscars", "Academy Award for Best Actor"
            )["semantic_key"],
            "oscars/actor-leading",
        )

    def test_publication_failure_does_not_flip_active_generation(self):
        store.save_scope(self.db, "wikidata", "cat", [observation()])
        reconcile.run(self.db)
        connector = Mock()
        connector.select.side_effect = lambda sql, args: [
            {"tmdb_id": i} for i in args[0]
        ]

        def fail(sql, params, **kwargs):
            if sql.startswith("INSERT INTO award_person_result"):
                raise RuntimeError("database unavailable")

        connector.run_many.side_effect = fail
        with self.assertRaises(RuntimeError):
            publish.run(self.db, connector)
        self.assertFalse(
            any(
                "INSERT INTO award_publication" in c.args[0]
                for c in connector.run_many.call_args_list
            )
        )
        self.assertIsNone(self.db.award_generations.find_one({}).get("published_at"))


class ReconciliationTests(unittest.TestCase):
    def test_nomination_and_win_and_sources_are_one_entry(self):
        a = observation(outcome="unknown")
        b = observation("tvdb", outcome="won")
        entries, unknown = models.reconcile_observations([a, b])
        self.assertEqual((len(entries), len(unknown)), (1, 0))
        self.assertEqual(entries[0]["result_status"], "won")

    def test_two_actors_in_one_film_category_are_different_entries(self):
        a = observation()
        b = observation(
            record="second", people=[{"identity": "person:99", "kind": "person"}]
        )
        self.assertEqual(len(models.reconcile_observations([a, b])[0]), 2)

    def test_joint_producers_are_one_work_entry(self):
        a = observation(basis="work")
        b = observation(
            record="producer2",
            basis="work",
            people=[{"identity": "person:99", "kind": "person"}],
        )
        entries, _ = models.reconcile_observations([a, b])
        self.assertEqual(len(entries), 1)
        self.assertEqual(len(entries[0]["recipients"]), 2)

    def test_two_songs_with_same_writers_and_parent_film_remain_separate(self):
        song = lambda q: [
            {"identity": "wikidata:" + q, "kind": "song", "role": "recognized_work"},
            {"identity": "movie:872585", "kind": "movie", "role": "context_title"},
        ]
        a = observation(basis="song", works=song("Q1"))
        b = observation(record="second", basis="song", works=song("Q2"))
        self.assertEqual(len(models.reconcile_observations([a, b])[0]), 2)
        self.assertIsNone(models.entry_identity(observation(basis="song")))

    def test_year_and_a_single_known_actor_do_not_resolve_unknown_recipient_or_edition(
        self,
    ):
        self.assertIsNone(models.entry_identity(observation(people=[])))
        self.assertIsNone(models.entry_identity(observation(ceremony=None)))
        self.assertEqual(
            len(
                models.reconcile_observations(
                    [observation(ceremony="emmy:75"), observation(ceremony="emmy:76")]
                )[0]
            ),
            2,
        )

    def test_honorary_person_award_needs_no_work(self):
        self.assertIsNotNone(
            models.entry_identity(observation(basis="career", works=[]))
        )

    def test_conflicting_final_results_stay_disputed_and_are_not_displayed(self):
        a = observation()
        b = observation("tvdb", outcome="not_won")
        entries, _ = models.reconcile_observations([a, b])
        self.assertEqual(entries[0]["result_status"], "disputed")
        self.assertEqual(reconcile.projections([a, b], entries), ([], []))

    def test_title_observation_never_assigns_award_to_cast_and_junk_years_do_not_display(
        self,
    ):
        a = observation("tvdb", people=[])
        titles, people = reconcile.projections([a], [])
        self.assertEqual((len(titles), len(people)), (1, 0))
        self.assertFalse(titles[0]["totals_available"])
        a["year"] = 2027
        self.assertEqual(reconcile.projections([a], [], 2026), ([], []))

    def test_coarse_release_year_statement_does_not_invent_an_extra_person_win(self):
        precise = observation()
        coarse = observation(record="year-only", ceremony=None)
        coarse["year"] = 2023
        entries, _ = models.reconcile_observations([precise, coarse])
        _, people = reconcile.projections([precise, coarse], entries)
        self.assertEqual(len(people), 1)
        self.assertEqual(people[0]["ceremony_year"], "2024")


class WikidataTests(unittest.TestCase):
    setUp = DatabaseTests.setUp

    def entity(self, q, prop, val):
        return {
            "id": q,
            "labels": {"en": {"value": q}},
            "claims": {prop: [{"mainsnak": {"datavalue": {"value": val}}}]},
        }

    def test_person_work_nomination_win_are_linked_to_same_ceremony(self):
        person = self.entity("Q202589", "P4985", "2037")
        person["claims"]["P31"] = [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}]
        movie = self.entity("Q108839994", "P4947", "872585")
        ceremony = self.entity("Q85314819", "P585", {"time": "+2024-03-10T00:00:00Z"})
        ceremony["labels"]["en"]["value"] = "96th Academy Awards"
        category = {
            "labels": {"en": {"value": "Academy Award for Best Actor"}},
            "claims": {
                "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q19020"}}}}]
            },
        }
        entities = {
            "Q202589": person,
            "Q108839994": movie,
            "Q85314819": ceremony,
            "Q103916": category,
        }
        client = Mock()
        client.entities.side_effect = lambda ids: {q: entities[q] for q in ids}
        connector = Mock()
        connector.select.side_effect = lambda sql, args: [
            {"tmdb_id": i} for i in args[0]
        ]
        self.db.tmdb_movie_details.insert_one({"tmdb_id": 872585})

        def row(st, prop, date):
            uri = lambda v: {"value": v}
            return {
                k: uri(v)
                for k, v in {
                    "statement": "http://www.wikidata.org/entity/statement/" + st,
                    "subject": "http://www.wikidata.org/entity/Q202589",
                    "object": "http://www.wikidata.org/entity/Q103916",
                    "property": "http://www.wikidata.org/prop/" + prop,
                    "work": "http://www.wikidata.org/entity/Q108839994",
                    "ceremony": "http://www.wikidata.org/entity/Q85314819",
                    "date": date,
                    "rank": "http://wikiba.se/ontology#NormalRank",
                }.items()
            }

        data = wikidata.normalize(
            self.db,
            client,
            connector,
            {"qid": "Q103916", "program_key": "oscars"},
            [row("nom", "P1411", "2024-01-23"), row("win", "P166", "2024-03-10")],
        )
        entries, _ = models.reconcile_observations([o.to_dict() for o in data])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["recipients"][0]["person_tmdb_id"], 2037)
        self.assertEqual(entries[0]["works"][0]["media_tmdb_id"], 872585)
        self.assertEqual(entries[0]["result_status"], "won")

    def test_partial_statement_page_raises_instead_of_acknowledging_snapshot(self):
        client = Mock()
        client.query.side_effect = [
            [{"statement": {"value": "http://www.wikidata.org/entity/statement/guid"}}],
            [],
        ]
        with self.assertRaises(ValueError):
            wikidata.fetch_category(client, "Q103916")


class ResumeTests(unittest.TestCase):
    def test_compressed_snapshot_round_trip_and_incomplete_chunk_rejected(self):
        db = mongomock.MongoClient().db
        raw = [{"statement": {"value": "évidence"}}]
        ref = store.save_raw(db, "wikidata", raw)
        self.assertEqual(store.load_raw(db, ref), raw)
        db.award_raw_chunks.delete_many({})
        with self.assertRaises(ValueError):
            store.load_raw(db, ref)

    def test_partial_category_resumes_without_committing_partial_scope(self):
        db = mongomock.MongoClient().db
        ids = [
            {
                "statement": {
                    "value": "http://www.wikidata.org/entity/statement/Q1-" + str(i)
                }
            }
            for i in range(101)
        ]
        batch = ids[:100]
        client = Mock()
        client.query.side_effect = [ids, batch, wikidata.Deferred("time budget")]
        with self.assertRaises(wikidata.Deferred):
            wikidata.fetch_category(client, "Q103916", db=db)
        self.assertEqual(db.award_scopes.count_documents({}), 0)
        self.assertEqual(len(db.award_fetch_checkpoints.find_one({})["pending"]), 1)
        client.query.side_effect = [ids, ids[100:]]
        self.assertEqual(len(wikidata.fetch_category(client, "Q103916", db=db)), 101)
        self.assertTrue(db.award_fetch_checkpoints.find_one({})["complete"])
        client.query.side_effect = AssertionError(
            "completed fetch must use saved evidence"
        )
        self.assertEqual(len(wikidata.fetch_category(client, "Q103916", db=db)), 101)

    def test_exact_character_association_survives_reconciliation(self):
        row = observation()
        row["portrayals"] = [
            {"credit_id": "verified-credit", "link_status": "verified"}
        ]
        entries, _ = models.reconcile_observations([row])
        self.assertEqual(entries[0]["portrayals"], row["portrayals"])
        row.pop("portrayals")
        self.assertEqual(models.reconcile_observations([row])[0][0]["portrayals"], [])


if __name__ == "__main__":
    unittest.main()
