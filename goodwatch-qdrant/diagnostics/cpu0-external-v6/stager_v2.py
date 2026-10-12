"""Closed successor staging and installed Node verification; no v1 rebind."""
import os
import stat

from packet import (closed_json, directory, hash_value, read_owned, sha,
                    stage_absent_once, _v2_inventory)
import running_adoption as adoption
import stager

NODE_KEYS=frozenset(('schema','nodeSha256','nodeBytes','sourceReceiptSha256',
    'targetDevice','targetInode','targetMode','sourceStable','sourceHostWrites',
    'cloneFilesCreated','targetMtimeNs','targetCtimeNs'))


def publish_node_receipt(raw,uid=0):
    """One fixed O_EXCL receipt; retain original failure and partial evidence."""
    path=adoption.STAGE/'node-provenance.json'
    if type(raw)is not bytes or not 0<len(raw)<=65536:
        raise RuntimeError('node_provenance_changed')
    directory(adoption.STAGE,uid=uid)
    evidence={'fileCreated':False,'writeCompleted':False,'fileFsyncCompleted':False,
              'directoryFsyncCompleted':False,'descriptorCloseFailed':False,
              'continuationAllowed':False}
    fd=None;primary=None
    try:
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
        evidence['fileCreated']=True
        info=os.fstat(fd)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid!=uid or info.st_nlink!=1
                or stat.S_IMODE(info.st_mode)!=0o600):
            raise RuntimeError('node_provenance_changed')
        pending=memoryview(raw)
        while pending:
            written=os.write(fd,pending)
            if written<=0:raise RuntimeError('node_provenance_changed')
            pending=pending[written:]
        evidence['writeCompleted']=True
        os.fsync(fd);evidence['fileFsyncCompleted']=True
        dfd=os.open(adoption.STAGE,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        try:os.fsync(dfd);evidence['directoryFsyncCompleted']=True
        finally:os.close(dfd)
        actual,identity=read_owned(path,uid=uid)
        if actual!=raw or identity!=(info.st_dev,info.st_ino):
            raise RuntimeError('node_provenance_changed')
    except BaseException as error:
        primary=error
        evidence['fileRetained']=os.path.lexists(path)
        error.nodeReceiptPublicationEvidence=evidence.copy()
        raise
    finally:
        if fd is not None:
            try:os.close(fd)
            except BaseException as error:
                evidence['descriptorCloseFailed']=True
                evidence['fileRetained']=os.path.lexists(path)
                if primary is not None:primary.nodeReceiptPublicationEvidence=evidence.copy()
                else:
                    error.nodeReceiptPublicationEvidence=evidence.copy()
                    raise


def verify_staged(manifest_raw,external_sha,files,source_sha,node_receipt_sha):
    stager.verify_full_v2(manifest_raw,external_sha,files,source_sha)
    hash_value(node_receipt_sha)
    _v2_inventory(adoption.STAGE)
    for name,content in {**files,'cpu0-external-manifest.json':manifest_raw}.items():
        raw,_=read_owned(adoption.STAGE/name)
        if raw!=content:raise RuntimeError('staged_source_changed')
    raw,_=read_owned(adoption.STAGE/'node-provenance.json')
    if sha(raw)!=node_receipt_sha:raise RuntimeError('node_provenance_changed')
    try:
        value=closed_json(raw)
        if (type(value)is not dict or set(value)!=NODE_KEYS
                or value['schema']!='clone-node-copy-receipt.v2'
                or value['nodeSha256']!=stager.NODE_SHA
                or value['sourceReceiptSha256']!=stager.NODE_RECEIPT_SHA
                or value['nodeBytes']!=stager.NODE_BYTES
                or value['targetMode']!=0o700 or value['sourceStable']is not True
                or type(value['sourceHostWrites'])is not int or value['sourceHostWrites']!=0
                or type(value['cloneFilesCreated'])is not int or value['cloneFilesCreated']!=2
                or any(type(value[key])is not int or value[key]<=0 for key in
                       ('targetDevice','targetInode','nodeBytes','targetMtimeNs','targetCtimeNs'))):
            raise ValueError()
    except (ValueError,TypeError,KeyError,UnicodeError,RecursionError):
        raise RuntimeError('node_provenance_changed') from None
    identity=(value['targetDevice'],value['targetInode'])
    # A fresh full descriptor hash and ctime/mode/owner fence must reproduce
    # the existing receipt. No regenerated receipt is published or substituted.
    fresh,_=stager._verify_node_copy_v2(adoption.STAGE/'node',raw,identity,0,
                                      stager.NODE_SHA,stager.NODE_BYTES)
    if fresh!=raw:raise RuntimeError('node_source_changed')
    _v2_inventory(adoption.STAGE)
    return {'schema':'cpu0-staged-source-proof.v7','variant':'cpu0-fixed-capacity.v2',
            'sourceFreezeSha256':source_sha,'externalManifestSha256':external_sha,
            'nodeReceiptSha256':node_receipt_sha,'nodeSha256':stager.NODE_SHA,
            'nodeBytes':stager.NODE_BYTES,'codeFilesVerified':len(stager.FULL_NAMES)+1}


def stage_public(manifest_raw,external_sha,files,source_sha,lifecycle,docker,
                 lock_fd,predecessor_sha,admission,prior_census):
    """Callbacks are the frozen executor's concrete guards, never caller flags."""
    stager.verify_full_v2(manifest_raw,external_sha,files,source_sha)
    if getattr(lifecycle,'_AUTHENTICATED_SOURCE_SHA256',None)!=sha(files['lifecycle_cpu0.py']):
        raise RuntimeError('lifecycle_freeze_changed')
    lifecycle.require_lock(lock_fd)
    lifecycle.read_handoff(docker,predecessor_sha)
    prior=prior_census()
    if type(prior)is not dict or prior.get('recordedWritersGone')is not True:
        raise RuntimeError('prior_writer_evidence_unknown')
    before=admission()
    lifecycle.read_handoff(docker,predecessor_sha)
    staged=stage_absent_once(adoption.STAGE,
                            {**files,'cpu0-external-manifest.json':manifest_raw})
    try:
        receipt,_=stager.copy_node_v2(adoption.STAGE)
        publish_node_receipt(receipt)
        source_proof=verify_staged(manifest_raw,external_sha,files,source_sha,sha(receipt))
        final_prior=prior_census()
        if type(final_prior)is not dict or final_prior.get('recordedWritersGone')is not True:
            raise RuntimeError('prior_writer_evidence_unknown')
        after=admission()
        handoff=lifecycle.commit_handoff(docker,predecessor_sha,'stager')
        return {'schema':'cpu0-full-stage-result.v7','variant':'cpu0-fixed-capacity.v2',
                'sourceFreezeSha256':source_sha,'externalManifestSha256':external_sha,
                'nodeReceiptSha256':sha(receipt),'handoff':handoff,
                'admissionBefore':before,'admissionAfter':after,'stagedSourceProof':source_proof,
                'publicFilesCreated':staged['filesCreated']+2,
                'nodeCopySourceHostWrites':0,'modelsRead':0,'queries':0}
    except BaseException as error:
        error.fullStageFailureEvidence={'stageRetained':os.path.lexists(adoption.STAGE),
                                       'handoffContinuationAllowed':False}
        raise
