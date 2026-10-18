import datetime as dt
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'windmill'))
sys.path.insert(0, str(ROOT/'tools'))
from f.buzz import signal_parsers as p
from f.buzz.signal_store import SignalStore, DDL
from f.buzz.signals import Collector, Http, SourceError, run
from buzz_signals import lift, correlation, backtest, SignalCrate

FIX = Path(__file__).parent/'fixtures'/'buzz_signals'
NOW = dt.datetime(2026, 10, 18, tzinfo=dt.timezone.utc)


def fixture(name):
    return (FIX/name).read_text()


class Parsers(unittest.TestCase):
    def test_export_floor_cohort_and_cap(self):
        rows = p.tmdb_export(fixture('tmdb.jsonl').splitlines(), 'movie', {'movie:1'}, cap=1)
        self.assertEqual({r['title_key'] for r in rows}, {'movie:603', 'movie:1'})
        self.assertEqual(rows[0]['value'], 0)
        self.assertEqual(p.tmdb_export(fixture('tmdb.jsonl').splitlines(), 'tv', cap=1)[0]['title_key'], 'tv:603')

    def test_export_rejects_bad_value(self):
        with self.assertRaises(ValueError):
            p.tmdb_export(['{"id":1,"popularity":NaN}'], 'movie')

    def test_trakt_namespaced_and_unmapped(self):
        rows = p.trakt_page(json.loads(fixture('trakt.json')), 'movie', 100)
        self.assertEqual((rows[0]['title_key'], rows[0]['rank'], rows[0]['value']), ('movie:603', 101, 123))
        self.assertEqual(rows[1]['title_key'], 'unmapped:trakt:movie:999')
        rows = p.trakt_page([{'watcher_count': 13, 'show': {'ids': {'tmdb': 1396}}}], 'tv')
        self.assertEqual(rows[0]['value'], 13)
        self.assertEqual(rows[0]['title_key'], 'tv:1396')

    def test_imdb_json_rank_changes(self):
        rows = p.imdb_chart(fixture('imdb.html'))
        self.assertEqual([r['rank'] for r in rows], [1, 2])
        self.assertEqual(rows[0]['raw']['rank_change'], {'changeDirection':'UP', 'difference':12})

    def test_imdb_ld_fallback(self):
        html = '<script type="application/ld+json">{"@type":"ListItem","position":2,"item":{"url":"https://www.imdb.com/title/tt123/"}}</script>'
        self.assertEqual(p.imdb_chart(html)[0]['source_id'], 'tt123')

    def test_letterboxd_variants(self):
        rows = p.letterboxd_chart(fixture('letterboxd.html'), 72)
        self.assertEqual([r['source_id'] for r in rows], ['the-matrix', 'arrival-2016', 'a-new-film'])
        self.assertEqual(rows[0]['rank'], 73)
        self.assertEqual(p.tmdb_link(fixture('letterboxd-film.html'), 'movie'), 'movie:603')

    def test_flixpatrol_both_kinds_and_metadata(self):
        rows = p.flixpatrol_chart(fixture('flixpatrol.html'), 'netflix')
        self.assertEqual([(r['kind'], r['rank']) for r in rows], [('movie', 1), ('tv', 2)])
        self.assertEqual(p.flixpatrol_details(fixture('flixpatrol-title.html')), ('The Matrix', 1999, 'movie'))
        self.assertEqual(p.tmdb_link(fixture('flixpatrol-title.html')), 'movie:603')

    def test_ambiguous_mapping(self):
        self.assertIsNone(p.tmdb_link('<a href="https://www.themoviedb.org/movie/1">1</a><a href="https://www.themoviedb.org/movie/2">2</a>'))

    def test_challenges_fail_visible(self):
        for parser in [p.imdb_chart, p.letterboxd_chart, lambda h:p.flixpatrol_chart(h, 'netflix')]:
            with self.assertRaises(ValueError):
                parser('<html>Just a moment...</html>')


class Storage(unittest.TestCase):
    def setUp(self):
        self.crate = Mock()
        self.store = SignalStore(self.crate)

    def test_ddl_and_parameterized_unmapped_storage(self):
        self.store.initialize()
        self.assertEqual(self.crate.run.call_count, 3)
        self.store.save('imdb_moviemeter', '2026-10-18', [dict(title_key='unmapped:imdb:tt1', rank=1, value=None, raw={'quote': "'"})], NOW)
        sql, rows = self.crate.run_many.call_args.args
        self.assertIn('ON CONFLICT (source, day, title_key) DO UPDATE', sql)
        self.assertEqual(rows[0][:5], ['imdb_moviemeter', '2026-10-18', 'unmapped:imdb:tt1', 1, None])
        self.assertEqual(json.loads(rows[0][5]), {'quote': "'"})
        with self.assertRaises(ValueError):
            self.store.upsert('movie', [], [])

    def test_bulk_failure_propagates(self):
        self.crate.run_many.side_effect = RuntimeError('incomplete bulk')
        with self.assertRaises(RuntimeError):
            self.store.save('tmdb_popularity','2026-10-18',[dict(title_key='movie:1', value=1, raw={})],NOW)

    def test_duplicate_keys_rejected(self):
        with self.assertRaises(ValueError):
            self.store.save('x','2026-10-18',[dict(title_key='movie:1')]*2,NOW)

    def test_ambiguous_imdb_does_not_map(self):
        self.crate.select.return_value = [{'tmdb_id':1,'imdb_id':'tt1'}, {'tmdb_id':2,'imdb_id':'tt1'}, {'tmdb_id':3,'imdb_id':'tt2'}]
        self.assertEqual(self.store.imdb(['tt1','tt2'],'movie'), {'tt2':'movie:3'})

    def test_catalog_exact_year_ambiguity(self):
        self.crate.select.return_value = [{'tmdb_id':1}, {'tmdb_id':2}]
        self.assertIsNone(self.store.catalog_match('Remake', 2020, 'movie'))
        self.crate.select.return_value = [{'tmdb_id':1}]
        self.assertEqual(self.store.catalog_match('Remake',2020,'movie'),'movie:1')
        self.assertEqual(self.crate.select.call_args.args[1][-2:], ('2020-01-01','2021-01-01'))

    def test_mapping_cached_even_when_unmapped(self):
        self.crate.select.return_value = []
        self.assertIsNone(self.store.mapping('letterboxd','slug'))
        self.store.save_mapping('letterboxd','slug',None,{},NOW)
        self.assertEqual(self.store.mapping('letterboxd','slug')['title_key'], None)
        self.assertEqual(self.crate.select.call_count,1)

    def test_local_allowlist(self):
        crate = SignalCrate({'CRATE_HOSTS':'localhost'})
        with self.assertRaises(ValueError):
            crate.request('DELETE FROM doc.buzz_snapshot')


class Collection(unittest.TestCase):
    def test_source_and_storage_failures_are_isolated(self):
        store = Mock()
        store.cohort.side_effect = RuntimeError('unavailable')
        http = Mock()
        http.get.side_effect = SourceError('HTTP 403')
        store.save.side_effect = [RuntimeError('db'), None, None, None, None, None, None]
        result = run(store, now=NOW, http=http)
        self.assertEqual(len(result['sources']),7)
        self.assertEqual(result['sources']['tmdb_popularity']['status'],'storage_error')
        self.assertEqual(result['sources']['trakt_trending']['status'],'needs_owner')
        self.assertEqual(result['sources']['flixpatrol_top10']['status'],'blocked')

    def test_no_fake_history(self):
        with self.assertRaises(ValueError):
            run(Mock(), now=NOW, day=NOW.date()-dt.timedelta(days=1))

    def test_rate_limit_blocks_host_without_retries(self):
        session = Mock()
        session.get.return_value.status_code = 429
        http = Http(session=session, sleep=Mock())
        for _ in range(2):
            with self.assertRaises(SourceError):
                http.get('https://api.trakt.tv/movies/trending')
        self.assertEqual(session.get.call_count,1)

    def test_chart_access_failure_does_not_suppress_other_chart(self):
        session = Mock()
        session.get.return_value.status_code = 202
        http = Http(session=session, sleep=Mock())
        for chart in ('moviemeter', 'tvmeter'):
            with self.assertRaises(SourceError):
                http.get('https://www.imdb.com/chart/'+chart+'/')
        self.assertEqual(session.get.call_count, 2)

    def test_mapping_page_fetched_once_including_no_match(self):
        crate = Mock()
        crate.select.return_value = []
        store = SignalStore(crate)
        http = Mock()
        http.get.return_value.__enter__ = Mock(return_value=Mock(text='<html>no link</html>'))
        http.get.return_value.__exit__ = Mock(return_value=False)
        collector = Collector(store,http=http,now=NOW)
        for _ in range(2):
            self.assertIsNone(collector.resolve('letterboxd','slug','movie'))
        self.assertEqual(http.get.call_count,1)

    def test_trakt_pagination(self):
        from unittest.mock import MagicMock
        http = Mock()
        responses=[]
        for count in [2,2,1]:
            response=MagicMock()
            response.__enter__.return_value=response
            response.headers={'X-Pagination-Page-Count':str(count)}
            response.json.return_value=json.loads(fixture('trakt.json'))
            responses.append(response)
        # TV uses a different response shape.
        responses[-1].json.return_value=[{'watchers':1,'show':{'ids':{'tmdb':603}}}]
        http.get.side_effect=responses
        collector=Collector(Mock(),http=http,trakt_id='test',now=NOW)
        rows=collector.trakt()
        self.assertEqual(http.get.call_count,3)
        self.assertIn('tv:603',[r['title_key'] for r in rows])
        self.assertEqual(next(r['rank'] for r in rows if r['title_key']=='movie:603'), 1)

    def test_trakt_keeps_completed_pages_when_next_page_fails(self):
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value = response
        response.headers = {'X-Pagination-Page-Count': '3'}
        response.json.return_value = json.loads(fixture('trakt.json'))
        http = Mock()
        http.get.side_effect = [response, SourceError('HTTP 429'), SourceError('Host blocked')]
        collector = Collector(Mock(), http=http, trakt_id='test', now=NOW)
        rows, status = collector.collect('trakt_trending', NOW.date())
        self.assertEqual(status['status'], 'partial')
        self.assertEqual(len(rows), 2)

    def test_letterboxd_keeps_unmapped_and_completed_page_on_failure(self):
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value = response
        response.text = fixture('letterboxd.html')
        http = Mock()
        http.get.side_effect = [response, SourceError('HTTP 403')]
        store = Mock()
        store.mapping.return_value = {'title_key': None}
        collector = Collector(store, http=http, now=NOW)
        rows, status = collector.collect('letterboxd_popular_week', NOW.date())
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(r['title_key'].startswith('unmapped:') for r in rows))
        self.assertEqual(status['status'], 'partial')

    def test_flixpatrol_aggregates_services_without_duplicate_keys(self):
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value = response
        response.text = fixture('flixpatrol.html')
        http = Mock()
        http.get.return_value = response
        store = Mock()
        store.mapping.side_effect = lambda source, slug: {'title_key':'movie:603' if slug=='the-matrix' else 'tv:1396'}
        collector = Collector(store, http=http, now=NOW)
        rows = collector.flixpatrol(NOW.date())
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['value'], 70)
        self.assertEqual(len(rows[0]['raw']['charts']), 7)

    def test_gzip_export_stream_both_kinds(self):
        import gzip
        import io
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.side_effect = lambda: Mock(raw=io.BytesIO(gzip.compress(fixture('tmdb.jsonl').encode())))
        http = Mock()
        http.get.return_value = response
        store = Mock()
        store.cohort.return_value = {'movie:1'}
        collector = Collector(store, http=http, now=NOW)
        rows, status = collector.collect('tmdb_popularity', NOW.date())
        self.assertEqual(status['status'], 'works')
        self.assertEqual(len(rows), 5)
        self.assertEqual(http.get.call_count, 2)


class Backtest(unittest.TestCase):
    def series(self):
        return {'movie:1':{(NOW.date()-dt.timedelta(days=i)).isoformat():10 if i else 30 for i in range(29)}}

    def test_lift_complete_window_and_gates(self):
        series=self.series()
        self.assertEqual(lift(series,NOW.date()), (['movie:1'],1))
        series['movie:1'].pop((NOW.date()-dt.timedelta(days=28)).isoformat())
        self.assertEqual(lift(series,NOW.date()),([],0))
        self.assertEqual(lift(self.series(),NOW.date(),minimum=31),([],1))

    def test_zero_baseline_and_deterministic_tie(self):
        series=self.series()
        series['tv:1']=dict(series['movie:1'])
        for values in series.values():
            for day in values:
                values[day]=0 if day != NOW.date().isoformat() else 10
        self.assertEqual(lift(series,NOW.date())[0],['movie:1','tv:1'])

    def test_spearman(self):
        self.assertEqual(correlation(['a','b','c'],['c','b','a']),-1)
        self.assertEqual(correlation(['x','a','b'],['a','y','b']),1)
        self.assertIsNone(correlation(['a'],['a']))

    def test_report_uses_prior_calendar_window_and_fixed_cutoffs(self):
        crate = Mock()
        def select(sql, params=()):
            if 'buzz_snapshot' in sql:
                return [{'day':'2026-10-18','payload':json.dumps({'top20':[{'title_key':'tv:1'}, {'title_key':'movie:1'}]})}]
            value = 30 if params[0]=='2026-10-18' else 10
            return [{'title_key':'movie:1', 'value':value}, {'title_key':'tv:1', 'value':value}]
        crate.select.side_effect = select
        report = backtest(crate)
        self.assertIn('| 2026-10-18 | 2 | 2 | 2/2 | 0.250 | 0.100 | 2 | -1.000 |', report)
        self.assertEqual(crate.select.call_count, 30)

    def test_report_missing_history_explicit(self):
        crate=Mock()
        crate.select.side_effect=lambda sql, params=(): [{'day':'2026-10-18','payload':json.dumps({'top20':[{'title_key':'movie:1'}]})}] if 'buzz_snapshot' in sql else []
        report=backtest(crate)
        self.assertIn('| 2026-10-18 | 0 | 0 | 0/1 | 0.000 | 0.000 | 0 | N/A |',report)


if __name__=='__main__':
    unittest.main()
