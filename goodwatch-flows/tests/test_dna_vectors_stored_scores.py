"""The vectors step stores the fingerprint of the scores the title holds now (#392)."""
import io
import json
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import fakeredis
import mongomock
import requests
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.dna.generate import fetch, vectors
from f.dna.models import DnaMovie, DnaTv, create_fingerprint

SAVED_AT = datetime(2026, 10, 1, 12)


def response(dna):
    result = requests.Response()
    result.status_code = 200
    result._content = json.dumps({'choices': [{'message': {'content': json.dumps(dna)}}]}).encode()
    return result


class StoredScoresTest(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect('dna_vectors_test', mongo_client_class=mongomock.MongoClient, uuidRepresentation='standard')
        self.addCleanup(disconnect)
        for target, kwargs in (
            ('f.db.mongodb.connect', {}),
            ('f.db.mongodb.disconnect', {}),
            ('f.db.redis.RedisCluster', {'return_value': fakeredis.FakeRedis()}),
            ('wmill.get_variable', {'side_effect': lambda name: '6379' if name == 'u/Alp/REDIS_PORT' else 'key'}),
            ('sys.stdout', {'new_callable': io.StringIO}),
        ):
            patcher = patch(target, **kwargs)
            patcher.start()
            self.addCleanup(patcher.stop)
        first = json.loads((Path(__file__).parent / 'fixtures/dna.json').read_text())
        second = json.loads(json.dumps(first))
        for name, score in first['fingerprint']['scores'].items():
            second['fingerprint']['scores'][name] = 10 - score
        self.first, self.second = first, second

    def title(self, cls=DnaMovie, **fields):
        fields = {'is_selected': True, 'selected_at': datetime(2026, 10, 1, 11), **fields}
        return cls(tmdb_id=603, original_title='The Matrix', release_year=1999,
                   overview='A programmer discovers a simulated world.', popularity=1.0, **fields).save()

    def analysed(self, dna, cls=DnaMovie, **fields):
        """A title as f/dna/generate/fetch leaves it, unless fields say otherwise."""
        fields = {'vector_fingerprint': create_fingerprint(dna['fingerprint']['scores']),
                  'updated_at': SAVED_AT, 'is_selected': False, **fields}
        return self.title(cls, dna=dna, **fields)

    def run_step(self, entry, dna):
        key = 'movie_ids' if isinstance(entry, DnaMovie) else 'tv_ids'
        ids = {'movie_ids': [], 'tv_ids': [], key: [str(entry.id)]}
        return vectors.main(ids, [{'id': str(entry.id), 'dna': dna}])

    def assert_fingerprint_of(self, entry, dna):
        entry.reload()
        self.assertEqual(entry.dna, dna)
        self.assertEqual(entry.vector_fingerprint, create_fingerprint(dna['fingerprint']['scores']))
        self.assertFalse(entry.is_selected)

    def two_overlapping_runs(self):
        """Two fetch jobs load one title before either saves; the second save wins."""
        entry = self.title()
        loaded_by_first, loaded_by_second = DnaMovie.objects.get(id=entry.id), DnaMovie.objects.get(id=entry.id)
        with patch('requests.post', side_effect=[response(self.first), response(self.second)]):
            first_results = fetch.generate_dna([loaded_by_first])
            second_results = fetch.generate_dna([loaded_by_second])
        self.assertEqual(first_results, [{'id': str(entry.id), 'dna': self.first}])
        self.assertEqual(second_results, [{'id': str(entry.id), 'dna': self.second}])
        return entry

    def test_overlapping_runs_end_with_the_fingerprint_of_the_stored_scores(self):
        orders = {'earlier save, then later save': (self.first, self.second),
                  'later save, then earlier save': (self.second, self.first)}
        for order, steps in orders.items():
            with self.subTest(vectors_steps=order):
                DnaMovie.drop_collection()
                entry = self.two_overlapping_runs()
                saved_at = DnaMovie.objects.get(id=entry.id).updated_at
                for dna in steps:
                    self.assertEqual(self.run_step(entry, dna), {'fingerprints_count': 1})
                    self.assert_fingerprint_of(entry, self.second)
                self.assertEqual(entry.updated_at, saved_at)

    def test_scores_saved_while_the_step_runs_keep_their_own_fingerprint(self):
        entry = self.analysed(self.first, vector_fingerprint=[], is_selected=True)
        stored_fingerprint = vectors.create_fingerprint
        saves = []

        def save_between_read_and_write(scores):
            # Only the step's read of the document is interrupted, once.
            if scores == self.first['fingerprint']['scores'] and len(saves) < 2:
                saves.append(scores)
                if len(saves) == 2:
                    DnaMovie.objects(id=entry.id).update_one(
                        set__dna=self.second, set__updated_at=datetime(2026, 10, 2),
                        set__vector_fingerprint=create_fingerprint(self.second['fingerprint']['scores']),
                        set__is_selected=False)
            return stored_fingerprint(scores)

        with patch.object(vectors, 'create_fingerprint', side_effect=save_between_read_and_write):
            self.assertEqual(self.run_step(entry, self.first), {'fingerprints_count': 1})

        self.assertEqual(len(saves), 2)
        self.assert_fingerprint_of(entry, self.second)
        self.assertEqual(entry.updated_at, datetime(2026, 10, 2))

    def test_a_title_that_keeps_changing_is_reported_and_gets_no_fingerprint_of_other_scores(self):
        entry = self.analysed(self.first, vector_fingerprint=[])
        stored_fingerprint = vectors.create_fingerprint
        calls = []

        def replace_scores_after_each_read(scores):
            calls.append(scores)
            if len(calls) > 1:  # the first call validates the batch
                other = self.second if scores == self.first['fingerprint']['scores'] else self.first
                DnaMovie.objects(id=entry.id).update_one(set__dna=other)
            return stored_fingerprint(scores)

        with patch.object(vectors, 'create_fingerprint', side_effect=replace_scores_after_each_read):
            with self.assertRaisesRegex(ValueError, f'DNA title {entry.id} kept changing'):
                self.run_step(entry, self.first)

        self.assertEqual(len(calls), 3)
        entry.reload()
        self.assertEqual(entry.vector_fingerprint, [])

    def test_a_single_run_leaves_the_saved_title_as_it_is(self):
        for cls in (DnaMovie, DnaTv):
            with self.subTest(cls=cls.__name__):
                entry = self.analysed(self.first, cls)
                before = cls.objects(id=entry.id).as_pymongo().first()

                self.assertEqual(self.run_step(entry, self.first), {'fingerprints_count': 1})

                self.assertEqual(cls.objects(id=entry.id).as_pymongo().first(), before)
                self.assert_fingerprint_of(entry, self.first)
                self.assertEqual(entry.updated_at, SAVED_AT)

    def test_a_missing_or_stale_fingerprint_is_stored_and_the_title_released(self):
        stale = create_fingerprint(self.second['fingerprint']['scores'])
        for stored in ([], stale):
            with self.subTest(stored=stored[:2]):
                DnaMovie.drop_collection()
                entry = self.analysed(self.first, vector_fingerprint=stored, is_selected=True)

                self.assertEqual(self.run_step(entry, self.first), {'fingerprints_count': 1})

                self.assert_fingerprint_of(entry, self.first)
                # The copies select on updated_at.
                self.assertGreater(entry.updated_at, SAVED_AT)

    def test_a_selected_title_with_a_matching_fingerprint_is_released_without_a_new_updated_at(self):
        entry = self.analysed(self.first, is_selected=True)

        self.run_step(entry, self.first)

        self.assert_fingerprint_of(entry, self.first)
        self.assertEqual(entry.updated_at, SAVED_AT)

    def test_a_title_deleted_in_between_still_raises(self):
        entry = self.analysed(self.first)
        entry.delete()
        with self.assertRaisesRegex(ValueError, f'DNA title {entry.id} no longer exists'):
            self.run_step(entry, self.first)

    def test_a_title_deleted_between_read_and_write_still_raises(self):
        entry = self.analysed(self.first, vector_fingerprint=[])
        stored_fingerprint = vectors.create_fingerprint
        calls = []

        def delete_after_read(scores):
            calls.append(scores)
            if len(calls) == 2:
                DnaMovie.objects(id=entry.id).delete()
            return stored_fingerprint(scores)

        with patch.object(vectors, 'create_fingerprint', side_effect=delete_after_read):
            with self.assertRaisesRegex(ValueError, f'DNA title {entry.id} no longer exists'):
                self.run_step(entry, self.first)

    def test_stored_dna_without_valid_scores_raises(self):
        entry = self.analysed(self.first)
        DnaMovie.objects(id=entry.id).update_one(unset__dna__fingerprint__scores__adrenaline=1)
        with self.assertRaisesRegex(ValueError, 'no valid stored scores'):
            self.run_step(entry, self.first)

    def test_invalid_result_scores_are_rejected_before_database_access(self):
        entry = self.analysed(self.first)
        broken = json.loads(json.dumps(self.first))
        del broken['fingerprint']['scores']['adrenaline']
        with patch.object(vectors, 'init_mongodb') as connect_mongodb:
            with self.assertRaises(ValueError):
                self.run_step(entry, broken)
        connect_mongodb.assert_not_called()


if __name__ == '__main__':
    unittest.main()
