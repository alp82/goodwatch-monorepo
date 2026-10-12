import copy
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
import cpu0_guards as g
import daemon_cpu0 as daemon

class GuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.cg=self.root/'parent'/'source';self.cg.mkdir(parents=True)
        self.policy={'periodMicros':100000,'weight':100,'cpusetCpus':'','cpusetMems':''}
        self.source=SimpleNamespace(cgroup=self.cg)
        for p in (self.cg,self.cg.parent):
            (p/'cpu.max').write_text('max 100000\n');(p/'cpu.stat').write_text('nr_throttled 0\nthrottled_usec 0\n')
        (self.root/'cpu.stat').write_text('usage_usec 1\nuser_usec 1\nsystem_usec 0\n')
        for key,value in [('cpu.weight','100'),('cpuset.cpus',''),('cpuset.mems','')]: (self.cg/key).write_text(value)
    def test_root_only_not_applicable(self):
        state=g.source_cpu(self.source,self.policy,self.root)
        self.assertIsNone(state['rows'][-1]['nrThrottled'])
        self.assertEqual(g.cpu_delta(state,copy.deepcopy(state))[-1]['applicability'],'hierarchy-root-no-bandwidth-controller')
    def test_missing_nonroot_refuses(self):
        (self.cg.parent/'cpu.stat').write_text('usage_usec 4\n')
        with self.assertRaisesRegex(RuntimeError,'cpu_metric_missing'):g.source_cpu(self.source,self.policy,self.root)
    def test_finite_ancestor_refuses(self):
        (self.cg.parent/'cpu.max').write_text('200000 100000')
        with self.assertRaisesRegex(RuntimeError,'ancestor_cpu_quota_present'):g.source_cpu(self.source,self.policy,self.root)
    def test_source_quota_not_docker_assumption(self):
        (self.cg/'cpu.max').write_text('200000 100000')
        with self.assertRaisesRegex(RuntimeError,'source_cpu_quota_changed'):g.source_cpu(self.source,self.policy,self.root)
    def test_root_usage_required(self):
        (self.root/'cpu.stat').unlink()
        with self.assertRaisesRegex(RuntimeError,'cpu_metric_missing'):g.source_cpu(self.source,self.policy,self.root)
    def test_actual_ancestor_delta_preserved(self):
        before=g.source_cpu(self.source,self.policy,self.root)
        (self.cg.parent/'cpu.stat').write_text('nr_throttled 1\nthrottled_usec 7\n')
        after=g.source_cpu(self.source,self.policy,self.root)
        with self.assertRaisesRegex(RuntimeError,'ancestor_cpu_throttled') as failure:g.cpu_delta(before,after)
        self.assertEqual(failure.exception.cpuHierarchyEvidence['failedDepth'],1)
    def test_stat_duplicates_oversize_and_same_depth_identity_drift_refuse(self):
        before=g.source_cpu(self.source,self.policy,self.root)
        after=copy.deepcopy(before);after['rows'][1]['groupIdentitySha256']='a'*64
        with self.assertRaisesRegex(RuntimeError,'cpu_ancestor_changed'):g.cpu_delta(before,after)
        for raw in ('nr_throttled 0\nnr_throttled 1\nthrottled_usec 0\n','x'*16385):
            (self.cg/'cpu.stat').write_text(raw)
            with self.assertRaisesRegex(RuntimeError,'cpu_metric_invalid'):g.source_cpu(self.source,self.policy,self.root)

    def test_docker_strict_zero_not_false_or_float(self):
        valid={'NanoCpus':0,'CpuQuota':0,'CpuPeriod':0,'CpusetCpus':'','CpusetMems':''}
        g.docker_cpu(valid,self.policy)
        for v in (False,0.0,2000000000):
            with self.assertRaisesRegex(RuntimeError,'source_cpu_quota_changed'):g.docker_cpu({**valid,'NanoCpus':v},self.policy)
        with self.assertRaisesRegex(RuntimeError,'source_cpu_quota_changed'):g.docker_cpu({**valid,'CpuQuota':-1},self.policy)
    def test_host_threshold_no_wait(self):
        proc=self.root/'proc';(proc/'pressure').mkdir(parents=True)
        (proc/'loadavg').write_text('2 2 9 1/2 4');(proc/'pressure/cpu').write_text('some avg10=10 avg60=4 total=8')
        self.assertEqual(g.host_cpu(proc,4)['load1'],2)
        for content in ('2.01 2 9','2 nan 9'):
            (proc/'loadavg').write_text(content)
            with self.assertRaises(RuntimeError):g.host_cpu(proc,4)
        (proc/'loadavg').write_text('0 0 0');(proc/'pressure/cpu').unlink()
        with self.assertRaisesRegex(RuntimeError,'host_cpu_metrics_missing'):g.host_cpu(proc,4)

class LedgerTests(unittest.TestCase):
    def account(self):
        return {'availableBytes':100,'anonBytes':1,'fileBytes':2,'kernelBytes':3,'unevictableBytes':0,'currentBytes':6,'cgroupMaxBytes':20,'memoryEvents':{'oom':0,'oom_kill':0,'max':0},'cpu':{'nr_throttled':0,'throttled_usec':0}}
    def test_every_scope_keeps_cpu_failure_original_and_cleanup_separate(self):
        for scope in g.SCOPES:
            before=self.account();after=copy.deepcopy(before);after['cpu']['nr_throttled']=1
            with self.assertRaisesRegex(RuntimeError,'phase_resource_failed') as failure:g.resource_limits(before,after,pressure=False,scope=scope,account=daemon.account)
            evidence=failure.exception.resourceLimitEvidence
            self.assertEqual(evidence['scope'],scope);self.assertEqual(evidence['cpuLimitDelta']['nr_throttled'],1)
            self.assertTrue(evidence['overlappingNonAdditive'])
            self.assertEqual(evidence['before'],before)
    def test_pressure_exception_is_effective_and_never_cpu_or_oom(self):
        before=self.account();after=copy.deepcopy(before);after['memoryEvents']['max']=1
        self.assertTrue(g.resource_limits(before,after,pressure=True,scope='pressure-interval',account=daemon.account)['pressureMaxException'])
        for pressure,key in ((False,'max'),(True,'oom')):
            state=copy.deepcopy(before);state['memoryEvents'][key]=1
            with self.assertRaisesRegex(RuntimeError,'phase_resource_failed'):g.resource_limits(before,state,pressure=pressure,scope='pressure-interval',account=daemon.account)
    def test_regression_signed_and_missing_not_zero(self):
        before=self.account();before['memoryEvents']['max']=1;after=self.account()
        with self.assertRaises(RuntimeError) as failure:g.resource_limits(before,after,pressure=False,scope='query-interval',account=daemon.account)
        self.assertEqual(failure.exception.resourceLimitEvidence['memoryEventDelta']['max'],-1)
        del after['cpu']['nr_throttled']
        with self.assertRaisesRegex(RuntimeError,'resource_metrics_unavailable'):g.resource_limits(before,after,pressure=False,scope='query-interval',account=daemon.account)

if __name__=='__main__':unittest.main()
