"""Optional real MongoDB checks: TEST_MONGO_URL=mongodb://127.0.0.1:<port>.

Run against a disposable local MongoDB. Each test uses its own temporary database.

The completeness queue must read never-selected and stale titles through an index
in popularity order. The previous $or query fetched and sorted every never-selected
title (175k movies in production), which outgrew the 60 s step timeout.
"""

import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.data_source.common import completeness_queue, never_selected_titles, stale_titles
from f.dna.models import DnaMovie, DnaTv
from f.imdb_web.models import ImdbMovieRating, ImdbTvRating
from f.metacritic_web.models import MetacriticMovieRating, MetacriticTvRating
from f.rotten_web.models import RottenTomatoesMovieRating, RottenTomatoesTvRating
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tvtropes_web.models import TvTropesMovieTags, TvTropesTvTags

URL = os.environ.get("TEST_MONGO_URL")
NEVER_SELECTED_COUNT = 5000
# As in production, stale titles outnumber the never-selected tail, and recently
# fetched titles are the most popular, so a stale scan in popularity order passes them first.
FRESH_COUNT = 5000
STALE_COUNT = 20000
BATCH = 50
QUEUE_MODELS = [
    TmdbMovieDetails, TmdbTvDetails,
    ImdbMovieRating, ImdbTvRating,
    MetacriticMovieRating, MetacriticTvRating,
    RottenTomatoesMovieRating, RottenTomatoesTvRating,
    TvTropesMovieTags, TvTropesTvTags,
    DnaMovie, DnaTv,
]
STALE_ID = 400_000


def stages(plan):
    found = [plan.get("stage")]
    if "inputStage" in plan:
        found += stages(plan["inputStage"])
    for child in plan.get("inputStages", []):
        found += stages(child)
    return found


def seed(model, offset, now):
    collection = model._get_collection()  # creates the model indexes
    collection.insert_many(
        [{"tmdb_id": offset + i, "popularity": i / 1000} for i in range(NEVER_SELECTED_COUNT)]
        + [
            {
                "tmdb_id": offset + 100_000 + i,
                "popularity": 10 + i / 100,
                "selected_at": now - timedelta(minutes=FRESH_COUNT - i),
                "is_selected": False,
            }
            for i in range(FRESH_COUNT)
        ]
        # Fetched more than 30 days ago.
        + [
            {
                "tmdb_id": offset + STALE_ID + i,
                "popularity": 5 + i / 10000,
                "selected_at": now - timedelta(days=40, minutes=i),
                "is_selected": False,
            }
            for i in range(STALE_COUNT)
        ]
        # A title a timed-out run reserved and never released.
        + [
            {
                "tmdb_id": offset + 200_000,
                "popularity": 1000.0,
                "selected_at": now - timedelta(hours=2),
                "is_selected": True,
            },
            # Flagged deleted on TMDB: never queued.
            {"tmdb_id": offset + 300_000, "popularity": 9999.0, "tmdb_deleted": True},
            {
                "tmdb_id": offset + 300_001,
                "popularity": 9999.0,
                "selected_at": now - timedelta(days=60),
                "tmdb_deleted": True,
            },
        ]
    )


@unittest.skipUnless(URL, "set TEST_MONGO_URL to run against a disposable MongoDB")
class DetailsQueueIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.db_name = f"details_queue_{uuid4().hex[:8]}"
        self.client = connect(host=f"{URL.rstrip('/')}/{self.db_name}")
        self.now = datetime.utcnow()
        seed(TmdbMovieDetails, 0, self.now)
        seed(TmdbTvDetails, 1_000_000, self.now)

    def tearDown(self):
        self.client.drop_database(self.db_name)
        disconnect()

    def assert_read_in_index_order(self, queryset):
        explain = queryset.limit(BATCH).explain()
        plan = explain["queryPlanner"]["winningPlan"]
        name = queryset._document._get_collection_name()
        self.assertNotIn("SORT", stages(plan.get("queryPlan", plan)), name)
        self.assertLess(explain["executionStats"]["totalDocsExamined"], BATCH * 3, name)

    def test_every_queue_collection_reads_never_selected_and_stale_titles_in_index_order(self):
        for model in QUEUE_MODELS[2:]:
            seed(model, 0, self.now)
        for model in QUEUE_MODELS:
            self.assert_read_in_index_order(never_selected_titles(model))
            self.assert_read_in_index_order(stale_titles(model, self.now - timedelta(days=30)))

    def test_batch_mixes_never_selected_and_most_popular_stale_titles(self):
        entries = completeness_queue(TmdbMovieDetails, TmdbTvDetails, BATCH, 10)

        tmdb_ids = [entry.tmdb_id for entry in entries]
        self.assertEqual(len(tmdb_ids), BATCH)
        self.assertEqual(len(set(tmdb_ids)), BATCH)
        stale = [e for e in entries if STALE_ID <= e.tmdb_id % 1_000_000 < STALE_ID + STALE_COUNT]
        no_fetch = [e for e in entries if e not in stale]
        self.assertEqual((len(no_fetch), len(stale)), (BATCH // 2, BATCH // 2))
        # Stuck titles first, then the most popular never-selected titles.
        self.assertEqual({e.tmdb_id for e in no_fetch[:2]}, {200_000, 1_200_000})
        self.assertEqual(min(e.popularity for e in no_fetch), (NEVER_SELECTED_COUNT - 12) / 1000)
        self.assertEqual(min(e.popularity for e in stale), 5 + (STALE_COUNT - 13) / 10000)
        self.assertFalse({300_000, 300_001, 1_300_000, 1_300_001} & set(tmdb_ids))
        reserved = TmdbMovieDetails.objects(tmdb_id__in=tmdb_ids, is_selected=True)
        self.assertEqual(reserved.count(), len([i for i in tmdb_ids if i < 1_000_000]))

    def test_never_selected_titles_fill_the_batch_when_nothing_is_stale(self):
        entries = completeness_queue(TmdbMovieDetails, TmdbTvDetails, BATCH, 10, stale_after_days=365)

        self.assertEqual(len(entries), BATCH)
        self.assertTrue(all(e.tmdb_id % 1_000_000 < STALE_ID for e in entries))

    def test_stale_titles_fill_the_batch_when_nothing_is_left_to_fetch(self):
        for model in (TmdbMovieDetails, TmdbTvDetails):
            model._get_collection().delete_many({"selected_at": None})
            model._get_collection().update_many({}, {"$set": {"is_selected": False}})

        entries = completeness_queue(TmdbMovieDetails, TmdbTvDetails, BATCH, 10)

        self.assertEqual(len(entries), BATCH)
        self.assertTrue(all(STALE_ID <= e.tmdb_id % 1_000_000 for e in entries))


if __name__ == "__main__":
    unittest.main()
