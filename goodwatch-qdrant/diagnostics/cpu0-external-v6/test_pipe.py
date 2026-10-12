import json
import subprocess
import sys
import unittest

import packet
import private_pipe


def admitted():
    h={'schema':'clone-lifecycle-handoff.cpu0.v1','owner':'preflight',
       'previousSha256':'c'*64,'snapshot':{'fixture':'public'}}
    h['sha256']=packet.sha(packet.canonical(h)+b'\n')
    return {'kind':'consumer-admission','variant':'cpu0-owned-lifecycle.v1',
            'sourceFreezeSha256':'a'*64,'externalManifestSha256':'b'*64,
            'handoff':h}


class PipeTests(unittest.TestCase):
    def run_pipe(self,consumer,producer):
        frames=[];calls=[]
        def spawn(argv,**kwargs):
            calls.append(argv)
            return subprocess.Popen(argv,**kwargs)
        result=private_pipe.stream([sys.executable,'-u','-c',consumer],
                                  [sys.executable,'-u','-c',producer],
                                  'a'*64,'b'*64,'c'*64,frames.append,validate_admission=lambda value:value,register_consumer=lambda value,proof:{"registeredBeforeCapture":True},register_producer=lambda value:{"registeredBeforeForwarding":True},validate_producer_exit=lambda value:None,spawn=spawn)
        return result,frames,calls

    def test_real_pipe_admission_before_capture_and_exit_fence(self):
        first=json.dumps(admitted())
        consumer="import sys,json\nsys.stdout.write("+repr(first[:40])+" );sys.stdout.flush()\nsys.stdout.write("+repr(first[40:]+'\n')+");sys.stdout.flush()\nraw=sys.stdin.buffer.read()\nrows=raw.splitlines()\nassert json.loads(rows[0])=={'kind':'private-batch','fixture':'private-fixture'}\nassert json.loads(rows[-1])=={'kind':'private-producer-complete','exitCode':0}\nprint(json.dumps({'kind':'complete','fixtureBytes':len(raw)}),flush=True)"
        result,frames,calls=self.run_pipe(consumer,"import json;print(json.dumps({'kind':'private-producer-registration'}));print(json.dumps({'kind':'private-batch','fixture':'private-fixture'}));print(json.dumps({'kind':'private-producer-exit-proof','proof':{'fixture':True}}))")
        self.assertEqual(len(calls),2);self.assertTrue(result['producerExitZeroBeforeCompletionMarker'])
        self.assertTrue(result['remoteCleanupRequired'])
        self.assertNotIn('private-fixture',json.dumps(frames))
        self.assertEqual(result['exits']['producer']['exitCode'],0)

    def test_admission_refusal_never_spawns_producer(self):
        calls=[]
        def spawn(argv,**kwargs):calls.append(argv);return subprocess.Popen(argv,**kwargs)
        with self.assertRaisesRegex(RuntimeError,'pipe_consumer_admission_invalid'):
            private_pipe.stream([sys.executable,'-u','-c',"print('{\"kind\":\"failed\"}',flush=True)"],
                                [sys.executable,'-c',"raise RuntimeError('must not spawn')"],
                                'a'*64,'b'*64,'c'*64,lambda value:None,validate_admission=lambda value:value,register_consumer=lambda value,proof:{"registeredBeforeCapture":True},register_producer=lambda value:{"registeredBeforeForwarding":True},validate_producer_exit=lambda value:None,spawn=spawn)
        self.assertEqual(len(calls),1)

    def test_partial_first_frame_never_starts_capture(self):
        calls=[]
        def spawn(argv,**kwargs):calls.append(argv);return subprocess.Popen(argv,**kwargs)
        with self.assertRaisesRegex(RuntimeError,'pipe_partial_public_frame'):
            private_pipe.stream([sys.executable,'-u','-c',"import sys;sys.stdout.write('{');sys.stdout.flush()"],
                                [sys.executable,'-c',"raise RuntimeError('must not spawn')"],
                                'a'*64,'b'*64,'c'*64,lambda value:None,validate_admission=lambda value:value,register_consumer=lambda value,proof:{"registeredBeforeCapture":True},register_producer=lambda value:{"registeredBeforeForwarding":True},validate_producer_exit=lambda value:None,spawn=spawn)
        self.assertEqual(len(calls),1)

    def test_nonzero_producer_has_no_completion_credit(self):
        consumer="import sys;print("+repr(json.dumps(admitted()))+",flush=True);sys.stdin.buffer.read()"
        with self.assertRaisesRegex(RuntimeError,'pipe_producer_exit_failed') as caught:
            self.run_pipe(consumer,"import sys,json;print(json.dumps({'kind':'private-producer-registration'}));print(json.dumps({'kind':'private-batch','fixture':'private-fixture'}));sys.exit(1)")
        evidence=caught.exception.pipeExitEvidence
        self.assertEqual(evidence['producer']['exitCode'],1)
        self.assertTrue(evidence['consumer']['observed'])
        self.assertIsNone(evidence['consumer']['remoteBirthGone'])


if __name__=='__main__':unittest.main()
