import hashlib
import json
import os
import signal
from contextlib import ExitStack
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import idle_launcher as launcher
import idle_trial
import pin
import production
import runtime
from test_idle_trial import pressure_files,lease
from test_idle_journal import frame
import test_idle_lease


def waiting_child(connection):
    connection.send({'ready':True})
    if connection.recv()=='close':connection.send({'closed':True})


def full_idle_holder(connection,root,spec,source):
    root=Path(root)
    def inventory(*args,**kwargs):
        targets=[pin.Target.open(root/k,k)for k in ('vector','graph','sparse','other')]
        return runtime.Inventory(targets,0,runtime.ensure_inventory_nofile(raise_own_nofile=True))
    def sampled(value):return idle_trial._sample(value,root/'proc',root/'cg',lambda value:value)
    with patch.object(runtime,'validate_source_locally',side_effect=lambda value:value),patch.object(runtime,'prepare_self'),patch.object(runtime,'inventory',side_effect=inventory),patch.object(idle_trial,'sample',side_effect=sampled):
        idle_trial.holder(connection,spec,pin.IdlePolicy(),root/'mapping-lock',False,True,idle_trial.code_hash(),lifetime=230)


def nongraceful_writer(connection,*args):
    class CloseFailure:
        def recv(self):
            command=connection.recv()
            if command=='close':raise RuntimeError('idle_journal_write_failed')
            return command
        def send(self,row):return connection.send(row)
        def poll(self,seconds):return connection.poll(seconds)
        def close(self):return connection.close()
    launcher.idle_journal.writer(CloseFailure(),*args)



class LauncherTests(unittest.TestCase):
    def test_default_and_execute_flag_inspect_nothing_and_refuse_execution(self):
        with patch.object(launcher,'run_reviewed',side_effect=AssertionError('must not execute')),patch.object(launcher,'verify_code',side_effect=AssertionError('must not inspect')):
            self.assertEqual(launcher.main([]),0);self.assertEqual(launcher.main(['--execute-reviewed']),1)

    def test_exact_immutable_packet_refuses_alias_mutation_and_pyc(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);rows={}
            for name in launcher.CODE_FILES:
                path=root/name;path.write_text(name);path.chmod(0o400);rows[name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
            self.assertEqual(launcher._verify_code(root,rows,os.geteuid()),launcher.packet_hash(rows))
            (root/'json.py').write_text('shadow')
            with self.assertRaises(RuntimeError):launcher._verify_code(root,rows,os.geteuid())
            (root/'json.py').unlink()
            path=root/'idle_trial.py';path.chmod(0o600);path.write_text('mutated');path.chmod(0o400)
            with self.assertRaises(RuntimeError):launcher._verify_code(root,rows,os.geteuid())
            path.write_text('idle_trial.py')if path.stat().st_mode&0o200 else None
            (root/'__pycache__').mkdir()
            with self.assertRaises(RuntimeError):launcher._verify_code(root,rows,os.geteuid())

    def test_real_writer_commits_birth_before_public_run_callback_is_acknowledged(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);calls=[]
            def public_run(config,spec,register,emit,lease,code_hash,policy_path,policy_hash,**kwargs):
                worker=production.Holder(waiting_child)
                try:
                    self.assertTrue(worker.connection.poll(30));self.assertEqual(worker.connection.recv(),{'ready':True})
                    birth=production.holder_birth(worker);self.assertTrue(register(birth))
                    committed=json.loads((root/'trial.jsonl').read_bytes())
                    self.assertEqual(committed['data'],birth);calls.append('committed')
                    emit(frame());self.assertTrue(worker.close()['released']);return 'inconclusive'
                finally:worker.close(emergency=True)
            with patch.object(idle_trial,'run',side_effect=public_run):
                result=launcher._invoke({},None,root/'policy','b'*64,None,'a'*64,root/'trial.jsonl')
            self.assertEqual(calls,['committed']);self.assertEqual(result['outcome'],'inconclusive')
            self.assertTrue(result['writerReleased']);self.assertTrue(result['writerGraceful']);self.assertEqual(result['writerExitCode'],0)

    def test_callback_failure_is_not_a_success_receipt(self):
        with tempfile.TemporaryDirectory()as tmp:
            def public_run(config,spec,register,emit,*args,**kwargs):emit({**frame(),'query':'private'})
            with patch.object(idle_trial,'run',side_effect=public_run):
                result=launcher._invoke({},None,Path(tmp)/'policy','b'*64,None,'a'*64,Path(tmp)/'trial.jsonl')
            self.assertEqual(result['outcome'],'evidence_failure');self.assertTrue(result['writerReleased'])

    def test_source_and_self_pids_cannot_be_registered_or_signalled(self):
        for source_pid in (os.getpid(),123):
            owned=launcher.OwnedBirths(source_pid)
            for pid in (os.getpid(),source_pid):
                with self.assertRaisesRegex(RuntimeError,'idle_launcher_birth_invalid'):
                    owned.register({'phase':'holder_started','holderPid':pid,'holderStartTicks':1,'pidfdOwned':True},None)
            self.assertTrue(owned.release());self.assertEqual(owned.held,[])

    def test_refused_wrapper_returns_fixed_reason_without_private_path(self):
        with patch.object(os,'geteuid',return_value=0),patch.object(launcher,'verify_code',return_value='a'*64),patch.object(launcher.zero_placement,'contract',side_effect=FileNotFoundError('/private/contract')):
            result=launcher.run_reviewed('private','a'*64,'unused','a'*64,{}, {},'unused',123,456,'b'*64)
        self.assertEqual(result['outcome'],'refused');self.assertEqual(result['reason'],'idle_guard_failure')
        self.assertNotIn('/private',json.dumps(result));self.assertFalse(result['journalCreated'])

    def test_early_preflight_refusal_is_durable_and_bounded_before_any_holder(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp)
            def refused():raise RuntimeError('idle_schedule_expired')
            with patch.object(idle_trial,'run',side_effect=AssertionError('no holder work')):
                result=launcher._invoke({},None,root/'policy','b'*64,None,'a'*64,root/'journal',binding={'packetSha256':'d'*64,'sourceContractSha256':'e'*64},preflight=refused)
            rows=[json.loads(line)for line in (root/'journal').read_text().splitlines()]
            self.assertEqual(result['outcome'],'refused');self.assertEqual(result['reason'],'idle_schedule_expired')
            self.assertEqual([row['kind']for row in rows],['binding','event'])
            self.assertIsNone(rows[-1]['data']['scheduleSha256']);self.assertEqual(result['terminalReceipt']['sequence'],2)
            self.assertTrue(result['writerReleased']);self.assertTrue(result['registeredHoldersExited'])

    def test_actual_core_refusal_null_completion_reason_reaches_strict_journal(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp)
            def core(config,spec,register,emit,lease,code,policy_path,policy_hash,**kwargs):
                return idle_trial._run(config,spec,register,emit,root/'holder.lock',lease,code,policy_hash)
            with patch.object(idle_trial,'run',side_effect=core):
                result=launcher._invoke({},None,root/'policy','b'*64,None,'a'*64,root/'journal')
            row=json.loads((root/'journal').read_text())['data']
            self.assertEqual(row['outcome'],'refused');self.assertIsNone(row['completionReason'])
            self.assertEqual(result['reason'],'idle_code_changed');self.assertEqual(result['outcome'],'refused')

    def test_result_reason_preserves_safety_late_pressure_and_null_completion_precedence(self):
        for row,expected in (({'completionReason':None,'mainReason':'idle_schedule_expired'},'idle_schedule_expired'),
                ({'completionReason':'idle_hold_complete','safetyReason':'idle_headroom'},'idle_headroom'),
                ({'completionReason':'idle_hold_complete','firstReason':'idle_quiet_pressure'},'idle_quiet_pressure'),
                ({'completionReason':'idle_hold_complete','postReleaseReason':'idle_guard_failure'},'idle_guard_failure'),
                ({'outcome':'inconclusive','completionReason':'idle_hold_complete','observerShutdownReason':'idle_guard_failure'},'idle_guard_failure'),
                ({'outcome':'inconclusive','completionReason':'idle_hold_complete','drainReason':'idle_guard_failure'},'idle_guard_failure'),
                ({'outcome':'release_unproven','safetyReason':'idle_headroom','cleanupReason':'holder_exit_unproven'},'holder_exit_unproven')):
            self.assertEqual(launcher.result_reason(row),expected)

    def test_real_writer_nongraceful_exit_downgrades_pass_with_explicit_reason(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);constructor=launcher.idle_journal.Journal.__init__
            def create(writer,*args,**kwargs):return constructor(writer,*args,worker_target=nongraceful_writer,**kwargs)
            def passed(*args,**kwargs):
                args[3]({**frame('complete'),'outcome':'pass','completionReason':'idle_hold_complete'});return 'pass'
            with patch.object(launcher.idle_journal.Journal,'__init__',create),patch.object(idle_trial,'run',side_effect=passed):
                result=launcher._invoke({},None,root/'policy','b'*64,None,'a'*64,root/'journal')
            self.assertEqual(result['outcome'],'evidence_failure');self.assertEqual(result['reason'],'idle_journal_nongraceful_exit')
            self.assertTrue(result['writerReleased']);self.assertEqual(result['writerExitCode'],1)

    def test_ownership_exit_uncertainty_reports_cleanup_reason_instead_of_completion(self):
        with tempfile.TemporaryDirectory()as tmp:
            def passed(*args,**kwargs):
                args[3]({**frame('complete'),'outcome':'pass','completionReason':'idle_hold_complete'});return 'pass'
            with patch.object(idle_trial,'run',side_effect=passed),patch.object(launcher.OwnedBirths,'release',return_value=False):
                result=launcher._invoke({},None,Path(tmp)/'policy','b'*64,None,'a'*64,Path(tmp)/'journal')
            self.assertEqual(result['outcome'],'release_unproven');self.assertEqual(result['reason'],'holder_exit_unproven')
            self.assertTrue(result['writerReleased'])

    def test_real_same_cgroup_refusal_prevents_writer_and_journal(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);source=SimpleNamespace(cgroup_relative='/fixture-source')
            with patch.object(os,'geteuid',return_value=0),patch.object(launcher,'verify_code',return_value='d'*64),patch.object(launcher.zero_placement,'contract',return_value=({},None)),patch.object(production,'own_group',return_value='/fixture-source'),patch.object(runtime,'inspect_source',return_value=source),patch.object(production,'Holder',side_effect=AssertionError('must not spawn')):
                result=launcher.run_reviewed('private','e'*64,'unused','b'*64,{}, {},root/'journal',123,456,'a'*64)
            self.assertEqual(result['outcome'],'refused');self.assertEqual(result['reason'],'supervisor_placement_changed')
            self.assertFalse(result['journalCreated']);self.assertFalse((root/'journal').exists())

    def test_source_descendant_refusal_prevents_writer_and_journal(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);source=SimpleNamespace(cgroup_relative='/fixture-source')
            with patch.object(os,'geteuid',return_value=0),patch.object(launcher,'verify_code',return_value='d'*64),patch.object(launcher.zero_placement,'contract',return_value=({},None)),patch.object(production,'own_group',return_value='/fixture-source/child'),patch.object(production,'check_source',return_value=source),patch.object(production,'Holder',side_effect=AssertionError('must not spawn')):
                result=launcher.run_reviewed('private','e'*64,'unused','b'*64,{}, {},root/'journal',123,456,'a'*64)
            self.assertEqual(result['reason'],'supervisor_placement_changed');self.assertFalse(result['journalCreated'])
            self.assertFalse((root/'journal').exists())

    def _reviewed_fixture(self,root,stack):
        proc,schedule=test_idle_lease.LeaseTests()._filesystem(root)
        source=SimpleNamespace(pid=123,identity=('fixture','image',123,456),cgroup=root,cgroup_relative='/fixture-source')
        (root/'memory.swap.current').write_text('0')
        spec=runtime.Spec('production','qdrant-main','fixture',root,frozenset(),0,0,0)
        for target,attribute,options in ((os,'geteuid',{'return_value':0}),(launcher,'verify_code',{'return_value':'d'*64}),
                (launcher.zero_placement,'contract',{'return_value':({},spec)}),(idle_trial,'load_policy',{}),
                (production,'own_group',{'return_value':'outside'}),(production,'check_source',{'return_value':source}),
                (launcher.zero_placement,'vm_locked',{'return_value':0}),(idle_trial,'sample',{}),
                (launcher.idle_lease,'LOCALTIME',{'new':str(root/'localtime')}),
                (launcher.idle_lease,'inspect_known',{'side_effect':ValueError('idle_schedule_changed')})):
            stack.enter_context(patch.object(target,attribute,**options))
        return ('private','e'*64,root/'policy','b'*64,schedule,{},root/'journal',123,456,hashlib.sha256(repr(source.identity).encode()).hexdigest())

    def test_real_reviewed_wrapper_preflight_refusal_commits_binding_and_restores_alarm_mask(self):
        with tempfile.TemporaryDirectory()as tmp,ExitStack()as stack:
            root=Path(tmp);args=self._reviewed_fixture(root,stack)
            original=signal.pthread_sigmask(signal.SIG_BLOCK,{signal.SIGALRM})
            try:
                result=launcher.run_reviewed(*args)
                self.assertEqual(result['outcome'],'refused');self.assertEqual(result['reason'],'idle_schedule_expired')
                self.assertEqual(signal.getitimer(signal.ITIMER_REAL),(0.0,0.0))
                self.assertIn(signal.SIGALRM,signal.pthread_sigmask(signal.SIG_BLOCK,set()))
                rows=[json.loads(line)for line in (root/'journal').read_text().splitlines()]
                self.assertEqual([row['kind']for row in rows],['binding','event'])
                self.assertEqual(rows[0]['data'],{'packetSha256':'d'*64,'sourceContractSha256':'e'*64})
                self.assertIsNone(rows[-1]['data']['scheduleSha256']);self.assertTrue(result['writerReleased'])
            finally:signal.setitimer(signal.ITIMER_REAL,0);signal.pthread_sigmask(signal.SIG_SETMASK,original)

    def test_journal_startup_failure_marks_creation_unknown_and_retains_backstop(self):
        with tempfile.TemporaryDirectory()as tmp,ExitStack()as stack:
            root=Path(tmp);args=self._reviewed_fixture(root,stack);(root/'journal').write_bytes(b'partial')
            original=signal.pthread_sigmask(signal.SIG_BLOCK,set())
            try:
                result=launcher.run_reviewed(*args)
                self.assertEqual(result['outcome'],'release_unproven');self.assertTrue(result['journalCreationUnknown'])
                self.assertNotIn('journalCreated',result);self.assertGreater(signal.getitimer(signal.ITIMER_REAL)[0],0)
                self.assertEqual((root/'journal').read_bytes(),b'partial')
            finally:signal.setitimer(signal.ITIMER_REAL,0);signal.pthread_sigmask(signal.SIG_SETMASK,original)

    def test_binding_and_terminal_receipt_cover_exact_journal_tail(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);bound={'packetSha256':'d'*64,'sourceContractSha256':'e'*64}
            with patch.object(idle_trial,'run',side_effect=lambda *args,**kwargs:args[3](frame())or'inconclusive'):
                result=launcher._invoke({},None,root/'policy','b'*64,None,'a'*64,root/'journal',binding=bound)
            raw=(root/'journal').read_bytes().splitlines(keepends=True)
            self.assertEqual(json.loads(raw[0])['kind'],'binding');self.assertEqual(json.loads(raw[0])['data'],bound)
            self.assertEqual(result['terminalReceipt']['sequence'],2)
            self.assertEqual(result['terminalReceipt']['recordSha256'],hashlib.sha256(raw[-1]).hexdigest())
            self.assertEqual(result['packetSha256'],bound['packetSha256']);self.assertEqual(result['sourceContractSha256'],bound['sourceContractSha256'])

    def test_holder_cleanup_failure_still_closes_writer(self):
        with tempfile.TemporaryDirectory()as tmp:
            with patch.object(idle_trial,'run',return_value='inconclusive'),patch.object(launcher.OwnedBirths,'release',side_effect=RuntimeError('/private')):
                result=launcher._invoke({},None,Path(tmp)/'policy','b'*64,None,'a'*64,Path(tmp)/'journal')
            self.assertEqual(result['outcome'],'release_unproven');self.assertTrue(result['writerReleased'])
            self.assertEqual(result['reason'],'holder_exit_unproven')

    def test_real_public_run_full_sequence_reaches_strict_journal_with_actual_mappings(self):
        with tempfile.TemporaryDirectory()as tmp:
            root=Path(tmp);proc,group=pressure_files(root)
            for kind in ('vector','graph','sparse','other'):(root/kind).write_bytes(bytes(pin.PAGE))
            fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
            actual_group=production.own_group();spec=runtime.Spec('production','qdrant-main','fixture',root,frozenset(),0,0,0)
            source=SimpleNamespace(spec=spec,pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=actual_group,cgroup=group)
            config={'source':{'memoryMax':'max','memoryHigh':'max','cpuMax':'max 100000'}}
            policy={'schema':'production-idle-lock-release.v1','maxLockedBytes':2*pin.GIB,'floorBytes':2*pin.GIB,
                'transientAllowanceBytes':6*pin.GIB,'includePayload':False,'capReserveBytes':256*1024**2,'mappingReserveCount':1024,
                'baselineSeconds':30,'initialSeconds':180,'holdSeconds':30,'cleanupSeconds':20,'pollSeconds':2}
            policy_path=root/'policy';policy_path.write_text(json.dumps(policy));policy_hash=hashlib.sha256(policy_path.read_bytes()).hexdigest()
            constructor=production.Holder.__init__;shared_lock=idle_trial._supervisor_lock;reader=idle_trial._sample
            def create(worker,target,args=(),**kwargs):
                if target is idle_trial.holder:return constructor(worker,full_idle_holder,(str(root),spec,source),**kwargs)
                return constructor(worker,target,args,**kwargs)
            def lock(_root):return shared_lock(root,owner_uid=os.geteuid())
            def sampled(value,*args):return reader(value,proc,root/'cg',lambda value:value)
            boundary=time.monotonic()+1000
            with patch.object(production.Holder,'__init__',create),patch.object(idle_trial,'_supervisor_lock',side_effect=lock),patch.object(runtime,'inspect_source',return_value=source),patch.object(production,'own_group',return_value='/fixture-supervisor'),patch.object(idle_trial,'_sample',side_effect=sampled):
                result=launcher._invoke(config,spec,policy_path,policy_hash,lambda:lease(boundary),idle_trial.code_hash(),root/'trial.jsonl',source_pid=os.getpid(),binding={'packetSha256':'d'*64,'sourceContractSha256':'e'*64})
            records=[json.loads(line)for line in (root/'trial.jsonl').read_text().splitlines()]
            self.assertEqual(records[0]['kind'],'binding');self.assertEqual(result['terminalReceipt']['sequence'],len(records))
            rows=[row['data']for row in records if row['kind']!='binding']
            self.assertEqual(result['outcome'],'pass',rows[-1]);self.assertEqual(result['reason'],'idle_hold_complete');self.assertTrue(result['registeredHoldersExited'])
            phases=[row['phase']for row in rows]
            for phase in ('baseline_start','admitted','holder_started','lock_ready','pre_release','complete'):self.assertIn(phase,phases)
            final=rows[-1];self.assertEqual(final['outcome'],'pass');self.assertEqual(final['cleanup']['exitCode'],0)
            self.assertTrue(final['cleanup']['gracefulReleaseAcknowledged']);self.assertEqual(next(row for row in rows if row['phase']=='lock_ready')['lockedBytes'],4*pin.PAGE)


if __name__=='__main__':unittest.main()
