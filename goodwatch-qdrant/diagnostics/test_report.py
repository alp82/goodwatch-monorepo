import copy
import datetime
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import report


def fixture():
    observer, consumer = [], []
    for cycle in (1, 2, 3):
        hour = 20 + cycle
        def at(seconds):
            return (datetime.datetime(2026, 10, 11, hour, tzinfo=datetime.timezone.utc) + datetime.timedelta(seconds=seconds)).isoformat()
        def counters(major, reads, rss, reclaim=0):
            return {'pid': 123, 'minorFaults': major * 2, 'majorFaults': major, 'readBytes': reads, 'rssBytes': rss,
                    'hostReclaim': {'pgscan_kswapd': reclaim * 2, 'pgsteal_kswapd': reclaim, 'pswpin': 0, 'pswpout': 0}}
        def extent(phase, seconds):
            return {'event': 'qdrant-mapped-file-residency', 'cycle': cycle, 'phase': phase, 'method': 'extent',
                    'at': at(seconds), 'qdrantPid': 123, 'pageSizeBytes': 4096, 'failedFiles': 0, 'excludedFiles': 0,
                    'classes': {kind: {'files': 1, 'extentSupportedFiles': 1, 'extentUnsupportedFiles': 0,
                                      'fileIdentityHash': 'a'*64, 'dataExtentPages': 100, 'dataResidentPages': 99,
                                      'pages': 100000, 'residentPages': 90000} for kind in report.CLASSES}}
        for phase, seconds in (('before-baseline', 560), ('before-backup', 860), ('post-backup', 1000), ('post-warm-repeat', 1100)):
            observer.append(extent(phase, seconds))
        whole = extent('post-backup', 995); whole['method'] = 'whole'; observer.append(whole)
        for seconds, running, metrics in ((855, False, counters(10, 1000, 9000)), (905, True, counters(12, 2000, 9000)),
                                          (980, False, counters(14, 3000, 8000)), (982, False, counters(15, 4000, 8000))):
            observer.append({'event': 'modified-backup-passive-sample', 'at': at(seconds), 'cycle': cycle,
                             'backupRunning': running, 'counters': metrics})
        for cls in ('media', 'reference'):
            for phase in ('snapshot', 'publish', 'cache_advice', 'retention'):
                for status, seconds in (('started', 901), ('completed', 970)):
                    event = {'event': 'qdrant.backup.phase.v1', 'at': at(seconds), 'cycle': cycle,
                             'collectionClass': cls, 'phase': phase, 'status': status}
                    if phase == 'cache_advice' and status == 'completed': event['adviceAccepted'] = True
                    observer.append(event)
        observer.append({'event': 'modified-backup-phase-summary', 'at': at(990), 'cycle': cycle,
                         'phaseEventCount': 16, 'failedPhaseCount': 0, 'cacheAdviceAcceptedCount': 2, 'cacheAdviceRejectedCount': 0})
        observer.append({'event': 'modified-backup-post-control', 'at': at(1010), 'cycle': cycle,
                         'backupObservedThenAbsent': True, 'signalSucceeded': True, 'wholeAt': at(995), 'extentAt': at(1000),
                         'countersBeforeSignal': counters(20, 5000, 8000)})
        observer.append({'event': 'modified-backup-post-batch-counters', 'at': at(1040), 'cycle': cycle,
                         'postBatchCount': 3, 'counters': counters(30, 6000, 10000)})
        observer.append({'event': 'modified-backup-warm-control', 'at': at(1050), 'cycle': cycle, 'signalSucceeded': True})
        observer.append({'event': 'modified-backup-warm-batch-counters', 'at': at(1080), 'cycle': cycle,
                         'warmBatchCount': 3, 'counters': counters(31, 6000, 9500)})
        for phase, kind, seconds in (('baseline', 'batch', 600), ('post_backup', 'batch', 1011), ('post_backup_warm', 'warm_batch', 1051)):
            for index, tag in enumerate(report.TAGS):
                consumer.append({'kind': kind, 'cycle': cycle, 'phase': phase, 'tag': tag, 'repeat': 1, 'at': at(seconds + index),
                                 'serverMs': 50, 'wallMs': 65, 'queryCount': 3, 'resultIdHash': 'b'*64,
                                 'resultIdScoreHash': 'c'*64, 'resultSetHash': 'd'*64, 'resultScoreSetHash': 'e'*64})
        consumer.append({'kind': 'awaiting_post_backup_control', 'cycle': cycle, 'at': at(605)})
        consumer.append({'kind': 'awaiting_post_backup_warm_control', 'cycle': cycle, 'at': at(1030)})
        consumer.append({'kind': 'cycle_complete', 'cycle': cycle, 'warmRepeats': 1, 'at': at(1060)})
    observer.append({'event': 'modified-backup-observation-complete'})
    consumer.append({'kind': 'complete'})
    return observer, consumer


class ReportTests(unittest.TestCase):
    def test_descriptive_counter_brackets_and_sparse_holes(self):
        obs, con = fixture()
        result = report.summarize(obs, con)
        self.assertEqual(result['diagnosticStatus'], 'observed')
        self.assertFalse(result['productionAcceptance'])
        cycle = result['cycles'][0]
        self.assertEqual(cycle['beforeBackupToPostBackup']['vector']['residentDataPagesChange'], 0)
        self.assertEqual(cycle['counterBrackets']['firstPostBatchesAndGrace']['delta'],
                         {'majorFaults': 10, 'minorFaults': 20, 'readBytes': 1000, 'rssBytesChange': 2000,
                          'hostReclaim': {'pgscan_kswapd': 0, 'pgsteal_kswapd': 0, 'pswpin': 0, 'pswpout': 0}})
        self.assertEqual(cycle['counterBrackets']['warmBatchesAndGrace']['delta']['rssBytesChange'], -500)
        self.assertNotIn('residentPages', json.dumps(result))

    def test_deficit_tail_and_score_changes_fail_explicit_diagnostic_policy(self):
        obs, con = fixture()
        extent = next(r for r in obs if r.get('cycle') == 1 and r.get('method') == 'extent' and r.get('phase') == 'post-backup')
        extent['classes']['vector']['dataResidentPages'] = 70
        candidate = next(r for r in con if r.get('cycle') == 1 and r.get('phase') == 'post_backup' and r.get('tag') == report.TAGS[1])
        candidate['serverMs'] = 2123; candidate['resultScoreSetHash'] = 'f'*64
        policy = {'maxResidentLossPages': 0, 'maxKswapdStealPages': 0, 'maxServerMs': 1499}
        result = report.summarize(obs, con, policy)
        self.assertEqual(result['diagnosticStatus'], 'not_passed')
        self.assertIn('resident_data_loss_over_policy:vector', result['cycles'][0]['failures'])
        self.assertIn('post_server_tail_over_policy:known-native-title', result['cycles'][0]['failures'])
        self.assertIn('post_result_or_score_change:known-native-title', result['cycles'][0]['failures'])
        descriptive = report.summarize(obs, con)
        self.assertEqual(descriptive['cycles'][0]['diagnosticStatus'], 'observed_requires_review')
        self.assertTrue(any('direct_qdrant_at_least_1500ms' in r for r in descriptive['cycles'][0]['findings']))

    def test_signal_timestamp_race_is_valid_only_after_residency_and_waiting_fences(self):
        obs, con = fixture()
        post = next(r for r in con if r.get('cycle') == 1 and r.get('phase') == 'post_backup')
        warm = next(r for r in con if r.get('cycle') == 1 and r.get('kind') == 'warm_batch')
        # Consumer starts immediately on signal; controller emits its receipt later.
        post['at'] = '2026-10-11T21:16:46+00:00'  # 1006, before post-control 1010, after extent 1000.
        warm['at'] = '2026-10-11T21:17:25+00:00'  # 1045, before warm-control 1050, after post-counter 1040.
        self.assertEqual(report.summarize(obs, con)['cycles'][0]['diagnosticStatus'], 'observed')
        for target, invalid in ((post, '2026-10-11T21:16:39+00:00'), (warm, '2026-10-11T21:17:19+00:00')):
            prior = target['at']; target['at'] = invalid
            with self.subTest(invalid=invalid):
                self.assertEqual(report.summarize(obs, con)['cycles'][0]['diagnosticStatus'], 'incomplete_or_invalid')
            target['at'] = prior

    def test_actual_kernel_dma32_reclaim_counter_is_preserved_with_numeric_delta(self):
        obs, con = fixture()
        for row in obs:
            counters = row.get('counters', row.get('countersBeforeSignal'))
            if counters is not None:
                counters['hostReclaim']['allocstall_dma32'] = 2 if row.get('event') in ('modified-backup-post-control', 'modified-backup-post-batch-counters', 'modified-backup-warm-batch-counters') else 1
        result = report.summarize(obs, con)
        self.assertEqual(result['cycles'][0]['diagnosticStatus'], 'observed')
        self.assertEqual(result['cycles'][0]['counterBrackets']['backupAndPostSampling']['delta']['hostReclaim']['allocstall_dma32'], 1)

    def test_baseline_exact_1500ms_is_flagged_without_application_acceptance_claim(self):
        obs, con = fixture()
        next(r for r in con if r.get('cycle') == 1 and r.get('phase') == 'baseline')['serverMs'] = 1500
        result = report.summarize(obs, con)
        self.assertIn('baseline_direct_qdrant_at_least_1500ms:known-exact-title', result['cycles'][0]['findings'])
        self.assertFalse(result['productionAcceptance'])

    def test_ordered_tie_changes_are_not_sorted_score_changes(self):
        obs, con = fixture()
        candidate = next(r for r in con if r.get('cycle') == 1 and r.get('phase') == 'post_backup')
        candidate['resultIdHash'] = 'f'*64; candidate['resultIdScoreHash'] = 'f'*64
        result = report.summarize(obs, con)
        case = result['cycles'][0]['cases'][report.TAGS[0]]['postVsBaseline']
        self.assertFalse(case['sameOrderedIdsScores']); self.assertTrue(case['sameSortedPerIdScores'])
        self.assertEqual(result['cycles'][0]['failures'], [])

    def test_changed_cohort_is_incomparable_even_when_whole_file_percent_looks_warm(self):
        obs, con = fixture()
        extent = next(r for r in obs if r.get('cycle') == 1 and r.get('method') == 'extent' and r.get('phase') == 'post-backup')
        extent['classes']['vector']['fileIdentityHash'] = 'f'*64
        result = report.summarize(obs, con)
        self.assertFalse(result['cycles'][0]['beforeBackupToPostBackup']['vector']['comparable'])
        self.assertIn('extent_cohort_incomparable:vector', result['cycles'][0]['findings'])

    def test_missing_phase_changed_pid_and_counter_reset_block_evidence(self):
        for defect in ('phase', 'pid', 'reset'):
            obs, con = fixture()
            if defect == 'phase': obs = [r for r in obs if not (r.get('cycle') == 1 and r.get('collectionClass') == 'reference' and r.get('phase') == 'retention')]
            if defect == 'pid': next(r for r in obs if r.get('cycle') == 1 and r.get('event') == 'modified-backup-post-batch-counters')['counters']['pid'] = 456
            if defect == 'reset': next(r for r in obs if r.get('cycle') == 1 and r.get('event') == 'modified-backup-post-batch-counters')['counters']['readBytes'] = 0
            with self.subTest(defect=defect):
                self.assertEqual(report.summarize(obs, con)['cycles'][0]['diagnosticStatus'], 'incomplete_or_invalid')

    def test_incomplete_three_cycle_run_is_not_a_success(self):
        obs, con = fixture()
        con = [r for r in con if r.get('kind') != 'complete']
        self.assertEqual(report.summarize(obs, con)['diagnosticStatus'], 'not_passed')

    def test_cli_never_reprints_untrusted_fields_or_raw_errors(self):
        obs, con = fixture(); obs[0]['privateField'] = 'private-marker'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, rows in (('observer', obs), ('consumer', con)):
                (root / name).write_text(''.join(json.dumps(row)+'\n' for row in rows))
            run = subprocess.run([sys.executable, str(Path(report.__file__)), str(root/'observer'), str(root/'consumer')], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0); self.assertNotIn('private-marker', run.stdout); self.assertEqual(run.stderr, '')
            (root/'observer').write_text('not-json private-marker\n')
            run = subprocess.run([sys.executable, str(Path(report.__file__)), str(root/'observer'), str(root/'consumer')], capture_output=True, text=True)
            self.assertEqual(run.returncode, 2); self.assertNotIn('private-marker', run.stdout); self.assertEqual(run.stderr, '')


if __name__ == '__main__': unittest.main()
