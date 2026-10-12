"""Public real-process schema regression using normal production cleanup bounds."""
import json,signal,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[3]/'goodwatch-qdrant/diagnostics/pinning-prototype'))
sys.path.insert(0,str(HERE/'launcher-v2'))
import production,runtime,zero_placement as zero
import stage_and_run as outer


def actual_child(connection,spec,digest):
    # Only the unavailable foreign-cgroup boundary is mocked. The reviewed
    # spawned child, owned PIDfd, pipe ACK, close, TERM/KILL and reap are real.
    with patch.object(runtime,'prepare_self'),patch.object(runtime,'validate_source_locally',side_effect=lambda source:source):
        zero.child(connection,spec,digest)


class PublicSchemaTests(unittest.TestCase):
    def test_actual_normal_cleanup_shapes_match_strict_public_schema(self):
        with tempfile.TemporaryDirectory()as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),production.own_group(),spec)
            rows=[];workers=[]
            def factory(_target,args):
                worker=production.Holder(actual_child,args) # actual default: 5s
                self.assertEqual(worker.cleanup_seconds,5)
                workers.append(worker);return worker
            with patch.object(zero,'limits',return_value={}):
                zero.run({},spec,lambda _:True,rows.append,worker_factory=factory,check_source=lambda *_:source,poll=.01)
            exits=[row for row in rows if row['phase']=='exited']
            self.assertEqual([(row['mode'],row['exitCode'])for row in exits],[('close',0),('term',-signal.SIGTERM),('kill',-signal.SIGKILL)])
            self.assertTrue(exits[0]['gracefulReleaseAcknowledged'])
            self.assertTrue(all(row['holderExited']is True and row['released']is True for row in exits))
            for row in rows:outer.public_frame(json.dumps({'event':'qdrant.zero-placement.v1','at':'2026-10-12T08:32:20Z',**row}))
            for malformed in (1,0,None,'true'):
                row={'event':'qdrant.zero-placement.v1','at':'2026-10-12T08:32:20Z',**exits[0],'holderExited':malformed}
                self.assertRaisesRegex(RuntimeError,'invalid_public_frame',outer.public_frame,json.dumps(row))
            self.assertTrue(all(not worker.alive_owned()for worker in workers))
if __name__=='__main__':unittest.main()
