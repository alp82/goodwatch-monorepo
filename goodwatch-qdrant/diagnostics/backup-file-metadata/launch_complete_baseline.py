"""Local-only default. Root-reviewed opt-in transports metadata reader in memory."""
import argparse,datetime as dt,hashlib,json,os,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parent
OBSERVER_SHA='1a386e673d5ecf9b53e55ca61a26c936ffe813ebea687e66f7acacefa292c21d'
HELPER_SHA='e133e50dfacd20c759f561716ff6ef6454363646fe1ecf4218e9bf9535a452bb'
CONTRACT=pathlib.Path('/home/alper/projects/search-production-pin-preflight-406/private-production-source-contract.json')
CONTRACT_SHA='12db49b938d8d8d6b24738c860559c098732ff351cf1b90c4637f28d0d2f1b6d'
END=dt.datetime.fromisoformat('2026-10-12T07:29:00+00:00').timestamp()

def payload(code,contract,helper):
    body = """import os,time,json,signal,types,datetime
helpers=types.ModuleType('reviewed_metadata_helpers')
exec(compile(HELPER,'reviewed_metadata_helpers','exec'),helpers.__dict__)
namespace={'__name__':'complete_metadata_baseline_runtime'}
exec(compile(CODE,'complete_metadata_baseline_runtime','exec'),namespace)
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def emit(v):print(json.dumps(v,sort_keys=True),flush=True)
pid=os.fork()
if pid==0:
 try:
  result=namespace['capture'](CONTRACT,helpers)
  emit({'event':'private-complete-file-baseline','public':result['public'],'private':result['private']})
 except BaseException as error:
  reason=str(error)if str(error)in SAFE else 'baseline_runtime_failure'
  emit({'event':'complete-file-baseline-failed','at':stamp(),'reason':reason});os._exit(1)
 os._exit(0)
emit({'event':'backup-metadata-reader-started','at':stamp(),'readerPid':pid,'queries':0,'hostFilesCreated':0})
status=None;finish=time.monotonic()+50
while time.monotonic()<finish:
 child,result=os.waitpid(pid,os.WNOHANG)
 if child:status=result;break
 time.sleep(.1)
term=False;kill=False
for sig,label,grace in ((signal.SIGTERM,'term',5),(signal.SIGKILL,'kill',5)):
 if status is not None:break
 child,result=os.waitpid(pid,os.WNOHANG)
 if child:status=result;break
 try:os.kill(pid,sig)
 except ProcessLookupError:pass
 if label=='term':term=True
 else:kill=True
 deadline=time.monotonic()+grace
 while time.monotonic()<deadline:
  child,result=os.waitpid(pid,os.WNOHANG)
  if child:status=result;break
  time.sleep(.1)
emit({'event':'backup-metadata-reader-exit','at':stamp(),'readerPid':pid,'readerGone':status is not None,'exitCode':None if status is None else os.waitstatus_to_exitcode(status),'termSent':term,'killSent':kill,'deadlineStop':term,'hostFilesCreated':0})
raise SystemExit(0 if status==0 else 1)
"""
    safe=('empty_collection_cohort','scan_depth_bound','path_invalid','scan_time_bound','scan_entry_bound','alias_excluded','directory_changed','nonregular_excluded','empty_cohort','store_changed','output_bound','backup_active_or_unknown','source_changed','source_limits_changed','private_contract_invalid','metadata_unavailable','backup_schedule_unavailable')
    return 'CODE='+repr(code)+'\nHELPER='+repr(helper)+'\nCONTRACT='+repr(contract)+'\nSAFE='+repr(safe)+'\n'+body

def reader_exit_proof(path):
    """SSH success is not proof that a kernel-blocked remote child exited."""
    try:
        with path.open('rb')as stream:
            stream.seek(0,os.SEEK_END);length=stream.tell();stream.seek(max(0,length-16384));tail=stream.read()
        lines=tail.splitlines()
        if not lines:return {'readerExitProven':False,'remoteStateUnknown':True}
        row=json.loads(lines[-1])
        expected={'event','at','readerPid','readerGone','exitCode','termSent','killSent','deadlineStop','hostFilesCreated'}
        if set(row)!=expected or row['event']!='backup-metadata-reader-exit' or type(row['readerPid'])is not int or row['readerPid']<=0 or type(row['readerGone'])is not bool or row['hostFilesCreated']!=0:
            raise ValueError()
        if any(type(row[k])is not bool for k in ('termSent','killSent','deadlineStop')):raise ValueError()
        dt.datetime.fromisoformat(row['at'])
        if row['readerGone']:
            if type(row['exitCode'])is not int or not -64<=row['exitCode']<=255:raise ValueError()
        elif row['exitCode']is not None:raise ValueError()
        return {'readerExitProven':row['readerGone'],'remoteStateUnknown':not row['readerGone'],
                'readerPid':row['readerPid'],'readerExitCode':row['exitCode'],'termSent':row['termSent'],'killSent':row['killSent']}
    except Exception:return {'readerExitProven':False,'remoteStateUnknown':True}


def public_receipt(path):
    try:
        if path.stat().st_size>17*1024*1024:raise ValueError()
        records=[json.loads(line)for line in path.read_bytes().splitlines()]
        found=[r for r in records if r.get('event')=='private-complete-file-baseline']
        if len(found)!=1:return {'baselineComplete':False}
        result=found[0]['public']
        allowed={'schema','complete','entries','files','segmentDirectories','scannedDirectories','aliases','apparentBytes','allocatedStatBytes','metadataHash','durationSeconds','contentRead','atomicSnapshot','futureCeilingEstablished','startedAt','endedAt','sourceIdentityHash','availableBytesBefore','availableBytesAfter','sourcePid','sourceStartTicks','queries','cacheControls','remoteHostFilesCreated'}
        if set(result)!=allowed:raise ValueError()
        return {'baselineComplete':result['complete'],'receipt':result,'privateArtifactSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'privateArtifactBytes':path.stat().st_size}
    except Exception:return {'baselineComplete':False,'receiptInvalid':True}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--execute',action='store_true');parser.add_argument('--output',type=pathlib.Path);args=parser.parse_args()
    if not args.execute:
        print(json.dumps({'stage':'prepared-only','ssh':False,'observerSha256':OBSERVER_SHA,'privateContractSha256':CONTRACT_SHA}));return
    try:
        code=(ROOT/'complete_baseline.py').read_bytes();helper=(ROOT/'observer_v4.py').read_bytes();private=CONTRACT.read_bytes()
        if hashlib.sha256(code).hexdigest()!=OBSERVER_SHA or hashlib.sha256(private).hexdigest()!=CONTRACT_SHA or hashlib.sha256(helper).hexdigest()!=HELPER_SHA:raise ValueError()
        if args.output is None or not args.output.is_absolute() or args.output.exists() or args.output.is_symlink() or args.output.parent.stat().st_mode&0o777!=0o700:raise ValueError()
        timeout=80
        fd=os.open(args.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'wb')as out:
            result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@10.0.0.20','python3','-I','-B','-'],input=payload(code.decode(),json.loads(private),helper.decode()).encode(),stdout=out,stderr=subprocess.DEVNULL,timeout=timeout)
        print(json.dumps({'stage':'observer-finished','sshExitCode':result.returncode,**public_receipt(args.output),**reader_exit_proof(args.output)}));raise SystemExit(result.returncode)
    except subprocess.TimeoutExpired:
        print(json.dumps({'stage':'observer-transport-timeout',**reader_exit_proof(args.output)}));raise SystemExit(1)
    except Exception:
        print(json.dumps({'stage':'observer-launch-refused','reason':'source_or_output_guard_failed'}));raise SystemExit(1)
if __name__=='__main__':main()
