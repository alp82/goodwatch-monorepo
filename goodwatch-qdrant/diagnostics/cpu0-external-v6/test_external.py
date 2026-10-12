import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
import socket
import threading
import unittest
from unittest import mock

import packet
import setup
import stager
import census


def source():
    files={name:b'# public source\n' for name in packet.SOURCE_NAMES}
    files['lifecycle_cpu0.py']=b"marker='executed'\n"
    manifest={'schema':'search.clone-cpu0-owned-source-freeze.v1',
              'variant':'cpu0-owned-lifecycle.v1','preparedOnly':True,
              'files':{name:packet.sha(raw) for name,raw in files.items()}}
    raw=packet.canonical(manifest)
    return raw,packet.sha(raw),files


def inspected(name, cpu):
    return {'Id':'a'*64,'Name':'/'+name,'Image':setup.IMAGE,
            'Config':{'Image':setup.IMAGE,'Hostname':'configured-old-host',
                      'Env':['PRIVATE_FIXTURE=not-emitted'],'Cmd':['./entrypoint.sh']},
            'HostConfig':{'NanoCpus':cpu,'CpuQuota':0,'CpuPeriod':0,
                          'CpuShares':0,'CpusetCpus':'','CpusetMems':'',
                          'Memory':6*1024**3,'MemorySwap':6*1024**3,
                          'RestartPolicy':{'Name':'no','MaximumRetryCount':0},
                          'SecurityOpt':['unchanged'],'Ulimits':None,
                          'NetworkMode':'owned-network'},
            'Mounts':[{'Source':'/owned/'+str(i),'Destination':d,'Type':'bind','RW':i!=2}
                      for i,d in enumerate(('/qdrant/storage','/qdrant/snapshots','/qdrant/snapshots/fixture.snapshot'))],
            'State':{'Running':False,'Pid':0,'OOMKilled':False}}


class PacketTests(unittest.TestCase):
    def test_complete_freeze_before_any_exec(self):
        raw,sha,files=source()
        bad=dict(files);bad['CPU0.md']=b'changed'
        with mock.patch('builtins.exec') as execute:
            with self.assertRaisesRegex(RuntimeError,'source_file_changed'):
                packet.load_first_lifecycle(raw,sha,bad)
            execute.assert_not_called()
        module=packet.load_first_lifecycle(raw,sha,files)
        self.assertEqual(module.marker,'executed')
        self.assertEqual(module._AUTHENTICATED_SOURCE_SHA256,packet.sha(files['lifecycle_cpu0.py']))

    def test_twelve_file_predecessor_rejected(self):
        raw,sha,files=source();files.pop('test_lifecycle_cpu0.py')
        with self.assertRaisesRegex(RuntimeError,'source_closure_incomplete'):
            packet.verify_source(raw,sha,files)

    def test_exec_failure_never_authenticates(self):
        raw,_,files=source();files['lifecycle_cpu0.py']=b"raise RuntimeError('fixture')\n"
        m=json.loads(raw);m['files']['lifecycle_cpu0.py']=packet.sha(files['lifecycle_cpu0.py'])
        raw=packet.canonical(m)
        with self.assertRaisesRegex(RuntimeError,'fixture'):
            packet.load_first_lifecycle(raw,packet.sha(raw),files)

    def test_stable_owned_read_and_symlink_rejection(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'source';p.write_bytes(b'public');p.chmod(0o600)
            raw,identity=packet.read_owned(p,uid=os.getuid())
            self.assertEqual(raw,b'public');self.assertEqual(identity,(p.stat().st_dev,p.stat().st_ino))
            link=Path(tmp)/'link';link.symlink_to(p)
            with self.assertRaisesRegex(RuntimeError,'scope_changed'):
                packet.read_owned(link,uid=os.getuid())

    def test_stage_absent_refuses_existing_and_preserves_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);root.chmod(0o700);stage=root/'stage'
            stage.mkdir();original=stage/'unrelated';original.write_bytes(b'keep')
            with self.assertRaises(FileExistsError):
                packet.stage_absent(stage,{'file':b'public'},uid=os.getuid())
            self.assertEqual(original.read_bytes(),b'keep')

    def test_actual_partial_write_rollback(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);root.chmod(0o700);stage=root/'stage'
            with mock.patch('packet.os.fsync',side_effect=OSError('fixture')):
                with self.assertRaises(OSError) as caught:
                    packet.stage_absent(stage,{'first':b'public'},uid=os.getuid())
            self.assertFalse(stage.exists())
            self.assertEqual(caught.exception.stageCleanupEvidence,{'cleanupFailures':0,'directoryRetained':False})


class ConfigurationTests(unittest.TestCase):
    def test_non_cpu_equal_full_unknown_fields(self):
        old=inspected(setup.OLD,2_000_000_000);new=inspected(setup.NEW,0)
        proof=setup.configured_pair(old,new)
        self.assertTrue(proof['configEqual']);self.assertFalse(proof['writableLayerParity'])
        self.assertNotIn('PRIVATE_FIXTURE',json.dumps(proof))
        for section,key,value in [('Config','Env',['changed']),('HostConfig','SecurityOpt',[]),
                                  ('HostConfig','NewUnknownPolicy',True),('HostConfig','CpuShares',1),
                                  ('HostConfig','Ulimits',[{'Name':'nofile'}])]:
            with self.subTest(section=section,key=key):
                bad=copy.deepcopy(new);bad[section][key]=value
                with self.assertRaises(RuntimeError):setup.configured_pair(old,bad)

    def test_bool_zero_quota_rejected(self):
        old=inspected(setup.OLD,2_000_000_000);new=inspected(setup.NEW,0)
        new['HostConfig']['CpuQuota']=False
        with self.assertRaisesRegex(RuntimeError,'cpu_not_unlimited'):
            setup.configured_pair(old,new)

    def test_restart_and_extra_mount_refused(self):
        old=inspected(setup.OLD,2_000_000_000);new=inspected(setup.NEW,0)
        new['Mounts'].append({'Source':'unknown','Destination':'unknown','Type':'volume','RW':True})
        with self.assertRaisesRegex(RuntimeError,'mount_drift'):setup.configured_pair(old,new)
        new=inspected(setup.NEW,0);old['HostConfig']['RestartPolicy']['Name']='always'
        with self.assertRaisesRegex(RuntimeError,'restart_policy_changed'):setup.configured_pair(old,new)

    def test_body_preserves_env_no_cpu_options(self):
        old=inspected(setup.OLD,2_000_000_000)
        image={'Id':setup.IMAGE,'Config':{'Volumes':{'/qdrant/storage':{}}}}
        body=setup.creation_body(old,image)
        self.assertEqual(body['Env'],old['Config']['Env'])
        self.assertEqual(body['Hostname'],old['Config']['Hostname'])
        self.assertEqual(body['HostConfig']['NanoCpus'],0)
        self.assertEqual(old['HostConfig']['NanoCpus'],2_000_000_000)
        image['Config']['Volumes']['/unknown']={}
        with self.assertRaisesRegex(RuntimeError,'image_volume_unclassified'):
            setup.creation_body(old,image)

    def test_engine_only_exact_create_and_structured_body(self):
        response=mock.Mock(status=201);response.read.return_value=json.dumps({'Id':'b'*64,'Warnings':None}).encode()
        connection=mock.Mock();connection.getresponse.return_value=response
        engine=setup.Engine(connection=lambda timeout:connection)
        body=setup.creation_body(inspected(setup.OLD,2_000_000_000),{'Id':setup.IMAGE,'Config':{}})
        self.assertEqual(engine.request('POST','/containers/create?name='+setup.NEW,body),'b'*64)
        args,kwargs=connection.request.call_args
        self.assertEqual(json.loads(kwargs['body'])['Env'],body['Env'])
        self.assertEqual(kwargs['headers']['Content-Length'],str(len(kwargs['body'])))
        connection.close.assert_called_once()
        with self.assertRaisesRegex(RuntimeError,'operation_refused'):
            engine.request('POST','/containers/old/kill',{})

    def test_real_unix_engine_body_content_length_and_connection_close(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=str(Path(tmp)/'engine.sock');listener=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
            listener.bind(path);listener.listen(1);listener.settimeout(2)
            captured=[];errors=[]
            def server():
                try:
                    connection,_=listener.accept()
                    with connection:
                        connection.settimeout(2);buffer=b''
                        while b'\r\n\r\n' not in buffer:buffer+=connection.recv(4096)
                        head,body=buffer.split(b'\r\n\r\n',1)
                        headers=dict(line.split(b': ',1) for line in head.split(b'\r\n')[1:])
                        size=int(headers[b'Content-Length'])
                        while len(body)<size:body+=connection.recv(size-len(body))
                        captured.append((headers,json.loads(body)))
                        result=json.dumps({'Id':'c'*64,'Warnings':[]}).encode()
                        connection.sendall(b'HTTP/1.1 201 Created\r\nContent-Length: '+str(len(result)).encode()+b'\r\nConnection: close\r\n\r\n'+result)
                except BaseException as error:errors.append(type(error).__name__)
            thread=threading.Thread(target=server);thread.start()
            class LocalConnection(setup.UnixEngineConnection):
                def connect(self):
                    self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
                    self.sock.settimeout(self.timeout);self.sock.connect(path)
            try:
                body=setup.creation_body(inspected(setup.OLD,2_000_000_000),{'Id':setup.IMAGE,'Config':{}})
                self.assertEqual(setup.Engine(LocalConnection).request('POST','/containers/create?name='+setup.NEW,body),'c'*64)
            finally:
                thread.join(3);listener.close()
            self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
            self.assertEqual(captured[0][0][b'Connection'],b'close')
            self.assertEqual(captured[0][1]['Env'],body['Env'])


class NodeTests(unittest.TestCase):
    def test_real_stable_copy_receipt_and_no_source_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'source';stage=root/'stage'
            source.mkdir(mode=0o700);stage.mkdir(mode=0o700)
            node=source/'node';raw=b'fixture-node-binary';node.write_bytes(raw);node.chmod(0o700)
            receipt=source/'node-provenance.json';receipt.write_bytes(b'fixture-receipt');receipt.chmod(0o600)
            before=node.stat()
            result,identity=stager.copy_node(stage,source,uid=os.getuid(),expected_sha=packet.sha(raw),expected_bytes=len(raw),receipt_sha=packet.sha(receipt.read_bytes()))
            proof=json.loads(result)
            self.assertEqual((stage/'node').read_bytes(),raw)
            self.assertNotEqual(identity,(before.st_dev,before.st_ino))
            self.assertEqual(proof['sourceHostWrites'],0)
            self.assertEqual(packet.metadata(before),packet.metadata(node.stat()))
            self.assertEqual(stat_mode(stage/'node'),0o700)

    def test_wrong_hash_removes_only_created_node(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'source';stage=root/'stage'
            source.mkdir(mode=0o700);stage.mkdir(mode=0o700)
            node=source/'node';node.write_bytes(b'node');node.chmod(0o700)
            receipt=source/'node-provenance.json';receipt.write_bytes(b'fixture');receipt.chmod(0o600)
            unrelated=stage/'unrelated';unrelated.write_bytes(b'keep')
            with self.assertRaisesRegex(RuntimeError,'node_source_changed') as caught:
                stager.copy_node(stage,source,uid=os.getuid(),expected_sha='0'*64,expected_bytes=4,receipt_sha=packet.sha(b'fixture'))
            self.assertFalse((stage/'node').exists());self.assertEqual(unrelated.read_bytes(),b'keep')
            self.assertFalse(caught.exception.nodeCleanupEvidence['cleanupFailed'])


class LifecycleCallerTests(unittest.TestCase):
    def admitted(self,lifecycle):
        lifecycle.state_snapshot.return_value={'fixed':'old-birth'}
        expected={'state':{'fixed':'old-birth'}};lifecycle.attest.return_value=expected
        return lambda:{'schema':'cpu0-old-stop-admission.v6','source':expected}

    def test_stop_refusal_never_publishes_receipt(self):
        lifecycle=mock.Mock();lifecycle.graceful_stop.side_effect=RuntimeError('lifecycle_stop_unclean')
        old=inspected(setup.OLD,2_000_000_000);old['State']['Running']=True
        with mock.patch('setup.os.path.lexists',return_value=False),mock.patch('setup.write_root_absent') as publish:
            with self.assertRaisesRegex(RuntimeError,'lifecycle_stop_unclean'):
                setup.clean_old(lifecycle,mock.Mock(),7,{100},old,self.admitted(lifecycle))
            publish.assert_not_called()

    def test_completed_stop_survives_receipt_failure(self):
        lifecycle=mock.Mock();receipt={'schema':'clone-child-term.clean.v1','clean':True};lifecycle.graceful_stop.return_value=receipt
        old=inspected(setup.OLD,2_000_000_000);old['State']['Running']=True
        with mock.patch('setup.os.path.lexists',return_value=False),mock.patch('setup.write_root_absent',side_effect=OSError('fixture')):
            with self.assertRaises(OSError) as caught:
                setup.clean_old(lifecycle,mock.Mock(),7,{100},old,self.admitted(lifecycle))
        self.assertEqual(caught.exception.setupCompletedStopReceipt,receipt)

    def test_restart_between_admission_and_stop_refuses_without_rebase(self):
        lifecycle=mock.Mock();admission=self.admitted(lifecycle)
        lifecycle.attest.return_value={'state':{'fixed':'new-birth'}}
        old=inspected(setup.OLD,2_000_000_000);old['State']['Running']=True
        with mock.patch('setup.os.path.lexists',return_value=False):
            with self.assertRaisesRegex(RuntimeError,'setup_old_admission_changed'):
                setup.clean_old(lifecycle,mock.Mock(),7,{100},old,admission)
        lifecycle.graceful_stop.assert_not_called()

    def test_wrong_created_id_refuses_start_and_no_removal(self):
        old=inspected(setup.OLD,2_000_000_000);new=inspected(setup.NEW,0);new['Id']='c'*64
        lifecycle=mock.Mock();lifecycle.container.side_effect=[old,new]
        lifecycle.secure_json.return_value=({'clean':True},'d'*64,None)
        engine=mock.Mock();engine.request.return_value='b'*64;docker=mock.Mock();before_start=mock.Mock()
        with self.assertRaisesRegex(RuntimeError,'creation_identity_changed') as caught:
            setup.create_owned_clone(old,lifecycle,docker,engine,7,{'Id':setup.IMAGE,'Config':{}},{'Id':setup.IMAGE},mock.Mock(),before_start)
        before_start.assert_not_called();docker.assert_not_called()
        self.assertFalse(caught.exception.setupFailureEvidence['automaticRemoval'])

    def test_old_drift_after_create_refuses_start(self):
        old=inspected(setup.OLD,2_000_000_000);new=inspected(setup.NEW,0);new['Id']='b'*64
        drift=copy.deepcopy(old);drift['State']['Running']=True
        lifecycle=mock.Mock();lifecycle.container.side_effect=[old,new,drift]
        lifecycle.state_snapshot.side_effect=lambda x:x['State']
        lifecycle.secure_json.return_value=({'clean':True},'d'*64,None)
        engine=mock.Mock();engine.request.return_value='b'*64;docker=mock.Mock();before_start=mock.Mock()
        with self.assertRaisesRegex(RuntimeError,'old_state_changed'):
            setup.create_owned_clone(old,lifecycle,docker,engine,7,{'Id':setup.IMAGE,'Config':{}},{'Id':setup.IMAGE},mock.Mock(),before_start)
        docker.assert_not_called();before_start.assert_not_called()


class CensusTests(unittest.TestCase):
    def test_fd_alias_and_deleted_lock_are_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'root';root.mkdir(mode=0o700)
            folder=root/census.PRIOR_STAGES[0];folder.mkdir(mode=0o700)
            lock=folder/'pin-instance.lock';lock.write_bytes(b'');lock.chmod(0o600)
            proc=Path(tmp)/'proc';proc.mkdir()
            for pid in (os.getpid(),os.getpid()+100000):
                entry=proc/str(pid);entry.mkdir();(entry/'fd').mkdir()
                fields=['S','1']+['0']*17+['123']+['0']*4
                (entry/'stat').write_text(str(pid)+' (fixture) '+' '.join(fields))
                (entry/'cmdline').write_bytes(b'fixture\0')
            target=proc/str(os.getpid()+100000)/'fd'/'7'
            alias=Path(tmp)/'alias';alias.symlink_to(lock);target.symlink_to(alias)
            with mock.patch.object(census,'ROOT',root):
                with self.assertRaisesRegex(RuntimeError,'existing_holder_present'):
                    census.proc_controls(proc,uid=os.getuid())
                target.unlink();target.symlink_to(str(lock)+' (deleted)')
                with self.assertRaisesRegex(RuntimeError,'existing_holder_present'):
                    census.proc_controls(proc,uid=os.getuid())


def stat_mode(path):
    return path.stat().st_mode & 0o777


if __name__=='__main__':unittest.main()
