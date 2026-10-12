"""Offline supplemental helper coverage. Never constitutes application acceptance."""
import json
import argparse
from datetime import datetime
from pathlib import Path
from production_journal import sanitize,HASH


def stamp(value):
    if type(value) is not str or not value.endswith('Z'): raise ValueError('explicit_utc_required')
    parsed = datetime.fromisoformat(value.replace('Z','+00:00'))
    return parsed.timestamp()


def verify(records,start,end,code_hash,policy_hash,service_hash,now,max_gap_seconds=45):
    lo,hi = stamp(start),stamp(end)
    if hi <= lo or not all(HASH.fullmatch(x or '') for x in (code_hash,policy_hash,service_hash)): raise ValueError('invalid_coverage_inputs')
    events = []; source_changes = 0; problems = 0; restarts = 0; previous = None
    started = False; collector_fenced = False; sequence_errors = 0; births = {}; birth_errors = 0
    for row in records:
        if row.get('schema') != 'qdrant.helper-journal.v1': raise ValueError('invalid_helper_journal')
        at = stamp(row['recordedAt'])
        in_window = lo <= at <= hi
        sequence = row.get('sequence')
        if type(sequence) is not int or sequence <= 0: raise ValueError('invalid_helper_sequence')
        if row.get('kind') == 'helper.collector-started':
            if sequence != 1: sequence_errors += 1
            started = True
            if at <= lo and all(row.get(k) == v for k,v in (('codeSha256',code_hash),('policySha256',policy_hash),('serviceSha256',service_hash))): collector_fenced = True
            if lo < at <= hi: restarts += 1
        elif row.get('kind') == 'helper.collector-problem':
            if in_window: problems += 1
        elif row.get('kind') == 'helper.event':
            data = sanitize(row['data'],row['codeSha256'],row['policySha256']); data_at = stamp(data['at'])
            if data_at > at+1: raise ValueError('helper_event_future_timestamp')
            if lo <= data_at <= hi and at-data_at > 5: problems += 1
            same_source = all(row.get(k) == v for k,v in (('codeSha256',code_hash),('policySha256',policy_hash),('serviceSha256',service_hash)))
            if data['phase']=='holder_started' and same_source:
                births[data['holderPid']]=data['holderStartTicks']
            if data['phase'] in ('locked','heartbeat') and same_source:
                if data['holderPid'] not in births or data['phase']=='locked' and births[data['holderPid']]!=data['holderStartTicks']:birth_errors+=1
                events.append(data)
            elif lo <= data_at <= hi and data['phase'] in ('holder_started','inventory_retry_claimed','failed','released'): problems += 1
        else: raise ValueError('unknown_helper_record')
        if row.get('kind') != 'helper.collector-started' and (not started or previous is None or sequence != previous+1): sequence_errors += 1
        previous = sequence
        if in_window and any(row.get(k) != v for k,v in (('codeSha256',code_hash),('policySha256',policy_hash),('serviceSha256',service_hash))): source_changes += 1
    events.sort(key=lambda d:stamp(d['at']))
    before = [d for d in events if stamp(d['at']) <= lo]; after = [d for d in events if stamp(d['at']) >= hi]
    fenced = bool(before and after)
    cohort = [d for d in events if before and after and stamp(before[-1]['at']) <= stamp(d['at']) <= stamp(after[0]['at'])]
    lock = next((d for d in reversed(events) if d['phase'] == 'locked' and stamp(d['at']) <= lo),None)
    initial_lock = lock
    gaps = [stamp(b['at'])-stamp(a['at']) for a,b in zip(cohort,cohort[1:])]
    invalid_lock = 0; turnover = 0
    for data in cohort:
        if data['phase'] == 'locked': lock = data
        if lock is None or lock.get('lockedBytes',0) <= 0 or lock.get('lockedBytes',0) > 2*1024**3 or lock.get('vmLockedBytes') != lock.get('lockedBytes') or lock.get('holderPlacementVerified') is not True or stamp(data['at'])-stamp(lock['at']) > max_gap_seconds:
            invalid_lock += 1; continue
        if data['holderPid'] != lock['holderPid'] or data['qdrantPid'] != lock['qdrantPid'] or data['sourceStartTicks'] != lock['sourceStartTicks']:
            turnover += 1
        if initial_lock and lock.get('sourceIdentitySha256') != initial_lock.get('sourceIdentitySha256'): turnover += 1
        residency = lock.get('lockedResidency',{})
        if set(residency) != {'vector','graph','sparse','other'} or lock.get('pageBytes',0) <= 0:
            invalid_lock += 1
        if sum(v.get('lockedDataPages',0) for v in residency.values())*lock.get('pageBytes',0) != lock['lockedBytes']:
            invalid_lock += 1
        for values in residency.values():
            if values.get('lockedDataPages',0) <= 0 or values.get('residentLockedDataPages') != values.get('lockedDataPages'): invalid_lock += 1
    checks = {'seven_days':hi-lo >= 7*86400,'closed':stamp(now) >= hi,'fences_complete':fenced,
              'initial_lock_proven':initial_lock is not None,'no_coverage_gaps':bool(cohort) and all(0 <= g <= max_gap_seconds for g in gaps),
              'holder_birth_registered':birth_errors==0,'collector_start_proven':collector_fenced,'no_missing_journal_frames':sequence_errors == 0,
              'no_collector_restart':restarts == 0,'no_problems_or_release':problems == 0,'frozen_sources':source_changes == 0,
              'lock_proof_valid':invalid_lock == 0,'no_source_turnover':turnover == 0}
    return {'schema':'qdrant.helper-coverage.v1','windowStart':start,'windowEnd':end,'healthyFrames':len(cohort),
            'maximumGapSeconds':max(gaps,default=None),'collectorRestarts':restarts,'problems':problems,'sourceChanges':source_changes,
            'invalidLockProofs':invalid_lock,'turnoverFrames':turnover,'sequenceErrors':sequence_errors,'checks':checks,'helperCoveragePass':all(checks.values()),
            'applicationAcceptance':False,'limits':['Supplemental source/lock evidence only; search lifecycle/history and both ingress collectors remain required.',
            'Cadence and stdout/source checks do not prove absence of silent kernel/log-sink loss or all existing page charges inside the source cgroup.']}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('journal');p.add_argument('start');p.add_argument('end');p.add_argument('code_sha256');p.add_argument('policy_sha256');p.add_argument('service_sha256');p.add_argument('now')
    args = p.parse_args()
    try:
        raw = Path(args.journal).read_text()
        if raw and not raw.endswith('\n'): raise ValueError('partial_journal')
        result = verify([json.loads(x) for x in raw.splitlines()],args.start,args.end,args.code_sha256,args.policy_sha256,args.service_sha256,args.now)
        print(json.dumps(result,sort_keys=True));return 0 if result['helperCoveragePass'] else 1
    except BaseException:
        print(json.dumps({'schema':'qdrant.helper-coverage.v1','helperCoveragePass':False,'applicationAcceptance':False,'reason':'invalid_journal_or_inputs'}));return 2


if __name__ == '__main__': raise SystemExit(main())
