"""Real spawn/reap from exec-loaded python -c parent, no clone placement.

The gate bytes are immutable backend source; child placement/source checks are
explicit physical fixture modules which forbid mutation and attest own group.
This proves import/protocol composition, never the actual cgroup-join guard.
"""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import packet

GATE=Path('/home/alper/projects/search-100-evidence/cpu0-fixed-capacity-backend-review-v3-20261012/code/turnover_gate_cpu0.py')


class ExecLoadedZeroChildTests(unittest.TestCase):
    def test_actual_gate_spawn_from_exec_loaded_parent_joins_protocol_and_reaps(self):
        raw=GATE.read_bytes()
        self.assertEqual(packet.sha(raw),'17f4495253d3db84cb2218079d14cc614127068549f166f46184bdcb9a5278fc')
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'turnover_gate_cpu0.py').write_bytes(raw)
            (root/'controller_cpu0.py').write_text('def frozen_helper(config): assert config=={"localFixture":True}\ndef safe_control_reason(error): return "guard_or_runtime_failure"\ndef admission_failure(error): return {}\nclass Guards:\n def failure_evidence(self,error): return {}\ncpu0_guards=Guards()\n')
            (root/'daemon_cpu0.py').write_text('# Explicit unused fixture dependency\n')
            (root/'runtime_cpu0.py').write_text('from pathlib import Path\ndef validate_source_locally(source): return source.spec=="local-no-join"\ndef prepare_self(source,budget,source_check):\n assert budget==0 and source_check(source.spec)\n assert source.cgroup_relative==(Path("/proc/self/cgroup").read_text().strip().split(":",2)[2])\n')
            code='''import sys,types
from pathlib import Path
folder=Path(sys.argv[1]);sys.path.insert(0,str(folder))
raw=(folder/'turnover_gate_cpu0.py').read_bytes()
module=types.ModuleType('turnover_gate_cpu0');module.__file__=str(folder/'turnover_gate_cpu0.py');module.__package__=''
sys.modules['turnover_gate_cpu0']=module
exec(compile(raw,module.__file__,'exec'),module.__dict__)
source=types.SimpleNamespace(spec='local-no-join',cgroup_relative=Path('/proc/self/cgroup').read_text().strip().split(':',2)[2])
child=module.ZeroChild(source,{'localFixture':True})
try:
 assert child.process._start_method=='spawn'
 joined=child.joined(source);assert joined['joined'] and joined['lockedBytes']==0
finally:
 proof=child.gone()
assert proof['childGone'] and proof['exitCode']==0 and not proof['survivedGracePeriod']
print('actual-gate-spawn-protocol-reaped')
'''
            result=subprocess.run([sys.executable,'-I','-B','-c',code,str(root)],
                stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
            self.assertEqual(result.returncode,0,result.stderr.decode())
            self.assertEqual(result.stdout,b'actual-gate-spawn-protocol-reaped\n')
            self.assertEqual((root/'turnover_gate_cpu0.py').read_bytes(),raw)


if __name__=='__main__':unittest.main()
