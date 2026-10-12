"""Real subprocess limits: fail before opening, explicit measure, retained-FD steady pin."""
import json
from pathlib import Path
import resource
import subprocess
import sys
import unittest
from unittest.mock import patch
import runtime
import pin

CHILD = r'''
import json, os, resource, sys
from unittest.mock import patch
import pin, runtime
from test_runtime import RuntimeTests
case=sys.argv[1]
test=RuntimeTests();test.setUp();test.nofile_patch.stop()
try:
    for i in range(60):
        path=test.fixture_path(('vector','graph','sparse','id_tracker','payload_index')[i%5]+f'-{i}.bin')
        path.write_bytes(b'x'*pin.PAGE);test.paths.append(path)
    test.write_maps(test.paths)
    _,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
    if case=='hard':hard=128
    resource.setrlimit(resource.RLIMIT_NOFILE,(32,hard))
    before=len(os.listdir('/proc/self/fd'));opened=[]
    original=runtime.Target.open
    def opening(*args,**kwargs):opened.append(1);return original(*args,**kwargs)
    with patch.object(runtime.Target,'open',side_effect=opening),patch.object(runtime,'accounting',return_value=test.memory):
        if case in ('default','hard'):
            try:runtime.measure_source(test.spec,raise_own_nofile=case=='hard')
            except RuntimeError as error:
                reason=pin.safe_reason(error)
            else:raise AssertionError('guard did not reject')
            assert reason==('own_nofile_hard_limit_insufficient' if case=='hard' else 'explicit_own_nofile_raise_required')
            assert len(opened)==0
            assert resource.getrlimit(resource.RLIMIT_NOFILE)==(32,hard)
            out={'reason':reason,'opened':0}
        else:
            measured=runtime.measure_source(test.spec,raise_own_nofile=True)
            assert sum(v['files'] for v in measured['classesMeasured'].values())==65
            manager=test.manager()
            manager.policy=pin.Policy('clone',128*pin.PAGE,0,16*pin.PAGE,8*pin.PAGE,cap_reserve_bytes=16*pin.PAGE,mapping_reserve_count=16)
            with patch.object(runtime,'prepare_self'):
                first=runtime.reconcile_source(manager,test.spec,source_check=runtime.inspect_source,raise_own_nofile=True)
                addresses={k:v.address for k,v in manager.mappings.items()}
                second=runtime.reconcile_source(manager,test.spec,source_check=runtime.inspect_source,raise_own_nofile=True)
                assert second['newLockBytes']==0
                assert addresses=={k:v.address for k,v in manager.mappings.items()}
                assert second['nofileLimits']['requiredSoft']>first['nofileLimits']['requiredSoft']
                manager.close()
            out={'measure':measured['nofileLimits'],'first':first['nofileLimits'],'steady':second['nofileLimits']}
            assert resource.getrlimit(resource.RLIMIT_NOFILE)[1]==hard
    assert len(os.listdir('/proc/self/fd'))==before
    print(json.dumps(out))
finally:test.doCleanups()
'''

class NofileTests(unittest.TestCase):
    def child(self,case):
        parent=resource.getrlimit(resource.RLIMIT_NOFILE)
        result=subprocess.run([sys.executable,'-B','-c',CHILD,case],cwd=Path(__file__).parent,text=True,capture_output=True,timeout=20)
        self.assertEqual(resource.getrlimit(resource.RLIMIT_NOFILE),parent)
        self.assertEqual(result.returncode,0,result.stderr)
        return json.loads(result.stdout)

    def test_default_fails_before_target_open_without_changing_limits(self):
        self.assertEqual(self.child('default')['opened'],0)

    def test_existing_hard_limit_cannot_be_increased(self):
        self.assertEqual(self.child('hard')['reason'],'own_nofile_hard_limit_insufficient')

    def test_explicit_measure_and_two_pin_passes_cover_overlapping_fds(self):
        out=self.child('explicit')
        for state in out.values():
            self.assertTrue(state['raised'])
            self.assertFalse(state['hardChanged'])
            self.assertEqual(state['softAfter'],state['requiredSoft'])
            self.assertLessEqual(state['requiredSoft'],40512)
        self.assertGreater(out['steady']['openFdCount'],out['first']['openFdCount'])

class NofileGuardTests(unittest.TestCase):
    def test_maximum_overlap_stays_bounded_and_preserves_hard(self):
        with patch.object(runtime.os,'listdir',return_value=[None]*20256), patch.object(runtime.resource,'getrlimit',side_effect=[(1024,1048576),(40512,1048576)]), patch.object(runtime.resource,'setrlimit') as setting:
            proof=runtime.ensure_inventory_nofile(True)
        setting.assert_called_once_with(resource.RLIMIT_NOFILE,(40512,1048576))
        self.assertEqual(proof['requiredSoft'],40512)

    def test_unbounded_existing_fds_or_failed_raise_keep_fixed_cause(self):
        with patch.object(runtime.os,'listdir',return_value=[None]*20257), patch.object(runtime.resource,'getrlimit',return_value=(1048576,1048576)), patch.object(runtime.resource,'setrlimit') as setting:
            with self.assertRaisesRegex(RuntimeError,'own_nofile_baseline_bound_exceeded'):runtime.ensure_inventory_nofile(True)
        setting.assert_not_called()
        with patch.object(runtime.os,'listdir',return_value=[None]*4), patch.object(runtime.resource,'getrlimit',return_value=(32,1048576)), patch.object(runtime.resource,'setrlimit',side_effect=OSError('private path')):
            with self.assertRaises(RuntimeError) as caught:runtime.ensure_inventory_nofile(True)
        self.assertEqual(pin.safe_reason(caught.exception),'own_nofile_raise_failed')

if __name__=='__main__':unittest.main()
