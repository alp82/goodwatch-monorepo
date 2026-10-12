"""Prepared atomic publication/rollback of owned helper files only; default no-op."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile

ROOT = Path('/opt/goodwatch-qdrant-pin')
TARGETS = {name:(ROOT/name,0o400) for name in ('pin.py','runtime.py','production.py','production_journal.py','production_service.py')}
TARGETS.update({'policy.json':(Path('/etc/goodwatch-qdrant-pin/policy.json'),0o600),
                'service.unit':(Path('/etc/systemd/system/goodwatch-qdrant-pin.service'),0o644),
                'service.env':(Path('/etc/default/goodwatch-qdrant-pin'),0o600)})
HASH = re.compile('[a-f0-9]{64}')


def sha(raw):return hashlib.sha256(raw).hexdigest()


def canonical_parent(path):
    parent=Path(path).parent
    if parent.resolve()!=parent or not parent.is_dir() or parent.stat().st_uid!=os.geteuid():raise ValueError('owned_target_parent_required')


def read_regular(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        info=os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_uid!=os.geteuid() or info.st_size>1024**2:raise ValueError('owned_regular_file_required')
        raw=os.read(fd,1024**2+1)
        if len(raw)!=info.st_size:raise ValueError('owned_file_changed')
        return raw,stat.S_IMODE(info.st_mode)
    finally:os.close(fd)


def current_hash(path):
    try:return sha(read_regular(path)[0])
    except FileNotFoundError:return None


def atomic(path,raw,mode):
    canonical_parent(path)
    fd,tmp=tempfile.mkstemp(prefix='.goodwatch-pin-',dir=Path(path).parent)
    try:
        os.fchmod(fd,mode)
        with os.fdopen(fd,'wb') as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
        os.replace(tmp,path)
        directory=os.open(Path(path).parent,os.O_RDONLY|os.O_DIRECTORY)
        try:os.fsync(directory)
        finally:os.close(directory)
    finally:
        try:os.unlink(tmp)
        except FileNotFoundError:pass


def inactive():
    result=subprocess.run(['/usr/bin/systemctl','is-active','goodwatch-qdrant-pin.service'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=5)
    if result.stdout.strip() not in (b'inactive',b'unknown',b'failed'):raise RuntimeError('helper_unit_not_inactive')


def publish(plan_path,expected_sha,backup_root,targets=TARGETS,check_inactive=inactive):
    raw,_=read_regular(plan_path)
    if not HASH.fullmatch(expected_sha or '') or sha(raw)!=expected_sha:raise ValueError('deployment_plan_changed')
    plan=json.loads(raw)
    if set(plan)!= {'schema','files'} or plan['schema']!='owned-pin-publication.v1' or set(plan['files'])!=set(targets):raise ValueError('explicit_owned_targets_required')
    candidate={};original={}
    for name,(target,mode) in targets.items():
        canonical_parent(target);item=plan['files'][name]
        if set(item)!= {'candidate','sha256','expectedCurrentSha256'}:raise ValueError('explicit_original_hash_required')
        source=Path(item['candidate'])
        if source.resolve()!=source or source.parent!=Path(plan_path).parent.resolve():raise ValueError('candidate_scope_changed')
        body,_=read_regular(source)
        try: prior=read_regular(target)
        except FileNotFoundError: prior=None
        prior_hash=None if prior is None else sha(prior[0])
        if not HASH.fullmatch(item['sha256'] or '') or sha(body)!=item['sha256'] or prior_hash!=item['expectedCurrentSha256']:raise ValueError('publication_source_changed')
        if name.endswith('.py'):compile(body,str(source),'exec')
        if name=='policy.json':json.loads(body)
        if name=='service.env' and not re.fullmatch(rb'(?:PIN_(?:CODE|POLICY|SERVICE)_SHA256=[a-f0-9]{64}\n){3}',body):raise ValueError('nonsecret_helper_environment_required')
        candidate[name]=body
        original[name]=prior
    check_inactive()
    backup_root=Path(backup_root);canonical_parent(backup_root)
    backup_root.mkdir(mode=0o700)
    receipt={'schema':'owned-pin-publication-receipt.v1','state':'prepared','files':{}}
    for name in targets:
        prior=original[name]
        if prior is not None:atomic(backup_root/(name+'.original'),prior[0],0o600)
        receipt['files'][name]={'originalSha256':None if prior is None else sha(prior[0]),'originalMode':None if prior is None else prior[1],'candidateSha256':sha(candidate[name])}
    atomic(backup_root/'receipt.json',(json.dumps(receipt,sort_keys=True)+'\n').encode(),0o600)
    # All originals/receipt exist durably before first target mutation. A torn
    # publication can be rolled back using the prepared receipt and hashes.
    for name,(target,mode) in targets.items():
        check_inactive()
        if current_hash(target)!=receipt['files'][name]['originalSha256']:raise ValueError('target_changed_during_publication')
        atomic(target,candidate[name],mode)
    receipt['state']='published'
    atomic(backup_root/'receipt.json',(json.dumps(receipt,sort_keys=True)+'\n').encode(),0o600)
    return {'state':'published','ownedFiles':len(targets),'receiptSha256':sha((backup_root/'receipt.json').read_bytes()),'servicesStarted':False}


def rollback(backup_root,targets=TARGETS,check_inactive=inactive):
    backup_root=Path(backup_root);raw,_=read_regular(backup_root/'receipt.json');receipt=json.loads(raw)
    if receipt.get('schema')!='owned-pin-publication-receipt.v1' or set(receipt.get('files',{}))!=set(targets):raise ValueError('owned_receipt_required')
    restores={}
    for name,(target,_mode) in targets.items():
        item=receipt['files'][name];current=current_hash(target)
        if current not in (item['originalSha256'],item['candidateSha256']):raise ValueError('rollback_would_replace_unrelated_edit')
        if item['originalSha256'] is not None:
            body,_=read_regular(backup_root/(name+'.original'))
            if sha(body)!=item['originalSha256']:raise ValueError('original_backup_changed')
            restores[name]=(body,item['originalMode'])
        else:restores[name]=None
    check_inactive()
    for name,(target,_mode) in targets.items():
        check_inactive()
        item=receipt['files'][name]
        if current_hash(target)==item['originalSha256']:continue
        if current_hash(target)!=item['candidateSha256']:raise ValueError('target_changed_during_rollback')
        if restores[name] is None:
            target.unlink();fd=os.open(target.parent,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(fd)
            finally:os.close(fd)
        else:atomic(target,*restores[name])
    receipt['state']='rolled-back'
    atomic(backup_root/'receipt.json',(json.dumps(receipt,sort_keys=True)+'\n').encode(),0o600)
    return {'state':'rolled-back','ownedFiles':len(targets),'servicesStarted':False,'evidenceRetained':True}



def guarded_publish(plan_path,expected_sha,backup_root,journal=None,guard=None):
    from publication_guard import ReleaseGuard
    guard=guard or ReleaseGuard(TARGETS,inactive,journal)
    with guard:
        return publish(plan_path,expected_sha,backup_root,targets=guard.targets,check_inactive=guard.check)


def guarded_rollback(backup_root,journal=None,guard=None):
    from publication_guard import ReleaseGuard
    guard=guard or ReleaseGuard(TARGETS,inactive,journal)
    with guard:
        return rollback(backup_root,targets=guard.targets,check_inactive=guard.check)


def main(argv=None):
    class Parser(argparse.ArgumentParser):
        def error(self,message):raise ValueError('invalid_arguments')
    p=Parser(description=__doc__);p.add_argument('--apply-reviewed',action='store_true');p.add_argument('--rollback',action='store_true')
    p.add_argument('--plan');p.add_argument('--plan-sha256');p.add_argument('--backup-dir')
    try:
        args=p.parse_args(argv)
        if not args.apply_reviewed:print(json.dumps({'event':'qdrant.pin-publication.prepared.v1','execution':False}));return 0
        # Guarded publication/release evidence is implemented separately, but
        # execution remains refused until root reviews those exact files.
        raise RuntimeError('live_holder_release_gate_not_integrated')
    except BaseException:
        print(json.dumps({'event':'qdrant.pin-publication.failed.v1','reason':'owned_publication_gate_failed','servicesStarted':False}));return 1


if __name__=='__main__':raise SystemExit(main())
