"""Local-only public packet construction; never accesses remote hosts or secrets."""
import argparse
import base64
import json
from pathlib import Path
import os
import sys
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bootstrap
import local_entry
from packet import SOURCE_NAMES,canonical,sha,verify_source
from setup import derivative_admission_policy
from stager import FULL_NAMES,verify_full
from census import validate_prior_policy

SOURCE_SHA='00e523226e42ce10bca605f403c4e314f2e49fc55273b683a08e926c4a445108'
CONSUMER_FREEZE_SHA='4f44eab300c70c871d8629d73af8c2d56ca8e2af102d8ed4c390024943b00ee4'
JS_HASHES={
 'consumer_cpu0.mjs':'d2cf68e077e4a6d227abc84b3121b1426829d9f5c4e087245f21eeb6df10fcb6',
 'compare-contract-cpu0.mjs':'09c260c1b36658a1851b6f3cea1c7e75e719fbf27ac2f013f04f5b73038bcd90',
 'audit_cpu0.mjs':'120e435f11f8742685c9987d2678d9ad9889b1f58bb011d1e9b14fb9eb93696e',
 'transport_cpu0.mjs':'4e0d19d3f0cd1c1e9f837a5c1558e93081084ddd302d5f727a004393098ba5b5',
 'compare-contract.mjs':'41c0e1fdf9f28a7d26032b8d95540b39bd441d6aafe5236bb89c82cfc4ef5b48',
 'parity.mjs':'738c1e68af814a952ae7b54b101cb3921256142205b0a192b9869181580fc86e'}
JS_NAMES=frozenset(JS_HASHES)


def consumer_files(folder):
    files={name:(Path(folder)/name).read_bytes() for name in JS_NAMES}
    if any(sha(raw)!=JS_HASHES[name] for name,raw in files.items()):raise RuntimeError('consumer_source_changed')
    return files


def build(source,consumer,reclaim,external,prior):
    source=Path(source).resolve(strict=True);consumer=Path(consumer).resolve(strict=True);external=Path(external).resolve(strict=True)
    backend={name:(source/name).read_bytes() for name in SOURCE_NAMES}
    raw_source=(source/'cpu0-source-freeze.json').read_bytes();verify_source(raw_source,SOURCE_SHA,backend)
    prior=validate_prior_policy(prior)
    full={**backend,'cpu0-source-freeze.json':raw_source,
          'helper-config.json':backend['prepared-helper-policy-cpu0.json'],
          'controller-config.json':backend['prepared-control-policy-cpu0.json'],
          'prepare_clone_reclaim.py':Path(reclaim).read_bytes(),
          **consumer_files(consumer)}
    manifest_raw=canonical({'schema':'cpu0-full-public-packet.v6','variant':'cpu0-owned-lifecycle.v1','sourceFreezeSha256':SOURCE_SHA,'files':{name:sha(raw) for name,raw in full.items()}})+b'\n'
    verify_full(manifest_raw,sha(manifest_raw),full,SOURCE_SHA)
    closure={name+'.py':(external/(name+'.py')).read_bytes() for name in bootstrap.MODULES}
    closure_raw=canonical({'schema':'cpu0-ssh-closure.v6','files':{name:sha(raw) for name,raw in closure.items()}})+b'\n'
    local_raw=canonical({'schema':'cpu0-local-execution-closure.v6','files':{name:sha((external/name).read_bytes()) for name in local_entry.NAMES}})+b'\n'
    encode=lambda raw:base64.b64encode(raw).decode('ascii')
    packet={'schema':'cpu0-execution-packet.v6','sourceFreezeSha256':SOURCE_SHA,
            'sourceFreeze':encode(raw_source),'sourceFiles':{name:encode(raw) for name,raw in backend.items()},
            'fullManifest':encode(manifest_raw),'fullFiles':{name:encode(raw) for name,raw in full.items()},
            'externalManifestSha256':sha(manifest_raw),
            'derivativePolicySha256':sha(derivative_admission_policy(backend['prepared-control-policy-cpu0.json'],sha(backend['prepared-control-policy-cpu0.json']))),
            'priorPolicy':prior,'priorPolicySha256':sha(canonical(prior)),
            'bootstrap':encode((external/'bootstrap.py').read_bytes()),'bootstrapSha256':sha((external/'bootstrap.py').read_bytes()),
            'closureFiles':{name:encode(raw) for name,raw in closure.items()},'closureSha256':sha(closure_raw),
            'admissionValidatorSha256':sha((external/'validate_admission.mjs').read_bytes()),
            'localExecutionClosureSha256':sha(local_raw)}
    raw=canonical(packet)+b'\n'
    if len(raw)>8*1024**2:raise RuntimeError('packet_input_bound')
    return raw,local_raw


def absent(path,raw):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
    with os.fdopen(fd,'wb') as out:out.write(raw);out.flush();os.fsync(out.fileno())


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--prepare-reviewed-public-packet',action='store_true')
    for name in ('source-dir','consumer-dir','reclaim-helper','external-dir','prior-policy','output','local-execution-closure'):parser.add_argument('--'+name)
    args=parser.parse_args()
    if not args.prepare_reviewed_public_packet:
        print('{"schema":"cpu0-execution-packet.v6","status":"prepared-only","hostOperations":0}');return
    raw,local_raw=build(args.source_dir,args.consumer_dir,args.reclaim_helper,args.external_dir,json.loads(Path(args.prior_policy).read_bytes()))
    absent(Path(args.output),raw);absent(Path(args.local_execution_closure),local_raw)
    print(json.dumps({'schema':'cpu0-execution-packet.v6','packetSha256':sha(raw),
                      'localExecutionClosureSha256':sha(local_raw),'publicLocalFilesCreated':2,'hostOperations':0}))


if __name__=='__main__':main()
