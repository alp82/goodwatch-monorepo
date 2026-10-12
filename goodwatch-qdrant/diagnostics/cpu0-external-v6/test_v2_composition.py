"""Actual pure JS admission composition, public synthetic births, no hosts.

The packet uses inert backend fixtures and real reviewed JS bytes. No installed
process authority, backend execution, production input or cleanup is inferred.
"""
import base64
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

import outer_local_v2 as outer
import private_pipe_v2
import packet
import stager
import test_packet_v2

FROZEN_JS=Path('/home/alper/projects/search-100-evidence/cpu0-capacity-consumer-review-v3-20261012')
JS_HASHES={'audit_cpu0.mjs': 'dcd9c48b41653422af9bdcc32c0144d8fae9d8a5882af7b2db6e5bd8fac54fc1', 'compare-contract-cpu0.mjs': 'd818c289025a517fd2cf816b355aeb4ff24c4d741b11dc09565647adc8192794', 'compare-contract.mjs': '41c0e1fdf9f28a7d26032b8d95540b39bd441d6aafe5236bb89c82cfc4ef5b48', 'consumer_cpu0.mjs': 'a4a5a297a4ec0e9f1bf8a4ff65fb06b0e46754b98c973c49d707d72a4049b001', 'parity.mjs': '738c1e68af814a952ae7b54b101cb3921256142205b0a192b9869181580fc86e', 'transport_cpu0.mjs': '4e0d19d3f0cd1c1e9f837a5c1558e93081084ddd302d5f727a004393098ba5b5', 'test_capacity_cpu0.mjs': 'd15607e6934924200d156ec16414211203bcc8e555b52b441c503704f215b4d5', 'cpu0_consumer_fixture.mjs': 'ca5adcc6e455f24768112394a6930b5659bbc8df8e046d89992742a51bf1cfbd', 'cpu0_contract_fixture.mjs': '2760535d7a063717f8f531624153a0f5cdd9e4a081e79736ac2b18c9a3e44cfb'}


class PureAdmissionCompositionTests(unittest.TestCase):
    def setUp(self):
        self.folder=Path(self.enterContext(tempfile.TemporaryDirectory()))
        js={}
        for name,expected in JS_HASHES.items():
            source=FROZEN_JS/'source'/name
            if not source.exists():source=FROZEN_JS/'context'/name
            raw=source.read_bytes()
            self.assertEqual(packet.sha(raw),expected,'Frozen public JS dependency changed: '+name)
            js[name]=raw
            (self.folder/name).write_bytes(raw)
        full,_,_=test_packet_v2.SuccessorPacketTests().full()
        full['prepared-helper-policy-cpu0.json']=full['helper-config.json']=b'{"publicFixture":true}\n'
        config={'helperCodeSha256':'1'*64,'helperPolicySha256':packet.sha(full['helper-config.json'])}
        full['prepared-control-policy-cpu0.json']=full['controller-config.json']=packet.canonical(config)+b'\n'
        for name in ('compare-contract-cpu0.mjs','compare-contract.mjs','parity.mjs'):
            full[name]=js[name]
        source={'schema':'search.clone-cpu0-fixed-source-freeze.v2','variant':'cpu0-fixed-capacity.v2',
                'preparedOnly':True,'files':{name:packet.sha(full[name]) for name in packet.SOURCE_NAMES}}
        full['cpu0-source-freeze.json']=packet.canonical(source)+b'\n'
        source_sha=packet.sha(full['cpu0-source-freeze.json'])
        manifest={'schema':'cpu0-full-public-packet.v7','variant':'cpu0-fixed-capacity.v2',
                  'sourceFreezeSha256':source_sha,'files':{name:packet.sha(raw) for name,raw in full.items()}}
        manifest_raw=packet.canonical(manifest)+b'\n'
        validator=Path(__file__).parent/'validate_admission_v2.mjs'
        self.packet={'sourceFreezeSha256':source_sha,'externalManifestSha256':packet.sha(manifest_raw),
                     'fullManifest':base64.b64encode(manifest_raw).decode(),
                     'fullFiles':{name:base64.b64encode(raw).decode() for name,raw in full.items()},
                     'admissionValidatorSha256':packet.sha(validator.read_bytes())}
        self.validator=validator.resolve()
        for name in ('compare-contract-cpu0.mjs','compare-contract.mjs','parity.mjs'):
            (self.folder/name).write_bytes(full[name])
        # Reuse exact public constructors from the JS author's tests; no tests
        # or executable consumer are imported or launched by this fixture.
        helpers=js['test_capacity_cpu0.mjs'].decode().split('const GiB=',1)[1].split("test('ABI2",1)[0]
        helpers='const GiB='+helpers
        helpers='\n'.join(line for line in helpers.splitlines() if not line.startswith('const allPackets='))
        expected={'sourceFreezeSha256':source_sha,'externalManifestSha256':self.packet['externalManifestSha256'],
                  'adoptionIntentSha256':'1'*64,'helperCodeSha256':config['helperCodeSha256'],
                  'helperPolicySha256':config['helperPolicySha256'],
                  'controllerPolicySha256':packet.sha(full['controller-config.json']),
                  'nodeProvenanceSha256':'6'*64}
        code=f"import crypto from 'node:crypto';import * as contract from {json.dumps((self.folder/'compare-contract-cpu0.mjs').as_uri())};import {{admission,prior}} from {json.dumps((self.folder/'cpu0_consumer_fixture.mjs').as_uri())};\n"+helpers+"\n"+f"const context={json.dumps(expected)};"+"""
const previous=v2Handoff(),sample=v2Admission();sample.target=previous.snapshot.newRunning;
sample.sourceIdentity[2]=sample.target.qdrant.pid;sample.sourceIdentity[3]=sample.target.qdrant.startTicks;
const enrolled=enrolmentFixture({...context,consumerPredecessorSha256:previous.sha256},sample.target);
const frame={kind:'consumer-admission',schema:'search.clone-cpu0-preflight.v2',variant:'cpu0-fixed-capacity.v2',birthAdmission:sample,handoff:v2Handoff('preflight',previous.sha256),sourceIdentity:sample.sourceIdentity,queries:0,resourceWrites:0,handoffWrites:1,enrolmentWrites:1,modelsRead:0,consumerBirth:enrolled.consumer.identity,consumerEnrolment:enrolled,consumerEnrolmentSha256:contract.canonicalHash(enrolled),preflightExit:{observed:true,exitCode:0,signal:null,birthGone:true},sourceFreezeSha256:context.sourceFreezeSha256,externalManifestSha256:context.externalManifestSha256,productionAcceptance:false};
contract.validateAdmissionFrameV2(frame,previous,context);
console.log(JSON.stringify({frame,previous,context}));
"""
        child=subprocess.run(['/usr/bin/node','--input-type=module','-e',code],stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,timeout=10,check=False)
        self.assertEqual(child.returncode,0,child.stderr.decode())
        fixture=json.loads(child.stdout);self.frame=fixture['frame'];self.previous=fixture['previous'];self.expected=fixture['context']

    def validate(self):
        return outer.validated_admission(self.frame,self.previous,self.packet,self.folder,self.validator,
                                        node_receipt_sha=self.expected['nodeProvenanceSha256'])

    def test_real_python_wrapper_and_real_v2_validator_accept_all_independent_bindings(self):
        result=self.validate()
        self.assertEqual(result['consumerBirth'],self.frame['consumerBirth'])
        self.assertEqual(result['receipt']['consumerEnrolmentSha256'],self.frame['consumerEnrolmentSha256'])
        self.assertEqual(result['preflightExit'],self.frame['preflightExit'])

    def test_missing_old_context_and_wrong_staging_receipt_refuse(self):
        old={'sourceFreezeSha256':self.expected['sourceFreezeSha256'],
             'externalManifestSha256':self.expected['externalManifestSha256'],
             'adoptionIntentSha256':self.expected['adoptionIntentSha256']}
        argv=['/usr/bin/node',str(self.validator),str(self.folder/'compare-contract-cpu0.mjs'),
              packet.sha((self.folder/'compare-contract-cpu0.mjs').read_bytes()),
              self.packet['sourceFreezeSha256'],self.packet['externalManifestSha256']]
        child=subprocess.run(argv,input=packet.canonical({'frame':self.frame,'previous':self.previous,'expected':old}),
                             stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10)
        self.assertEqual(child.returncode,1)
        with self.assertRaisesRegex(RuntimeError,'outer_consumer_admission_refused'):
            outer.validated_admission(self.frame,self.previous,self.packet,self.folder,self.validator,node_receipt_sha='9'*64)

    def test_real_v2_pipe_composes_full_pure_admission_before_capture(self):
        frames=[];events=[]
        consumer="import sys,json;print("+repr(json.dumps(self.frame))+",flush=True);rows=[json.loads(row) for row in sys.stdin.buffer.read().splitlines()];assert rows==[{'kind':'private-batch','fixture':'private-local-only'},{'kind':'private-producer-complete','exitCode':0}];print('{\"kind\":\"complete\"}',flush=True)"
        producer="import json;print('{\"kind\":\"private-producer-registration\"}',flush=True);print('{\"kind\":\"private-batch\",\"fixture\":\"private-local-only\"}',flush=True);print('{\"kind\":\"private-producer-exit-proof\",\"proof\":{\"fixture\":true}}',flush=True)"
        producer_argv=[sys.executable,'-u','-c',producer]
        def spawn(argv,**kwargs):
            if argv==producer_argv:events.append('producer-spawn')
            return subprocess.Popen(argv,**kwargs)
        def validate(frame):
            events.append('actual-pure-validator')
            return outer.validated_admission(frame,self.previous,self.packet,self.folder,self.validator,node_receipt_sha=self.expected['nodeProvenanceSha256'])
        def register(frame,proof):
            self.assertEqual(proof['preflightExit'],self.frame['preflightExit'])
            events.append('synthetic-registration')
            return {'registeredBeforeCapture':True}
        result=private_pipe_v2.stream([sys.executable,'-u','-c',consumer],producer_argv,
            self.packet['sourceFreezeSha256'],self.packet['externalManifestSha256'],self.previous['sha256'],
            frames.append,validate_admission=validate,register_consumer=register,
            register_producer=lambda value:{'registeredBeforeForwarding':True},
            validate_producer_exit=lambda value:self.assertEqual(value,{'fixture':True}),spawn=spawn)
        self.assertEqual(events,['actual-pure-validator','synthetic-registration','producer-spawn'])
        self.assertEqual(result['exits']['producer']['exitCode'],0)
        self.assertTrue(result['producerExitZeroBeforeCompletionMarker'])
        self.assertNotIn('private-local-only',json.dumps(frames))
        self.assertIsNone(result['exits']['consumer']['remoteBirthGone'])

    def test_offline_audit_context_retains_independent_node_and_intent(self):
        def audit(argv,**kwargs):
            context=json.loads(Path(argv[3]).read_bytes())
            self.assertEqual(context['nodeProvenanceSha256'],self.expected['nodeProvenanceSha256'])
            self.assertEqual(context['adoptionIntentSha256'],self.previous['adoptionIntentSha256'])
            self.assertEqual(context['helperPolicySha256'],self.expected['helperPolicySha256'])
            return subprocess.CompletedProcess(argv,1,b'{"consumerPass":false,"reason":"synthetic-no-pairs"}')
        with mock.patch.object(outer.subprocess,'run',side_effect=audit):
            with self.assertRaisesRegex(RuntimeError,'outer_consumer_audit_refused'):
                outer.audit_consumer([self.frame],self.previous,self.packet,absolute_deadline=time.monotonic()+20,
                                     node_receipt_sha=self.expected['nodeProvenanceSha256'])


if __name__=='__main__':unittest.main()
