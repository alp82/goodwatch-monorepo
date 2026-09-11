import sys
from pathlib import Path
import unittest
from datetime import datetime, timedelta, timezone
import mongomock
sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.monitoring.backlog_collection import collect_countries

class CountryBacklogCollectionTests(unittest.TestCase):
    def test_only_overdue_eligible_countries_count_and_partial_title_stays_visible(self):
        now=datetime(2026,9,11,tzinfo=timezone.utc)
        db=mongomock.MongoClient(tz_aware=True).test
        db.tmdb_movie_providers.insert_many([
            {'tmdb_id':1,'country_code':'DE','next_fetch_at':now-timedelta(hours=2)},
            {'tmdb_id':1,'country_code':'US','updated_at':now,'next_fetch_at':now+timedelta(days=7)},
            {'tmdb_id':2,'country_code':'DE','next_fetch_at':now+timedelta(hours=1),'consecutive_failures':2},
            {'tmdb_id':3,'country_code':'DE','next_fetch_at':now-timedelta(hours=2),'lease_expires_at':now+timedelta(minutes=1)},
            {'tmdb_id':4,'country_code':'DE','next_fetch_at':now-timedelta(minutes=10)},
        ])
        result=collect_countries(db,now)
        self.assertTrue(result['complete'])
        self.assertEqual(result['overdue_country_count'],1)
        self.assertEqual(result['overdue_title_count'],1)
        self.assertEqual(result['oldest_due_at'],(now-timedelta(hours=2)).isoformat())
        self.assertNotIn('streaming_links',str(result))

    def test_global_upstream_backoff_suppresses_current_eligibility(self):
        now=datetime(2026,9,11,tzinfo=timezone.utc)
        db=mongomock.MongoClient(tz_aware=True).test
        db.tmdb_streaming_upstream.insert_one({'_id':'tmdb_watch','blocked_until':now+timedelta(hours=1)})
        db.tmdb_movie_providers.insert_one({'tmdb_id':1,'country_code':'DE','next_fetch_at':now-timedelta(days=1)})
        result=collect_countries(db,now)
        self.assertEqual(result['overdue_country_count'],0)
        self.assertEqual(result['upstream_blocked_until'],(now+timedelta(hours=1)).isoformat())

if __name__=='__main__':unittest.main()

from unittest.mock import patch
from f.monitoring.backlog_collection import collect_publication
from test_workflow_store_integration import LocalCrate, URL
from uuid import uuid4

class PublicationDB(LocalCrate):
    def request(self, sql, **params):
        return super().request(sql.replace('crawl_priority', self.table), **params)

@unittest.skipUnless(URL, 'Set TEST_CRATE_URL for real priority aggregate checks')
class PublicationBacklogCollectionTests(unittest.TestCase):
    def setUp(self):
        self.db=PublicationDB('priority_backlog_'+uuid4().hex)
        self.db.run('CREATE TABLE crawl_priority (media_type TEXT,tmdb_id INTEGER,demand BIGINT,acknowledged_demand BIGINT,last_success_at TIMESTAMP,lease_expires_at TIMESTAMP,updated_at TIMESTAMP,PRIMARY KEY(media_type,tmdb_id))')
        self.now=datetime(2026,9,11,tzinfo=timezone.utc)
        self.stamp=int(self.now.timestamp()*1000)

    def tearDown(self):
        self.db.run('DROP TABLE crawl_priority')

    def insert(self,identity,*,ack=0,success=None,lease=None,updated=None):
        self.db.run('INSERT INTO crawl_priority VALUES(?,?,?,?,?,?,?)',('movie',identity,5,ack,success,lease,updated if updated is not None else self.stamp-3*3600000))

    def test_grace_active_leases_cooldown_and_acknowledged_work_are_excluded(self):
        self.insert(1)
        self.insert(2,ack=5)
        self.insert(3,success=self.stamp-3600000)
        self.insert(4,lease=self.stamp+60000)
        self.insert(5,updated=self.stamp-60000)
        self.db.run('REFRESH TABLE crawl_priority')
        result=collect_publication(self.db,[],self.now)
        self.assertEqual(result['overdue_title_count'],1)
        self.assertEqual(result['outstanding_demand'],5)
        self.assertEqual(result['age_basis'],'last_queue_update_lower_bound')

    def test_other_title_ack_does_not_hide_correlated_exhaustion(self):
        self.insert(1,ack=2,lease=self.stamp+60000)
        self.insert(2,ack=5,success=self.stamp)
        self.db.run('REFRESH TABLE crawl_priority')
        failed={'publication_failure':{'classification':'attempts_exhausted','attempts':4,'retries':3,'completed_at':self.now.isoformat(),'job_id':'failed-publish','targets':[{'media_type':'movie','tmdb_id':1,'claimed_demand':5}]}}
        result=collect_publication(self.db,[failed],self.now)
        self.assertTrue(result['failure_unacknowledged'])
        self.db.run('UPDATE crawl_priority SET acknowledged_demand=5 WHERE media_type=? AND tmdb_id=?',('movie',1))
        self.assertFalse(collect_publication(self.db,[failed],self.now)['failure_unacknowledged'])
