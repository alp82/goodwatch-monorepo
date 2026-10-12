"""Inactive trial integration: strict evidence with bounded owned-writer RPC."""
import ctypes
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import stat
import threading
import time

import idle_trial as idle
import production

HASH=re.compile(r'[a-f0-9]{64}')
MAX_RECORD_BYTES=32768
MAX_TOTAL_BYTES=16*1024**2
MAX_RECORDS=512
PHASES={'baseline_start','baseline','admitted','initial','hold','cleanup','holder_started','lock_ready','pre_release','complete'}
NUMBERS={'fullBudgetBytes','retainBytes','elapsedMs','holderPid','holderStartTicks','vmLockedBytes',
    'lockedBytes','newLockBytes','qdrantPid','sourceStartTicks','deletedMappingsExcluded','nonresidentSelectedBytes',
    'projectedCurrentBytes','capReserveBytes','pageBytes'}
BOOLEANS={'pidfdOwned','initialSelfChargeIncluded','holderPlacementVerified','extentRangesHashed','contentFixed',
    'rangesChanged','existingPageChargesInsideTargetProven','guardExited'}
REASON_FIELDS={'observerShutdownReason','drainReason','postReleaseReason','guardReason','firstReason','mainReason',
    'completionReason','safetyReason','cleanupReason'}
STATE_OBJECTS={'memoryEventDelta':('oom','oom_kill','max'),'cpuLimitDelta':('nr_throttled','throttled_usec'),
    'mappingBounds':('currentVmas','maxMapCount','projectedAdditionalVmas','reservedVmas','projectedTotalVmas'),
    'memlockLimits':('softBefore','hardBefore','softAfter','hardAfter')}


def digest(raw):return hashlib.sha256(raw).hexdigest()


def integer(value,positive=False):
    if type(value)is not int or value<(1 if positive else 0):raise ValueError('invalid_idle_journal_number')
    return value


def exact(row,keys):
    if type(row)is not dict or set(row)!=set(keys):raise ValueError('invalid_idle_journal_object')
    return row


def numbers(row,keys):
    return {key:integer(value)for key,value in exact(row,keys).items()}


def pressure(row):
    exact(row,{'source','startMonoNs','endMonoNs','host','effectiveAvailableBytes','sourceMemory','memoryEvents','cpuEvents','reclaim','psi'})
    source=exact(row['source'],{'pid','startTicks','cgroupHash','ancestorLimitHash'})
    integer(source['pid'],True);integer(source['startTicks'],True)
    if any(type(source[k])is not str or not HASH.fullmatch(source[k])for k in ('cgroupHash','ancestorLimitHash')):raise ValueError('invalid_idle_journal_hash')
    numbers(row['host'],idle.HOST_KEYS);numbers(row['sourceMemory'],(*idle.STAT_KEYS,'current'))
    numbers(row['memoryEvents'],idle.MEMORY_KEYS);numbers(row['cpuEvents'],idle.CPU_KEYS);numbers(row['reclaim'],idle.RECLAIM_KEYS)
    exact(row['psi'],{'memory','io'})
    for value in row['psi'].values():numbers(value,('some','full'))
    integer(row['startMonoNs']);integer(row['endMonoNs']);integer(row['effectiveAvailableBytes'])
    if row['endMonoNs']<row['startMonoNs'] or row['effectiveAvailableBytes']!=idle.effective_available(row['host']):raise ValueError('invalid_idle_journal_sample')
    return row


def birth(row):
    exact(row,{'phase','holderPid','holderStartTicks','pidfdOwned'})
    if row['phase']!='holder_started' or row['pidfdOwned']is not True:raise ValueError('invalid_idle_journal_birth')
    integer(row['holderPid'],True);integer(row['holderStartTicks'],True)
    return row


def sanitize(row,code_hash,policy_hash):
    required={'event','policyBasis','codeSha256','policySha256','scheduleSha256','at','queries','storageWrites','phase'}
    allowed=required|NUMBERS|BOOLEANS|REASON_FIELDS|set(STATE_OBJECTS)|{'sample','postReleaseSample','selectionHash',
        'firstReasonOrigin','outcome','cleanup','classesMeasured','lockedResidency','nofileLimits'}
    if type(row)is not dict or not required<=set(row) or set(row)-allowed:raise ValueError('invalid_idle_journal_frame')
    if row['event']!='qdrant.idle-lock-trial.v1' or row['policyBasis']!='idle-2g-floor-6g-transient.v1' or row['phase']not in PHASES:raise ValueError('invalid_idle_journal_frame')
    if row['codeSha256']!=code_hash or row['policySha256']!=policy_hash:raise ValueError('idle_journal_source_changed')
    for key in ('codeSha256','policySha256','scheduleSha256','selectionHash'):
        if key=='scheduleSha256'and row.get(key)is None and row['phase']=='complete'and row.get('outcome')=='refused':continue
        if key in row and (type(row[key])is not str or not HASH.fullmatch(row[key])):raise ValueError('invalid_idle_journal_hash')
    if type(row['at'])is not str or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',row['at']):raise ValueError('invalid_idle_journal_timestamp')
    datetime.fromisoformat(row['at'].replace('Z','+00:00'))
    for key in ('queries','storageWrites'):
        if type(row[key])is not int or row[key]!=0:raise ValueError('invalid_idle_journal_frame')
    for key in NUMBERS&row.keys():integer(row[key])
    for key in BOOLEANS&row.keys():
        if type(row[key])is not bool:raise ValueError('invalid_idle_journal_boolean')
    for key in REASON_FIELDS&row.keys():
        if row[key]is not None and (type(row[key])is not str or row[key]not in idle.REASONS):raise ValueError('invalid_idle_journal_reason')
    if 'firstReasonOrigin'in row and row['firstReasonOrigin']not in (None,'guard','main'):raise ValueError('invalid_idle_journal_origin')
    if 'outcome'in row and row['outcome']not in {'pass','refused','safety_abort','inconclusive','release_unproven'}:raise ValueError('invalid_idle_journal_outcome')
    for key in ('sample','postReleaseSample'):
        if key in row and row[key]is not None:pressure(row[key])
    for key,keys in STATE_OBJECTS.items():
        if key not in row:continue
        if key=='memlockLimits':
            exact(row[key],keys)
            for value in row[key].values():
                if value is not None:integer(value)
        else:numbers(row[key],keys)
    for key,fields,kinds in (('classesMeasured',('files','dataLockBytes','dataPages','rawExtentCount','dataRangeCount'),{'vector','graph','sparse','payload','other'}),
                            ('lockedResidency',('lockedDataPages','residentLockedDataPages'),{'vector','graph','sparse','other'})):
        if key in row:
            exact(row[key],kinds)
            for value in row[key].values():numbers(value,fields)
    if 'nofileLimits'in row:
        keys={'openFdCount','mappedFileBound','reserveFds','requiredSoft','softBefore','softAfter','hardLimit','raised','hardChanged'}
        exact(row['nofileLimits'],keys)
        for key,value in row['nofileLimits'].items():
            if key in ('raised','hardChanged'):
                if type(value)is not bool:raise ValueError('invalid_idle_journal_boolean')
            elif value is not None:integer(value)
    if 'cleanup'in row and row['cleanup']is not None:
        cleanup=exact(row['cleanup'],{'holderExited','gracefulReleaseAcknowledged','exitCode','released'})
        if any(type(cleanup[k])is not bool for k in ('holderExited','gracefulReleaseAcknowledged','released')) or cleanup['exitCode']is not None and type(cleanup['exitCode'])is not int:raise ValueError('invalid_idle_journal_cleanup')
    if row['phase']=='holder_started':birth({key:row[key]for key in ('phase','holderPid','holderStartTicks','pidfdOwned')})
    # Roundtrip produces an independent, JSON-only frozen copy.
    raw=json.dumps(row,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
    if len(raw)>MAX_RECORD_BYTES:raise ValueError('idle_journal_record_too_large')
    return json.loads(raw)


def binding(row):
    exact(row,{'packetSha256','sourceContractSha256'})
    if any(type(value)is not str or not HASH.fullmatch(value)for value in row.values()):raise ValueError('idle_journal_source_changed')
    return dict(row)


def writer(connection,path,code_hash,policy_hash,max_records,max_bytes):
    """Outside-source worker; no target files, maps, source RPC or locking."""
    descriptor=None
    try:
        parent=os.getppid()
        if parent<=1 or ctypes.CDLL(None,use_errno=True).prctl(1,signal.SIGTERM,0,0,0)!=0 or os.getppid()!=parent:raise RuntimeError('idle_journal_parent_changed')
        signal.signal(signal.SIGTERM,signal.SIG_DFL);signal.signal(signal.SIGALRM,signal.SIG_DFL)
        signal.pthread_sigmask(signal.SIG_UNBLOCK,{signal.SIGTERM,signal.SIGALRM});signal.setitimer(signal.ITIMER_REAL,400)
        path=Path(path)
        if path.parent.resolve()!=path.parent:raise RuntimeError('idle_journal_private_directory_required')
        directory=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:
            parent_info=os.fstat(directory);current=path.parent.stat()
            if parent_info.st_uid!=os.geteuid() or parent_info.st_mode&0o077 or (parent_info.st_dev,parent_info.st_ino)!=(current.st_dev,current.st_ino):raise RuntimeError('idle_journal_private_directory_required')
            descriptor=os.open(path.name,os.O_RDWR|os.O_APPEND|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=directory)
            os.fsync(directory)
        finally:os.close(directory)
        info=os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or info.st_nlink!=1 or info.st_mode&0o077:raise RuntimeError('idle_journal_private_file_required')
        count=0;total=0;connection.send({'ready':True})
        while connection.poll(60):
            command=connection.recv()
            if command=='close':connection.send({'closed':True});return
            exact(command,{'kind','data'})
            kind=command['kind'];data=birth(command['data'])if kind=='birth'else sanitize(command['data'],code_hash,policy_hash)if kind=='event'else binding(command['data'])if kind=='binding'else None
            if data is None:raise RuntimeError('idle_journal_invalid_command')
            record={'schema':'qdrant.idle-journal.v1','sequence':count+1,'kind':kind,'codeSha256':code_hash,'policySha256':policy_hash,'data':data}
            raw=(json.dumps(record,sort_keys=True,separators=(',',':'))+'\n').encode()
            if len(raw)>MAX_RECORD_BYTES or count>=max_records or total+len(raw)>max_bytes:raise RuntimeError('idle_journal_full')
            offset=total;written=0
            while written<len(raw):
                n=os.write(descriptor,raw[written:])
                if n<=0:raise RuntimeError('idle_journal_write_failed')
                written+=n
            os.fsync(descriptor)
            if os.pread(descriptor,len(raw),offset)!=raw or os.fstat(descriptor).st_size!=offset+len(raw):raise RuntimeError('idle_journal_receipt_mismatch')
            count+=1;total+=len(raw)
            receipt={'sequence':count,'recordSha256':digest(raw),'committed':True}
            if kind=='birth':receipt.update(holderPid=data['holderPid'],holderStartTicks=data['holderStartTicks'])
            connection.send({'receipt':receipt})
        raise RuntimeError('idle_journal_lease_expired')
    except BaseException as error:
        value=str(error)
        safe=value if type(error)is RuntimeError and value.startswith('idle_journal_') and value in {'idle_journal_full','idle_journal_receipt_mismatch','idle_journal_write_failed','idle_journal_lease_expired'}else 'idle_journal_failure'
        try:connection.send({'failed':safe})
        except BaseException:pass
        raise SystemExit(1)
    finally:
        if descriptor is not None:os.close(descriptor)
        connection.close()


class Journal:
    """Callbacks wait at most one second; an uncertain commit never authorizes pins."""
    def __init__(self,path,code_hash,policy_hash,worker_target=writer,callback_seconds=1,max_records=MAX_RECORDS,max_bytes=MAX_TOTAL_BYTES):
        if any(type(value)is not str or not HASH.fullmatch(value)for value in (code_hash,policy_hash)):raise ValueError('idle_journal_source_changed')
        if type(callback_seconds)not in (float,int) or type(max_records)is not int or type(max_bytes)is not int or not 0<callback_seconds<=1 or not 1<=max_records<=MAX_RECORDS or not 1<=max_bytes<=MAX_TOTAL_BYTES:raise ValueError('idle_journal_invalid_bounds')
        self.code_hash=code_hash;self.policy_hash=policy_hash;self.callback_seconds=callback_seconds;self.poisoned=False;self.last_receipt=None;self.sequence=0;self.last_event=None
        self.worker=production.Holder(worker_target,(str(path),code_hash,policy_hash,max_records,max_bytes))
        try:
            if not self.worker.connection.poll(5)or self.worker.connection.recv()!={'ready':True}:raise RuntimeError('idle_journal_start_failed')
        except BaseException:
            self.worker.close(emergency=True);raise RuntimeError('idle_journal_start_failed')from None

    def _request(self,kind,data):
        if self.poisoned:raise RuntimeError('idle_journal_unavailable')
        result=[]
        def rpc():
            try:self.worker.connection.send({'kind':kind,'data':data});result.append(self.worker.connection.recv())
            except BaseException:result.append({'failed':'idle_journal_failure'})
        thread=threading.Thread(target=rpc,daemon=True);thread.start();thread.join(self.callback_seconds)
        if thread.is_alive():
            self.poisoned=True;self.worker.signal_owned(signal.SIGKILL)
            # Reaping belongs to overall cleanup, not the callback budget.
            raise RuntimeError('idle_journal_timeout')
        reply=result[0]
        if type(reply)is dict and set(reply)=={'failed'}:
            self.poisoned=True;raise RuntimeError(reply['failed'])
        try:
            receipt=exact(reply,{'receipt'})['receipt'];keys={'sequence','recordSha256','committed'}|({'holderPid','holderStartTicks'}if kind=='birth'else set())
            exact(receipt,keys)
            expected={'schema':'qdrant.idle-journal.v1','sequence':self.sequence+1,'kind':kind,'codeSha256':self.code_hash,'policySha256':self.policy_hash,'data':data}
            raw=(json.dumps(expected,sort_keys=True,separators=(',',':'))+'\n').encode()
            if receipt['sequence']!=self.sequence+1 or type(receipt['sequence'])is not int or receipt['committed']is not True or receipt['recordSha256']!=digest(raw):raise ValueError('idle_journal_receipt_mismatch')
            if kind=='birth'and any(receipt[k]!=data[k] or type(receipt[k])is not int for k in ('holderPid','holderStartTicks')):raise ValueError('idle_journal_receipt_mismatch')
        except (ValueError,TypeError,KeyError):
            self.poisoned=True;raise RuntimeError('idle_journal_receipt_mismatch')from None
        self.sequence+=1;self.last_receipt=receipt;return receipt

    def bind(self,row):
        if self.sequence!=0:raise RuntimeError('idle_journal_source_changed')
        return self._request('binding',binding(row))

    def register(self,row):
        self._request('birth',dict(birth(row)));return True

    def emit(self,row):
        clean=sanitize(row,self.code_hash,self.policy_hash);self._request('event',clean);self.last_event=clean

    def close(self):return self.worker.close(emergency=self.poisoned)
