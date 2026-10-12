"""Prepared stdin-only transport. --execute-preflight is explicit; no remote files."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys

SOURCE_SHA='c01c7030a24daa0e4e8ca865d926f195cd94e9a87e269331550dfd7be38c36c5'
SOURCE=Path('/home/alper/projects/goodwatch-qdrant-resource-window-100/goodwatch-qdrant/diagnostics/resource_window.py')

SUPERVISOR=r'''
import base64,ctypes,hashlib,json,os,selectors,signal,subprocess,sys,time
from pathlib import Path
SOURCE_B64=__SOURCE_B64__
EXPECTED_SHA=__SOURCE_SHA__
MODE=__MODE__
ALLOWED_EVENT=__EVENT__
EXTRA_EVENTS=__EXTRA_EVENTS__
MAX_ROWS=__MAX_ROWS__
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
 code="import ctypes,os,signal,sys;libc=ctypes.CDLL(None,use_errno=True);expected=int(sys.argv[1]);checked=libc.prctl(1,signal.SIGKILL,0,0,0)==0 and os.getppid()==expected;checked or sys.exit(1);sys.argv=['reviewed-reader',"+repr(MODE)+"];exec(compile("+repr(source)+",'<reviewed-resource-window>','exec'))"
 child=subprocess.Popen(['/usr/bin/python3','-I','-B','-c',code,str(os.getpid())],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 pid=child.pid;pidfd=os.pidfd_open(pid);ticks=birth(pid)
 emit({'event':'preflight.reader-born.v1','pid':pid,'startTicks':ticks,'sourceSha256':EXPECTED_SHA,'hostFilesCreated':0})
 sel=selectors.DefaultSelector();sel.register(child.stdout,selectors.EVENT_READ);deadline=time.monotonic()+45
 while sel.get_map():
  if time.monotonic()>=deadline:raise TimeoutError()
  for key,_ in sel.select(min(.2,max(0,deadline-time.monotonic()))):
   chunk=os.read(key.fd,8192)
   if not chunk:
    sel.unregister(key.fileobj);break
   total+=len(chunk);buffer+=chunk
   if total>65536:raise ValueError()
   while b'\n'in buffer:
    line,buffer=buffer.split(b'\n',1)
    if len(line)>8192:raise ValueError()
    row=json.loads(line);rows+=1
    if rows>MAX_ROWS or row.get('event')not in (ALLOWED_EVENT,'resource-window.failed.v1','cron-schedule-failed.v1',*EXTRA_EVENTS):raise ValueError()
    emit(row)
   if len(buffer)>8192:raise ValueError()
 if buffer or not 1<=rows<=MAX_ROWS:raise ValueError()
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
  emit({'event':'preflight.reader-exit.v1','pid':pid,'startTicks':ticks,'exitCode':child.poll(),'readerGoneProven':absent,'termSent':terminated,'killSent':killed,'clean':failure is None and child.poll()==0 and absent,'reason':failure,'hostFilesCreated':0})
 else:emit({'event':'preflight.transport-failed.v1','reason':failure})
 if pidfd is not None:os.close(pidfd)
sys.exit(0 if child is not None and failure is None and child.poll()==0 and absent else 1)
'''

SCHEDULE_SHA='36d7e2bd606ea3f7c26228e987226855c440a31175e26eda5439d6928cd2c78f'
SCHEDULE=Path(__file__).with_name('schedule_probe_v2.py')

def script(source,expected_sha=SOURCE_SHA,mode='--inspect-preflight',event='resource-window.preflight.v1',max_rows=1,extra_events=()):
    if hashlib.sha256(source).hexdigest()!=expected_sha:raise ValueError('source_hash')
    return SUPERVISOR.replace('__SOURCE_B64__',repr(base64.b64encode(source).decode())).replace('__SOURCE_SHA__',repr(expected_sha)).replace('__MODE__',repr(mode)).replace('__EVENT__',repr(event)).replace('__MAX_ROWS__',repr(max_rows)).replace('__EXTRA_EVENTS__',repr(extra_events))

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute-diagnostic',action='store_true')
    args=parser.parse_args()
    if not args.execute_diagnostic:
        print(json.dumps({'event':'cron-diagnostic.transport-prepared.v2','hostOperations':0,'sourceSha256':SCHEDULE_SHA}));return 0
    code=script(SCHEDULE.read_bytes(),SCHEDULE_SHA,'--inspect','cron-diagnostic.identity.v2',48,('cron-diagnostic.phase.v2','cron-diagnostic.candidate.v2','cron-diagnostic.failed.v2'))
    # No remote shell interpolation, output file or code staging. Private source metadata stays in memory.
    result=subprocess.run(['/usr/bin/ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=5','root@10.0.0.20','/usr/bin/python3 -I -B -'],input=code.encode(),stdout=sys.stdout.buffer,stderr=subprocess.DEVNULL,timeout=75)
    return result.returncode

if __name__=='__main__':sys.exit(main())
