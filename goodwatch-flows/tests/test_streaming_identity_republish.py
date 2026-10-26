"""Offline bounded identity republish, lease-held backup and resumable rollback."""
import os
import re
import socket
import sys
import unittest
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import mongomock
from bson import Binary, Decimal128
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import streaming_identity_republish as repair
from test_streaming_publication import load_copy, availability
from test_provider_identity import clickout_url


class Crate:
    def __init__(self, db):
        self.db = db
        self.tables = {name: [] for name in repair.TABLES}
        self.media = {42: {'tmdb_id':42,'name':'Preserve metadata', **{field:None for field in repair.AGGREGATES}}}
        self.catalog = [dict(tmdb_id=value,name='Apple TV',media_type='movie') for value in (2,350)]
        self.cur = SimpleNamespace(rowcount=1)
        self.mutations = 0
        self.before_mutate = lambda: None
        self.fail_insert_once = None

    def select(self, sql, params=None):
        table = re.search(r'FROM (\w+)', sql).group(1)
        if table == 'streaming_service':
            return deepcopy(self.catalog)
        if table in self.tables:
            ids = params[0] if isinstance(params[0],list) else [params[0]]
            rows=[row for row in self.tables[table] if row['media_tmdb_id'] in ids and row['media_type']==params[1]]
            if sql.startswith('SELECT country_code'):
                rows=[{'country_code':row['country_code']} for row in rows]
            return deepcopy(rows)
        row=self.media.get(params[0])
        return [deepcopy(row)] if row else []

    def mutate(self):
        self.before_mutate()
        self.mutations+=1

    def upsert_many(self, table, records, **kwargs):
        self.mutate()
        for record in records:
            row=record.model_dump()
            if table in self.tables:
                fields=repair.PRIMARY_KEYS[table]
                self.tables[table]=[old for old in self.tables[table] if tuple(old.get(f) for f in fields)!=tuple(row.get(f) for f in fields)]
                self.tables[table].append(row)
            else:
                self.media.setdefault(row['tmdb_id'],{}).update(row)
        return {'records_received':len(records),'rows_upserted':len(records)}

    def run(self, sql, params=None):
        if sql.startswith('REFRESH '):
            return
        self.mutate()
        if sql.startswith('DELETE '):
            table=re.search(r'FROM (\w+)',sql).group(1)
            if len(params)==2:
                self.tables[table]=[r for r in self.tables[table] if (r['media_tmdb_id'],r['media_type'])!=tuple(params)]
            else:
                fields=repair.PRIMARY_KEYS[table]
                self.tables[table]=[r for r in self.tables[table] if tuple(r.get(f) for f in fields)!=tuple(params)]
        elif sql.startswith('INSERT '):
            table=re.search(r'INTO (\w+)',sql).group(1)
            if self.fail_insert_once==table:
                self.fail_insert_once=None
                raise RuntimeError('synthetic interrupted INSERT')
            columns=[col.strip().strip('"') for col in sql.split('(',1)[1].split(')',1)[0].split(',')]
            self.tables[table].append(dict(zip(columns,params)))
        elif sql.startswith('UPDATE '):
            fields=[part.strip().split(' = ')[0] for part in sql.split(' SET ')[1].split(' WHERE ')[0].split(',')]
            self.media[params[-1]].update(dict(zip(fields,params[:-1])))
        else:
            raise AssertionError(sql)


class RepublishTests(unittest.TestCase):
    def database(self):
        return mongomock.MongoClient().repair

    def setUp(self):
        self.db=self.database()
        self.crate=Crate(self.db)
        self.output=TemporaryDirectory()
        self.addCleanup(self.output.cleanup)
        guard=patch.object(socket.socket,'connect',side_effect=AssertionError('Network forbidden'))
        if not os.environ.get('REPUBLISH_TEST_MONGO_URI'):
            guard.start();self.addCleanup(guard.stop)
        self.now=datetime.utcnow()
        self.url=clickout_url('Apple TV',2)
        self.db.tmdb_movie_details.insert_one({'tmdb_id':42,'updated_at':self.now,'name':'Raw metadata',
            'watch_providers':{'results':{'US':{'link':'https://tmdb.test/watch','rent':[{'provider_id':2,'provider_name':'Apple TV','display_priority':1}]}}}})
        self.db.tmdb_movie_providers.insert_one({'tmdb_id':42,'country_code':'US','updated_at':self.now,
            'created_at':self.now,'streaming_links':[{'provider_name':'Apple TV','stream_type':'rent','stream_url':self.url,'price_dollar':3,'quality':'HD'}]})
        self.crate.tables['streaming_availability']=[availability(media_type='movie',streaming_type='rent',streaming_service_id=350,stream_url=self.url),
            availability(media_type='movie',streaming_type='rent',streaming_service_id=2,stream_url=None,tmdb_link='https://tmdb.test/watch',display_priority=1)]
        self.crate.tables['availability_history']=[dict(media_tmdb_id=42,media_type='movie',country_code='DE',streaming_service_id=8,streaming_type='flatrate',observed_at=1760000000000,appeared_on=1760000000000,appeared_after=None,appeared_source='backfill',appeared_precision='unknown',last_seen_on=1760000000000,dropped_on=None,dropped_precision=None)]
        self.db.streaming_history_pending.insert_one({'_id':'movie:42','opaque':Binary(b'\x00\xff', subtype=128),'decimal':Decimal128('12.50')})
        self.publisher=SimpleNamespace(**load_copy(self.db).__globals__)
        self.plan=lambda:repair.plan_title(self.db,self.crate,'movie',42,self.publisher)
        self.apply=lambda plan:repair.apply_title(self.db,self.crate,plan,self.output.name,self.publisher)
        self.rollback=lambda plan:repair.rollback_title(self.db,self.crate,plan,self.output.name,self.publisher)

    def test_preview_no_writes_canonical_id_and_lossless_archive_under_lease(self):
        plan=self.plan()
        self.assertEqual(self.crate.mutations,0)
        self.assertEqual(plan['apple_350_store_rows'],1)
        self.assertTrue(all(row['canonical_service_id']==2 for row in plan['inventory']))
        self.assertEqual([row['streaming_service_id'] for row in plan['expected_availability']],[2])
        archive,receipt=repair.paths(self.output.name,plan)
        def protected_write():
            self.assertIsNotNone(self.db.streaming_publication_leases.find_one({'_id':'movie:42'}))
            self.assertTrue(archive.exists())
        self.crate.before_mutate=protected_write
        result=self.apply(plan)
        self.assertEqual(result['phase'],'applied')
        self.assertEqual(repair.read(archive)['before'],plan['before'])
        self.assertEqual(len(self.crate.tables['streaming_availability']),1)
        self.assertEqual(self.crate.tables['streaming_availability'][0]['streaming_service_id'],2)
        self.assertEqual(self.crate.media[42]['name'],'Preserve metadata')
        mutations=self.crate.mutations
        self.assertEqual(self.apply(plan),result)
        self.assertEqual(self.crate.mutations,mutations)
        self.rollback(plan)
        self.assertEqual(repair.targets(self.db,self.crate,'movie',42),plan['before'])
        self.rollback(plan)
        self.assertEqual(self.crate.media[42]['name'],'Preserve metadata')

    def test_stale_preview_and_newer_targets_or_sources_refuse(self):
        plan=self.plan()
        self.db.tmdb_movie_details.update_one({'tmdb_id':42},{'$set':{'name':'New metadata'}})
        with self.assertRaisesRegex(RuntimeError,'Source changed'):
            self.apply(plan)
        self.assertEqual(self.crate.mutations,0)
        plan=self.plan();self.apply(plan)
        self.crate.tables['streaming_availability'][0]['quality']='Newer'
        with self.assertRaisesRegex(RuntimeError,'Target changed'):
            self.rollback(plan)
        self.assertEqual(self.crate.tables['streaming_availability'][0]['quality'],'Newer')

    def test_interrupted_rollback_resumes_without_losing_other_titles(self):
        plan=self.plan();self.apply(plan)
        self.crate.tables['streaming_availability'].append(availability(media_type='movie',media_tmdb_id=99))
        self.crate.media[42]['name']='New unrelated metadata'
        self.crate.fail_insert_once='streaming_availability'
        with self.assertRaisesRegex(RuntimeError,'interrupted INSERT'):
            self.rollback(plan)
        self.assertEqual(self.rollback(plan)['phase'],'rolled_back')
        self.assertEqual(repair.targets(self.db,self.crate,'movie',42),plan['before'])
        self.assertTrue(any(row['media_tmdb_id']==99 for row in self.crate.tables['streaming_availability']))
        self.assertEqual(self.crate.media[42]['name'],'New unrelated metadata')

    def test_rollback_refuses_new_source_and_unexpected_interrupted_rows(self):
        plan=self.plan();self.apply(plan)
        self.db.tmdb_movie_details.update_one({'tmdb_id':42},{'$set':{'name':'New raw metadata'}})
        with self.assertRaisesRegex(RuntimeError,'Source changed'):
            self.rollback(plan)
        self.db.tmdb_movie_details.update_one({'tmdb_id':42},{'$set':{'name':'Raw metadata'}})
        self.crate.fail_insert_once='streaming_availability'
        with self.assertRaisesRegex(RuntimeError,'interrupted INSERT'):
            self.rollback(plan)
        self.crate.tables['streaming_availability'].append(availability(media_type='movie',streaming_service_id=999))
        with self.assertRaisesRegex(RuntimeError,'Target changed during interrupted rollback'):
            self.rollback(plan)
        self.assertTrue(any(row['streaming_service_id']==999 for row in self.crate.tables['streaming_availability']))

    def test_interrupted_apply_resumes_existing_writer(self):
        plan=self.plan()
        real=self.crate.upsert_many
        failed=[False]
        def crash(table, records, **kwargs):
            result=real(table,records,**kwargs)
            if table=='streaming_availability' and not failed[0]:
                failed[0]=True
                raise RuntimeError('synthetic after availability upsert')
            return result
        self.crate.upsert_many=crash
        with self.assertRaisesRegex(RuntimeError,'synthetic after'):
            self.apply(plan)
        self.crate.tables['streaming_availability'].append(availability(media_type='movie',streaming_service_id=999))
        with self.assertRaisesRegex(RuntimeError,'Target changed after interrupted apply'):
            self.apply(plan)
        self.crate.tables['streaming_availability']=[r for r in self.crate.tables['streaming_availability'] if r['streaming_service_id']!=999]
        self.assertEqual(self.apply(plan)['phase'],'applied')
        self.assertEqual([r['streaming_service_id'] for r in self.crate.tables['streaming_availability']],[2])


@unittest.skipUnless(os.environ.get('REPUBLISH_TEST_MONGO_URI'),'disposable localhost Mongo required')
class RealMongoRepublishTests(RepublishTests):
    def database(self):
        uri=os.environ['REPUBLISH_TEST_MONGO_URI']
        if uri!='mongodb://127.0.0.1:27189/':
            raise ValueError('Only disposable localhost Mongo allowed')
        client=MongoClient(uri,serverSelectionTimeoutMS=3000)
        db=client['streaming_republish_test_'+uuid4().hex]
        self.addCleanup(client.close)
        self.addCleanup(lambda:client.drop_database(db.name))
        return db
