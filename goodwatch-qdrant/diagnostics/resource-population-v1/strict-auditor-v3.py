"""Offline conservative coverage auditor for sanitized resource-window journals."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import math
import re

TIMING_TOLERANCE_SECONDS=.1

SHA='17e692e8c44c751a2ddbc4b1f98bd6d651323c12cf2bff42369c7d98ac8093b8'

def number(value):return isinstance(value,(int,float))and not isinstance(value,bool)and math.isfinite(value)and value>=0

def identity(value):return type(value)is int and 0<value<=2**64-1

def hash64(value):return type(value)is str and re.fullmatch('[0-9a-f]{64}',value)is not None

def utc(value):
    result=dt.datetime.fromisoformat(value)
    if result.utcoffset()!=dt.timedelta(0):raise ValueError('invalid_timestamp')
    return result.timestamp()

def audit(rows,receipt):
    problems=[]
    def require(value,reason):
        if not value and reason not in problems:problems.append(reason)
    started=[r for r in rows if r.get('event')=='resource-window.started.v1']
    complete=[r for r in rows if r.get('event')=='resource-window.complete.v1']
    samples=[r for r in rows if r.get('event')=='resource-window.sample.v1']
    require(len(started)==1 and len(complete)==1,'terminal_or_start_missing')
    require(not any(r.get('event')=='resource-window.failed.v1'for r in rows),'failure_record')
    require(bool(rows)and rows[0].get('event')=='resource-window.started.v1'and rows[-1].get('event')=='resource-window.complete.v1','event_order')
    require(all(r.get('event')in ('resource-window.started.v1','resource-window.sample.v1','resource-window.complete.v1')for r in rows),'unknown_event')
    require(receipt.get('event')=='resource-window.reader-exit.v1'and receipt.get('sourceSha256')==SHA,'source_provenance_missing')
    require(type(receipt.get('exitCode'))is int and receipt.get('exitCode')==0 and receipt.get('readerGoneProven')is True and receipt.get('termSent')is False and receipt.get('killSent')is False and receipt.get('clean')is True,'clean_reader_exit_missing')
    require(identity(receipt.get('pid'))and identity(receipt.get('startTicks')),'reader_identity_missing')
    try:
        begin=started[0];end=complete[0]
        start_wall=utc(begin['scheduledStart']);end_wall=utc(begin['scheduledEnd'])
        require(2<=end_wall-start_wall<=2700 and begin['intervalSeconds']==2 and begin['maximumGapSeconds']==3,'window_contract')
        require(utc(begin['at'])>=start_wall and utc(begin['at'])-start_wall<2,'start_coverage')
        require(utc(end['at'])>=end_wall,'end_coverage')
        require(end['continuousCoverage']is True and end['fullScheduledWindowObserved']is True,'reader_coverage_invalid')
        require(number(end['elapsedMonotonicSeconds'])and end['elapsedMonotonicSeconds']>=end_wall-start_wall-2,'elapsed_window_incomplete')
        require(type(end['wallClockDriftSeconds'])in(int,float)and math.isfinite(end['wallClockDriftSeconds'])and abs(end['wallClockDriftSeconds'])<=1,'clock_drift')
        require(type(end['samples'])is int and end['samples']==len(samples)and 0<len(samples)<=1500,'sample_count')
        require(abs((utc(end['at'])-utc(begin['at']))-end['elapsedMonotonicSeconds']-end['wallClockDriftSeconds'])<=TIMING_TOLERANCE_SECONDS,'terminal_drift_inconsistent')
        identities=set();members=set();reader_groups=set();previous=None
        for index,row in enumerate(samples):
            require(type(row['sample'])is int and row['sample']==index,'sample_sequence')
            low=row['startedMonotonicSeconds'];high=row['finishedMonotonicSeconds']
            duration=row['durationSeconds']
            require(number(low)and number(high)and number(duration)and high>=low and high-low<=2 and duration<=2,'sample_bounds')
            if number(low)and number(high)and number(duration):
                require(abs(high-low-duration)<=TIMING_TOLERANCE_SECONDS,'sample_duration_inconsistent')
                require(abs(utc(row['finishedAt'])-utc(row['startedAt'])-duration)<=TIMING_TOLERANCE_SECONDS,'sample_wall_drift')
            if previous is not None:require(0<low-previous<=3,'cadence_gap')
            previous=low
            require(utc(row['startedAt'])>=start_wall and utc(row['finishedAt'])<=end_wall+2,'sample_wall_bounds')
            require(identity(row['sourcePid'])and identity(row['sourceStartTicks']),'source_identity_invalid')
            require(all(hash64(row[k])for k in ('sourceIdentityHash','ancestorLimitHash','sourceGroupHash')),'source_hash_invalid')
            identities.add((row['sourcePid'],row['sourceStartTicks'],row['sourceIdentityHash'],row['ancestorLimitHash'],row['sourceGroupHash']))
            require(row['sshUserspace']['complete']is True and row['sshUserspace']['backup']['complete']is True and row['otherCgroups']['complete']is True,'class_incomplete')
            require(type(row['sshUserspace'].get('ownedReaderExcludedCount'))is int and row['sshUserspace']['ownedReaderExcludedCount']==1,'owned_reader_exclusion_invalid')
            for group in (row['sourceBefore'],row['sourceAfter']):
                require(hash64(group['processMembershipHash']),'membership_hash_invalid')
                members.add(group['processMembershipHash']);require(group['processVmLckBytes']==0,'source_locked')
            for reader in (row['readerBefore'],row['readerAfter']):
                require(reader['outsideSourceCgroup']is True and reader['placementUnchanged']is True and reader['VmLckBytes']==0,'reader_placement')
                require(hash64(reader['groupHash']),'reader_hash_invalid')
                reader_groups.add(reader['groupHash'])
        require(0<=samples[0]['startedMonotonicSeconds']-begin['startedMonotonicSeconds']<=3 and 0<=end['finishedMonotonicSeconds']-samples[-1]['finishedMonotonicSeconds']<=3,'edge_gap')
        require(abs(end['finishedMonotonicSeconds']-begin['startedMonotonicSeconds']-end['elapsedMonotonicSeconds'])<0.000001,'elapsed_proof_inconsistent')
        require(len(identities)==1 and len(members)==1 and len(reader_groups)==1,'source_or_membership_turnover')
        final=end['finalResourceFence']
        require(all(hash64(final[k])for k in ('sourceMembershipHash','sourceIdentityHash'))and hash64(final['reader']['groupHash']),'final_hash_invalid')
        require(final['sourceProcessVmLckBytes']==0 and final['sourceMembershipHash']in members,'final_membership')
        require(final['sourceIdentityHash']==samples[-1]['sourceIdentityHash'],'final_source')
        require(final['reader']['outsideSourceCgroup']is True and final['reader']['VmLckBytes']==0 and final['reader']['groupHash']in reader_groups,'final_reader')
    except (KeyError,ValueError,IndexError,TypeError):require(False,'required_proof_missing')
    return {'event':'resource-window.audit.v1','samples':len(samples),'coverage':'complete'if not problems else'UNKNOWN','problems':problems,'readerGoneProven':receipt.get('readerGoneProven')is True,'cleanReaderExitProven':receipt.get('clean')is True and type(receipt.get('exitCode'))is int and receipt.get('exitCode')==0 and receipt.get('readerGoneProven')is True,'futureCeilingEstablished':False,'productionAcceptance':False}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('journal');parser.add_argument('receipt');args=parser.parse_args()
    data=Path(args.journal).read_bytes()
    if len(data)>16*1024**2:raise ValueError('journal_bound')
    lines=data.splitlines()
    if len(lines)>1502 or any(len(line)>8192 for line in lines):raise ValueError('journal_bound')
    receipt_bytes=Path(args.receipt).read_bytes()
    if len(receipt_bytes)>8192:raise ValueError('receipt_bound')
    result=audit([json.loads(line)for line in lines],json.loads(receipt_bytes));result['journalSha256']=hashlib.sha256(data).hexdigest()
    print(json.dumps(result,separators=(',',':')))

if __name__=='__main__':main()
