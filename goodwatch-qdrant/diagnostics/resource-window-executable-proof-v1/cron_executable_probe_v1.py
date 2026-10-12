"""Prepared exact Ubuntu cron byte/ownership/launch proof; --inspect is explicit."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

PID=2662717
TICKS=2555921687
BINARY_SHA='6bd8593640af2413bce259fa0affc18dbf149892756ebe805bf316624f8b590f'
MANUAL_SHA='c7d050fb22c8a67246780877ae1619dec8330a10a67ed769b23be515c0cc646d'

def read(path,limit):
    with Path(path).open('rb')as stream:data=stream.read(limit+1)
    if len(data)>limit:raise ValueError('read_bound')
    return data

def ticks(node):
    text=read(node/'stat',8192).decode();return int(text[text.rfind(')')+2:].split()[19])

def flags(args):
    if not args or args[0]not in('/usr/sbin/cron','cron'):raise ValueError('launch_unknown')
    result={'foreground':False,'preserveChildPath':False,'lsbSysinit':False,'fqdnMail':False,'runImmediately':False,'loggingLevel':1,'debugFlags':False,'alternateScheduleConfigFlag':False,'unknownFlags':False}
    values=args[1:];i=0
    while i<len(values):
        value=values[i]
        if value in('-f','-P','-l','-n','-N'):
            result[{'-f':'foreground','-P':'preserveChildPath','-l':'lsbSysinit','-n':'fqdnMail','-N':'runImmediately'}[value]]=True
        elif value=='-L':
            i+=1
            if i>=len(values)or not re.fullmatch('[0-9]{1,2}',values[i]):raise ValueError('launch_unknown')
            result['loggingLevel']=int(values[i])
        elif re.fullmatch('-L[0-9]{1,2}',value):result['loggingLevel']=int(value[2:])
        else:raise ValueError('launch_unknown')
        i+=1
    if result['runImmediately']:raise ValueError('not_normal_scheduler')
    return result

def probe():
    node=Path('/proc')/str(PID)
    if ticks(node)!=TICKS or read(node/'comm',128).strip()!=b'cron'or os.readlink(node/'exe')!='/usr/sbin/cron':raise ValueError('daemon_changed')
    binary=read(node/'exe',131072);installed=read('/usr/sbin/cron',131072)
    if hashlib.sha256(binary).hexdigest()!=BINARY_SHA or binary!=installed:raise ValueError('binary_mismatch')
    owner=subprocess.run(['/usr/bin/dpkg-query','-S','/usr/sbin/cron'],capture_output=True,timeout=3)
    if owner.returncode or owner.stdout.strip()!=b'cron: /usr/sbin/cron':raise ValueError('package_ownership')
    version=subprocess.run(['/usr/bin/dpkg-query','-W','-f=${Version}\t${Status}','cron'],capture_output=True,timeout=3)
    if version.returncode or version.stdout!=b'3.0pl1-184ubuntu2\tinstall ok installed':raise ValueError('package_version')
    args=read(node/'cmdline',8192).decode().rstrip('\0').split('\0');launch=flags(args)
    environment=read(node/'environ',65536);tz=[v[3:]for v in environment.split(b'\0')if v.startswith(b'TZ=')]
    if tz:raise ValueError('daemon_timezone_changed')
    if ticks(node)!=TICKS or os.readlink(node/'exe')!='/usr/sbin/cron'or read(node/'cmdline',8192).decode().rstrip('\0').split('\0')!=args or read(node/'environ',65536)!=environment:raise ValueError('daemon_changed')
    return {'event':'cron-executable-proof.v1','pid':PID,'startTicks':TICKS,'binarySha256':BINARY_SHA,'binaryMatchesOfficialUbuntuArchive':True,'binaryBytes':len(binary),'installedExecutableMatchesRunning':True,'dpkgOwnershipMatches':True,'package':'cron','version':'3.0pl1-184ubuntu2','launchFlags':launch,'daemonTimezoneSet':False,'hostWrites':0,'queries':0}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--inspect',action='store_true');args=parser.parse_args()
    if not args.inspect:print(json.dumps({'event':'cron-executable-prepared.v1','hostOperations':0}));return 0
    try:print(json.dumps(probe(),separators=(',',':')));return 0
    except Exception as error:
        allowed={'read_bound','launch_unknown','not_normal_scheduler','daemon_changed','binary_mismatch','package_ownership','package_version','daemon_timezone_changed'}
        print(json.dumps({'event':'cron-executable-failed.v1','reason':str(error)if str(error)in allowed else'bounded_proof_failed'}));return 1

if __name__=='__main__':raise SystemExit(main())
