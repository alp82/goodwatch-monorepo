"""Prepared stdin-only transport. --execute-window is explicit, maximum 180 seconds; no remote files."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys

SOURCE_SHA='17e692e8c44c751a2ddbc4b1f98bd6d651323c12cf2bff42369c7d98ac8093b8'
SOURCE=Path('/home/alper/projects/goodwatch-resource-membership-ledger-100/goodwatch-qdrant/diagnostics/resource_window.py')

SUPERVISOR=r'''
import base64,ctypes,hashlib,json,os,selectors,signal,subprocess,sys,time
from pathlib import Path
SOURCE_B64=__SOURCE_B64__
EXPECTED_SHA=__SOURCE_SHA__
MODE=__MODE__
READER_ARGS=__READER_ARGS__
END_TIMESTAMP=__END_TIMESTAMP__
ALLOWED_EVENT=__EVENT__
def parent_death_guard(expected):
 libc=ctypes.CDLL(None,use_errno=True)
 if libc.prctl(1,signal.SIGKILL,0,0,0)!=0 or os.getppid()!=expected:raise RuntimeError()
parent_death_guard(os.getppid())
def interrupted(signum,frame):raise RuntimeError()
for sig in (signal.SIGTERM,signal.SIGHUP,signal.SIGINT):signal.signal(sig,interrupted)
if not hasattr(os,'pidfd_open')or not hasattr(signal,'pidfd_send_signal'):
 print('{"event":"preflight.transport-failed.v1","reason":"pidfd_unavailable"}',flush=True);sys.exit(1)
def emit(row):
 print(json.dumps(row,separators=(',',':')),flush=True)
def birth(pid):
 text=Path('/proc/'+str(pid)+'/stat').read_text()
 return int(text[text.rfind(')')+2:].split()[19])
def gone(pid,ticks):
 try:return birth(pid)!=ticks
 except FileNotFoundError:return True
source=base64.b64decode(SOURCE_B64)
if hashlib.sha256(source).hexdigest()!=EXPECTED_SHA:
 emit({'event':'preflight.transport-failed.v1','reason':'source_hash'});sys.exit(1)
child=None;pid=None;ticks=None;pidfd=None;terminated=False;killed=False;failure=None;buffer=b'';rows=0;total=0
try:
 code="import ctypes,os,signal,sys;libc=ctypes.CDLL(None,use_errno=True);expected=int(sys.argv[1]);checked=libc.prctl(1,signal.SIGKILL,0,0,0)==0 and os.getppid()==expected;checked or sys.exit(1);sys.argv="+repr(READER_ARGS)+";exec(compile("+repr(source)+",'<reviewed-resource-window>','exec'))"
 child=subprocess.Popen(['/usr/bin/python3','-I','-B','-c',code,str(os.getpid())],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 pid=child.pid;pidfd=os.pidfd_open(pid);ticks=birth(pid)
 emit({'event':'resource-window.reader-born.v1','pid':pid,'startTicks':ticks,'sourceSha256':EXPECTED_SHA,'hostFilesCreated':0})
 sel=selectors.DefaultSelector();sel.register(child.stdout,selectors.EVENT_READ);deadline=time.monotonic()+min(3100,max(0,END_TIMESTAMP-time.time())+20)
 while sel.get_map():
  if time.monotonic()>=deadline:raise TimeoutError()
  for key,_ in sel.select(min(.2,max(0,deadline-time.monotonic()))):
   chunk=os.read(key.fd,8192)
   if not chunk:
    sel.unregister(key.fileobj);break
   total+=len(chunk);buffer+=chunk
   if total>16*1024**2:raise ValueError()
   while b'\n'in buffer:
    line,buffer=buffer.split(b'\n',1)
    if len(line)>8192:raise ValueError()
    row=json.loads(line);rows+=1
    if rows>1502 or row.get('event')not in ('resource-window.started.v1','resource-window.sample.v1','resource-window.complete.v1','resource-window.failed.v1'):raise ValueError()
    emit(row)
   if len(buffer)>8192:raise ValueError()
 if buffer or not 1<=rows<=1502:raise ValueError()
 child.wait(timeout=5)
except Exception:
 failure='bounded_transport_failure'
finally:
 for sig in (signal.SIGTERM,signal.SIGHUP,signal.SIGINT):signal.signal(sig,signal.SIG_IGN)
 if child is not None and child.poll()is None:
  if pidfd is not None:
   try:signal.pidfd_send_signal(pidfd,signal.SIGTERM);terminated=True
   except ProcessLookupError:pass
  else:child.terminate();terminated=True
  try:child.wait(timeout=5)
  except subprocess.TimeoutExpired:
   if pidfd is not None:
    try:signal.pidfd_send_signal(pidfd,signal.SIGKILL);killed=True
    except ProcessLookupError:pass
   else:child.kill();killed=True
   try:child.wait(timeout=5)
   except subprocess.TimeoutExpired:failure='reader_exit_unproven'
 if child is not None:
  absent=child.poll()is not None and (ticks is None or gone(pid,ticks))
  emit({'event':'resource-window.reader-exit.v1','sourceSha256':EXPECTED_SHA,'pid':pid,'startTicks':ticks,'exitCode':child.poll(),'readerGoneProven':absent,'termSent':terminated,'killSent':killed,'clean':failure is None and child.poll()==0 and absent,'reason':failure,'hostFilesCreated':0})
 else:emit({'event':'preflight.transport-failed.v1','reason':failure})
 if pidfd is not None:os.close(pidfd)
sys.exit(0 if child is not None and failure is None and child.poll()==0 and absent else 1)
'''

def script(source,args,end_timestamp):
    if hashlib.sha256(source).hexdigest()!=SOURCE_SHA:raise ValueError('source_hash')
    return SUPERVISOR.replace('__SOURCE_B64__',repr(base64.b64encode(source).decode())).replace('__SOURCE_SHA__',repr(SOURCE_SHA)).replace('__MODE__',repr('--execute')).replace('__EVENT__',repr('resource-window.complete.v1')).replace('__READER_ARGS__',repr(args)).replace('__END_TIMESTAMP__',repr(end_timestamp))

def main():
    import datetime as dt
    import re
    import time
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute-window',action='store_true')
    parser.add_argument('--start-utc');parser.add_argument('--end-utc')
    parser.add_argument('--expected-source-sha256');parser.add_argument('--backup-path-sha256')
    args=parser.parse_args()
    if not args.execute_window:
        print(json.dumps({'event':'resource-window.transport-prepared.v1','hostOperations':0,'sourceSha256':SOURCE_SHA}));return 0
    if not all(re.fullmatch('[0-9a-f]{64}',v or '')for v in (args.expected_source_sha256,args.backup_path_sha256)):raise ValueError('source_hash_required')
    start=dt.datetime.fromisoformat(args.start_utc);end=dt.datetime.fromisoformat(args.end_utc)
    if start.utcoffset()!=dt.timedelta(0)or end.utcoffset()!=dt.timedelta(0)or not 2<=(end-start).total_seconds()<=180 or not 0<=start.timestamp()-time.time()<=300:raise ValueError('window_invalid')
    argv=['resource_window.py','--execute','--start-utc',args.start_utc,'--end-utc',args.end_utc,'--expected-source-sha256',args.expected_source_sha256,'--backup-path-sha256',args.backup_path_sha256]
    code=script(SOURCE.read_bytes(),argv,end.timestamp())
    remaining=max(0,end.timestamp()-time.time())
    try:
        result=subprocess.run(['/usr/bin/ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=5','root@10.0.0.20','/usr/bin/python3 -I -B -'],input=code.encode(),stdout=sys.stdout.buffer,stderr=subprocess.DEVNULL,timeout=min(3150,remaining+50))
        return result.returncode
    except subprocess.TimeoutExpired:
        print(json.dumps({'event':'resource-window.transport-failed.v1','reason':'outer_timeout','remoteStateUnknown':True}));return 1

if __name__=='__main__':sys.exit(main())
