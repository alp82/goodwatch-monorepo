"""Inactive integration: fresh known-job lease from pinned UTC cron proof."""
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import time

CRON_BINARY='6bd8593640af2413bce259fa0affc18dbf149892756ebe805bf316624f8b590f'
PHASES=('snapshot','publish','cache_advice','retention')
LOCALTIME='/etc/localtime'
UTC_CANONICAL=frozenset({'/usr/share/zoneinfo/Etc/UTC','/usr/share/zoneinfo/UTC'})
CONFIG_KEYS=frozenset({'daemonPid','daemonStartTicks','daemonExecutableSha256','daemonCmdlineSha256','daemonEnvironmentSha256','daemonMountNamespace','timezoneFiles','crontabPath','crontabSha256','backupScript','backupSha256','phaseLogPath','minute'})

def validate_config(config):
    if type(config)is not dict or set(config)!=CONFIG_KEYS:raise ValueError('idle_schedule_unknown')
    for key in ('daemonPid','daemonStartTicks','daemonMountNamespace'):
        if type(config[key])is not int or config[key]<=0:raise ValueError('idle_schedule_unknown')
    if type(config['minute'])is not int or not 0<=config['minute']<60:raise ValueError('idle_schedule_unknown')
    for key in ('daemonExecutableSha256','daemonCmdlineSha256','daemonEnvironmentSha256','crontabSha256','backupSha256'):
        if type(config[key])is not str or not re.fullmatch('[a-f0-9]{64}',config[key]):raise ValueError('idle_schedule_unknown')
    for key in ('crontabPath','backupScript','phaseLogPath'):
        if type(config[key])is not str or not Path(config[key]).is_absolute():raise ValueError('idle_schedule_unknown')
    files=config['timezoneFiles']
    if type(files)is not list or not 1<=len(files)<=4:raise ValueError('idle_schedule_timezone_changed')
    paths=set()
    for row in files:
        if type(row)is not dict or set(row)!={'path','canonical','sha256','mtimeNs'} or type(row['path'])is not str or not Path(row['path']).is_absolute() or row['path']in paths or row['canonical']not in UTC_CANONICAL or type(row['sha256'])is not str or not re.fullmatch('[a-f0-9]{64}',row['sha256']) or type(row['mtimeNs'])is not int or row['mtimeNs']<0:raise ValueError('idle_schedule_timezone_changed')
        paths.add(row['path'])
    if LOCALTIME not in paths:raise ValueError('idle_schedule_timezone_changed')
    return config


def read(path,limit):
    with Path(path).open('rb')as stream:raw=stream.read(limit+1)
    if len(raw)>limit:raise ValueError('idle_schedule_read_bound')
    return raw


def digest(raw):return hashlib.sha256(raw).hexdigest()


def cron_minute(raw,script):
    jobs=[]
    for line in raw.decode().splitlines():
        line=line.strip()
        if not line or line.startswith('#'):continue
        if re.match(r'(?:CRON_TZ|TZ)\s*=',line):raise ValueError('idle_schedule_timezone_changed')
        if re.match(r'[A-Za-z_][A-Za-z0-9_]*\s*=',line):continue
        if line.startswith('@'):raise ValueError('idle_schedule_unknown')
        mentions=script in line or Path(script).name in line
        fields=line.split(None,5)
        if len(fields)!=6:raise ValueError('idle_schedule_unknown')
        tokens=shlex.split(fields[5])
        if script not in tokens:
            if mentions:raise ValueError('idle_schedule_unknown')
            continue
        if fields[1:5]!=['*']*4 or not fields[0].isdigit() or not 0<=int(fields[0])<60:raise ValueError('idle_schedule_unknown')
        pos=tokens.index(script)
        if tokens.count(script)!=1 or pos!=2 or not tokens[0].startswith('/') or Path(tokens[0]).name!='uv' or tokens[1]!='run':
            raise ValueError('idle_schedule_unknown')
        # Only the reviewed no-argument backup invocation, optional output redirection.
        rest=tokens[3:]
        if not (len(rest)==3 and rest[0]=='>>' and rest[1].startswith('/') and rest[2]=='2>&1'):raise ValueError('idle_schedule_unknown')
        jobs.append(int(fields[0]))
    if len(jobs)!=1:raise ValueError('idle_schedule_unknown')
    return jobs[0]


def phases_idle(raw):
    """Known backup's latest observed cycle only; no claim about other clients."""
    if not raw or not raw.endswith(b'\n'):return False
    states={};failed=False
    for line in raw.splitlines():
        try:row=json.loads(line)
        except (ValueError,UnicodeDecodeError):continue
        if type(row)is not dict or row.get('event')!='qdrant.backup.phase.v1':continue
        collection=row.get('collectionClass');phase=row.get('phase');status=row.get('status')
        if collection not in ('media','reference')or phase not in PHASES or status not in ('started','completed','failed'):return False
        key=(collection,phase)
        if phase=='snapshot'and status=='started'and key in states:states={};failed=False
        if status=='failed':failed=True
        if status=='completed'and states.get(key)!='started':return False
        states[key]=status
        if phase=='cache_advice'and status=='completed'and row.get('adviceAccepted')is not True:failed=True
    return not failed and states=={(c,p):'completed'for c in ('media','reference')for p in PHASES}


def ticks(node):
    fields=read(node/'stat',8192).decode().rsplit(')',1)[1].split()
    return int(fields[19])


def inspect_known(config,proc_root=Path('/proc')):
    """Private paths remain in memory; fixed booleans/hash/minute alone leave."""
    validate_config(config)
    start=time.monotonic();node=proc_root/str(config['daemonPid'])
    if ticks(node)!=config['daemonStartTicks'] or read(node/'comm',128).strip()!=b'cron':raise ValueError('idle_schedule_daemon_changed')
    if config['daemonExecutableSha256']!=CRON_BINARY or digest(read(node/'exe',131072))!=CRON_BINARY:raise ValueError('idle_schedule_daemon_changed')
    command=read(node/'cmdline',8192);environment=read(node/'environ',65536)
    if digest(command)!=config['daemonCmdlineSha256'] or digest(environment)!=config['daemonEnvironmentSha256'] or any(v.startswith(b'TZ=')for v in environment.split(b'\0')):raise ValueError('idle_schedule_daemon_changed')
    if (node/'ns'/'mnt').stat().st_ino!=config['daemonMountNamespace'] or (proc_root/'self'/'ns'/'mnt').stat().st_ino!=config['daemonMountNamespace']:raise ValueError('idle_schedule_daemon_changed')
    for item in config['timezoneFiles']:
        path=Path(item['path'])
        if path.resolve()!=Path(item['canonical']) or digest(read(path,65536))!=item['sha256'] or path.stat().st_mtime_ns!=item['mtimeNs']:raise ValueError('idle_schedule_timezone_changed')
    table=read(config['crontabPath'],65536)
    if digest(table)!=config['crontabSha256'] or digest(read(config['backupScript'],262144))!=config['backupSha256']:raise ValueError('idle_schedule_changed')
    minute=cron_minute(table,config['backupScript'])
    if minute!=config['minute']:raise ValueError('idle_schedule_changed')
    nodes=list(proc_root.glob('[0-9]*'))
    if len(nodes)>4096:raise ValueError('idle_schedule_census_bound')
    daemon_count=0
    for candidate in nodes:
        if time.monotonic()-start>1:raise ValueError('idle_schedule_read_bound')
        try:
            comm=read(candidate/'comm',128).strip()
            if comm in (b'cron',b'crond'):daemon_count+=1
            args=read(candidate/'cmdline',65536).split(b'\0')
            if config['backupScript'].encode()in args:raise ValueError('idle_schedule_job_active')
        except FileNotFoundError:raise ValueError('idle_schedule_census_changed')from None
    if daemon_count!=1:raise ValueError('idle_schedule_daemon_changed')
    log=Path(config['phaseLogPath'])
    with log.open('rb')as stream:
        stream.seek(0,os.SEEK_END);size=stream.tell();stream.seek(max(0,size-131072));tail=stream.read(131073)
    if not phases_idle(tail):raise ValueError('idle_schedule_phase_unknown')
    if ticks(node)!=config['daemonStartTicks'] or read(node/'cmdline',8192)!=command or read(node/'environ',65536)!=environment or digest(read(config['crontabPath'],65536))!=config['crontabSha256'] or time.monotonic()-start>1:raise ValueError('idle_schedule_changed')
    return {'minute':minute,'scheduleSha256':digest(json.dumps(config,sort_keys=True,separators=(',',':')).encode()),'knownBackupIdle':True,'knownSnapshotPhaseIdle':True}


class Lease:
    """Freeze one boundary; future clock/schedule/known-job changes refuse."""
    def __init__(self,proof,checker,wall=time.time,clock=time.monotonic):
        if type(proof)is not dict or set(proof)!={'schema','minute','scheduleSha256'}or proof['schema']!='qdrant.idle-schedule-proof.v1' or type(proof['minute'])is not int or not 0<=proof['minute']<60 or type(proof['scheduleSha256'])is not str or not re.fullmatch('[a-f0-9]{64}',proof['scheduleSha256']):raise ValueError('idle_schedule_expired')
        self.proof=dict(proof);self.checker=checker;self.wall=wall;self.clock=clock;self.offset=None;self.boundary=None

    def __call__(self):
        begun=self.clock()
        try:observed=self.checker()
        except Exception:raise RuntimeError('idle_schedule_expired')from None
        checked=self.clock();wall=self.wall()
        if checked-begun>1 or observed!={'minute':self.proof['minute'],'scheduleSha256':self.proof['scheduleSha256'],'knownBackupIdle':True,'knownSnapshotPhaseIdle':True}:raise RuntimeError('idle_schedule_expired')
        offset=wall-checked
        if self.offset is None:
            self.offset=offset;next_wall=(int(wall)//3600)*3600+self.proof['minute']*60
            if next_wall<=wall:next_wall+=3600
            self.boundary=int((next_wall-offset)*1_000_000_000)
        if abs(offset-self.offset)>.5 or checked*1_000_000_000>=self.boundary:raise RuntimeError('idle_schedule_expired')
        return {'checkedMonoNs':int(checked*1_000_000_000),'nextBackupMonoNs':self.boundary,
            'knownBackupIdle':True,'knownSnapshotPhaseIdle':True,'scheduleSha256':self.proof['scheduleSha256']}
