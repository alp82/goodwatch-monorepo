"""Prepared read-only scheduler identity probe; --inspect is explicit."""
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

def probe():
    begun=time.monotonic();nodes=list(Path('/proc').glob('[0-9]*'));daemons=[]
    if len(nodes)>4096:raise ValueError('census_bound')
    btime=[int(line.split()[1])for line in read('/proc/stat').decode().splitlines()if line.startswith('btime ')]
    if len(btime)!=1:raise ValueError('clock_unknown')
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
            daemons.append({'pid':int(node.name),'startTicks':ticks,'comm':comm,'startedEpochSeconds':btime[0]+ticks/os.sysconf('SC_CLK_TCK'),'daemonTimezoneSet':bool(tz),'daemonTimezoneIsUtc':tz[0]in(b'UTC',b'Etc/UTC',b'GMT')if tz else None,'daemonTimezoneHash':sha(tz[0])if tz else None})
        except FileNotFoundError:continue
    if len(daemons)!=1:raise ValueError('daemon_ambiguous')
    result=subprocess.run(['/usr/bin/dpkg-query','-W','-f=${binary:Package}\t${Version}\t${Status}\n','cron','cronie','busybox','systemd-cron'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=3)
    if len(result.stdout)>8192:raise ValueError('package_bound')
    packages=[]
    for line in result.stdout.decode().splitlines():
        parts=line.split('\t')
        if len(parts)!=3:raise ValueError('package_unknown')
        name=parts[0].split(':')[0]
        if name not in ('cron','cronie','busybox','systemd-cron')or not re.fullmatch(r'[A-Za-z0-9.+:~_-]{1,80}',parts[1]):raise ValueError('package_unknown')
        if parts[2]=='install ok installed':packages.append({'package':name,'version':parts[1]})
    manual=read('/usr/share/man/man5/crontab.5.gz',131072)
    with gzip.GzipFile(fileobj=io.BytesIO(manual))as stream:plain=stream.read(131073)
    if len(plain)>131072:raise ValueError('manual_bound')
    local=Path('/etc/localtime');timezone=Path('/etc/timezone');tzdata=read(timezone,1024).strip()
    canonical=os.path.realpath(local)
    daemon_fence(Path('/proc')/str(daemons[0]['pid']),daemons[0],executable,tz)
    return {'event':'cron-schedule-identity.v1','atEpochSeconds':time.time(),'daemon':daemons[0],'packages':packages,'localtimeSha256':sha(read(local)),'localtimeCanonicalIsUtc':canonical.endswith(('/Etc/UTC','/UTC','/GMT')),'timezoneFileIsUtc':tzdata in(b'UTC',b'Etc/UTC',b'GMT'),'timezoneFileHash':sha(tzdata),'timezoneFilesPredateDaemon':max(local.stat().st_mtime,timezone.stat().st_mtime)<=daemons[0]['startedEpochSeconds'],'installedManualSha256':sha(plain),'manualHasCronTzToken':b'CRON_TZ'in plain,'cronTzSupportEstablished':False,'nextBackupUtcEstablished':False,'hostWrites':0,'queries':0}


def daemon_fence(node,daemon,executable,tz):
    final=read(node/'stat',8192).decode();final_ticks=int(final[final.rfind(')')+2:].split()[19])
    final_tz=[item[3:]for item in read(node/'environ').split(b'\0')if item.startswith(b'TZ=')]
    if final_ticks!=daemon['startTicks']or read(node/'comm',128).decode().strip()!=daemon['comm']or os.readlink(node/'exe')!=executable or final_tz!=tz:
        raise ValueError('daemon_changed')


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--inspect',action='store_true');args=parser.parse_args()
    if not args.inspect:
        print(json.dumps({'event':'cron-schedule-prepared.v1','hostOperations':0}));return 0
    try:print(json.dumps(probe(),separators=(',',':')));return 0
    except Exception:
        print(json.dumps({'event':'cron-schedule-failed.v1','reason':'identity_or_timezone_unestablished'}));return 1

if __name__=='__main__':raise SystemExit(main())
