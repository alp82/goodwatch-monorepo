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
        self.assertEqual(result['outstanding_demand'],15)
        self.assertEqual(result['overdue_demand'],5)
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

    def test_renewed_claims_preserve_pending_demand_observation(self):
        self.insert(1,lease=self.stamp+2*3600000,updated=self.stamp)
        self.db.run('REFRESH TABLE crawl_priority')
        initial=collect_publication(self.db,[],self.now)
        self.assertEqual(initial['overdue_title_count'],0)
        self.assertEqual(initial['unacknowledged_title_count'],1)
        later=self.now+timedelta(hours=3)
        stamp=int(later.timestamp()*1000)
        self.db.run('UPDATE crawl_priority SET updated_at=?,lease_expires_at=? WHERE media_type=? AND tmdb_id=?',(stamp,stamp+2*3600000,'movie',1))
        self.db.run('REFRESH TABLE crawl_priority')
        renewed=collect_publication(self.db,[],later)
        self.assertEqual(renewed['overdue_title_count'],0)
        self.assertEqual(renewed['unacknowledged_title_count'],1)
        self.db.run('UPDATE crawl_priority SET acknowledged_demand=5 WHERE media_type=? AND tmdb_id=?',('movie',1))
        self.db.run('REFRESH TABLE crawl_priority')
        self.assertEqual(collect_publication(self.db,[],later)['unacknowledged_title_count'],0)

    def test_older_unacknowledged_exhaustion_is_not_lost_after_twenty_failures(self):
        self.insert(1,ack=0)
        self.insert(2,ack=5)
        self.db.run('REFRESH TABLE crawl_priority')
        jobs=[]
        for index in range(21):
            jobs.append({'publication_failure':{'classification':'attempts_exhausted','attempts':4,'retries':3,'completed_at':(self.now-timedelta(minutes=index)).isoformat(),'job_id':'failure-'+str(index),'targets':[{'media_type':'movie','tmdb_id':1 if index==20 else 2,'claimed_demand':5}]}})
        result=collect_publication(self.db,jobs,self.now)
        self.assertTrue(result['failure_unacknowledged'])
        self.assertEqual(result['latest_job_id'],'failure-20')

    def test_unexamined_failure_targets_prevent_false_recovery(self):
        from f.monitoring.backlog_health import assess_backlogs
        from f.monitoring.health import incident_transition
        self.insert(1,ack=0)
        self.insert(2,ack=5)
        self.db.run('REFRESH TABLE crawl_priority')
        jobs=[{'publication_failure':{'classification':'attempts_exhausted','attempts':4,'retries':3,'completed_at':(self.now-timedelta(minutes=index)).isoformat(),'job_id':'failure-'+str(index),'targets':[{'media_type':'movie','tmdb_id':1 if index==100 else 2,'claimed_demand':5}]}} for index in range(101)]
        result=collect_publication(self.db,jobs,self.now)
        self.assertFalse(result['complete'])
        self.assertTrue(result['correlation_incomplete'])
        report=assess_backlogs({},result,None,self.now)['reports'][1]
        transition=incident_transition({'active':True},report,self.now)
        self.assertEqual(report['status'],'unknown')
        self.assertTrue(transition['state']['active'])
        self.assertNotEqual(transition['transition'],'recovered')
