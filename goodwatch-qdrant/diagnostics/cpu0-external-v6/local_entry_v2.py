"""Stdlib-only root execution entry: authenticate own closure BEFORE imports."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import types

MODULES=('packet','reason_codes','admission','census','setup','recovery',
         'stager','registration','producer','executor','census_v2',
         'running_adoption_proofs','running_adoption','stager_v2','reason_codes_v2',
         'registration_v2','executor_v2','bootstrap','bootstrap_v2','rpc','rpc_v2',
         'private_pipe_v2','outer_local_v2')
NAMES=frozenset(name+'.py' for name in MODULES)|{'local_entry_v2.py','validate_admission_v2.mjs'}


def unique_object(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise RuntimeError('local_entry_freeze_invalid')
        result[key]=value
    return result


def reject_constant(_):raise RuntimeError('local_entry_freeze_invalid')


def stable(path):
    if path.resolve(strict=True)!=path:raise RuntimeError('local_entry_source_changed')
    before=path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_uid!=os.geteuid() or before.st_nlink!=1 or stat.S_IMODE(before.st_mode) not in (0o644,0o600) or before.st_size>262144:raise RuntimeError('local_entry_source_changed')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
    fields=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns,s.st_nlink,s.st_uid,stat.S_IMODE(s.st_mode))
    try:
        opened=os.fstat(fd);raw=os.read(fd,262145)
        if fields(before)!=fields(opened) or fields(opened)!=fields(os.fstat(fd)) or fields(opened)!=fields(path.lstat()) or len(raw)!=opened.st_size:raise RuntimeError('local_entry_source_changed')
        return raw
    finally:os.close(fd)


def authenticate(folder,manifest_raw,expected_sha):
    digest=lambda raw:hashlib.sha256(raw).hexdigest()
    if digest(manifest_raw)!=expected_sha:raise RuntimeError('local_entry_freeze_changed')
    manifest=json.loads(manifest_raw,object_pairs_hook=unique_object,parse_constant=reject_constant)
    if not isinstance(manifest,dict) or set(manifest)!={'schema','files'} or manifest['schema']!='cpu0-local-execution-closure.v7' or not isinstance(manifest['files'],dict) or set(manifest['files'])!=NAMES:raise RuntimeError('local_entry_freeze_invalid')
    files={name:stable(folder/name) for name in NAMES}
    if any(digest(raw)!=manifest['files'][name] for name,raw in files.items()) or sum(map(len,files.values()))>2*1024**2:raise RuntimeError('local_entry_source_changed')
    return files


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--execution-closure');parser.add_argument('--execution-closure-sha256');parser.add_argument('--execute-reviewed-fixed-capacity-v2',action='store_true')
    args,remaining=parser.parse_known_args()
    if not args.execute_reviewed_fixed_capacity_v2:
        print('{"schema":"cpu0-local-execution-closure.v7","status":"prepared-only","hostOperations":0}');return 0
    folder=Path(__file__).resolve(strict=True).parent
    raw=stable(Path(args.execution_closure).resolve(strict=True))
    files=authenticate(folder,raw,args.execution_closure_sha256)
    sys.dont_write_bytecode=True
    if os.path.lexists('/root/goodwatch-qdrant-cold-406-20261011/authenticated-local-cpu0-v7'):raise RuntimeError('authenticated_namespace_not_absent')
    for name in MODULES:
        module=types.ModuleType(name)
        # Dependencies see only an absent fixed namespace, never the checkout
        # directory where an undeclared sibling could shadow a stdlib import.
        module.__file__='/root/goodwatch-qdrant-cold-406-20261011/authenticated-local-cpu0-v7/'+name+'.py'
        module._AUTHENTICATED_EXTERNAL_SOURCE_PATH=str(folder/(name+'.py'))
        module.__package__='';sys.modules[name]=module
        exec(compile(files[name+'.py'],str(folder/(name+'.py')),'exec'),module.__dict__)
        module._AUTHENTICATED_EXTERNAL_SHA256=hashlib.sha256(files[name+'.py']).hexdigest()
        module._AUTHENTICATED_LOCAL_CLOSURE_SHA256=args.execution_closure_sha256
    sys.argv=[str(folder/'outer_local_v2.py'),'--execute-reviewed-fixed-capacity-v2',*remaining]
    return sys.modules['outer_local_v2'].main()


if __name__=='__main__':raise SystemExit(main())
