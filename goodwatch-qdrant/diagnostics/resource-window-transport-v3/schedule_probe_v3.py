"""Versioned fixed-phase scheduler diagnostic. No host action by default."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import time


def read(path,limit=65536):
    with Path(path).open('rb')as stream:data=stream.read(limit+1)
    if len(data)>limit:raise ValueError('read_bound')
    return data

def sha(value):return hashlib.sha256(value).hexdigest()

PHASES=('proc-census','boot-clock','daemon-census','daemon-selection','package-query','installed-manual','timezone-files','daemon-end-fence')
phase=None

def mark(value,**numeric):
    global phase
    if value not in PHASES:raise ValueError('phase_invalid')
    phase=value
    print(json.dumps({'event':'cron-diagnostic.phase.v3','phase':value,**numeric},separators=(',',':')),flush=True)

def probe():
    mark('proc-census')
    begun=time.monotonic();nodes=list(Path('/proc').glob('[0-9]*'));daemons=[]
    if len(nodes)>4096:raise ValueError('census_bound')
    mark('boot-clock')
    btime=[int(line.split()[1])for line in read('/proc/stat').decode().splitlines()if line.startswith('btime ')]
    if len(btime)!=1:raise ValueError('clock_unknown')
    mark('daemon-census',processEntries=len(nodes))
    host_namespace=Path('/proc/1/ns/mnt').stat().st_ino
    for node in nodes:
        if time.monotonic()-begun>2:raise ValueError('census_bound')
        try:
            comm=read(node/'comm',128).decode().strip()
            if comm not in ('cron','crond'):continue
            text=read(node/'stat',8192).decode();ticks=int(text[text.rfind(')')+2:].split()[19])
            executable=os.readlink(node/'exe')
            if Path(executable).name not in ('cron','crond'):raise ValueError('daemon_identity')
            environment=read(node/'environ').split(b'\0');tz=[item[3:]for item in environment if item.startswith(b'TZ=')]
            if len(tz)>1:raise ValueError('timezone_ambiguous')
            again=read(node/'stat',8192).decode()
            if int(again[again.rfind(')')+2:].split()[19])!=ticks:raise ValueError('daemon_changed')
            namespace=Path(node/'ns/mnt').stat().st_ino
            if len(daemons)>=32:raise ValueError('candidate_bound')
            cgroup=read(node/'cgroup',8192)
            daemons.append({'mountNamespaceIsHost':namespace==host_namespace,'cgroupHash':sha(cgroup),'pid':int(node.name),'startTicks':ticks,'comm':comm,'startedEpochSeconds':btime[0]+ticks/os.sysconf('SC_CLK_TCK'),'daemonTimezoneSet':bool(tz),'daemonTimezoneIsUtc':tz[0]in(b'UTC',b'Etc/UTC',b'GMT')if tz else None,'daemonTimezoneHash':sha(tz[0])if tz else None})
        except FileNotFoundError:continue
    mark('daemon-selection',candidateCount=len(daemons),hostNamespaceCandidates=sum(d['mountNamespaceIsHost']for d in daemons))
    for candidate in daemons:print(json.dumps({'event':'cron-diagnostic.candidate.v3',**candidate},separators=(',',':')),flush=True)
    if len(daemons)!=1:raise ValueError('daemon_ambiguous')
    mark('package-query')
    result=subprocess.run(['/usr/bin/dpkg-query','-W','-f=${binary:Package}\t${Version}\t${Status}\n','cron','cronie','busybox','systemd-cron'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=3)
    if len(result.stdout)>8192:raise ValueError('package_bound')
    packages=parse_package_rows(result.stdout.decode())
    mark('installed-manual',installedCandidatePackages=len(packages))
    manual=read('/usr/share/man/man5/crontab.5.gz',131072)
    with gzip.GzipFile(fileobj=io.BytesIO(manual))as stream:plain=stream.read(131073)
    if len(plain)>131072:raise ValueError('manual_bound')
    mark('timezone-files')
    local=Path('/etc/localtime');timezone=Path('/etc/timezone');tzdata=read(timezone,1024).strip()
    canonical=os.path.realpath(local)
    mark('daemon-end-fence')
    daemon_fence(Path('/proc')/str(daemons[0]['pid']),daemons[0],executable,tz)
    return {'event':'cron-diagnostic.identity.v3','atEpochSeconds':time.time(),'daemon':daemons[0],'packages':packages,'localtimeSha256':sha(read(local)),'localtimeCanonicalIsUtc':canonical.endswith(('/Etc/UTC','/UTC','/GMT')),'timezoneFileIsUtc':tzdata in(b'UTC',b'Etc/UTC',b'GMT'),'timezoneFileHash':sha(tzdata),'timezoneFilesPredateDaemon':max(local.stat().st_mtime,timezone.stat().st_mtime)<=daemons[0]['startedEpochSeconds'],'installedManualSha256':sha(plain),'manualHasCronTzToken':b'CRON_TZ'in plain,'cronTzSupportEstablished':False,'nextBackupUtcEstablished':False,'hostWrites':0,'queries':0}


def daemon_fence(node,daemon,executable,tz):
    final=read(node/'stat',8192).decode();final_ticks=int(final[final.rfind(')')+2:].split()[19])
    final_tz=[item[3:]for item in read(node/'environ').split(b'\0')if item.startswith(b'TZ=')]
    if final_ticks!=daemon['startTicks']or read(node/'comm',128).decode().strip()!=daemon['comm']or os.readlink(node/'exe')!=executable or final_tz!=tz:
        raise ValueError('daemon_changed')


def parse_package_rows(text):
    packages=[]
    names=('cron','cronie','busybox','systemd-cron')
    status_pattern=r'(?:unknown|install|deinstall|purge|hold) (?:ok|reinstreq) (?:not-installed|config-files|half-installed|unpacked|half-configured|triggers-awaited|triggers-pending|installed)'
    seen=set()
    for line in text.splitlines():
        parts=line.split('\t')
        if len(parts)!=3:raise ValueError('package_unknown')
        name=parts[0].split(':')[0]
        if name not in names or name in seen or not re.fullmatch(status_pattern,parts[2]):raise ValueError('package_unknown')
        seen.add(name)
        if parts[2].split()[1:]!=['ok','installed']:
            continue
        if not re.fullmatch(r'[A-Za-z0-9.+:~_-]{1,80}',parts[1]):raise ValueError('package_unknown')
        packages.append({'package':name,'version':parts[1]})
    return packages


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--inspect',action='store_true');args=parser.parse_args()
    if not args.inspect:
        print(json.dumps({'event':'cron-schedule-prepared.v1','hostOperations':0}));return 0
    try:print(json.dumps(probe(),separators=(',',':')));return 0
    except Exception as error:
        allowed={'census_bound','clock_unknown','daemon_identity','timezone_ambiguous','daemon_changed','daemon_ambiguous','package_bound','package_unknown','manual_bound','read_bound','candidate_bound'}
        reason=str(error)if str(error)in allowed else ('required_file_absent'if isinstance(error,FileNotFoundError)else'bounded_read_or_parse_failed')
        print(json.dumps({'event':'cron-diagnostic.failed.v3','phase':phase,'reason':reason},separators=(',',':')));return 1

if __name__=='__main__':raise SystemExit(main())
