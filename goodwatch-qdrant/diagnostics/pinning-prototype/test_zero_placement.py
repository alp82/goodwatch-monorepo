import contextlib,io,json,signal,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import production,runtime,zero_placement as zero
from production_journal import Journal


def fixture_child(connection,spec,digest):
    with patch.object(runtime,'prepare_self'),patch.object(runtime,'validate_source_locally',side_effect=lambda source:source):
        zero.child(connection,spec,digest)


def losing_parent(connection):
    import os
    worker=production.Holder(zero.child,(None,zero.code_hash()),cleanup_seconds=.1)
    if not worker.connection.poll(3) or worker.connection.recv()!= {'ready':True}:os._exit(2)
    connection.send(worker.process.pid);os._exit(0)


class ZeroTests(unittest.TestCase):
    def source(self,directory):
        spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
        return spec,runtime.Source(('private','image',900,100),900,Path(directory),production.own_group(),spec)

    def test_prepared_and_bad_cli_never_inspect_or_echo(self):
        for args in ([],['--private-secret-value']):
            output=io.StringIO()
            with patch.object(zero,'contract',side_effect=AssertionError()),patch.object(zero,'run',side_effect=AssertionError()),contextlib.redirect_stdout(output):
                result=zero.main(args)
            self.assertNotIn('private-secret',output.getvalue());self.assertEqual(result,0 if not args else 1)

    def test_durable_registration_then_real_close_term_kill_and_zero_lock_proof(self):
        with tempfile.TemporaryDirectory()as directory:
            spec,source=self.source(directory);rows=[];children=[];digest=zero.code_hash();policy='b'*64
            journal=Journal(Path(directory)/'journal',digest,policy,digest)
            def factory(_target,args):
                worker=production.Holder(fixture_child,args,cleanup_seconds=.1);children.append(worker);return worker
            def register(birth):
                journal.write(json.dumps({'event':'qdrant.pin-helper.v1','at':'2026-01-01T00:00:00Z','codeSha256':digest,'policySha256':policy,'queries':0,'storageWrites':0,**birth})+'\n')
                self.assertIn(str(birth['holderPid']),Path(directory,'journal').read_text())
                return journal.holder_registration_committed(birth['holderPid'],birth['holderStartTicks'])
            with patch.object(zero,'limits',return_value={}):
                zero.run({},spec,register,rows.append,worker_factory=factory,check_source=lambda *_:source,poll=.01)
            journal.close();exits=[row for row in rows if row['phase']=='exited']
            self.assertEqual([row['exitCode']for row in exits],[0,-signal.SIGTERM,-signal.SIGKILL])
            self.assertTrue(all(row['released']for row in exits));self.assertTrue(exits[0]['gracefulReleaseAcknowledged'])
            self.assertTrue(all(not worker.alive_owned()for worker in children))
            self.assertEqual(rows[-1]['lockedBytes'],0);self.assertEqual(rows[-1]['inventoryReads'],0)

    def test_failed_registration_reaps_child_before_join(self):
        with tempfile.TemporaryDirectory()as directory:
            spec,source=self.source(directory);workers=[]
            def factory(_target,args):
                worker=production.Holder(fixture_child,args,cleanup_seconds=.05);workers.append(worker);return worker
            with patch.object(zero,'limits',return_value={}):
                with self.assertRaisesRegex(RuntimeError,'zero_registration_unproven'):
                    zero.run({},spec,lambda _:False,lambda _:None,worker_factory=factory,check_source=lambda *_:source)
            self.assertFalse(workers[0].alive_owned())

    def test_changed_source_and_counter_abort_then_reap_actual_child(self):
        for changed in ('counter','identity'):
            with tempfile.TemporaryDirectory()as directory:
                spec,source=self.source(directory);workers=[];checks=[];counters=[]
                replacement=runtime.Source(('new','image',900,101),900,Path(directory),production.own_group(),spec)
                def check(*_):
                    checks.append(True);return replacement if changed=='identity'and len(checks)>2 else source
                def limits(_):
                    counters.append(True);return {'memory':{'max':1 if changed=='counter'and len(counters)>2 else 0}}
                def factory(_target,args):
                    worker=production.Holder(fixture_child,args,cleanup_seconds=.05);workers.append(worker);return worker
                with patch.object(zero,'limits',side_effect=limits):
                    with self.assertRaisesRegex(RuntimeError,'zero_source_changed'if changed=='identity'else'zero_limit_event'):
                        zero.run({},spec,lambda _:True,lambda _:None,worker_factory=factory,check_source=check,poll=.01)
                self.assertFalse(workers[0].alive_owned())

    def test_actual_child_idle_lease_and_kernel_parent_death_release_before_join(self):
        import ctypes,multiprocessing,os,select
        worker=production.Holder(zero.child,(None,zero.code_hash(),.1),cleanup_seconds=.1)
        try:
            self.assertTrue(worker.connection.poll(3));self.assertEqual(worker.connection.recv(),{'ready':True})
            worker.process.join(2);self.assertFalse(worker.alive_owned());self.assertEqual(worker.process.exitcode,0)
        finally:worker.close(emergency=True)
        kernel=ctypes.CDLL(None,use_errno=True);previous=ctypes.c_int()
        self.assertEqual(kernel.prctl(37,ctypes.byref(previous),0,0,0),0);self.assertEqual(kernel.prctl(36,1,0,0,0),0)
        pid=None;fd=None;parent=None
        try:
            context=multiprocessing.get_context('spawn');reader,writer=context.Pipe()
            parent=context.Process(target=losing_parent,args=(writer,));parent.start();writer.close()
            self.assertTrue(reader.poll(5));pid=reader.recv();reader.close();fd=os.pidfd_open(pid)
            parent.join(3);self.assertEqual(parent.exitcode,0)
            self.assertTrue(select.select([fd],[],[],2)[0])
            actual,status=os.waitpid(pid,0);pid=None
            self.assertTrue(os.WIFSIGNALED(status));self.assertEqual(os.WTERMSIG(status),signal.SIGTERM)
        finally:
            if pid is not None:
                if fd is None:fd=os.pidfd_open(pid)
                signal.pidfd_send_signal(fd,signal.SIGKILL);os.waitpid(pid,0)
            if fd is not None:os.close(fd)
            if parent is not None and parent.is_alive():parent.kill();parent.join(3)
            kernel.prctl(36,previous.value,0,0,0)

    def test_contract_hash_and_uncapped_shape(self):
        import hashlib
        with tempfile.TemporaryDirectory()as directory:
            source={'store':directory,'image':'sha256:'+'a'*64,'mounts':[[directory,'/qdrant/storage','volume',True]],
                    'memoryBytes':0,'swapBytes':0,'cpuNanos':0,'memoryMax':'max','memoryHigh':'max','cpuMax':'max 100000'}
            path=Path(directory)/'contract';raw=json.dumps(source).encode();path.write_bytes(raw)
            config,spec=zero.contract(path,hashlib.sha256(raw).hexdigest());self.assertEqual(spec.mode,'production')
            self.assertNotIn('archiveBytes',config)
            with self.assertRaisesRegex(ValueError,'zero_source_contract_changed'):zero.contract(path,'b'*64)
            source['memoryBytes']=1;raw=json.dumps(source).encode();path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError,'zero_contract_invalid'):zero.contract(path,hashlib.sha256(raw).hexdigest())


if __name__=='__main__':unittest.main()
