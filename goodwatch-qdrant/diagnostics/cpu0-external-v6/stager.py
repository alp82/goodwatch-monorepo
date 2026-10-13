"""CPU0 full public staging, after a predecessor admission handoff."""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from packet import (SOURCE_NAMES, canonical, closed_json, directory, hash_value, metadata,
                    read_owned, sha, stage_absent, verify_source, verify_source_v2)

ROOT = Path('/root/goodwatch-qdrant-cold-406-20261011')
STAGE = ROOT/'pin-control-20261012-100-cpu0-v1'
ADMISSION = ROOT/'cpu0-admission-20261012-100-v1'
OLD_STAGE = ROOT/'pin-control-20261012-406-v1'
NODE_SHA = '7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c'
NODE_BYTES = 126595440
NODE_RECEIPT_SHA = 'db019f01b0b25d9d85062d65fecbe5d79a35c9bc7add1d972301b2cbb95973ef'
RECLAIM_SHA = 'f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5'
FULL_NAMES = SOURCE_NAMES | frozenset((
    'cpu0-source-freeze.json', 'helper-config.json', 'controller-config.json',
    'prepare_clone_reclaim.py', 'consumer_cpu0.mjs', 'compare-contract-cpu0.mjs',
    'audit_cpu0.mjs', 'transport_cpu0.mjs', 'compare-contract.mjs', 'parity.mjs'))


def verify_full(manifest_raw, expected_sha, files, source_sha):
    return _verify_full(manifest_raw,expected_sha,files,source_sha,
                        'cpu0-full-public-packet.v6','cpu0-owned-lifecycle.v1',False)


def verify_full_v2(manifest_raw, expected_sha, files, source_sha):
    return _verify_full(manifest_raw,expected_sha,files,source_sha,
                        'cpu0-full-public-packet.v7','cpu0-fixed-capacity.v2',True)


def _verify_full(manifest_raw, expected_sha, files, source_sha, schema, variant, successor):
    hash_value(expected_sha);hash_value(source_sha)
    if not isinstance(manifest_raw,bytes) or len(manifest_raw)>262144 or sha(manifest_raw)!=expected_sha:
        raise RuntimeError('external_manifest_changed')
    try:
        manifest=closed_json(manifest_raw) if successor else json.loads(manifest_raw)
    except (ValueError,UnicodeError,RecursionError):
        raise RuntimeError('external_manifest_invalid') from None
    if not isinstance(manifest,dict) or set(manifest)!={'schema','variant','sourceFreezeSha256','files'} or manifest['schema']!=schema or manifest['variant']!=variant or manifest['sourceFreezeSha256']!=source_sha or not isinstance(manifest['files'],dict) or set(manifest['files'])!=FULL_NAMES or not isinstance(files,dict) or set(files)!=FULL_NAMES:
        raise RuntimeError('external_manifest_invalid')
    for name in FULL_NAMES:
        hash_value(manifest['files'][name])
        if not isinstance(files[name],bytes) or len(files[name])>262144 or sha(files[name])!=manifest['files'][name]:
            raise RuntimeError('external_file_changed')
    if sum(map(len,files.values()))>2*1024**2:
        raise RuntimeError('external_packet_bound')
    verify=(verify_source_v2 if successor else verify_source)
    verify(files['cpu0-source-freeze.json'],source_sha,{name:files[name] for name in SOURCE_NAMES})
    if files['helper-config.json']!=files['prepared-helper-policy-cpu0.json'] or files['controller-config.json']!=files['prepared-control-policy-cpu0.json'] or sha(files['prepare_clone_reclaim.py'])!=RECLAIM_SHA:
        raise RuntimeError('external_policy_alias_changed')
    return manifest


def copy_node(stage, source=OLD_STAGE, uid=0, expected_sha=NODE_SHA,
              expected_bytes=NODE_BYTES, receipt_sha=NODE_RECEIPT_SHA):
    """One bounded stable FD copy; no original file is modified."""
    directory(source,uid);directory(stage,uid)
    receipt,_=read_owned(source/'node-provenance.json',uid=uid)
    if sha(receipt)!=receipt_sha:
        raise RuntimeError('node_provenance_changed')
    target=Path(stage)/'node';node=Path(source)/'node'
    if node.resolve(strict=True)!=node:
        raise RuntimeError('node_source_changed')
    info=node.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=uid or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o700 or info.st_size!=expected_bytes:
        raise RuntimeError('node_source_changed')
    fd=os.open(node,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC);out=None;owned=None
    try:
        if metadata(os.fstat(fd))!=metadata(info):raise RuntimeError('node_source_changed')
        out=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o700)
        a=os.fstat(out);owned=(a.st_dev,a.st_ino)
        h=hashlib.sha256();count=0
        while True:
            chunk=os.read(fd,1024**2)
            if not chunk:break
            count+=len(chunk)
            if count>expected_bytes:raise RuntimeError('node_source_changed')
            h.update(chunk);view=memoryview(chunk)
            while view:
                n=os.write(out,view)
                if n<=0:raise RuntimeError('node_copy_failed')
                view=view[n:]
        if count!=expected_bytes or h.hexdigest()!=expected_sha or metadata(os.fstat(fd))!=metadata(info) or metadata(node.lstat())!=metadata(info):
            raise RuntimeError('node_source_changed')
        os.fsync(out)
        value={'schema':'clone-node-copy-receipt.v1','nodeSha256':h.hexdigest(),
               'nodeBytes':count,'sourceReceiptSha256':receipt_sha,
               'targetDevice':owned[0],'targetInode':owned[1],'targetMode':0o700,
               'sourceStable':True,'sourceHostWrites':0,'cloneFilesCreated':2}
        return canonical(value)+b'\n',owned
    except BaseException as original:
        cleanup={'targetRetained':False,'cleanupFailed':False}
        if owned is not None:
            try:
                current=target.lstat()
                if (current.st_dev,current.st_ino)==owned:target.unlink()
                else:cleanup={'targetRetained':True,'cleanupFailed':True}
            except BaseException:cleanup={'targetRetained':os.path.lexists(target),'cleanupFailed':True}
        original.nodeCleanupEvidence=cleanup
        raise
    finally:
        os.close(fd)
        if out is not None:os.close(out)


def copy_node_v2(stage, source=OLD_STAGE, uid=0, expected_sha=NODE_SHA,
                 expected_bytes=NODE_BYTES, receipt_sha=NODE_RECEIPT_SHA):
    """Fresh copy receipt binding stable final timestamps for later launches.

    The v1 copy/receipt behavior remains unchanged. A v2 failure retains the
    newly copied owned file for separate review; it never rewrites old receipts.
    Failure inside the original copy retains its existing owned-file rollback.
    """
    target = Path(stage)/'node'
    try:
        receipt, identity = copy_node(stage, source, uid, expected_sha, expected_bytes, receipt_sha)
    except BaseException as error:
        cleanup=getattr(error,'nodeCleanupEvidence',None)
        error.nodeVerificationEvidence={'schema':'clone-node-v2-verification-failure.v2',
            'stage':'inner-copy','automaticRollback':True,'verificationPassed':False,
            'targetRetained':cleanup.get('targetRetained') if cleanup is not None else None,
            'innerCleanupEvidence':cleanup}
        raise
    try:
        return _verify_node_copy_v2(target,receipt,identity,uid,expected_sha,expected_bytes)
    except BaseException as error:
        retained=None
        try:
            info=target.lstat()
            if (info.st_dev,info.st_ino)==identity:retained=True
        except FileNotFoundError:retained=False
        except OSError:pass
        error.nodeVerificationEvidence={'schema':'clone-node-v2-verification-failure.v2',
            'stage':'post-copy-verification','automaticRollback':False,
            'verificationPassed':False,'targetRetained':retained,
            'retentionScope':'original-inode-at-created-path'}
        raise


def _verify_node_copy_v2(target,receipt,identity,uid,expected_sha,expected_bytes):
    before = target.lstat()
    def stable(info):
        return (*metadata(info), info.st_ctime_ns)
    if ((before.st_dev, before.st_ino) != identity or not stat.S_ISREG(before.st_mode)
            or before.st_uid != uid or before.st_nlink != 1
            or stat.S_IMODE(before.st_mode) != 0o700 or before.st_size != expected_bytes
            or target.resolve(strict=True) != target):
        raise RuntimeError('node_source_changed')
    fd = os.open(target, os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
    try:
        if stable(os.fstat(fd)) != stable(before):
            raise RuntimeError('node_source_changed')
        h = hashlib.sha256();count = 0
        while True:
            raw = os.read(fd, 1024**2)
            if not raw:break
            count += len(raw)
            if count > expected_bytes:raise RuntimeError('node_source_changed')
            h.update(raw)
        after = os.fstat(fd)
        if count != expected_bytes or h.hexdigest() != expected_sha or stable(after) != stable(before) or stable(target.lstat()) != stable(before):
            raise RuntimeError('node_source_changed')
        value = json.loads(receipt)
        value.update(schema='clone-node-copy-receipt.v2', targetMtimeNs=after.st_mtime_ns,
                     targetCtimeNs=after.st_ctime_ns)
        return canonical(value)+b'\n', identity
    finally:
        os.close(fd)


def stage_public(manifest_raw, external_sha, files, source_sha, lifecycle,
                 docker, lock_fd, predecessor_sha, admission, prior_census):
    """All gates run under the already-held owner's lock; no second flock.

    The lifecycle module itself must already be loaded from the authenticated
    admission closure. Census and admission are concrete reviewed implementations
    owned by the final execution packet, never supplied booleans.
    """
    verify_full(manifest_raw,external_sha,files,source_sha)
    if getattr(lifecycle,'_AUTHENTICATED_SOURCE_SHA256',None)!=sha(files['lifecycle_cpu0.py']):
        raise RuntimeError('lifecycle_freeze_changed')
    lifecycle.require_lock(lock_fd)
    lifecycle.read_handoff(docker,predecessor_sha)
    prior=prior_census()
    if not isinstance(prior,dict) or prior.get('recordedWritersGone') is not True:
        raise RuntimeError('prior_writer_evidence_unknown')
    before=admission()
    # The source must remain equal to the predecessor AFTER the admission reads.
    lifecycle.read_handoff(docker,predecessor_sha)
    public={**files,'cpu0-external-manifest.json':manifest_raw}
    staged=stage_absent(STAGE,public)
    # Further failures leave the exact created stage for owner-fenced review;
    # no automatic deletion after source or handoff uncertainty.
    try:
        node_receipt,node_identity=copy_node(STAGE)
        path=STAGE/'node-provenance.json'
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
        with os.fdopen(fd,'wb') as out:
            out.write(node_receipt);out.flush();os.fsync(out.fileno())
        # Verify all actual staged bytes before any future executable imports.
        for name,raw in public.items():
            observed,_=read_owned(STAGE/name)
            if observed!=raw:raise RuntimeError('staged_source_changed')
        final_prior=prior_census()
        if not isinstance(final_prior,dict) or final_prior.get('recordedWritersGone') is not True:
            raise RuntimeError('prior_writer_evidence_unknown')
        after=admission()
        dfd=os.open(STAGE,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        try:os.fsync(dfd)
        finally:os.close(dfd)
        handoff=lifecycle.commit_handoff(docker,predecessor_sha,'stager')
        return {'schema':'cpu0-full-stage-result.v6','variant':'cpu0-owned-lifecycle.v1',
                'sourceFreezeSha256':source_sha,'externalManifestSha256':external_sha,
                'nodeReceiptSha256':sha(node_receipt),'handoff':handoff,
                'admissionBefore':before,'admissionAfter':after,
                'publicFilesCreated':staged['filesCreated']+2,
                'nodeCopySourceHostWrites':0,'modelsRead':0,'queries':0}
    except BaseException as original:
        original.fullStageFailureEvidence={'stageRetained':os.path.lexists(STAGE),
                                          'handoffContinuationAllowed':False}
        raise


def verify_staged(manifest_raw,external_sha,files,source_sha,node_receipt_sha):
    """Before private capture, authenticate code, aliases and the actual Node FD."""
    verify_full(manifest_raw,external_sha,files,source_sha);directory(STAGE)
    allowed=FULL_NAMES|{'cpu0-external-manifest.json','node','node-provenance.json','pin-instance.lock'}
    for path in STAGE.iterdir():
        if path.name not in allowed and not (path.name.startswith('reclaim-writer-') and path.name.endswith('.json')):
            raise RuntimeError('staged_extra_entry')
    for name,content in {**files,'cpu0-external-manifest.json':manifest_raw}.items():
        raw,_=read_owned(STAGE/name)
        if raw!=content:raise RuntimeError('staged_source_changed')
    receipt_raw,_=read_owned(STAGE/'node-provenance.json')
    if sha(receipt_raw)!=node_receipt_sha:raise RuntimeError('node_provenance_changed')
    value=json.loads(receipt_raw);node=STAGE/'node';before=node.lstat()
    if value.get('schema')!='clone-node-copy-receipt.v1' or value.get('nodeSha256')!=NODE_SHA or value.get('nodeBytes')!=NODE_BYTES or value.get('sourceReceiptSha256')!=NODE_RECEIPT_SHA or (value.get('targetDevice'),value.get('targetInode'))!=(before.st_dev,before.st_ino) or not stat.S_ISREG(before.st_mode) or before.st_uid!=0 or before.st_nlink!=1 or stat.S_IMODE(before.st_mode)!=0o700 or before.st_size!=NODE_BYTES or node.resolve(strict=True)!=node:
        raise RuntimeError('node_source_changed')
    fd=os.open(node,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
    try:
        if metadata(os.fstat(fd))!=metadata(before):raise RuntimeError('node_source_changed')
        h=hashlib.sha256();count=0
        while True:
            raw=os.read(fd,1024**2)
            if not raw:break
            count+=len(raw)
            if count>NODE_BYTES:raise RuntimeError('node_source_changed')
            h.update(raw)
        if count!=NODE_BYTES or h.hexdigest()!=NODE_SHA or metadata(os.fstat(fd))!=metadata(before) or metadata(node.lstat())!=metadata(before):raise RuntimeError('node_source_changed')
    finally:os.close(fd)
    return {'schema':'cpu0-staged-source-proof.v6','sourceFreezeSha256':source_sha,
            'externalManifestSha256':external_sha,'nodeReceiptSha256':node_receipt_sha,
            'nodeSha256':NODE_SHA,'nodeBytes':NODE_BYTES,'codeFilesVerified':len(FULL_NAMES)+1}


if __name__=='__main__':
    print(json.dumps({'schema':'cpu0-full-stage-result.v6','status':'prepared-only',
                      'hostOperations':0,'executionPacketReady':False}))
