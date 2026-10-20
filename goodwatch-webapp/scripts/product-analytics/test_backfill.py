import unittest
from backfill import envelope

class BackfillTests(unittest.TestCase):
    def test_surviving_rating_uses_last_update_and_a_stable_receipt(self):
        row={'user_id':'member','media_type':'movie','tmdb_id':603,'score':9,'updated_at':1792392448654}
        args=('user_score','rating saved',row,['user_id','media_type','tmdb_id'],'updated_at','current_record')
        first=envelope(*args)
        self.assertEqual(first,envelope(*args))
        self.assertEqual(first['properties']['user_id'],'member')
        self.assertTrue(first['properties']['backfilled'])
        self.assertEqual(first['properties']['history_precision'],'current_record')
        self.assertNotIn('previous_score',first['properties'])
        self.assertTrue(first['timestamp'].startswith('2026-10-19'))

    def test_current_state_does_not_invent_a_previous_state(self):
        row={'user_id':'member','media_type':'show','tmdb_id':1396,'state':'on_hold','pass':2,'updated_at':1792392448654}
        event=envelope('user_watch_state','watch state changed',row,['user_id','media_type','tmdb_id'],'updated_at','current_state_only')
        self.assertIsNone(event['properties']['from_state'])
        self.assertEqual(event['properties']['to_state'],'on_hold')

    def test_unknown_timestamp_is_not_replaced_with_today(self):
        row={'user_id':'member','media_type':'movie','tmdb_id':603,'updated_at':None}
        self.assertIsNone(envelope('user_score','rating saved',row,['user_id','media_type','tmdb_id'],'updated_at','current_record'))

    def test_import_keeps_its_real_outcome(self):
        row={'user_id':'member','id':'import','status':'undone','source':'imdb','finished_at':1792392448654}
        event=envelope('user_import','import completed',row,['user_id','id'],'finished_at','surviving_record')
        self.assertEqual(event['event'],'import undone')
        self.assertEqual(event['properties']['import_source'],'imdb')

if __name__=='__main__':unittest.main()
