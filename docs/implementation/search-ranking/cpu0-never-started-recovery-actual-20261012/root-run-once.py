import hashlib,json,os,subprocess,time
from pathlib import Path
R=Path('/home/alper/projects/search-100-evidence/cpu0-never-started-recovery-root-review-20261012')
C=R/'root-diagnostics'/'pinning-prototype'
B=R/'root-diagnostics'/'cpu0-external-v6'
bindings={'execution-packet.json':'baef942d1cf0b1ffb4c71db15306877a6d6baa47cf8e7e2be08afe208e5c3e3e','local-execution-closure.json':'bfad2fde72fdcf5778cca56ca6812e4f846e2db6afb6644a134542ddc5d5b66e'}
for name,digest in bindings.items():
    assert hashlib.sha256((R/name).read_bytes()).hexdigest()==digest
dependency_raw=(R/'root-dependency-manifest.json').read_bytes()
assert hashlib.sha256(dependency_raw).hexdigest()=='ff2d94f6e872b0bb1b8fa08c03f05be910cdc664cd05a1cd541ebe75b9b04cad'
dependency_manifest=json.loads(dependency_raw)
for name,digest in dependency_manifest['files'].items():
    assert hashlib.sha256((R/'root-diagnostics'/name).read_bytes()).hexdigest()==digest
argv=['/usr/bin/python3','-I','-B',str(B/'local_entry.py'),'--execute-reviewed','--execution-closure',str(R/'local-execution-closure.json'),'--execution-closure-sha256',bindings['local-execution-closure.json'],'--packet',str(R/'execution-packet.json'),'--packet-sha256',bindings['execution-packet.json'],'--contract-dir',str(C),'--validator',str(B/'validate_admission.mjs'),'--outer-sha256','6e0134f9c284c7e3d4ac97fc0ea35ee609e9ddd5b4a170b497d45e57119c315b','--raise-own-nofile','--initial-mode','recover-created-never-started.v1']
# Both files are public evidence only; O_EXCL prevents accidental repetition.
fd=os.open(R/'root-execution-public.ndjson',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_CLOEXEC,0o600)
start=time.monotonic()
with os.fdopen(fd,'wb') as output:
    child=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.DEVNULL,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
    print(json.dumps({'event':'root-owned-clone-execution-started','pid':child.pid,'output':str(R/'root-execution-public.ndjson'),'ordinarySearches':0,'historyWrites':0}),flush=True)
    code=child.wait()
    output.flush();os.fsync(output.fileno())
result={'event':'root-owned-clone-execution-returned','exitCode':code,'elapsedSeconds':time.monotonic()-start,'outputSha256':hashlib.sha256((R/'root-execution-public.ndjson').read_bytes()).hexdigest(),'ordinarySearches':0,'historyWrites':0,'productionAcceptance':False}
rfd=os.open(R/'root-execution-return.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_CLOEXEC,0o600)
with os.fdopen(rfd,'w') as f:
    json.dump(result,f,sort_keys=True);f.write('\n');f.flush();os.fsync(f.fileno())
print(json.dumps(result),flush=True)
raise SystemExit(code)
