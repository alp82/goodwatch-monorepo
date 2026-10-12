"""V2 outer ordering with actual public pure validation and fake host authority.

RPC source/process/cleanup and offline pair outcomes are explicit stand-ins;
no actual adoption, capture, registered birth, clean release or PASS is proved.
"""
import copy
import unittest
from unittest import mock

import outer_local_v2 as outer
import packet
import running_adoption as adoption
import test_v2_composition


class V2OuterOrderingTests(unittest.TestCase):
    setUp=test_v2_composition.PureAdmissionCompositionTests.setUp

    def exercise(self,*,registration_refuses=False,preflight_gone=True):
        events=[];calls=[];frames=[];previous=None
        initial=copy.deepcopy(self.previous);admission=copy.deepcopy(self.frame)
        fixture_packet={**self.packet,'schema':'cpu0-execution-packet.v7','initialMode':adoption.MODE,
            'adoptionProof':{'public':'synthetic'},'closureSha256':'a'*64,
            'sourceFreeze':'synthetic','sourceFiles':{},'derivativePolicySha256':'d'*64,
            'priorPolicy':[],'priorPolicySha256':'e'*64}
        def chained(owner,prior=None):
            record={k:v for k,v in initial.items() if k!='sha256'}
            record.update(owner=owner,previousSha256=prior)
            return {**record,'sha256':packet.sha(packet.canonical(record)+b'\n')}
        def call(operation,arguments,**limits):
            nonlocal previous
            events.append(operation);calls.append((operation,copy.deepcopy(arguments)))
            if operation=='adopt-running-clone':previous=initial;result={'handoff':previous}
            elif operation in ('preflight','stage','turnover','outer-admit'):
                self.assertEqual(arguments['predecessorSha256'],previous['sha256'])
                if operation in ('turnover','outer-admit'):
                    self.assertEqual(arguments['nodeReceiptSha256'],self.expected['nodeProvenanceSha256'])
                    self.assertEqual(arguments['fullFiles'],fixture_packet['fullFiles'])
                previous=chained({'stage':'stager','outer-admit':'outer'}.get(operation,operation),previous['sha256'])
                result={'handoff':previous}
                if operation=='stage':result['nodeReceiptSha256']=self.expected['nodeProvenanceSha256']
                if operation=='turnover':result={'frames':[{'stage':'complete','handoff':previous}]}
            elif operation=='register-consumer':
                self.assertEqual(arguments['nodeReceiptSha256'],self.expected['nodeProvenanceSha256'])
                self.assertEqual(arguments['preflightExit'],admission['preflightExit'])
                self.assertEqual(arguments['consumerPredecessorSha256'],previous['sha256'])
                self.assertEqual(arguments['predecessorSha256'],admission['handoff']['sha256'])
                self.assertEqual(arguments['consumerEnrolmentSha256'],admission['consumerEnrolmentSha256'])
                if registration_refuses:raise RuntimeError('consumer_registration_changed')
                result={'registrationSha256':'8'*64,'registeredBeforeCapture':True}
            elif operation=='producer-confirm':result={'registration':{'fixture':True},'registeredBeforeForwarding':True}
            elif operation=='producer-cleanup':result={'containerGone':True,'birthGone':True}
            elif operation=='cleanup':result={'consumer':{'birthGone':True,'preflightBirthGone':preflight_gone},
                'priorEvidence':{'writers':{'recordedWritersGone':True},'currentWriters':{'recordedWritersGone':True}},'rootLockAvailable':True}
            else:raise AssertionError(operation)
            return {'schema':'cpu0-public-rpc.v7','operation':operation,'result':result,
                'localClientExit':{'observed':True,'exitCode':0,'signal':None,'remoteStateNotInferredFromSsh':True}}
        def stream(consumer,producer,source,external,predecessor,emit,**callbacks):
            self.assertEqual(predecessor,previous['sha256'])
            self.assertIn('--execute-reviewed-fixed-capacity-v2',consumer[-1])
            admission['handoff']=chained('preflight',predecessor)
            admission['consumerEnrolment']['consumerPredecessorSha256']=predecessor
            admission['consumerEnrolmentSha256']=packet.sha(packet.canonical(admission['consumerEnrolment'])+b'\n')
            events.append('pure-validation')
            proof=callbacks['validate_admission'](admission)
            callbacks['register_consumer'](admission,proof)
            events.append('synthetic-private-capture')
            callbacks['register_producer']({'kind':'private-producer-registration','schema':'cpu0-producer-control.v6',
                'authentication':{},'registration':{'fixture':True},'receiptSha256':'6'*64})
            callbacks['validate_producer_exit']({'schema':'cpu0-producer-completion.v6','producerPrivateStreamCompleted':True,
                'cliExitCode':0,'containerExitCode':0,'exitObserved':True,'birthGone':True,'privatePayloadPersisted':False,
                'registration':{'fixture':True}})
            emit(admission);return {'remoteCleanupRequired':True}
        def audit(rows,prior,given,*,absolute_deadline,node_receipt_sha):
            events.append('synthetic-offline-audit');self.assertEqual(node_receipt_sha,self.expected['nodeProvenanceSha256'])
            self.assertEqual(prior,previous);return {'consumerPass':True,'experimentPass':False,'fixtureOnly':True}
        rpc=mock.Mock();rpc.call.side_effect=call;rpc.command.return_value=['inert'];rpc.envelope.return_value=b'public'
        with mock.patch.object(outer,'stream',side_effect=stream),mock.patch.object(outer,'audit_consumer',side_effect=audit):
            result=outer.run(fixture_packet,rpc,frames.append,contract_dir=self.folder,validator_path=self.validator,
                             raise_own_nofile=False)
        return result,events,calls

    def test_v2_hash_bound_validation_registration_capture_audit_cleanup_order(self):
        result,events,calls=self.exercise()
        self.assertEqual(result['status'],'completed')
        self.assertEqual(events[:5],['adopt-running-clone','preflight','stage','turnover','outer-admit'])
        self.assertLess(events.index('pure-validation'),events.index('register-consumer'))
        self.assertLess(events.index('register-consumer'),events.index('synthetic-private-capture'))
        self.assertLess(events.index('synthetic-offline-audit'),events.index('producer-cleanup'))
        self.assertEqual(events[-2:],['producer-cleanup','cleanup'])
        self.assertFalse(result['unknownUnregisteredChildrenAbsentProven'])
        self.assertFalse(result['productionAcceptance'])

    def test_v2_registration_refusal_never_captures_or_resumes_and_both_cleanup_sites_run(self):
        result,events,calls=self.exercise(registration_refuses=True)
        self.assertEqual(result['status'],'failed-or-cleanup-unknown')
        self.assertNotIn('synthetic-private-capture',events)
        self.assertNotIn('synthetic-offline-audit',events)
        self.assertEqual(events[-2:],['producer-cleanup','cleanup'])
        self.assertEqual(events.count('adopt-running-clone'),1)

    def test_unknown_preflight_birth_after_cleanup_cannot_promote_completion(self):
        result,events,calls=self.exercise(preflight_gone=False)
        self.assertEqual(result['status'],'failed-or-cleanup-unknown')
        self.assertFalse(result['allRegisteredLifecycleExitsProven'])


if __name__=='__main__':unittest.main()
