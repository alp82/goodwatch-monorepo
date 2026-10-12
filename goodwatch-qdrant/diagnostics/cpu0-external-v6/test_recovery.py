"""Local recovery refusals and composed dispatch; no host/container operations."""
import base64
import copy
from contextlib import ExitStack
import json
import os
import fcntl
from pathlib import Path
import socket
import tempfile
import threading
import time
import unittest
from unittest import mock

import bootstrap
import executor
import local_entry
import outer_local
import packet
import recovery
import setup
from reason_codes import REASONS


class RecoveryTests(unittest.TestCase):
    def objects(self):
        old = {'Id': 'a'*64, 'Name': '/'+setup.OLD, 'Image': setup.IMAGE,
               'Config': {'Image': setup.IMAGE, 'Env': [], 'WorkingDir': '/qdrant'},
               'HostConfig': {'NanoCpus': 2_000_000_000, 'CpuQuota': 200000, 'CpuPeriod': 100000,
                              'OomKillDisable': None, 'RestartPolicy': {'Name': 'no', 'MaximumRetryCount': 0},
                              'CpusetCpus': '', 'CpusetMems': '', 'CapDrop': []},
               'Mounts': [{'Source': '/owned/'+str(i), 'Destination': '/fixture/'+str(i),
                           'Type': 'bind', 'RW': i != 2} for i in range(3)],
               'RestartCount': 0,
               'State': {'Running': False, 'Pid': 0, 'OOMKilled': False, 'ExitCode': 0,
                         'Dead': False, 'Paused': False, 'Restarting': False, 'Status': 'exited',
                         'StartedAt': '2026-10-12T13:49:22Z', 'FinishedAt': '2026-10-12T18:36:19Z'}}
        new = copy.deepcopy(old);new.update(Id='b'*64, Name='/'+setup.NEW)
        new['HostConfig'].update(NanoCpus=0, CpuQuota=0, CpuPeriod=0, OomKillDisable=False)
        new['State'].update(Status='created', StartedAt=recovery.YEAR_ONE, FinishedAt=recovery.YEAR_ONE)
        return old,new

    def typed_fixture(self):
        scope=ExitStack();self.addCleanup(scope.close)
        old,new=self.objects()
        for name,value in (('OLD_ID_SHA',packet.sha(old['Id'].encode())),('NEW_ID_SHA',packet.sha(new['Id'].encode())),
                           ('OLD_HOST_SHA',packet.sha(packet.canonical(recovery.non_cpu(old)))),
                           ('NEW_HOST_SHA',packet.sha(packet.canonical(recovery.non_cpu(new))))):
            scope.enter_context(mock.patch.object(recovery,name,value))
        return scope,old,new

    def test_normalization_is_exact_json_and_only_one_field(self):
        _,old,new=self.typed_fixture()
        proof=recovery.configuration(old,new)
        self.assertTrue(proof['normalizedNonCpuHostConfigEqual'])
        self.assertFalse(proof['rawNonCpuHostConfigEqual'])
        self.assertFalse(proof['creationPerformed'])
        for mutation in ('missing',None,True,0,'false'):
            with self.subTest(mutation=mutation):
                changed=copy.deepcopy(new)
                if mutation=='missing':changed['HostConfig'].pop('OomKillDisable')
                else:changed['HostConfig']['OomKillDisable']=mutation
                with self.assertRaisesRegex(RuntimeError,'recovery_normalization_refused'):
                    recovery.configuration(old,changed)
        changed=copy.deepcopy(new);changed['HostConfig']['CapDrop']=['NET_ADMIN']
        with self.assertRaisesRegex(RuntimeError,'recovery_parity_changed'):recovery.configuration(old,changed)
        # Python equality would accept bool/int drift in an unrelated key.
        old['Config']['Tty']=False;new['Config']['Tty']=0
        with self.assertRaisesRegex(RuntimeError,'recovery_parity_changed'):recovery.configuration(old,new)

    def test_poststart_nil_is_recorded_but_no_other_field_can_change(self):
        _,old,new=self.typed_fixture();running=copy.deepcopy(new)
        running['HostConfig']['OomKillDisable']=None
        proof=recovery.configuration(old,running,poststart=True,prestart=new)
        self.assertEqual(proof['newValue'],'null');self.assertTrue(proof['rawNonCpuHostConfigEqual'])
        for value in (True,0,'false'):
            running['HostConfig']['OomKillDisable']=value
            with self.assertRaisesRegex(RuntimeError,'recovery_normalization_refused'):
                recovery.configuration(old,running,poststart=True,prestart=new)
        running=copy.deepcopy(new);running['Config']['Env']=['CHANGED=1']
        with self.assertRaisesRegex(RuntimeError,'recovery_parity_changed'):
            recovery.configuration(old,running,poststart=True,prestart=new)

    def lifecycle(self):
        source=Path(__file__).resolve().parent.parent/'pinning-prototype'
        raw=(source/'cpu0-source-freeze.json').read_bytes()
        files={name:(source/name).read_bytes() for name in json.loads(raw)['files']}
        actual=setup.load_first_lifecycle(raw,packet.sha(raw),files)
        return actual,raw,files

    def test_stopped_pair_requires_original_state_and_durable_semantics(self):
        scope,old,new=self.typed_fixture();actual,_,_=self.lifecycle()
        endpoints={tag:{'observed':True,'state':actual.state_snapshot(value)} for tag,value in (('old',old),('new',new))}
        receipt=b'{"fixed":"trusted-clean"}\n'
        scope.enter_context(mock.patch.object(recovery,'OLD_RECEIPT_SHA',packet.sha(receipt)))
        scope.enter_context(mock.patch.object(recovery,'read_owned',return_value=(receipt,(1,2))))
        actual.container=lambda name,docker:copy.deepcopy(old if name==setup.OLD else new)
        semantic=scope.enter_context(mock.patch.object(actual,'require_clean_receipt'))
        recovery.stopped_pair(actual,None,endpoints);semantic.assert_called_once()
        for change in ({'StartedAt':'2026-10-12T00:00:00Z'},{'Pid':99},{'OOMKilled':True},{'ExitCode':137},{'Status':'exited'}):
            changed=copy.deepcopy(new);changed['State'].update(change)
            actual.container=lambda name,docker:old if name==setup.OLD else changed
            with self.assertRaisesRegex(RuntimeError,'recovery_state_changed'):recovery.stopped_pair(actual,None,endpoints)
        actual.container=lambda name,docker:old if name==setup.OLD else new
        semantic.side_effect=RuntimeError('lifecycle_clean_receipt_missing')
        with self.assertRaisesRegex(RuntimeError,'lifecycle_clean_receipt_missing'):recovery.stopped_pair(actual,None,endpoints)

    def test_closed_admission_inventory_and_inode_fence(self):
        _,raw,files=self.lifecycle()
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(setup,'ADMISSION',Path(folder)),mock.patch.object(recovery,'directory',side_effect=lambda p:packet.directory(p,uid=os.geteuid())),mock.patch.object(recovery,'read_owned',side_effect=lambda p:packet.read_owned(p,uid=os.geteuid())):
            os.chmod(folder,0o700)
            derivative=b'{"fixed":"policy"}\n'
            expected={**files,'cpu0-source-freeze.json':raw,'helper-config.json':files['prepared-helper-policy-cpu0.json'],'controller-config.json':derivative}
            for name,content in expected.items():
                p=Path(folder)/name;p.write_bytes(content);p.chmod(0o600)
            self.assertEqual(len(recovery.admitted_files(raw,files,derivative)),17)
            (Path(folder)/'extra').write_bytes(b'')
            with self.assertRaisesRegex(RuntimeError,'recovery_stage_changed'):recovery.admitted_files(raw,files,derivative)
            (Path(folder)/'extra').unlink();(Path(folder)/'pin_cpu0.py').unlink()
            with self.assertRaisesRegex(RuntimeError,'recovery_stage_changed'):recovery.admitted_files(raw,files,derivative)

    def test_receipt_oexcl_keeps_first_attempt_bytes(self):
        with tempfile.TemporaryDirectory() as folder,mock.patch.object(setup,'ROOT',Path(folder)),mock.patch.object(recovery,'directory',side_effect=lambda p:packet.directory(p,uid=os.geteuid())),mock.patch.object(recovery,'read_owned',side_effect=lambda p:packet.read_owned(p,uid=os.geteuid())):
            os.chmod(folder,0o700)
            digest=recovery.publish(recovery.ATTEMPT_NAME,{'fixed':'one'})
            path=Path(folder)/recovery.ATTEMPT_NAME;before=path.read_bytes()
            self.assertEqual(packet.sha(before),digest)
            with self.assertRaisesRegex(RuntimeError,'recovery_attempt_exists'):recovery.publish(recovery.ATTEMPT_NAME,{'fixed':'two'})
            self.assertEqual(path.read_bytes(),before)
            with self.assertRaisesRegex(RuntimeError,'recovery_scope_changed'):recovery.publish('arbitrary.json',{})

    def test_actual_own_process_placement_and_existing_nonempty_target_refuse(self):
        _,old,new=self.typed_fixture();actual,_,_=self.lifecycle()
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            proof=recovery.own_stopped_placement(actual,old,new,cgroups=root)
            self.assertFalse(proof['preStartSourceProcessProof'])
            self.assertEqual(proof['ownProcess']['pid'],os.getpid());self.assertEqual(proof['ownProcess']['VmLckBytes'],0)
            target=root/('docker-'+new['Id']+'.scope');target.mkdir();(target/'cgroup.procs').write_text('999\n')
            with self.assertRaisesRegex(RuntimeError,'recovery_placement_unknown'):
                recovery.own_stopped_placement(actual,old,new,cgroups=root)

    def test_explicit_mode_fails_before_rpc_and_default_has_no_recovery(self):
        rpc=mock.Mock()
        packet_value={'schema':outer_local.SCHEMA,'initialMode':recovery.MODE,'recoveryProof':{}}
        with self.assertRaisesRegex(RuntimeError,'recovery_mode_mismatch'):
            outer_local.run(packet_value,rpc,lambda row:None,contract_dir=None,validator_path=None,raise_own_nofile=False)
        rpc.call.assert_not_called()
        self.assertIn('recovery',bootstrap.MODULES);self.assertIn('recovery',local_entry.MODULES)
        for modules in (bootstrap.MODULES,local_entry.MODULES):
            self.assertGreater(modules.index('recovery'),modules.index('setup'))
            self.assertLess(modules.index('recovery'),modules.index('executor'))

    def test_executor_projects_actual_recovery_failure_without_live_context(self):
        error=RuntimeError('recovery_start_unknown')
        error.recoveryFailureEvidence={'schema':'cpu0-never-started-recovery-failure.v1',
                                      'actionState':'issued-unknown','continuationAllowed':False}
        actual,raw,files=self.lifecycle()
        args={'sourceFreezeSha256':packet.sha(raw),'sourceFreeze':base64.b64encode(raw).decode(),
              'sourceFiles':{n:base64.b64encode(v).decode() for n,v in files.items()},
              'derivativePolicySha256':'1'*64,'priorPolicy':[],'priorPolicySha256':'2'*64,'externalClosureSha256':'3'*64,
              'recoveryProof':{'mode':recovery.MODE,'originalOutputSha256':recovery.OUTPUT_SHA,'configProofSha256':recovery.CONFIG_SHA,
                               'originalOutput':'e30=','configProof':'e30='}}
        with mock.patch.object(recovery,'run_recovery',side_effect=error),mock.patch.object(executor,'context') as context,mock.patch.object(executor,'load_first_lifecycle',side_effect=RuntimeError('fixed-refusal')):
            with self.assertRaisesRegex(RuntimeError,'recovery_start_unknown') as caught:executor.dispatch('setup-recover-never-started',args)
        context.assert_not_called()
        public=caught.exception.publicFailure
        self.assertEqual(public['reason'],'recovery_start_unknown')
        self.assertEqual(public['recoveryFailureEvidence'],error.recoveryFailureEvidence)
        self.assertFalse(public['continuationAllowed'])

    def close_owned(self,fd,identity):
        try:
            info=os.fstat(fd)
            if (info.st_dev,info.st_ino)==identity:os.close(fd)
        except OSError:pass

    def composed_fixture(self):
        scope,old,new=self.typed_fixture();actual,raw,files=self.lifecycle()
        scope.enter_context(mock.patch.object(recovery,'_AUTHENTICATED_EXTERNAL_CLOSURE_SHA256','9'*64,create=True))
        folder=Path(scope.enter_context(tempfile.TemporaryDirectory()));folder.chmod(0o700)
        admitted=folder/'admission';admitted.mkdir(mode=0o700)
        scope.enter_context(mock.patch.object(setup,'ROOT',folder))
        scope.enter_context(mock.patch.object(setup,'ADMISSION',admitted))
        actual.ROOT=folder
        reader=lambda path:packet.read_owned(path,uid=os.geteuid())
        validator=lambda path:packet.directory(path,uid=os.geteuid())
        scope.enter_context(mock.patch.object(recovery,'read_owned',side_effect=reader))
        scope.enter_context(mock.patch.object(recovery,'directory',side_effect=validator))
        scope.enter_context(mock.patch.object(setup,'directory',side_effect=validator))
        derivative=packet.canonical({'helperPolicySha256':'1'*64,'helperCodeSha256':'2'*64,'cpuIsolation':{}})+b'\n'
        scope.enter_context(mock.patch.object(setup,'derivative_admission_policy',return_value=derivative))
        expected={**files,'cpu0-source-freeze.json':raw,'helper-config.json':files['prepared-helper-policy-cpu0.json'],'controller-config.json':derivative}
        for name,content in expected.items():
            p=admitted/name;p.write_bytes(content);p.chmod(0o600)
        receipt=b'{"trusted":"fixture"}\n';receipt_path=folder/'cpu0-old-clean-receipt-v1.json'
        receipt_path.write_bytes(receipt);receipt_path.chmod(0o600)
        scope.enter_context(mock.patch.object(recovery,'OLD_RECEIPT_SHA',packet.sha(receipt)))
        endpoints={tag:{'observed':True,'state':actual.state_snapshot(value)} for tag,value in (('old',old),('new',new))}
        scope.enter_context(mock.patch.object(recovery,'proofs',return_value=endpoints))
        actual.container=lambda name,docker:copy.deepcopy(old if name==setup.OLD else new)
        actual.require_clean_receipt=mock.Mock()
        actual.pair_snapshot=lambda docker:{'schema':'fixture-pair','old':actual.state_snapshot(old),'new':actual.state_snapshot(new)}
        actual.read_handoff=lambda docker,digest:None
        actual.attest=lambda name,docker:{'wrapper':{'pid':111,'parentPid':110},'qdrant':{'pid':123,'parentPid':111},'state':actual.state_snapshot(new)}
        scope.enter_context(mock.patch.object(setup,'load_first_lifecycle',return_value=actual))
        guards=mock.Mock();scope.enter_context(mock.patch.object(setup,'load_first_guards',return_value=guards))
        def control(value):
            p=folder/'control.lock';fd=os.open(p,os.O_RDWR|os.O_CREAT,0o600)
            fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);actual.require_lock(fd)
            identity=(os.fstat(fd).st_dev,os.fstat(fd).st_ino)
            self.addCleanup(lambda:self.close_owned(fd,identity))
            return fd
        scope.enter_context(mock.patch.object(setup,'acquire_control',side_effect=control))
        prior=scope.enter_context(mock.patch.object(recovery,'prior_census',return_value={'recordedWritersGone':True}))
        scope.enter_context(mock.patch.object(recovery,'port_closed',return_value={'pointInTimeConnectionRefused':True}))
        scope.enter_context(mock.patch.object(recovery,'own_stopped_placement',side_effect=lambda *args:{'preStartSourceProcessProof':False,'ownProcess':actual.public_process(actual.process(os.getpid()))}))
        host=scope.enter_context(mock.patch.object(recovery.admission,'host',return_value={'MemAvailable':6*1024**3,'availableFloorBytes':5*1024**3}))
        scope.enter_context(mock.patch.object(recovery.admission,'collection_shape',return_value={'points':244262,'segments':12,'shards':6}))
        engine=mock.Mock();engine.postIssued=False;engine.version.return_value={'daemonVersion':'28.5.1','apiVersion':'1.51','binaryAttestation':False}
        def start(identity):
            self.assertEqual(identity,new['Id']);engine.postIssued=True
            new['State'].update(Running=True,Pid=123,Status='running',StartedAt='2026-10-12T20:00:00Z')
            new['HostConfig']['OomKillDisable']=None
            return {'httpStatus':204,'httpAcknowledged':True,'cliExitCode':None,'runningProven':False}
        engine.start.side_effect=start;scope.enter_context(mock.patch.object(recovery,'StartEngine',return_value=engine))
        daemon=mock.Mock();daemon.load_config.return_value=({},object(),object())
        control_module=mock.Mock();control_module.birth_admission.return_value={'actualSourceProof':'fixture-boundary'}
        scope.enter_context(mock.patch.object(setup,'load_staged_modules',return_value={'lifecycle_cpu0':actual,'controller_cpu0':control_module,'daemon_cpu0':daemon}))
        args=(raw,packet.sha(raw),files,packet.sha(derivative),[],packet.sha(packet.canonical([])),b'output',b'config','9'*64)
        return scope,args,folder,engine,host,new,control_module

    def test_composed_recovery_creates_no_container_and_commits_setup_handoff(self):
        _,args,folder,engine,host,_,control=self.composed_fixture()
        result=recovery.run_recovery(*args)
        self.assertEqual(engine.start.call_count,1);self.assertEqual(host.call_count,2)
        self.assertEqual(control.birth_admission.call_count,1)
        self.assertEqual(result['handoff']['owner'],'setup');self.assertIsNone(result['handoff']['previousSha256'])
        outer_local.handoff(result['handoff'])
        self.assertFalse(result['creationPerformed']);self.assertEqual(result['createCalls'],0)
        self.assertEqual(result['stopCalls'],0);self.assertEqual(result['removeCalls'],0)
        self.assertEqual(result['normalizationAfter']['newValue'],'null')
        attempt=json.loads((folder/recovery.ATTEMPT_NAME).read_bytes())
        self.assertFalse(attempt['startIssued']);self.assertTrue((folder/recovery.SUCCESS_NAME).exists())
        with self.assertRaisesRegex(RuntimeError,'recovery_scope_changed'):recovery.run_recovery(*args)
        self.assertEqual(engine.start.call_count,1)

    def test_composed_full_admission_refusal_cannot_spend_attempt_or_start(self):
        _,args,folder,engine,host,_,_=self.composed_fixture()
        host.side_effect=RuntimeError('setup_host_admission_failed')
        with self.assertRaisesRegex(RuntimeError,'setup_host_admission_failed') as caught:recovery.run_recovery(*args)
        engine.start.assert_not_called();self.assertFalse((folder/recovery.ATTEMPT_NAME).exists())
        self.assertEqual(caught.exception.recoveryFailureEvidence['actionState'],'not-issued')
        self.assertFalse(caught.exception.recoveryFailureEvidence['continuationAllowed'])

    def test_composed_issued_uncertainty_retains_attempt_and_no_continuation(self):
        _,args,folder,engine,_,_,control=self.composed_fixture()
        def uncertain(identity):
            engine.postIssued=True;raise RuntimeError('recovery_start_unknown')
        engine.start.side_effect=uncertain
        with self.assertRaisesRegex(RuntimeError,'recovery_start_unknown') as caught:recovery.run_recovery(*args)
        proof=caught.exception.recoveryFailureEvidence
        self.assertTrue(proof['attemptObserved']);self.assertEqual(proof['actionState'],'issued-unknown')
        self.assertIsNone(proof['cliExitCode']);self.assertIsNone(proof['httpStatus'])
        self.assertEqual(proof['primaryReason'],'recovery_start_unknown')
        control.birth_admission.assert_not_called()
        self.assertFalse((folder/recovery.SUCCESS_NAME).exists());self.assertFalse((folder/'cpu0-lifecycle-handoff-v1.json').exists())

    def test_target_drift_after_attempt_and_prior_version_never_becomes_post_issued(self):
        _,args,folder,engine,_,new,_=self.composed_fixture()
        publish=recovery.publish
        def mutate(name,value):
            result=publish(name,value)
            if name==recovery.ATTEMPT_NAME:new['Id']='c'*64
            return result
        with mock.patch.object(recovery,'publish',side_effect=mutate):
            with self.assertRaisesRegex(RuntimeError,'recovery_target_changed') as caught:recovery.run_recovery(*args)
        self.assertGreater(engine.version.call_count,0);engine.start.assert_not_called()
        self.assertTrue((folder/recovery.ATTEMPT_NAME).exists())
        self.assertEqual(caught.exception.recoveryFailureEvidence['actionState'],'not-issued')

    def test_final_live_census_protects_actual_source_identities(self):
        _,args,_,_,_,_,_=self.composed_fixture()
        original=recovery.prior_census
        with mock.patch.object(recovery,'prior_census',wraps=original) as census_call:
            recovery.run_recovery(*args)
        protected=census_call.call_args_list[-1].args[2]
        self.assertTrue({os.getpid(),os.getppid(),110,111,123}.issubset(protected))

    def test_successful_receipt_lock_close_failure_retains_action_and_complete_result(self):
        _,args,folder,engine,_,_,_=self.composed_fixture()
        with mock.patch.object(recovery,'close_control',side_effect=OSError('private cleanup detail')):
            with self.assertRaisesRegex(RuntimeError,'recovery_lock_close_failed') as caught:recovery.run_recovery(*args)
        error=caught.exception
        self.assertEqual(error.recoveryFailureEvidence['actionState'],'issued-acknowledged')
        self.assertTrue(error.recoveryFailureEvidence['attemptObserved'])
        self.assertEqual(error.recoveryCleanupFailure,'recovery_lock_close_failed')
        self.assertEqual(error.recoveryCompletedReceipt['handoff']['owner'],'setup')
        self.assertTrue((folder/recovery.SUCCESS_NAME).exists());self.assertEqual(engine.start.call_count,1)

    def test_no_authenticated_remote_closure_cannot_even_inspect(self):
        with mock.patch.dict(recovery.__dict__,{'_AUTHENTICATED_EXTERNAL_CLOSURE_SHA256':None}),mock.patch.object(setup,'Docker') as docker:
            with self.assertRaisesRegex(RuntimeError,'recovery_closure_unproven') as caught:
                recovery.run_recovery(b'', '1'*64, {}, '2'*64, [],'3'*64,b'',b'','4'*64)
        docker.assert_not_called();proof=caught.exception.recoveryFailureEvidence
        self.assertEqual(proof['actionState'],'not-issued');self.assertIsNone(proof['attemptObserved'])
        self.assertFalse(proof['attemptObservationKnown'])

    def test_actual_recovery_to_outer_framing_is_one_fixed_operation_then_fresh_preflight(self):
        _,args,_,_,_,_,_=self.composed_fixture()
        result=recovery.run_recovery(*args);seen=[]
        packet_value={'schema':outer_local.SCHEMA,'initialMode':recovery.MODE,'recoveryProof':{},'closureSha256':'9'*64,
                      **{key:'fixture' for key in ('sourceFreezeSha256','sourceFreeze','sourceFiles','externalManifestSha256','derivativePolicySha256','priorPolicy','priorPolicySha256')}}
        rpc=mock.Mock()
        def call(operation,values,**kwargs):
            seen.append((operation,values))
            if operation=='setup-recover-never-started':return {'result':result}
            if operation=='preflight':raise RuntimeError('setup_host_admission_failed')
            return {'result':{'ownedCleanup':True}}
        rpc.call.side_effect=call
        receipt=outer_local.run(packet_value,rpc,lambda row:None,contract_dir=None,validator_path=None,raise_own_nofile=False,initial_mode=recovery.MODE)
        self.assertEqual([value[0] for value in seen[:2]],['setup-recover-never-started','preflight'])
        self.assertNotIn('setup',[value[0] for value in seen])
        self.assertNotIn('recoveryProof',seen[1][1]);self.assertEqual(receipt['status'],'failed-or-cleanup-unknown')


class EngineTests(unittest.TestCase):
    def server(self,responses,delays=()):
        folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup)
        path=str(Path(folder.name)/'engine.sock');original=socket.socket
        listener=original(socket.AF_UNIX,socket.SOCK_STREAM);listener.bind(path);listener.listen(4);listener.settimeout(2)
        requests=[];errors=[]
        def serve():
            try:
                for i,response in enumerate(responses):
                    client,_=listener.accept()
                    with client:
                        data=b''
                        while b'\r\n\r\n' not in data:data+=client.recv(4096)
                        requests.append(data)
                        if i<len(delays):time.sleep(delays[i])
                        try:client.sendall(response)
                        except BrokenPipeError:pass
            except BaseException as error:errors.append(error)
            finally:listener.close()
        thread=threading.Thread(target=serve,daemon=True);thread.start()
        class Wrapped:
            def __init__(self,*args):self.client=original(*args)
            def connect(self,target):
                if target!='/var/run/docker.sock':raise AssertionError('unfixed socket')
                self.client.connect(path)
            def __getattr__(self,name):return getattr(self.client,name)
        return requests,thread,errors,Wrapped

    def test_real_unix_http_version_then_exact_id_empty_post(self):
        version=b'{"Version":"28.5.1","ApiVersion":"1.51"}'
        requests,thread,errors,scope=self.server([b'HTTP/1.1 200 OK\r\nContent-Length: '+str(len(version)).encode()+b'\r\n\r\n'+version,b'HTTP/1.1 204 No Content\r\n\r\n'])
        identity='b'*64
        with mock.patch.object(recovery,'NEW_ID_SHA',packet.sha(identity.encode())):
            engine=recovery.StartEngine(socket_factory=scope);self.assertFalse(engine.version()['binaryAttestation'])
            ack=engine.start(identity)
        thread.join(2);self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
        self.assertEqual(ack,{'httpStatus':204,'httpAcknowledged':True,'cliExitCode':None,'runningProven':False})
        self.assertIn(b'POST /v1.51/containers/'+identity.encode()+b'/start HTTP/1.1',requests[1])
        self.assertTrue(requests[1].endswith(b'Content-Length: 0\r\n\r\n'))

    def test_actual_total_deadline_and_issued_disconnect_evidence(self):
        requests,thread,errors,scope=self.server([b'HTTP/1.1 204 No Content\r\n\r\n'],delays=[.1])
        identity='b'*64
        with mock.patch.object(recovery,'NEW_ID_SHA',packet.sha(identity.encode())):
            engine=recovery.StartEngine(socket_factory=scope);started=time.monotonic()
            with self.assertRaisesRegex(RuntimeError,'recovery_start_unknown'):
                engine.request('POST','/v1.51/containers/'+identity+'/start',timeout=.03)
            self.assertLess(time.monotonic()-started,.08);self.assertTrue(engine.postIssued)
        thread.join(2)

    def test_http_nonzero_is_not_exit_or_birth_proof(self):
        _,thread,_,scope=self.server([b'HTTP/1.1 500 Error\r\nContent-Length: 0\r\n\r\n'])
        identity='b'*64
        with mock.patch.object(recovery,'NEW_ID_SHA',packet.sha(identity.encode())):
            with self.assertRaisesRegex(RuntimeError,'recovery_start_refused') as caught:recovery.StartEngine(socket_factory=scope).start(identity)
        thread.join(2);self.assertEqual(caught.exception.recoveryHttpStatus,500)


if __name__=='__main__':unittest.main()
