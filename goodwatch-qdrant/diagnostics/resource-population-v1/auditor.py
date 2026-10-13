"""New measurement-only auditor; old journals are not applicable and cannot become proof."""
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import sys
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import reader

PERMISSIONS={'capacityPermission':False,'idleAdmission':False,'productionAcceptance':False,'futureCeilingEstablished':False}
NAMESPACE='resource-population.'
TABLE_SHA='06ac005db11c28ca353d30ab6ddfa0d2f733b0eb9321c49d064449b7325bd813'

def hash64(value):return type(value)is str and re.fullmatch('[a-f0-9]{64}',value)is not None

def utc(value):
    time=dt.datetime.fromisoformat(value)
    if time.utcoffset()!=dt.timedelta(0):raise ValueError('timestamp')
    return time.timestamp()

def number(value):return type(value)in(int,float)and math.isfinite(value)and value>=0

def required_metrics(row):
    def natural(v):return type(v)is int and 0<=v<=2**64-1
    def fields(value,names):
        if not isinstance(value,dict)or any(k not in value or not natural(value[k])for k in names):raise ValueError('required-metric')
    def psi(value):
        for name in ('some','full'):
            if not number(value[name]['avg10'])or value[name]['avg10']>100 or not natural(value[name]['total']):raise ValueError('psi')
    fields(row['host'],reader.MEM);fields(row['hostReclaim'],reader.VM)
    for name in ('memory','io'):psi(row['hostPsi'][name])
    fields(row['process'],('startTicks','parentPid','minorFaults','majorFaults','rssBytes','readBytes','VmLck'))
    for key in ('sourceBefore','sourceAfter'):
        group=row[key]
        if not natural(group['currentBytes'])or not natural(group['swapBytes']):raise ValueError('source-current')
        fields(group['memory'],reader.STAT);fields(group['events'],reader.EVENTS);fields(group['cpu'],reader.CPU)
        psi(group['memoryPsi']);psi(group['ioPsi'])


def population_proof(population,main_pid=None,main_birth=None):
    def natural(value):return type(value)is int and value>=0
    if type(population)is not dict:raise ValueError('population-schema')
    if population['status']not in ('endpoint-verified','partial','unavailable'):raise ValueError('population-status')
    for key in ('duplicateCount','unresolvedCount','truncatedCount','unknownLocks','verifiedZeroLocks','positiveLocks'):
        if not natural(population[key]):raise ValueError('population-count')
    if population['status']!='unavailable'and not hash64(population.get('membershipHash')):raise ValueError('membership-hash')
    if population['status']=='unavailable'and population.get('membershipHash')is not None and not hash64(population['membershipHash']):raise ValueError('membership-hash')
    if population['status']=='unavailable':
        if population['observedCount']is not None or population.get('reason')not in ('optional_unreadable','invalid_numeric'):raise ValueError('unavailable-population')
    elif not natural(population['observedCount'])or population['observedCount']>4096:raise ValueError('population-count')
    members=population['members']
    if not isinstance(members,list)or len(members)>16:raise ValueError('population-bound')
    known=unknown=0;seen=set()
    for member in members:
        if not isinstance(member,list)or len(member)!=5 or type(member[0])is not int or member[0]<=0 or member[0]in seen:raise ValueError('member-schema')
        seen.add(member[0])
        if main_pid is not None and member[0]==main_pid and member[4]=='verified'and main_birth is not None and member[1]!=main_birth:raise ValueError('main-ledger-birth')
        if member[4]=='verified':
            if type(member[1])is not int or member[1]<=0 or type(member[3])is not int or member[3]!=0 or member[2]not in ('qdrant','shell','python','other'):raise ValueError('member-zero-proof')
            known+=1
        elif member==[member[0],None,'unavailable',None,'unknown']:unknown+=1
        else:raise ValueError('unknown-member-zero-laundering')
    if population['status']!='unavailable':
        observed=population['observedCount'];duplicate=population['duplicateCount'];unique=observed-duplicate
        byte_truncated=population.get('byteListTruncated',False)
        if type(byte_truncated)is not bool or duplicate>observed or len(members)+population['truncatedCount']!=unique+int(byte_truncated)or population['verifiedZeroLocks']+population['unknownLocks']>unique:raise ValueError('population-accounting')
    if population['positiveLocks']!=0:raise ValueError('auxiliary-lock')
    # Removed row-bound tuples remain counted in the source totals.
    if population['verifiedZeroLocks']<known or population['unknownLocks']<unknown or population['unresolvedCount']!=population['unknownLocks']:raise ValueError('population-accounting')
    if not population.get('rowBoundTruncated')and(population['verifiedZeroLocks']!=known or population['unknownLocks']!=unknown):raise ValueError('population-accounting')
    complete=population['status']=='endpoint-verified'
    if complete and main_pid is not None:
        if main_pid not in seen:raise ValueError('main-ledger-presence')
        if main_birth is not None and next(member[1]for member in members if member[0]==main_pid)!=main_birth:raise ValueError('main-ledger-birth')
    if complete and (population['duplicateCount']or population['unresolvedCount']or population['truncatedCount']or population['unknownLocks']or population['observedCount']!=len(members)):raise ValueError('false-endpoint-proof')
    return complete


def population_evidence(population,main_pid,main_birth):
    population_proof(population,main_pid,main_birth)
    return {**{name:population.get(name)for name in ('status','observedCount','duplicateCount','unresolvedCount','truncatedCount','unknownLocks','verifiedZeroLocks','positiveLocks','membershipHash')},'reasons':[reason for field,reason in (('duplicateCount','membership-duplicate'),('truncatedCount','membership-truncated'),('unresolvedCount','member-unresolved'))if population[field]]+(['membership-unavailable']if population['status']=='unavailable'else[])}


def optional_proof(row):
    allowed={'census_bound','eligible_identity_race','process_disappeared','optional_unreadable'}
    def integer(value):
        if type(value)is not int or not 0<=value<=2**64-1:raise ValueError('optional-count')
        return value
    def status(value):
        if type(value)is not dict or type(value.get('complete'))is not bool:raise ValueError('optional-schema')
        reasons=value.get('reasons',[value['reason']]if 'reason'in value else [])
        if type(reasons)is not list or any(reason not in allowed for reason in reasons):raise ValueError('optional-reason')
        unknown=integer(value.get('unresolvedCount',0))
        if value['complete']and(reasons or unknown):raise ValueError('false-optional-complete')
        if not value['complete']and not reasons and not unknown:raise ValueError('unexplained-optional-partial')
        return {'status':'observed-endpoints-only'if value['complete']else'unavailable'if value.get('reason')=='optional_unreadable'else'partial','reasons':reasons,'unresolvedCount':unknown}
    ssh=row['sshUserspace'];other=row['otherCgroups']
    if type(ssh)is not dict or ssh.get('ownedReaderExcludedCount')!=1 or type(ssh.get('ownedReaderExcludedCount'))is not int:raise ValueError('reader-exclusion-proof')
    ssh_status=status(ssh)
    if not hash64(ssh['identityHash'])or ssh.get('rssAccountingExact')is not False or ssh.get('observedSumsAreTotal')is not False:raise ValueError('ssh-accounting')
    if set(ssh['classes'])!={'sshfs','sshfs-child-ssh','other-ssh'}:raise ValueError('ssh-classes')
    total=0
    for item in ssh['classes'].values():
        total+=integer(item['processCount'])
        if set(item['observedBytes'])!=set(reader.RSS):raise ValueError('ssh-metrics')
        for value in item['observedBytes'].values():integer(value)
    if total>64:raise ValueError('ssh-bound')
    ssh_status['observedCount']=total
    backup=ssh['backup'];backup_status=status({**backup,'reasons':ssh.get('reasons',[]),'unresolvedCount':ssh.get('unresolvedCount',0)})
    backup_status['observedCount']=integer(backup['observedCount'])
    if not hash64(backup['identityHash'])or backup['occurrenceStatus']not in ('observed-running','none-observed-in-bounded-census'):raise ValueError('backup-schema')
    sibling_status=status(other)
    if 'observedChildCount'in other:
        if not hash64(other['identityHash'])or other.get('observedSumsAreTotal')is not False:raise ValueError('sibling-accounting')
        sibling_status['observedCount']=integer(other['observedChildCount']);integer(other['observedCurrentBytes'])
        if set(other['observedMemory'])!=set(reader.STAT):raise ValueError('sibling-metrics')
        for value in other['observedMemory'].values():integer(value)
    elif sibling_status['status']!='unavailable':raise ValueError('sibling-schema')
    else:sibling_status['observedCount']=None
    return {'sshCensus':ssh_status,'backupCensus':backup_status,'siblingCensus':sibling_status}


def audit(rows,receipt,source_sha):
    reasons=[]
    if type(rows)is not list or type(receipt)is not dict or any(type(row)is not dict or type(row.get('event'))is not str for row in rows):
        return {'schema':'resource-population.audit.v1','status':'observation-incomplete-or-refused','reasons':['invalid-input-schema'],**PERMISSIONS}
    def require(condition,reason):
        if not condition and reason not in reasons:reasons.append(reason)
    if any(not row.get('event','').startswith(NAMESPACE) or row.get('event')==NAMESPACE+'failed.v1' for row in rows):
        return {'schema':'resource-population.audit.v1','status':'not-applicable','reasons':['foreign-or-failed-event-namespace'],**PERMISSIONS}
    require(bool(rows),'empty-observation')
    require(all(row.get('schema')=='resource-population.measurement.v1'for row in rows),'event-schema')
    require(all(row.get('outcomeTableSha256')==TABLE_SHA for row in rows),'outcome-table-provenance')
    require(all(all(row.get(key)is False for key in PERMISSIONS) for row in rows),'permission-fields')
    starts=[row for row in rows if row.get('event')==NAMESPACE+'started.v1']
    ends=[row for row in rows if row.get('event')==NAMESPACE+'complete.v1']
    samples=[row for row in rows if row.get('event')==NAMESPACE+'sample.v1']
    failures=[row for row in rows if row.get('event')==NAMESPACE+'failed.v1']
    require(len(starts)==1 and len(ends)==1 and not failures,'terminal-or-failure')
    require(bool(rows)and rows[0].get('event')==NAMESPACE+'started.v1'and rows[-1].get('event')==NAMESPACE+'complete.v1','event-order')
    require(all(row.get('event')in {NAMESPACE+x+'.v1'for x in ('started','sample','complete')}for row in rows),'unknown-event')
    require(receipt.get('sourceSha256')==source_sha and hash64(source_sha),'source-provenance')
    require(receipt.get('event')==NAMESPACE+'reader-exit.v1'and receipt.get('exitCode')==0 and type(receipt.get('exitCode'))is int and receipt.get('readerGoneProven')is True and receipt.get('clean')is True and receipt.get('termSent')is False and receipt.get('killSent')is False,'reader-clean-exit')
    require(type(receipt.get('readerPid'))is int and receipt['readerPid']>0 and type(receipt.get('readerStartTicks'))is int and receipt['readerStartTicks']>0,'reader-exit-birth')
    dimensions={name:'not-observed'for name in ('sampling','primaryIdentity','requiredMetrics','auxiliaryPopulation','auxiliaryLocks','sshCensus','backupCensus','siblingCensus')}
    census_partial=set();census_unavailable=set();census_evidence=[];final_evidence=None;identities=set();reader_groups=set();previous=None
    try:
        start,end=starts[0],ends[0];low,high=utc(start['scheduledStart']),utc(start['scheduledEnd'])
        require(2<=high-low<=2700 and start['intervalSeconds']==2 and start['maximumGapSeconds']==3,'window-contract')
        require(low<=utc(start['at'])<low+2 and utc(end['samplingEndedAt'])>=high,'window-edges')
        require(utc(end['at'])>=utc(end['samplingEndedAt']),'terminal-time-order')
        require(end['samplingStatus']=='scheduled-samples-observed' and end['fullScheduledWindowObserved']is True,'sampling-status')
        require(number(end['elapsedMonotonicSeconds'])and end['elapsedMonotonicSeconds']>=high-low-2,'elapsed-window')
        require(type(end['wallClockDriftSeconds'])in(int,float)and math.isfinite(end['wallClockDriftSeconds'])and abs(end['wallClockDriftSeconds'])<=1,'clock-drift')
        require(abs((utc(end['samplingEndedAt'])-utc(start['at']))-end['elapsedMonotonicSeconds']-end['wallClockDriftSeconds'])<=.1,'clock-ledger')
        require(type(end['samples'])is int and end['samples']==len(samples)and 0<len(samples)<=1500,'sample-count')
        for index,row in enumerate(samples):
            required_metrics(row)
            require(row['sample']==index and type(row['sample'])is int,'sample-order')
            a,b=row['startedMonotonicSeconds'],row['finishedMonotonicSeconds'];duration=row['durationSeconds']
            require(number(a)and number(b)and number(duration)and 0<=b-a<=2 and duration<=2 and abs(b-a-duration)<=.1,'sample-bounds')
            require(abs(utc(row['finishedAt'])-utc(row['startedAt'])-duration)<=.1,'sample-clock')
            if previous is not None:require(0<a-previous<=3,'sample-gap')
            previous=a
            require(low<=utc(row['startedAt'])and utc(row['finishedAt'])<=high+2,'sample-wall-edges')
            identity=(row['sourcePid'],row['sourceStartTicks'],row['sourceIdentityHash'],row['ancestorLimitHash'],row['sourceGroupHash'],row['sourceDirectoryIdentityHash'])
            require(type(identity[0])is int and identity[0]>0 and type(identity[1])is int and identity[1]>0 and all(hash64(v)for v in identity[2:]),'source-identity')
            identities.add(identity)
            require(row['process']['startTicks']==row['sourceStartTicks'],'main-process-birth')
            require(row['process']['VmLck']==0 and row['host']['SwapTotal']==0,'source-lock-or-swap')
            for member in ('readerBefore','readerAfter'):
                proof=row[member];require(proof['outsideSourceCgroup']is True and proof['placementUnchanged']is True and proof['VmLckBytes']==0 and hash64(proof['groupHash']),'reader-placement');reader_groups.add(proof['groupHash'])
            require(row['dimensions']['primaryIdentity']=='observed-bracket'and row['dimensions']['requiredMetrics']=='observed-bracket','required-dimensions')
            optional=optional_proof(row)
            for name,evidence in optional.items():
                if evidence['status']!='observed-endpoints-only':census_partial.add(name)
                if evidence['status']=='unavailable':census_unavailable.add(name)
            for group in ('sourceBefore','sourceAfter'):
                population=row[group]['population']
                if population['status']=='unavailable':census_unavailable.update(('auxiliaryPopulation','auxiliaryLocks'))
                if not population_proof(population,row['sourcePid'],row['sourceStartTicks']):census_partial.update(('auxiliaryPopulation','auxiliaryLocks'))
            census_evidence.append({'sample':index,**optional,'auxiliaryEndpoints':{key:population_evidence(row[key]['population'],row['sourcePid'],row['sourceStartTicks'])for key in ('sourceBefore','sourceAfter')}})
        require(len(identities)==1 and len(reader_groups)==1,'source-or-reader-turnover')
        require(0<=samples[0]['startedMonotonicSeconds']-start['startedMonotonicSeconds']<=3 and 0<=end['finishedMonotonicSeconds']-samples[-1]['finishedMonotonicSeconds']<=3,'edge-gap')
        require(abs(end['finishedMonotonicSeconds']-start['startedMonotonicSeconds']-end['elapsedMonotonicSeconds'])<.000001,'elapsed-ledger')
        final=end['finalResourceFence'];
        required_metrics({**samples[-1],'sourceBefore':final['sourceBefore'],'sourceAfter':final['sourceAfter']})
        require(final['sourceIdentityHash']==samples[-1]['sourceIdentityHash']and final['sourceDirectoryIdentityHash']==samples[-1]['sourceDirectoryIdentityHash'],'final-source-fence')
        require(final['reader']['outsideSourceCgroup']is True and final['reader']['VmLckBytes']==0 and final['reader']['groupHash']in reader_groups,'final-reader')
        final_results=[population_proof(final[key]['population'],samples[-1]['sourcePid'],samples[-1]['sourceStartTicks'])for key in ('sourceBefore','sourceAfter')]
        final_complete=all(final_results)
        final_evidence={key:population_evidence(final[key]['population'],samples[-1]['sourcePid'],samples[-1]['sourceStartTicks'])for key in ('sourceBefore','sourceAfter')}
        if any(final[key]['population']['status']=='unavailable'for key in ('sourceBefore','sourceAfter')):census_unavailable.update(('auxiliaryPopulation','auxiliaryLocks'))
        require(final['sourceLockStatus']!='endpoint-zero-verified'or final_complete,'false-final-zero-proof')
        if final['sourceLockStatus']!='endpoint-zero-verified':census_partial.update(('auxiliaryPopulation','auxiliaryLocks'))
        dimensions.update(sampling='scheduled-samples-observed',primaryIdentity='observed-brackets',requiredMetrics='observed-brackets')
        for name in ('auxiliaryPopulation','auxiliaryLocks','sshCensus','backupCensus','siblingCensus'):dimensions[name]='unavailable'if name in census_unavailable else'partial'if name in census_partial else'observed-endpoints-only'
    except (KeyError,ValueError,IndexError,TypeError,AttributeError,OverflowError):require(False,'required-proof-missing')
    if reasons:
        for name in dimensions:dimensions[name]='not-established'
    status='observation-incomplete-or-refused'if reasons else'required-resource-samples-observed-with-census-unknowns'if census_partial else'required-resource-samples-and-census-endpoints-observed'
    return {'schema':'resource-population.audit.v1','status':status,'dimensions':dimensions,'reasons':reasons,'samples':len(samples),'censusEvidence':census_evidence,'finalAuxiliaryEndpoints':final_evidence,'endpointObservationsOnly':True,'rssAccountingExact':False,**PERMISSIONS}


def audit_file(journal,receipt_path,source_sha):
    raw=Path(journal).read_bytes()
    if len(raw)>16*1024*1024:raise ValueError('output-bound')
    lines=raw.splitlines()
    if len(lines)>1502 or any(len(line)+1>8192 for line in lines):raise ValueError('row-bound')
    rows=[json.loads(line)for line in lines]
    receipt_raw=Path(receipt_path).read_bytes()
    if len(receipt_raw)>8192:raise ValueError('receipt-bound')
    return {**audit(rows,json.loads(receipt_raw),source_sha),'journalSha256':hashlib.sha256(raw).hexdigest()}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('journal');parser.add_argument('receipt');parser.add_argument('--source-sha256',required=True)
    args=parser.parse_args()
    try:result=audit_file(args.journal,args.receipt,args.source_sha256)
    except (OSError,ValueError,KeyError,TypeError,AttributeError,OverflowError):result={'schema':'resource-population.audit.v1','status':'observation-incomplete-or-refused','reasons':['bounded-input-or-schema-refused'],**PERMISSIONS}
    print(json.dumps(result,allow_nan=False,separators=(',',':')))
