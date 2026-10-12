"""Dedicated fsynced numeric helper evidence; no production destination by default."""
import hashlib
import fcntl
import json
import os
from pathlib import Path
import re
import stat
from datetime import datetime,timezone
import pin
import production

HASH = re.compile('[a-f0-9]{64}')
PHASES = {'prepared','holder_started','inventory_retry_claimed','locked','heartbeat','released','failed'}
SCALARS = {'event','at','phase','reason','queries','storageWrites','execution','selectionHash','extentRangesHashed','contentFixed',
           'lockedBytes','newLockBytes','qdrantPid','sourceStartTicks','deletedMappingsExcluded','nonresidentSelectedBytes',
           'projectedCurrentBytes','capReserveBytes','pageBytes','rangesChanged','existingPageChargesInsideTargetProven',
           'pidfdOwned','holderPid','holderStartTicks','vmLockedBytes','holderPlacementVerified','sourceIdentitySha256','availableBytes',
           'holderClaimed','attempt','emergencyRelease','holderExited','gracefulReleaseAcknowledged','exitCode','released','codeSha256','policySha256'}
NESTED = {'classesMeasured':{'files','dataLockBytes','dataPages','rawExtentCount','dataRangeCount'},
          'lockedResidency':{'lockedDataPages','residentLockedDataPages'},
          'memoryEventDelta':{'oom','oom_kill','max'},'cpuLimitDelta':{'nr_throttled','throttled_usec'},
          'nofileLimits':{'openFdCount','mappedFileBound','reserveFds','requiredSoft','softBefore','softAfter','hardLimit','raised','hardChanged'},
          'mappingBounds':{'currentVmas','maxMapCount','projectedAdditionalVmas','reservedVmas','projectedTotalVmas'},
          'memlockLimits':{'softBefore','hardBefore','softAfter','hardAfter'}}
CLASSES = {'vector','graph','sparse','payload','other'}
STRINGS = {'event':{'qdrant.pin-helper.v1'},'phase':PHASES,'reason':{'source_turnover','supervisor_exit','invalid_cli_arguments',
           'production_policy_changed','invalid_production_policy','invalid_production_source','invalid_production_mounts',
           'production_allocation_changed','source_changed_during_pass','supervisor_placement_changed','holder_pass_timeout',
           'source_rpc_budget','holder_disappeared','holder_exit_unproven','frozen_production_inputs_required',
           'owned_supervisor_directory_required','owned_supervisor_lock_required','emergency_headroom_release','guard_or_runtime_failure'}}
STRINGS['reason'] |= production.PRODUCTION_REASONS


def scalar(key,value):
    if key == 'at':
        if type(value) is not str or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z',value): raise ValueError('invalid_helper_timestamp')
        datetime.fromisoformat(value.replace('Z','+00:00')); return value
    if key.endswith('Sha256') or key == 'selectionHash':
        if type(value) is not str or not HASH.fullmatch(value): raise ValueError('invalid_helper_hash')
        return value
    if key in STRINGS:
        if value not in STRINGS[key]: raise ValueError('unknown_helper_enum')
        return value
    if value is None or type(value) is bool: return value
    if type(value) is not int or value < 0 and key != 'exitCode': raise ValueError('invalid_helper_number')
    return value


def sanitize(row,code_hash,policy_hash):
    if type(row) is not dict or row.get('event') != 'qdrant.pin-helper.v1' or row.get('phase') not in PHASES or any(type(row.get(k)) is not int or row[k] != 0 for k in ('queries','storageWrites')):
        raise ValueError('invalid_helper_frame')
    if row['phase'] != 'prepared' and (row.get('codeSha256') != code_hash or row.get('policySha256') != policy_hash):
        raise ValueError('helper_source_changed')
    out = {k:scalar(k,v) for k,v in row.items() if k in SCALARS}
    for key,fields in NESTED.items():
        if key not in row: continue
        source = row[key]
        if type(source) is not dict: raise ValueError('invalid_helper_numeric_object')
        if key in ('classesMeasured','lockedResidency'):
            out[key] = {}
            for kind,data in source.items():
                if kind not in CLASSES or type(data) is not dict: raise ValueError('invalid_helper_class')
                out[key][kind] = {k:scalar(k,v) for k,v in data.items() if k in fields}
        else: out[key] = {k:scalar(k,v) for k,v in source.items() if k in fields}
    if row['phase'] in ('locked','heartbeat') and not all(k in out for k in ('at','holderPid','qdrantPid','sourceStartTicks','availableBytes')):
        raise ValueError('helper_source_proof_missing')
    if row['phase']=='holder_started' and (out.get('pidfdOwned') is not True or any(type(out.get(k))is not int or out[k]<=0 for k in ('holderPid','holderStartTicks'))):raise ValueError('holder_birth_proof_missing')
    if row['phase'] == 'locked' and not all(k in out for k in ('sourceIdentitySha256','selectionHash','lockedBytes','lockedResidency','vmLockedBytes','holderStartTicks','holderPlacementVerified')):
        raise ValueError('helper_lock_proof_missing')
    return out


class Journal:
    def __init__(self,path,code_hash,policy_hash,service_hash):
        if not all(type(x) is str and HASH.fullmatch(x) for x in (code_hash,policy_hash,service_hash)): raise ValueError('frozen_helper_inputs_required')
        self.code_hash = code_hash; self.policy_hash = policy_hash; self.service_hash = service_hash
        self.buffer = ''; self.sequence = 0; self.last_birth=None
        path = Path(path)
        if path.parent.resolve() != path.parent or not path.parent.is_dir(): raise ValueError('private_journal_parent_required')
        parent = path.parent.stat()
        if parent.st_uid != os.geteuid() or parent.st_mode & 0o077: raise ValueError('private_journal_parent_required')
        self.fd = os.open(path,os.O_RDWR|os.O_APPEND|os.O_CREAT|os.O_NOFOLLOW,0o600)
        info = os.fstat(self.fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1 or info.st_mode & 0o077:
            os.close(self.fd); raise ValueError('private_journal_required')
        # Refuse partial tails rather than hiding lost evidence after a restart.
        if info.st_size and os.pread(self.fd,1,info.st_size-1) != b'\n':
            os.close(self.fd); raise ValueError('partial_helper_journal')
        try: fcntl.flock(self.fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BaseException:
            os.close(self.fd); raise
        directory_fd = os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY)
        try: os.fsync(directory_fd)
        finally: os.close(directory_fd)
        try: self.append('helper.collector-started',{})
        except BaseException:
            os.close(self.fd); raise

    def append(self,kind,data):
        self.sequence += 1
        row = {'schema':'qdrant.helper-journal.v1','kind':kind,'sequence':self.sequence,
               'recordedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),
               'codeSha256':self.code_hash,'policySha256':self.policy_hash,'serviceSha256':self.service_hash,'data':data}
        raw = (json.dumps(row,sort_keys=True,separators=(',',':'))+'\n').encode()
        if len(raw) > 32768: raise ValueError('helper_frame_too_large')
        written = 0
        while written < len(raw):
            n = os.write(self.fd,raw[written:])
            if n <= 0: raise OSError('helper_journal_write_failed')
            written += n
        os.fsync(self.fd)

    def write(self,text):
        self.buffer += text
        if len(self.buffer) > 32768: raise ValueError('helper_frame_too_large')
        while '\n' in self.buffer:
            line,self.buffer = self.buffer.split('\n',1)
            if line:
                data=sanitize(json.loads(line),self.code_hash,self.policy_hash)
                self.append('helper.event',data)
                if data['phase']=='holder_started':self.last_birth=(data['holderPid'],data['holderStartTicks'])
        return len(text)

    def holder_registration_committed(self,pid,ticks):return self.last_birth==(pid,ticks)

    def flush(self): os.fsync(self.fd)
    def close(self):
        try:
            if self.buffer: raise ValueError('partial_helper_frame')
            os.fsync(self.fd)
        finally: os.close(self.fd)
