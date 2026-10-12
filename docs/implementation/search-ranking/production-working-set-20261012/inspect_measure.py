"""Reviewed metadata-only working-set snapshot; default does not inspect."""
import base64,hashlib,json,os,re,resource,signal,sys,time,types
from pathlib import Path
sys.dont_write_bytecode=True
CODE='2b956e9ad4b2297552d66524277acbc4d6d867f36cc1fdfa656a7c75a7568256'
CONTRACT='12db49b938d8d8d6b24738c860559c098732ff351cf1b90c4637f28d0d2f1b6d'
FILES={'pin.py':'4fea5b5b30a1b294466007f0d390f0b9dbc205ee7225ef704baf55e3c7d7dabc','runtime.py':'4e4cbce3e7b088cfd187af1b61b40ef633e9c9b6a4435e54e3a503921da0c1de','production.py':'9ad60d1b347600add5907c92125288aec3a2914caece63655a4df4ad59203005'}
SOURCE_PID=3411704;SOURCE_TICKS=2673362807
REASONS={'private_input_invalid','measurement_timeout','measurement_interrupted','source_identity_changed','source_limit_event','outside_unlocked_inspector_required','measurement_shape_invalid','expected_class_missing','own_fd_cleanup_unproven','own_nofile_restore_failed','mapped_cohort_changed','version_or_owner','guard_or_runtime_failure'}
pin=runtime=production=None

def fail(reason):raise RuntimeError(reason)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def emit(phase,**values):print(json.dumps({'event':'qdrant.working-set-measure.v1','phase':phase,**values},sort_keys=True),flush=True)
def vm_locked():
 rows=[line.split()for line in Path('/proc/self/status').read_text().splitlines()if line.startswith('VmLck:')]
 if len(rows)!=1 or rows[0][1:]!=['0','kB']:fail('outside_unlocked_inspector_required')
 return 0

def decode(raw):
 try:
  if len(raw)>524288:fail('private_input_invalid')
  packet=json.loads(raw)
  if type(packet)is not dict or set(packet)!={'code','contract'}or set(packet['code'])!=set(FILES):fail('private_input_invalid')
  code={n:base64.b64decode(packet['code'][n],validate=True)for n in FILES}
  digest=hashlib.sha256()
  for n,h in FILES.items():
   if sha(code[n])!=h:fail('private_input_invalid')
   digest.update(n.encode()+b'\0'+code[n]+b'\0')
  contract=base64.b64decode(packet['contract'],validate=True)
  if digest.hexdigest()!=CODE or len(contract)>16384 or sha(contract)!=CONTRACT:fail('private_input_invalid')
  config=json.loads(contract)
  required={'store','image','mounts','memoryBytes','swapBytes','cpuNanos','memoryMax','memoryHigh','cpuMax'}
  if type(config)is not dict or set(config)!=required:fail('private_input_invalid')
  if any(type(config[k])is not int or config[k]!=0 for k in ('memoryBytes','swapBytes','cpuNanos'))or(config['memoryMax'],config['memoryHigh'],config['cpuMax'])!=('max','max','max 100000'):fail('private_input_invalid')
  store=Path(config['store'])
  if not store.is_absolute()or store.resolve()!=store or not store.is_dir()or not re.fullmatch('sha256:[a-f0-9]{64}',config['image']):fail('private_input_invalid')
  mounts=config['mounts']
  if type(mounts)is not list or not 1<=len(mounts)<=8:fail('private_input_invalid')
  for row in mounts:
   if type(row)is not list or len(row)!=4 or any(type(s)is not str or not s.startswith('/')for s in row[:2])or row[2]not in('bind','volume')or type(row[3])is not bool:fail('private_input_invalid')
  frozen=frozenset(tuple(row)for row in mounts)
  if len(frozen)!=len(mounts)or not any(row[0]==str(store)and row[1]=='/qdrant/storage'and row[3]for row in frozen):fail('private_input_invalid')
  return code,config
 except RuntimeError:raise
 except BaseException:fail('private_input_invalid')

def load(code):
 global pin,runtime,production
 # No stage or temporary files: the reviewed source is executed directly from
 # private stdin. These module filenames are diagnostic labels, not host paths.
 for name in FILES:
  module=types.ModuleType(name[:-3]);module.__file__='memory-reviewed/'+name;sys.modules[name[:-3]]=module
  exec(compile(code[name],module.__file__,'exec'),module.__dict__)
 pin=sys.modules['pin'];runtime=sys.modules['runtime'];production=sys.modules['production']

def limits(before,after):
 out={}
 for group,keys in (('memoryEvents',('oom','oom_kill','max')),('cpu',('nr_throttled','throttled_usec'))):
  delta={k:after[group][k]-before[group][k]for k in keys}
  if any(type(v)is not int or v!=0 for v in delta.values()):fail('source_limit_event')
  out['memoryEventDelta'if group=='memoryEvents'else'cpuLimitDelta']=delta
 if before['cgroupMaxBytes']is not None or after['cgroupMaxBytes']is not None:fail('source_limit_event')
 return out

def numeric_accounting(value):
 keys=('availableBytes','anonBytes','fileBytes','kernelBytes','unevictableBytes','currentBytes')
 result={k:value[k]for k in keys}
 if any(type(v)is not int or v<0 for v in result.values()):fail('measurement_shape_invalid')
 return result

def classes(value,page):
 fields={'files','dataPages','residentDataPages','rawExtentCount','dataRangeCount'}
 if type(value)is not dict or set(value)!=set(pin.CLASSES)or type(page)is not int or page!=pin.PAGE:fail('measurement_shape_invalid')
 out={}
 for kind,row in value.items():
  if type(row)is not dict or set(row)!=fields or any(type(n)is not int or n<0 for n in row.values())or row['residentDataPages']>row['dataPages']:fail('measurement_shape_invalid')
  out[kind]={**row,'dataBytes':row['dataPages']*page,'residentDataBytes':row['residentDataPages']*page}
 if sum(r['files']for r in out.values())>runtime.MAX_MAPPED_FILES:fail('measurement_shape_invalid')
 selected=('vector','graph','sparse','other')
 if any(out[k]['files']==0 or out[k]['dataPages']==0 for k in selected):fail('expected_class_missing')
 return out

def host_memory():
 names={'MemAvailable','Dirty','Writeback'};found={}
 for line in Path('/proc/meminfo').read_text().splitlines():
  parts=line.split()
  if parts[0].rstrip(':')in names:
   if len(parts)!=3 or parts[2]!='kB' or not parts[1].isdigit():fail('measurement_shape_invalid')
   found[parts[0].rstrip(':')]=int(parts[1])*1024
 if set(found)!=names:fail('measurement_shape_invalid')
 return found

def fd_cohort():
 identities=[]
 for value in os.listdir('/proc/self/fd'):
  try:
   info=os.fstat(int(value));identities.append((int(value),info.st_dev,info.st_ino,info.st_mode))
  except FileNotFoundError:continue
  except OSError as error:
   if error.errno!=9:raise
 return tuple(sorted(identities))

def mapped_cohort(source):
 with (runtime.PROC/str(source.pid)/'maps').open('r')as stream:raw=stream.read(8*1024*1024+1)
 if len(raw)>8*1024*1024:fail('measurement_shape_invalid')
 rows=[line for line in raw.splitlines()if len(line.split(maxsplit=5))==6 and line.split(maxsplit=5)[5].startswith('/qdrant/storage/')]
 if not rows:fail('expected_class_missing')
 return sha('\n'.join(sorted(rows)).encode())

def measure(config,spec,allow_nofile=False,check_source=None):
 if type(allow_nofile)is not bool:fail('private_input_invalid')
 original=production.own_group();vm_locked();soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
 initial_fds=fd_cohort();began=time.monotonic();own_oom_before=Path('/proc/self/oom_score_adj').read_text().strip();memory_before=host_memory()
 source_check=check_source or(lambda requested:production.check_source({'source':config},requested,original))
 anchor=source_check(spec)
 def fenced(requested):
  source=source_check(requested)
  if source.identity!=anchor.identity or source.pid!=SOURCE_PID or source.identity[3]!=SOURCE_TICKS:fail('source_identity_changed')
  if production.own_group()!=original or original==source.cgroup_relative:fail('outside_unlocked_inspector_required')
  vm_locked();return source
 source=fenced(spec);before=runtime.accounting(source);cohort_before=mapped_cohort(source);result=None
 try:
  measured=runtime.measure_source(spec,include_payload=False,source_check=fenced,raise_own_nofile=allow_nofile)
  after_source=fenced(spec);after=runtime.accounting(after_source);delta=limits(before,after)
  if mapped_cohort(after_source)!=cohort_before:fail('mapped_cohort_changed')
  proof=production.nofile_proof(measured['nofileLimits'])
  if resource.getrlimit(resource.RLIMIT_NOFILE)[1]!=hard or proof['requiredSoft']>runtime.MAX_REQUIRED_NOFILE:fail('measurement_shape_invalid')
  totals=classes(measured['classesMeasured'],measured['pageBytes']);selected=sum(totals[k]['dataBytes']for k in ('vector','graph','sparse','other'))
  if not re.fullmatch('[a-f0-9]{64}',measured['selectionHash'])or measured['lockedBytes']!=0 or measured['queries']!=0 or measured['storageWrites']!=0:fail('measurement_shape_invalid')
  result={'codeSha256':CODE,'contractSha256':CONTRACT,'sourceIdentitySha256':sha(repr(source.identity).encode()),'sourcePid':source.pid,'sourceStartTicks':source.identity[3],
   'classesMeasured':totals,'selectedDataBytes':selected,'selectedResidentDataBytes':sum(totals[k]['residentDataBytes']for k in ('vector','graph','sparse','other')),
   'mappedCohortSha256':cohort_before,'mappedCohortUnchanged':True,'payloadSelectedBytes':0,'selectedBytesLe2GiB':selected<=2*pin.GIB,'selectionHash':measured['selectionHash'],'extentRangesHashed':True,'contentFixed':False,
   'kernelRelease':os.uname().release,'hostMemoryBefore':memory_before,'hostMemoryAfter':host_memory(),'pageBytes':pin.PAGE,'deletedMappingsExcluded':measured['deletedMappingsExcluded'],'helperVmas':measured['helperVmas'],'maxMapCount':measured['maxMapCount'],
   'nofileLimits':proof,'accountingBefore':numeric_accounting(before),'accountingAfter':numeric_accounting(after),'parentOutsideSourceCgroup':True,'vmLockedBytes':0,
   'queries':0,'lockedBytes':0,'storageWrites':0,'mappedContentReads':0,'archiveContentReads':0,'modelContentReads':0,'readOnlySharedMappings':True,'sourceOomGroupZero':True,'sourceAllocationUnchanged':True,'elapsedMs':round((time.monotonic()-began)*1000),**delta}
 finally:
  current_soft,current_hard=resource.getrlimit(resource.RLIMIT_NOFILE)
  if current_hard!=hard:fail('own_nofile_restore_failed')
  if current_soft!=soft:resource.setrlimit(resource.RLIMIT_NOFILE,(soft,hard))
  if resource.getrlimit(resource.RLIMIT_NOFILE)!=(soft,hard):fail('own_nofile_restore_failed')
  if fd_cohort()!=initial_fds:fail('own_fd_cleanup_unproven')
  vm_locked()
 if production.own_group()!=original or Path('/proc/self/oom_score_adj').read_text().strip()!=own_oom_before:fail('outside_unlocked_inspector_required')
 result['ownNofileRestored']=True;result['ownFdCountUnchanged']=True;result['ownFdCohortUnchanged']=True
 result['ownFdCountBefore']=len(initial_fds);result['ownFdCountAfter']=len(fd_cohort());result['ownVmLockedBytesBefore']=0;result['ownVmLockedBytesAfter']=0;result['ownOomScoreAdjUnchanged']=True
 return result

def safe_reason(error):
 value=str(error)
 allowed=REASONS|(production.PRODUCTION_REASONS if production else set())|(pin.SAFE_REASONS if pin and hasattr(pin,'SAFE_REASONS')else set())
 return value if type(error)in(RuntimeError,ValueError)and value in allowed else'guard_or_runtime_failure'

def main(argv=None):
 argv=sys.argv[1:]if argv is None else argv
 if not argv:emit('prepared',execution=False);return 0
 if argv not in (['--execute-reviewed'],['--execute-reviewed','--allow-own-nofile-raise']):emit('failed',reason='private_input_invalid');return 1
 if sys.version_info<(3,9)or os.geteuid()!=0:emit('failed',reason='version_or_owner');return 1
 signal.signal(signal.SIGTERM,lambda *_:fail('measurement_interrupted'));signal.signal(signal.SIGINT,lambda *_:fail('measurement_interrupted'))
 signal.signal(signal.SIGALRM,lambda *_:fail('measurement_timeout'));signal.alarm(90)
 try:
  code,config=decode(sys.stdin.buffer.read(524289));load(code)
  spec=runtime.Spec('production','qdrant-main',config['image'],Path(config['store']),frozenset(tuple(row)for row in config['mounts']),0,0,0)
  emit('completed',**measure(config,spec,allow_nofile='--allow-own-nofile-raise'in argv));return 0
 except BaseException as error:emit('failed',reason=safe_reason(error));return 1
 finally:signal.alarm(0)
if __name__=='__main__':raise SystemExit(main())
