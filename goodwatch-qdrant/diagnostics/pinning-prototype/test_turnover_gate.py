import io
import unittest
from contextlib import ExitStack,redirect_stdout
from types import SimpleNamespace
from unittest.mock import Mock,patch
import turnover_gate as gate
from test_daemon import accounting

class GateTests(unittest.TestCase):
    def test_default_never_inspects_or_joins(self):
        with patch.object(gate,'stage') as execute,redirect_stdout(io.StringIO()) as output:
            self.assertEqual(gate.main([]),0)
        execute.assert_not_called();self.assertIn('prepared-only',output.getvalue())
    def run_stage(self,fresh=True,cleanup=True):
        source=SimpleNamespace(pid=10,identity=('container','image',10,100),cgroup_relative='/clone')
        new=SimpleNamespace(pid=11 if fresh else 10,identity=('container','image',11,101) if fresh else source.identity,cgroup_relative='/clone')
        first,second=Mock(),Mock()
        for child in (first,second):
            child.joined.return_value={'joined':True,'lockedBytes':0,'childPidPositive':True}
            child.gone.return_value={'childGone':True,'survivedGracePeriod':False,'exitCode':0,'queries':0,'lockedBytes':0}
        if not cleanup:first.gone.side_effect=RuntimeError('zero_child_exit_unproven')
        events=[];spec=SimpleNamespace(store=gate.control.ROOT/'store',container='owned')
        with ExitStack() as stack:
            for name in ('owned_store_files','owned_total_budget','host_available','frozen_helper'):
                stack.enter_context(patch.object(gate.control,name))
            stack.enter_context(patch.object(gate.control.ROOT.__class__,'resolve',lambda path:path))
            stack.enter_context(patch.object(gate.control,'self_cgroup',return_value='/parent'))
            stack.enter_context(patch.object(gate.control,'inspect_stopped_or_running',return_value={'State':{'Running':False}}))
            calls=stack.enter_context(patch.object(gate.control,'clone_command'))
            stack.enter_context(patch.object(gate.runtime,'inspect_source',side_effect=[source,source,new]))
            stack.enter_context(patch.object(gate,'ready',return_value=new))
            stack.enter_context(patch.object(gate.runtime,'accounting',side_effect=lambda source:accounting()))
            stack.enter_context(patch.object(gate,'ZeroChild',side_effect=[first,second]))
            gate.stage({},spec,SimpleNamespace(emergency_bytes=1,reserve_bytes=2,cap_reserve_bytes=1),events.append)
        return events,calls.call_args_list,first,second
    def test_two_join_protocols_and_cleanup_order(self):
        events,calls,first,second=self.run_stage()
        self.assertEqual([e['stage'] for e in events],['first-join','old-child-gone','second-join','complete'])
        self.assertEqual([call.args[0] for call in calls],['stop','start'])
        first.gone.assert_called_once_with(graceful=False);second.gone.assert_called_once_with()
        self.assertTrue(events[-1]['childGone']);self.assertEqual(events[-1]['archiveBytesRead'],0)
    def test_same_source_cannot_prove_turnover(self):
        with self.assertRaisesRegex(RuntimeError,'turnover_not_fresh'):self.run_stage(fresh=False)
    def test_missing_child_exit_blocks_restart(self):
        with self.assertRaisesRegex(RuntimeError,'zero_child_exit_unproven'):self.run_stage(cleanup=False)
    def test_zero_lock_proof_requires_present_counter(self):
        with patch.object(gate.Path,'read_text',return_value='VmRSS: 10 kB\n'):
            with self.assertRaisesRegex(RuntimeError,'zero_pin_proof_missing'):gate.locked_bytes(10)
        with patch.object(gate.Path,'read_text',return_value='VmLck: 1 kB\n'):
            self.assertEqual(gate.locked_bytes(10),1024)

if __name__=='__main__':unittest.main()
