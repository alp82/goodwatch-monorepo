"""Prepare bounded public v2 packets locally; no remote execution authority.

Expected source and consumer manifest digests are explicit immutable-review
inputs. Preparation never substitutes its own newly computed expected digest.
"""
import argparse
import base64
import os
from pathlib import Path
import sys

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bootstrap_v2
import local_entry_v2
import running_adoption
from packet import SOURCE_NAMES,canonical,closed_json,hash_value,sha,verify_source_v2
from stager import verify_full_v2,RECLAIM_SHA
from census import validate_prior_policy

JS_NAMES=frozenset(('consumer_cpu0.mjs','compare-contract-cpu0.mjs',
                   'audit_cpu0.mjs','transport_cpu0.mjs','compare-contract.mjs','parity.mjs'))


def read(path):
    return local_entry_v2.stable(Path(path).absolute())


def consumer_files(folder,manifest_raw,expected_sha):
    hash_value(expected_sha)
    if type(manifest_raw)is not bytes or len(manifest_raw)>65536 or sha(manifest_raw)!=expected_sha:
        raise RuntimeError('consumer_freeze_changed')
    value=closed_json(manifest_raw)
    if (type(value)is not dict or set(value)!={'schema','files'}
            or value['schema']!='cpu0-consumer-source-closure.v2'
            or type(value['files'])is not dict or set(value['files'])!=JS_NAMES):
        raise RuntimeError('consumer_freeze_invalid')
    for expected in value['files'].values():hash_value(expected)
    files={name:read(Path(folder)/name) for name in JS_NAMES}
    if any(sha(raw)!=value['files'][name] for name,raw in files.items()):
        raise RuntimeError('consumer_source_changed')
    return files


def build(source,consumer,reclaim,external,prior,*,source_sha,
          consumer_manifest,consumer_manifest_sha,failed_recovery,memory_observation):
    hash_value(source_sha)
    source=Path(source).resolve(strict=True)
    external=Path(external).resolve(strict=True)
    backend={name:read(source/name) for name in SOURCE_NAMES}
    raw_source=read(source/'cpu0-source-freeze.json')
    verify_source_v2(raw_source,source_sha,backend)
    running_adoption.proofs.observations(failed_recovery,memory_observation)
    prior=validate_prior_policy(prior)
    helper=read(reclaim)
    if sha(helper)!=RECLAIM_SHA:raise RuntimeError('external_reclaim_source_changed')
    full={**backend,'cpu0-source-freeze.json':raw_source,
          'helper-config.json':backend['prepared-helper-policy-cpu0.json'],
          'controller-config.json':backend['prepared-control-policy-cpu0.json'],
          'prepare_clone_reclaim.py':helper,
          **consumer_files(consumer,consumer_manifest,consumer_manifest_sha)}
    manifest_raw=canonical({'schema':'cpu0-full-public-packet.v7',
        'variant':'cpu0-fixed-capacity.v2','sourceFreezeSha256':source_sha,
        'files':{name:sha(raw) for name,raw in full.items()}})+b'\n'
    verify_full_v2(manifest_raw,sha(manifest_raw),full,source_sha)
    local={name:read(external/name) for name in local_entry_v2.NAMES}
    closure={name:local[name] for name in bootstrap_v2.NAMES}
    if sum(map(len,closure.values()))>2*1024**2 or sum(map(len,local.values()))>2*1024**2:
        raise RuntimeError('packet_closure_bound')
    closure_raw=canonical({'schema':'cpu0-ssh-closure.v7',
        'files':{name:sha(raw) for name,raw in closure.items()}})+b'\n'
    local_raw=canonical({'schema':'cpu0-local-execution-closure.v7',
        'files':{name:sha(raw) for name,raw in local.items()}})+b'\n'
    encode=lambda raw:base64.b64encode(raw).decode('ascii')
    packet={'schema':'cpu0-execution-packet.v7','sourceFreezeSha256':source_sha,
        'sourceFreeze':encode(raw_source),'sourceFiles':{name:encode(raw) for name,raw in backend.items()},
        'fullManifest':encode(manifest_raw),'fullFiles':{name:encode(raw) for name,raw in full.items()},
        'externalManifestSha256':sha(manifest_raw),
        'consumerSourceClosureSha256':consumer_manifest_sha,
        'derivativePolicySha256':sha(running_adoption.derivative_policy(
            backend['prepared-control-policy-cpu0.json'],sha(backend['prepared-control-policy-cpu0.json']))),
        'priorPolicy':prior,'priorPolicySha256':sha(canonical(prior)),
        'bootstrap':encode(local['bootstrap_v2.py']),'bootstrapSha256':sha(local['bootstrap_v2.py']),
        'closureFiles':{name:encode(raw) for name,raw in closure.items()},'closureSha256':sha(closure_raw),
        'admissionValidatorSha256':sha(local['validate_admission_v2.mjs']),
        'localExecutionClosureSha256':sha(local_raw),'initialMode':running_adoption.MODE,
        'adoptionProof':{'mode':running_adoption.MODE,'failedRecovery':encode(failed_recovery),
            'memoryObservation':encode(memory_observation),
            'failedRecoverySha256':running_adoption.proofs.FAILURE_SHA,
            'memoryObservationSha256':running_adoption.proofs.MEMORY_SHA}}
    raw=canonical(packet)+b'\n'
    if len(raw)>8*1024**2:raise RuntimeError('packet_input_bound')
    return raw,local_raw


def absent(path,raw):
    """Retain any partial publication; never overwrite or roll back."""
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
    with os.fdopen(fd,'wb') as out:
        out.write(raw);out.flush();os.fsync(out.fileno())
    parent=os.open(Path(path).parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
    try:os.fsync(parent)
    finally:os.close(parent)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--prepare-reviewed-public-packet',action='store_true')
    for name in ('source-dir','source-sha256','consumer-dir','consumer-manifest',
                 'consumer-manifest-sha256','reclaim-helper','external-dir','prior-policy',
                 'failed-recovery','memory-observation','output','local-execution-closure'):
        parser.add_argument('--'+name)
    args=parser.parse_args()
    if not args.prepare_reviewed_public_packet:
        print('{"schema":"cpu0-execution-packet.v7","status":"prepared-only","hostOperations":0}')
        return 0
    raw,local_raw=build(args.source_dir,args.consumer_dir,args.reclaim_helper,args.external_dir,
        closed_json(read(args.prior_policy)),source_sha=args.source_sha256,
        consumer_manifest=read(args.consumer_manifest),consumer_manifest_sha=args.consumer_manifest_sha256,
        failed_recovery=read(args.failed_recovery),memory_observation=read(args.memory_observation))
    absent(Path(args.output),raw)
    absent(Path(args.local_execution_closure),local_raw)
    print(canonical({'schema':'cpu0-execution-packet.v7','packetSha256':sha(raw),
        'localExecutionClosureSha256':sha(local_raw),'publicLocalFilesCreated':2,'hostOperations':0}).decode())
    return 0


if __name__=='__main__':raise SystemExit(main())
