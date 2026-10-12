"""Prepared CPU0 fixed operation orchestration. Root alone executes this source.

Packet bytes are public code/policies; private producer stdout never reaches a
file or this ledger. Every remote birth/receipt fact is independent of SSH exit.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import tempfile

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from packet import canonical,hash_value,sha
from rpc import Rpc
from private_pipe import stream,fixed_consumer_command
from reason_codes import REASONS

SCHEMA='cpu0-execution-packet.v6'


def handoff(value):
    if not isinstance(value,dict) or set(value)!={'schema','owner','previousSha256','snapshot','sha256'}:raise RuntimeError('outer_handoff_invalid')
    hash_value(value['sha256'])
    if sha(canonical({k:v for k,v in value.items() if k!='sha256'})+b'\n')!=value['sha256']:raise RuntimeError('outer_handoff_invalid')
    return value


def source_arguments(packet):
    return {key:packet[key] for key in ('sourceFreezeSha256','sourceFreeze','sourceFiles',
            'externalManifestSha256','derivativePolicySha256','priorPolicy','priorPolicySha256')}


def validated_admission(frame,previous,packet,contract_dir,validator_path):
    """Pure immutable public-code validation, complete dependency binding."""
    raw_manifest=base64.b64decode(packet['fullManifest'],validate=True)
    manifest=json.loads(raw_manifest)
    if sha(raw_manifest)!=packet['externalManifestSha256']:raise RuntimeError('outer_full_manifest_changed')
    observed={}
    for name in ('compare-contract-cpu0.mjs','compare-contract.mjs','parity.mjs'):
        path=Path(contract_dir)/name
        if path.resolve(strict=True)!=path:raise RuntimeError('outer_local_contract_changed')
        raw=path.read_bytes();info=path.stat()
        if len(raw)>262144 or sha(raw)!=manifest['files'][name]:raise RuntimeError('outer_local_contract_changed')
        observed[path]=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns)
    if sha(Path(validator_path).read_bytes())!=packet['admissionValidatorSha256']:raise RuntimeError('outer_admission_validator_changed')
    argv=['/usr/bin/node',str(validator_path),str(Path(contract_dir)/'compare-contract-cpu0.mjs'),
          manifest['files']['compare-contract-cpu0.mjs'],packet['sourceFreezeSha256'],packet['externalManifestSha256']]
    # No private payload, provider/models or executable consumer is imported.
    child=subprocess.run(argv,input=canonical({'frame':frame,'previous':previous}),
                         stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10,
                         env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'},check=False)
    if child.returncode!=0 or len(child.stdout)>262144:raise RuntimeError('outer_consumer_admission_refused')
    result=json.loads(child.stdout)
    for path,old in observed.items():
        info=path.stat()
        if (info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns)!=old:raise RuntimeError('outer_local_contract_changed')
    if not isinstance(result,dict) or set(result)!={'receipt','consumerBirth'}:raise RuntimeError('outer_consumer_admission_refused')
    return result


def audit_consumer(frames,previous,packet,*,absolute_deadline):
    """Offline reviewed consumer audit on public artifacts in a local temp dir.

    All imported code comes from the authenticated full packet; no executable
    consumer or Python backend runs here. The audit itself cannot prove cleanup.
    """
    remaining=absolute_deadline-time.monotonic()
    if remaining<=0:raise RuntimeError('outer_deadline')
    manifest_raw=base64.b64decode(packet['fullManifest'],validate=True)
    from stager import verify_full
    files={name:base64.b64decode(value,validate=True) for name,value in packet['fullFiles'].items()}
    verify_full(manifest_raw,packet['externalManifestSha256'],files,packet['sourceFreezeSha256'])
    with tempfile.TemporaryDirectory(prefix='gw-cpu0-public-audit-') as folder:
        root=Path(folder);root.chmod(0o700)
        for name,raw in files.items():
            path=root/name;path.write_bytes(raw);path.chmod(0o600)
        manifest=root/'cpu0-external-manifest.json';manifest.write_bytes(manifest_raw);manifest.chmod(0o600)
        rows=root/'consumer-output.ndjson';raw=b''.join(canonical(row)+b'\n' for row in frames if row.get('kind')!='producer-registration')
        if len(raw)>16*1024**2:raise RuntimeError('outer_consumer_audit_bound')
        rows.write_bytes(raw);rows.chmod(0o600)
        context=root/'audit-context.json';context.write_bytes(canonical({'initialHandoff':previous,
            'sourceFreezeSha256':packet['sourceFreezeSha256'],'externalManifestSha256':packet['externalManifestSha256']}));context.chmod(0o600)
        child=subprocess.run(['/usr/bin/node',str(root/'audit_cpu0.mjs'),str(rows),str(context),str(manifest),packet['externalManifestSha256'],str(root)],
            stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=min(10,remaining_budget(absolute_deadline)),env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'},check=False)
        if time.monotonic()>=absolute_deadline:raise RuntimeError('outer_deadline')
        if len(child.stdout)>262144:raise RuntimeError('outer_consumer_audit_bound')
        value=json.loads(child.stdout)
        if child.returncode!=0 or not isinstance(value,dict) or value.get('consumerPass') is not True:
            error=RuntimeError('outer_consumer_audit_refused');error.consumerAuditEvidence=value;raise error
        return value


def run(packet,rpc,emit,*,contract_dir,validator_path,raise_own_nofile):
    """No source mutation beyond reviewed setup/lifecycle/staging/handoff writes.

    No resumption after refusal; final cleanup observes the actual current
    handoff rather than assuming the last reported one is still current.
    """
    if packet.get('schema')!=SCHEMA or type(raise_own_nofile) is not bool:raise RuntimeError('outer_packet_invalid')
    arguments=source_arguments(packet);ledger=[];frames=[];primary=None
    registered_consumer=None;registered_producer=None;previous=None;transport=None;consumer_audit=None
    started=time.monotonic();absolute_deadline=started+7200
    def call(operation,values):
        if time.monotonic()-started>=7200:raise RuntimeError('outer_deadline')
        reply=rpc.call(operation,values,absolute_deadline=absolute_deadline)
        ledger.append(reply);emit({'kind':'external-operation','operation':operation,'receipt':reply})
        return reply['result']
    try:
        setup=call('setup',arguments);previous=handoff(setup['handoff'])
        preflight=call('preflight',{**arguments,'predecessorSha256':previous['sha256']})
        previous=handoff(preflight['handoff'])
        staged=call('stage',{**arguments,'predecessorSha256':previous['sha256'],
                             'fullFiles':packet['fullFiles'],'fullManifest':packet['fullManifest']})
        previous=handoff(staged['handoff'])
        turn=call('turnover',{**arguments,'predecessorSha256':previous['sha256']})
        terminal=[frame for frame in turn['frames'] if frame.get('stage')=='complete']
        if len(terminal)!=1:raise RuntimeError('outer_turnover_handoff_missing')
        previous=handoff(terminal[0]['handoff'])
        admitted=call('outer-admit',{**arguments,'predecessorSha256':previous['sha256'],
                                    'nodeReceiptSha256':staged['nodeReceiptSha256'],
                                    'fullFiles':packet['fullFiles'],'fullManifest':packet['fullManifest']})
        previous=handoff(admitted['handoff'])
        entry_previous=previous
        def validate(value):return validated_admission(value,entry_previous,packet,contract_dir,validator_path)
        def register_consumer(value,proof):
            nonlocal registered_consumer,previous
            previous=handoff(proof['receipt']['handoff'])
            registered_consumer=call('register-consumer',{**arguments,
                'predecessorSha256':previous['sha256'],'consumerBirth':proof['consumerBirth'],
                'consumerPredecessorSha256':entry_previous['sha256'],'raiseOwnNofile':raise_own_nofile})
            return registered_consumer
        def register_producer(value):
            nonlocal registered_producer
            if set(value)!={'kind','schema','authentication','registration','receiptSha256'} or value['schema']!='cpu0-producer-control.v6':raise RuntimeError('outer_producer_control_invalid')
            registered_producer=call('producer-confirm',{'registration':value['registration'],'receiptSha256':value['receiptSha256']})
            return registered_producer
        def producer_exit(value):
            if not isinstance(value,dict) or value.get('schema')!='cpu0-producer-completion.v6' or value.get('producerPrivateStreamCompleted') is not True or value.get('cliExitCode')!=0 or value.get('containerExitCode')!=0 or value.get('exitObserved') is not True or value.get('birthGone') is not True or value.get('privatePayloadPersisted') is not False:
                raise RuntimeError('outer_producer_exit_refused')
            if registered_producer is None or value.get('registration')!=registered_producer['registration']:raise RuntimeError('outer_producer_exit_refused')
            ledger.append({'operation':'producer-completion','result':value})
        def public(value):
            frames.append(value);emit(value)
        consumer=fixed_consumer_command(packet['sourceFreezeSha256'],packet['externalManifestSha256'],entry_previous['sha256'],raise_own_nofile=raise_own_nofile)
        transport=stream(consumer,rpc.command('producer-stream'),packet['sourceFreezeSha256'],packet['externalManifestSha256'],entry_previous['sha256'],public,
                         validate_admission=validate,register_consumer=register_consumer,register_producer=register_producer,
                         validate_producer_exit=producer_exit,producer_input=lambda:rpc.envelope('producer-stream',{'remainingSeconds':remaining_budget(absolute_deadline)}),absolute_deadline=absolute_deadline)
        remaining_budget(absolute_deadline)
        consumer_audit=audit_consumer(frames,entry_previous,packet,absolute_deadline=absolute_deadline)
        remaining_budget(absolute_deadline)
    except BaseException as error:
        primary=error
    finally:
        cleanup={}
        # Cleanup remains independent of producer credentials and any old
        # self-reported handoff; refusal cannot skip the other site census.
        for operation,values in (
            ('producer-cleanup',{}),
            ('cleanup',{**arguments,'consumerRegistrationSha256':registered_consumer.get('registrationSha256') if registered_consumer else None})):
            try:
                reply=rpc.call(operation,values,timeout=60);ledger.append(reply);cleanup[operation]={'observed':True,'result':reply['result'],'localClientExit':reply['localClientExit']}
            except BaseException as error:
                cleanup[operation]={'observed':False,'result':getattr(error,'remoteFailureEvidence',None),
                                    'localClientExit':getattr(error,'rpcExitEvidence',None),'stateUnknown':True}
        producer_cleanup=cleanup['producer-cleanup'].get('result') or {}
        bench_cleanup=cleanup['cleanup'].get('result') or {}
        consumer_cleanup=bench_cleanup.get('consumer') or {}
        prior=bench_cleanup.get('priorEvidence') or {}
        writers=((prior.get('writers') or {}).get('recordedWritersGone') is True and
                 (prior.get('currentWriters') or {}).get('recordedWritersGone') is True)
        all_registered_gone=bool(cleanup['producer-cleanup']['observed'] and cleanup['cleanup']['observed'] and producer_cleanup.get('containerGone') is True and producer_cleanup.get('birthGone') is True and (registered_consumer is None or consumer_cleanup.get('birthGone') is True) and writers and bench_cleanup.get('rootLockAvailable') is True)
        if primary is None and time.monotonic()>=absolute_deadline:primary=RuntimeError('outer_deadline')
        result={'schema':'cpu0-external-completion.v6','variant':'cpu0-owned-lifecycle.v1',
                'sourceFreezeSha256':packet['sourceFreezeSha256'],'externalManifestSha256':packet['externalManifestSha256'],
                'status':'completed' if primary is None and all_registered_gone else 'failed-or-cleanup-unknown',
                'failureReason':fixed_reason(primary) if primary else None,
                'remoteFailureEvidence':getattr(primary,'remoteFailureEvidence',None) if primary else None,
                'pipeFailurePhase':getattr(primary,'pipeFailurePhase',None) if primary else None,
                'pipeExitEvidence':getattr(primary,'pipeExitEvidence',None) if primary else None,
                'transport':transport,'frames':frames,'consumerAudit':consumer_audit,
                'consumerAuditFailure':getattr(primary,'consumerAuditEvidence',None) if primary else None,
                'operationLedger':ledger,'cleanup':cleanup,
                'allRegisteredLifecycleExitsProven':all_registered_gone,
                'unknownUnregisteredChildrenAbsentProven':False,'privatePayloadPersisted':False,
                'ordinarySearches':0,'historyWrites':0,'productionAcceptance':False}
        emit({'kind':'external-completion','receipt':result})
    return result


def fixed_reason(error):
    if error is None:return None
    value=error.args[0] if type(error) is RuntimeError and len(error.args)==1 else None
    return value if isinstance(value,str) and value in REASONS else 'outer_guard_or_runtime_failure'

def remaining_budget(deadline):
    remaining=deadline-time.monotonic()
    if remaining<=0:raise RuntimeError('outer_deadline')
    return min(7200,remaining)



def main():
    parser=argparse.ArgumentParser();parser.add_argument('--execute-reviewed',action='store_true')
    for name in ('packet','packet-sha256','contract-dir','validator','outer-sha256'):parser.add_argument('--'+name)
    parser.add_argument('--raise-own-nofile',action='store_true');args=parser.parse_args()
    if not args.execute_reviewed:
        print(json.dumps({'schema':'cpu0-external-completion.v6','status':'prepared-only','hostOperations':0}));return 0
    if globals().get('_AUTHENTICATED_EXTERNAL_SHA256')!=hash_value(args.outer_sha256):raise RuntimeError('outer_authenticated_entry_required')
    actual_source=globals().get('_AUTHENTICATED_EXTERNAL_SOURCE_PATH')
    if not isinstance(actual_source,str) or sha(Path(actual_source).read_bytes())!=args.outer_sha256:raise RuntimeError('outer_source_changed')
    raw=Path(args.packet).read_bytes()
    if len(raw)>8*1024**2 or sha(raw)!=hash_value(args.packet_sha256):raise RuntimeError('outer_packet_changed')
    packet=json.loads(raw)
    bootstrap=base64.b64decode(packet['bootstrap'],validate=True)
    closure={name:base64.b64decode(value,validate=True) for name,value in packet['closureFiles'].items()}
    rpc=Rpc(bootstrap,packet['bootstrapSha256'],closure,packet['closureSha256'])
    result=run(packet,rpc,lambda value:print(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False),flush=True),contract_dir=Path(args.contract_dir).resolve(strict=True),validator_path=Path(args.validator).resolve(strict=True),raise_own_nofile=args.raise_own_nofile)
    return 0 if result['status']=='completed' else 1


if __name__=='__main__':raise SystemExit(main())
