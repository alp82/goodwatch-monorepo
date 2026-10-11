"""Offline diagnostic summary of sanitized journals; no network/process operations."""
import argparse
import datetime
import json
import math
import re
from pathlib import Path

TAGS = ('known-exact-title', 'known-native-title', 'known-low-vote-title')
CLASSES = ('vector', 'graph', 'sparse', 'payload', 'other')
HASH = re.compile(r'[a-f0-9]{64}')
RECLAIM = re.compile(r'(?:pgscan_[a-z_]+|pgsteal_[a-z_]+|allocstall[a-z_]*|workingset_refault[a-z_]*|pswpin|pswpout)')


def number(value, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError('invalid_numeric_evidence')
    if integer and not isinstance(value, int):
        raise ValueError('invalid_integer_evidence')
    return value


def stamp(row):
    value = row.get('at')
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)', value):
        raise ValueError('invalid_utc_evidence')
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def read_journal(path):
    raw = Path(path).read_bytes()
    if len(raw) > 64 * 1024 * 1024 or not raw or not raw.endswith(b'\n'):
        raise ValueError('invalid_journal_boundary')
    rows = [json.loads(line) for line in raw.splitlines()]
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError('invalid_journal_record')
    return rows


def unique(rows, predicate):
    matches = [row for row in rows if predicate(row)]
    if len(matches) != 1:
        raise ValueError('missing_or_duplicate_evidence')
    return matches[0]


def delta(before, after):
    if before['pid'] != after['pid']:
        raise ValueError('counter_pid_changed')
    result = {}
    for key in ('minorFaults', 'majorFaults', 'readBytes'):
        result[key] = number(after[key], True) - number(before[key], True)
        if result[key] < 0:
            raise ValueError('counter_reset')
    result['rssBytesChange'] = number(after['rssBytes'], True) - number(before['rssBytes'], True)
    a, b = before['hostReclaim'], after['hostReclaim']
    keys = set(a) | set(b)
    if set(a) != set(b) or any(not RECLAIM.fullmatch(key) for key in keys):
        raise ValueError('reclaim_schema_changed')
    result['hostReclaim'] = {key: number(b[key], True) - number(a[key], True) for key in sorted(keys)}
    if any(value < 0 for value in result['hostReclaim'].values()):
        raise ValueError('reclaim_counter_reset')
    return result


def extent_change(before, after):
    if before['qdrantPid'] != after['qdrantPid'] or before['pageSizeBytes'] != after['pageSizeBytes']:
        raise ValueError('residency_source_changed')
    if any(row.get('failedFiles') != 0 or row.get('excludedFiles') != 0 for row in (before, after)):
        raise ValueError('residency_sample_incomplete')
    if any(set(row['classes']) != set(CLASSES) for row in (before, after)):
        raise ValueError('residency_classes_incomplete')
    result = {}
    for kind in CLASSES:
        a, b = before['classes'][kind], after['classes'][kind]
        for cls in (a, b):
            if cls['extentUnsupportedFiles'] != 0 or cls['extentSupportedFiles'] != cls['files']:
                raise ValueError('extent_semantics_unsupported')
            if not HASH.fullmatch(cls['fileIdentityHash']):
                raise ValueError('invalid_cohort_hash')
            if number(cls['dataResidentPages'], True) > number(cls['dataExtentPages'], True):
                raise ValueError('invalid_extent_residency')
        comparable = a['fileIdentityHash'] == b['fileIdentityHash'] and a['files'] == b['files'] and a['dataExtentPages'] == b['dataExtentPages']
        result[kind] = {'comparable': comparable,
                        'beforeDataExtentPages': a['dataExtentPages'], 'afterDataExtentPages': b['dataExtentPages'],
                        'beforeDataResidentPages': a['dataResidentPages'], 'afterDataResidentPages': b['dataResidentPages'],
                        'residentDataPagesChange': b['dataResidentPages'] - a['dataResidentPages']}
    return result


def comparison(baseline, candidate):
    for row in (baseline, candidate):
        for field in ('resultIdHash', 'resultIdScoreHash', 'resultSetHash', 'resultScoreSetHash'):
            if not HASH.fullmatch(row[field]):
                raise ValueError('invalid_result_hash')
        number(row['serverMs']); number(row['wallMs'])
    return {'serverMs': candidate['serverMs'], 'wallMs': candidate['wallMs'],
            'serverMsChange': candidate['serverMs'] - baseline['serverMs'],
            'serverSlowdown': candidate['serverMs'] / baseline['serverMs'] if baseline['serverMs'] else None,
            'sameOrderedIds': baseline['resultIdHash'] == candidate['resultIdHash'],
            'sameOrderedIdsScores': baseline['resultIdScoreHash'] == candidate['resultIdScoreHash'],
            'sameIdSets': baseline['resultSetHash'] == candidate['resultSetHash'],
            'sameSortedPerIdScores': baseline['resultScoreSetHash'] == candidate['resultScoreSetHash']}


def cycle_report(observer, consumer, cycle, policy):
    obs = [row for row in observer if row.get('cycle') == cycle]
    con = [row for row in consumer if row.get('cycle') == cycle]
    failures = []
    findings = []
    post = unique(obs, lambda r: r.get('event') == 'modified-backup-post-control')
    warm = unique(obs, lambda r: r.get('event') == 'modified-backup-warm-control')
    if post.get('backupObservedThenAbsent') is not True or post.get('signalSucceeded') is not True or warm.get('signalSucceeded') is not True:
        raise ValueError('control_gate_incomplete')
    summary = unique(obs, lambda r: r.get('event') == 'modified-backup-phase-summary')
    if summary['failedPhaseCount'] != 0 or summary['cacheAdviceRejectedCount'] != 0 or summary['cacheAdviceAcceptedCount'] < 2:
        raise ValueError('backup_phase_failed')
    phases = [r for r in obs if r.get('event') == 'qdrant.backup.phase.v1']
    if len(phases) != summary['phaseEventCount'] or any(r.get('status') == 'failed' or r.get('adviceAccepted') is False for r in phases):
        raise ValueError('phase_summary_mismatch')
    for cls in ('media', 'reference'):
        for phase in ('snapshot', 'publish', 'cache_advice', 'retention'):
            start = unique(phases, lambda r: r.get('collectionClass') == cls and r.get('phase') == phase and r.get('status') == 'started')
            end = unique(phases, lambda r: r.get('collectionClass') == cls and r.get('phase') == phase and r.get('status') == 'completed')
            if not stamp(start) <= stamp(end) <= stamp(summary) <= stamp(post):
                raise ValueError('phase_order_invalid')
            if phase == 'cache_advice' and end.get('adviceAccepted') is not True:
                raise ValueError('advice_acceptance_missing')
    ext = {phase: unique(obs, lambda r: r.get('event') == 'qdrant-mapped-file-residency' and r.get('method') == 'extent' and r.get('phase') == phase)
           for phase in ('before-baseline', 'before-backup', 'post-backup', 'post-warm-repeat')}
    if not stamp(ext['before-baseline']) < stamp(ext['before-backup']) < stamp(ext['post-backup']) < stamp(post) < stamp(warm) < stamp(ext['post-warm-repeat']):
        raise ValueError('sample_order_invalid')
    whole_post = unique(obs, lambda r: r.get('event') == 'qdrant-mapped-file-residency' and r.get('method') == 'whole' and r.get('phase') == 'post-backup')
    if post['wholeAt'] != whole_post['at'] or post['extentAt'] != ext['post-backup']['at']:
        raise ValueError('control_sample_mismatch')
    if whole_post.get('failedFiles') != 0 or whole_post.get('excludedFiles') != 0 or not stamp(whole_post) < stamp(post):
        raise ValueError('whole_sample_incomplete')
    before_pid = post['countersBeforeSignal']['pid']
    if any(row['qdrantPid'] != before_pid for row in ext.values()) or whole_post['qdrantPid'] != before_pid:
        raise ValueError('residency_counter_pid_mismatch')
    resident = extent_change(ext['before-backup'], ext['post-backup'])
    for kind in ('vector', 'graph'):
        if not resident[kind]['comparable']:
            findings.append('extent_cohort_incomparable:' + kind)
        elif resident[kind]['residentDataPagesChange'] < 0:
            findings.append('resident_data_loss:' + kind)
            if policy is not None and -resident[kind]['residentDataPagesChange'] > policy['maxResidentLossPages']:
                failures.append('resident_data_loss_over_policy:' + kind)
    passive = [r for r in obs if r.get('event') == 'modified-backup-passive-sample']
    running = [i for i, r in enumerate(passive) if r.get('backupRunning') is True]
    if not running or running[0] == 0:
        raise ValueError('backup_observation_missing')
    if len(passive) < running[-1] + 3 or any(r.get('backupRunning') is not False for r in passive[running[-1]+1:]):
        raise ValueError('backup_exit_observation_missing')
    if stamp(passive[-1]) >= stamp(post):
        raise ValueError('passive_control_order_invalid')
    pre = passive[running[0] - 1]
    if pre.get('backupRunning') is not False or any(stamp(passive[i]) > stamp(passive[i+1]) for i in range(len(passive)-1)):
        raise ValueError('passive_order_invalid')
    backup_delta = delta(pre['counters'], post['countersBeforeSignal'])
    if 'pgsteal_kswapd' not in backup_delta['hostReclaim']:
        raise ValueError('kswapd_counter_missing')
    if policy is not None and backup_delta['hostReclaim']['pgsteal_kswapd'] > policy['maxKswapdStealPages']:
        failures.append('kswapd_reclaim_over_policy')
    after = unique(obs, lambda r: r.get('event') == 'modified-backup-post-batch-counters')
    after_warm = unique(obs, lambda r: r.get('event') == 'modified-backup-warm-batch-counters')
    if after['postBatchCount'] != 3 or after_warm['warmBatchCount'] != 3 or not stamp(post) < stamp(after) < stamp(warm) < stamp(after_warm):
        raise ValueError('batch_counter_gate_invalid')
    waiting_post = unique(con, lambda r: r.get('kind') == 'awaiting_post_backup_control')
    waiting_warm = unique(con, lambda r: r.get('kind') == 'awaiting_post_backup_warm_control')
    if not stamp(waiting_post) <= stamp(ext['post-backup']) or not stamp(waiting_warm) < stamp(after):
        raise ValueError('consumer_waiting_gate_order_invalid')
    cases = {}
    for tag in TAGS:
        baseline = unique(con, lambda r: r.get('kind') == 'batch' and r.get('phase') == 'baseline' and r.get('tag') == tag)
        candidate = unique(con, lambda r: r.get('kind') == 'batch' and r.get('phase') == 'post_backup' and r.get('tag') == tag)
        repeat = unique(con, lambda r: r.get('kind') == 'warm_batch' and r.get('repeat') == 1 and r.get('phase') == 'post_backup_warm' and r.get('tag') == tag)
        if not stamp(ext['before-baseline']) < stamp(baseline) < stamp(ext['before-backup']) or not max(stamp(ext['post-backup']), stamp(waiting_post)) <= stamp(candidate) < stamp(after) or not max(stamp(after), stamp(waiting_warm)) <= stamp(repeat) < stamp(after_warm):
            raise ValueError('batch_order_invalid')
        if not stamp(baseline) < stamp(waiting_post) or not stamp(candidate) <= stamp(waiting_warm):
            raise ValueError('consumer_waiting_gate_invalid')
        if baseline['queryCount'] != candidate['queryCount'] or baseline['queryCount'] != repeat['queryCount']:
            raise ValueError('query_count_changed')
        if number(baseline['serverMs']) >= 1500:
            findings.append('baseline_direct_qdrant_at_least_1500ms:' + tag)
        post_comparison = comparison(baseline, candidate)
        warm_comparison = comparison(candidate, repeat)
        for label, compared in (('post', post_comparison), ('warm', warm_comparison)):
            if compared['serverMs'] >= 1500:
                findings.append(label + '_direct_qdrant_at_least_1500ms:' + tag)
            if policy is not None and compared['serverMs'] > policy['maxServerMs']:
                failures.append(label + '_server_tail_over_policy:' + tag)
            if not compared['sameIdSets'] or not compared['sameSortedPerIdScores']:
                findings.append(label + '_result_or_score_change_requires_review:' + tag)
                if policy is not None:
                    failures.append(label + '_result_or_score_change:' + tag)
        cases[tag] = {'baselineServerMs': baseline['serverMs'], 'baselineWallMs': baseline['wallMs'],
                      'postVsBaseline': post_comparison, 'warmVsPost': warm_comparison}
    complete = unique(con, lambda r: r.get('kind') == 'cycle_complete')
    if complete.get('warmRepeats') != 1:
        raise ValueError('warm_repeat_incomplete')
    status = 'incomparable' if any('incomparable' in finding for finding in findings) else ('failed_selected_policy' if failures else ('observed_requires_review' if findings else 'observed'))
    if policy is not None and not failures and not any('incomparable' in finding for finding in findings):
        status = 'within_selected_policy'
    return {'cycle': cycle, 'diagnosticStatus': status, 'findings': findings, 'failures': failures,
            'beforeBaselineToBeforeBackup': extent_change(ext['before-baseline'], ext['before-backup']),
            'beforeBackupToPostBackup': resident, 'postBackupToPostWarm': extent_change(ext['post-backup'], ext['post-warm-repeat']),
            'counterBrackets': {'backupAndPostSampling': {'from': pre['at'], 'to': post['at'], 'delta': backup_delta},
                                'firstPostBatchesAndGrace': {'from': post['at'], 'to': after['at'], 'delta': delta(post['countersBeforeSignal'], after['counters'])},
                                'warmBatchesAndGrace': {'from': after['at'], 'to': after_warm['at'], 'delta': delta(after['counters'], after_warm['counters'])}},
            'cases': cases}


def summarize(observer, consumer, policy=None):
    if policy is not None and set(policy) != {'maxResidentLossPages', 'maxKswapdStealPages', 'maxServerMs'}:
        raise ValueError('explicit_policy_required')
    for key, value in (policy or {}).items(): number(value, key.endswith('Pages'))
    complete = any(r.get('event') == 'modified-backup-observation-complete' for r in observer) and any(r.get('kind') == 'complete' for r in consumer)
    failed = any(r.get('event') == 'modified-backup-observation-failed' for r in observer) or any(r.get('kind') == 'failed' for r in consumer)
    reports = []
    for cycle in (1, 2, 3):
        try: reports.append(cycle_report(observer, consumer, cycle, policy))
        except (KeyError, ValueError, TypeError): reports.append({'cycle': cycle, 'diagnosticStatus': 'incomplete_or_invalid', 'failures': ['evidence_gate_failed']})
    valid = complete and not failed and all(r['diagnosticStatus'] != 'incomplete_or_invalid' for r in reports)
    success = valid and policy is not None and all(r['diagnosticStatus'] == 'within_selected_policy' for r in reports)
    status = 'within_selected_policy' if success else ('incomparable' if valid and policy is None and any(r['diagnosticStatus'] == 'incomparable' for r in reports) else ('observed' if valid and policy is None else 'not_passed'))
    return {'schemaVersion': 1, 'productionAcceptance': False, 'diagnosticStatus': status,
            'selectedPolicy': policy, 'journalsComplete': complete, 'recordedFailure': failed, 'cycles': reports,
            'limits': ['Direct Qdrant batches do not measure first usable search results or seven-day organic acceptance.',
                       'Counter brackets include grace, sampling overhead, background work and organic traffic; no per-query attribution. Record timestamps are fences, not exact proc-read instants; post-control is emitted after signal receipt.',
                       'Residency uses filesystem-reported data extents and path-inferred classes; whole-file sparse holes are excluded.',
                       'Changed file identities or data-extent page counts are incomparable. Matching hashes/counts allow only coarse comparisons; unrecorded extent-range or content changes remain possible. Ordered parity stays separate from sorted per-ID score parity.',
                       'Score-set changes require review for concurrent data updates; they do not independently prove a backup regression.',
                       'Optional explicit diagnostic policy is caller-selected, not a calibrated warm-band or acceptance threshold.']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('observer'); parser.add_argument('consumer'); parser.add_argument('--policy')
    args = parser.parse_args()
    try:
        report = summarize(read_journal(args.observer), read_journal(args.consumer), json.loads(Path(args.policy).read_text()) if args.policy else None)
        print(json.dumps(report, indent=2))
        return 0 if report['diagnosticStatus'] in ('within_selected_policy', 'observed') else 1
    except (OSError, ValueError, TypeError, KeyError):
        print(json.dumps({'productionAcceptance': False, 'diagnosticStatus': 'invalid_input'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
