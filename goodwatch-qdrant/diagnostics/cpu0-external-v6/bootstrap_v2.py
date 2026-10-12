"""Authenticated v2 public closure over SSH stdin; adoption never starts a source.

Root separately authenticates THIS bootstrap before passing it to python -I -B
-c. The expected closed manifest SHA is an explicit reviewed command argument.
External dependencies authenticate before external exec/import. The executor
authenticates all fourteen backend files before any backend exec/import.
"""
import base64
import hashlib
import json
import os
import sys
import types

sys.dont_write_bytecode=True
MAX_INPUT=8*1024**2
MODULES=('packet','reason_codes','admission','census','setup','recovery',
         'stager','registration','producer','executor','census_v2',
         'running_adoption_proofs','running_adoption','stager_v2','reason_codes_v2',
         'registration_v2','executor_v2')
NAMES=frozenset(name+'.py' for name in MODULES)


def digest(raw):return hashlib.sha256(raw).hexdigest()


def unique_object(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise RuntimeError('bootstrap_input_invalid')
        result[key]=value
    return result


def reject_constant(_):raise RuntimeError('bootstrap_input_invalid')


def decode(raw,expected_sha):
    if not isinstance(raw,bytes) or len(raw)>MAX_INPUT or not isinstance(expected_sha,str) or len(expected_sha)!=64 or any(c not in '0123456789abcdef' for c in expected_sha):raise RuntimeError('bootstrap_input_invalid')
    value=json.loads(raw,object_pairs_hook=unique_object,parse_constant=reject_constant)
    if not isinstance(value,dict) or set(value)!={'manifest','files','operation','arguments'} or not isinstance(value['manifest'],dict) or set(value['manifest'])!={'schema','files'} or value['manifest']['schema']!='cpu0-ssh-closure.v7' or not isinstance(value['manifest']['files'],dict) or set(value['manifest']['files'])!=NAMES or not isinstance(value['files'],dict) or set(value['files'])!=NAMES:
        raise RuntimeError('bootstrap_closure_invalid')
    manifest=json.dumps(value['manifest'],sort_keys=True,separators=(',',':'),allow_nan=False).encode()+b'\n'
    if digest(manifest)!=expected_sha:raise RuntimeError('bootstrap_closure_changed')
    files={};total=0
    for name in NAMES:
        encoded=value['files'][name]
        if not isinstance(encoded,str) or len(encoded)>350000:raise RuntimeError('bootstrap_file_bound')
        content=base64.b64decode(encoded,validate=True);total+=len(content)
        if len(content)>262144 or digest(content)!=value['manifest']['files'][name]:raise RuntimeError('bootstrap_file_changed')
        files[name]=content
    if total>2*1024**2 or value['operation'] not in ('adopt-running-clone','preflight','stage','turnover','outer-admit','register-consumer','cleanup','producer-stream','producer-confirm','producer-cleanup') or not isinstance(value['arguments'],dict):raise RuntimeError('bootstrap_operation_invalid')
    return value,files


def execute(raw,expected_sha):
    value,files=decode(raw,expected_sha)
    # Authenticate all module bytes before ANY exec. No fallback filesystem import
    # can replace a closure dependency already installed here.
    os.environ.clear();os.environ.update({'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','DOCKER_HOST':'unix:///var/run/docker.sock'})
    if os.path.lexists('/root/goodwatch-qdrant-cold-406-20261011/authenticated-stdin-cpu0-v7'):raise RuntimeError('authenticated_namespace_not_absent')
    for name in MODULES:
        module=types.ModuleType(name);module.__file__='/root/goodwatch-qdrant-cold-406-20261011/authenticated-stdin-cpu0-v7/'+name+'.py'
        module.__package__='';sys.modules[name]=module
        exec(compile(files[name+'.py'],module.__file__,'exec'),module.__dict__)
        module._AUTHENTICATED_EXTERNAL_SHA256=digest(files[name+'.py'])
        module._AUTHENTICATED_EXTERNAL_CLOSURE_SHA256=expected_sha
    return sys.modules['executor_v2'].dispatch(value['operation'],value['arguments'])


BOOTSTRAP_REASONS=frozenset(('authenticated_namespace_not_absent', 'bootstrap_closure_changed', 'bootstrap_closure_invalid', 'bootstrap_explicit_hash_required', 'bootstrap_file_bound', 'bootstrap_file_changed', 'bootstrap_input_invalid', 'bootstrap_operation_invalid'))

def bootstrap_reason(error):
    value=error.args[0] if type(error) is RuntimeError and len(error.args)==1 else None
    return value if isinstance(value,str) and value in BOOTSTRAP_REASONS else 'bootstrap_guard_or_runtime_failure'


def main():
    try:
        if len(sys.argv)!=2:raise RuntimeError('bootstrap_explicit_hash_required')
        raw=sys.stdin.buffer.read(MAX_INPUT+1)
        result=execute(raw,sys.argv[1])
        if isinstance(result,dict) and result.get('producerPrivateStreamCompleted') is True:
            # Explicit control frame; private transport demultiplexes it and
            # never feeds registration/completion evidence to packet grammar.
            print(json.dumps({'kind':'private-producer-exit-proof','proof':result},sort_keys=True,separators=(',',':'),allow_nan=False),flush=True)
            return 0
        print(json.dumps(result,sort_keys=True,separators=(',',':'),allow_nan=False),flush=True)
        return 0
    except BaseException as error:
        # Executor supplies a closed allowlisted public projection. No arbitrary
        # exception strings/argv/tracebacks or private Docker configuration.
        result=getattr(error,'publicFailure',None)
        if not isinstance(result,dict):result={'schema':'cpu0-external-failure.v7','operation':None,'reason':bootstrap_reason(error),'continuationAllowed':False}
        print(json.dumps(result,sort_keys=True,separators=(',',':'),allow_nan=False),flush=True)
        return 1


if __name__=='__main__':raise SystemExit(main())
