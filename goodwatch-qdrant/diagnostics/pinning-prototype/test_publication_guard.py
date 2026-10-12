import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from publication_guard import ReleaseGuard,proc_ticks


def crashing_registered_parent(connection,journal_path):
    import production
    from test_production import stubborn_holder
    from production_journal import Journal
    import time
    worker=production.Holder(stubborn_holder,cleanup_seconds=.05)
    if not worker.connection.poll(3):os._exit(2)
    worker.connection.recv()
    journal=Journal(journal_path,'a'*64,'b'*64,'c'*64)
    birth=production.holder_birth(worker)
    journal.write(json.dumps({'event':'qdrant.pin-helper.v1','at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'queries':0,'storageWrites':0,'codeSha256':'a'*64,'policySha256':'b'*64,**birth})+'\n')
    connection.send((worker.process.pid,birth['holderStartTicks']))
    # Hard parent exit before reconcile/placement/first lock. This fixture child
    # intentionally ignores TERM to require evidence of actual kernel exit.
    os._exit(0)


class GuardTests(unittest.TestCase):
    def setup_scope(self,root):
        runtime=root/'runtime';runtime.mkdir(mode=0o700)
        code=root/'code';code.mkdir(mode=0o700)
        return runtime,code,{'owned.py':(code/'owned.py',0o400)}

    def procs(self,root,extra=None):
        directory=root/'proc'
        directory.mkdir(exist_ok=True)
        for pid in (os.getpid(),extra):
            if pid and not (directory/str(pid)).exists():(directory/str(pid)).symlink_to(Path('/proc')/str(pid),target_is_directory=True)
        return directory

    def journal(self,path,pid,ticks):
        rows=[{'schema':'qdrant.helper-journal.v1','kind':'helper.collector-started','sequence':1},
              {'schema':'qdrant.helper-journal.v1','kind':'helper.event','sequence':2,'data':{'phase':'holder_started','holderPid':pid,'holderStartTicks':ticks,'pidfdOwned':True}}]
        path.write_text(''.join(json.dumps(row)+'\n' for row in rows));path.chmod(0o600)

    def test_guarded_publication_holds_both_locks_for_mutations_and_retains_rollback_evidence(self):
        from publish_production import guarded_publish,guarded_rollback,sha
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);runtime,code,targets=self.setup_scope(root)
            stage=root/'stage';stage.mkdir();candidate=stage/'candidate';candidate.write_bytes(b'value=1\n')
            raw=json.dumps({'schema':'owned-pin-publication.v1','files':{'owned.py':{'candidate':str(candidate),'sha256':sha(candidate.read_bytes()),'expectedCurrentSha256':None}}}).encode()
            plan=stage/'plan';plan.write_bytes(raw);calls=[]
            def inactive():
                calls.append(True)
                for name in ('supervisor.lock','holder.lock'):
                    with (runtime/name).open('r+') as stream:
                        with self.assertRaises(BlockingIOError):fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
            guard=ReleaseGuard(targets,inactive,runtime=runtime,code_root=code,proc_root=self.procs(root))
            backup=root/'backup';self.assertEqual(guarded_publish(plan,sha(raw),backup,guard=guard)['state'],'published')
            self.assertGreaterEqual(len(calls),6)
            # First publication never launched a holder; its retained collector
            # record establishes that no holder identity was ever recorded.
            journal=root/'journal';journal.write_text(json.dumps({'schema':'qdrant.helper-journal.v1','kind':'helper.collector-started','sequence':1})+'\n');journal.chmod(0o600)
            guard=ReleaseGuard(targets,inactive,journal,runtime,code,proc_root=self.procs(root))
            self.assertEqual(guarded_rollback(backup,guard=guard)['state'],'rolled-back')
            self.assertFalse((code/'owned.py').exists());self.assertTrue((backup/'receipt.json').exists())

    def test_crash_before_first_lock_birth_record_blocks_until_actual_spawned_child_exit(self):
        import ctypes,multiprocessing,signal
        kernel=ctypes.CDLL(None,use_errno=True);previous=ctypes.c_int()
        self.assertEqual(kernel.prctl(37,ctypes.byref(previous),0,0,0),0)
        self.assertEqual(kernel.prctl(36,1,0,0,0),0)
        child_pid=None;pidfd=None;parent=None
        try:
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);runtime,code,targets=self.setup_scope(root);(code/'owned.py').write_text('installed')
                context=multiprocessing.get_context('spawn');reader,writer=context.Pipe();journal_path=root/'journal'
                parent=context.Process(target=crashing_registered_parent,args=(writer,journal_path));parent.start();writer.close()
                self.assertTrue(reader.poll(5));child_pid,ticks=reader.recv();reader.close()
                parent.join(3);self.assertEqual(parent.exitcode,0)
                self.assertEqual(proc_ticks(Path('/proc')/str(child_pid)),ticks);pidfd=os.pidfd_open(child_pid)
                kwargs={'journal':journal_path,'runtime':runtime,'code_root':code,'proc_root':self.procs(root,child_pid)}
                with self.assertRaisesRegex(RuntimeError,'retained_holder_still_live'):
                    with ReleaseGuard(targets,lambda:None,**kwargs):pass
                signal.pidfd_send_signal(pidfd,signal.SIGKILL);os.waitpid(child_pid,0);child_pid=None
                with ReleaseGuard(targets,lambda:None,**kwargs):pass
                self.assertNotIn('locked',journal_path.read_text())
        finally:
            if child_pid is not None:
                if pidfd is None:pidfd=os.pidfd_open(child_pid)
                signal.pidfd_send_signal(pidfd,signal.SIGKILL);os.waitpid(child_pid,0)
            if pidfd is not None:os.close(pidfd)
            if parent is not None and parent.is_alive():parent.kill();parent.join(3)
            kernel.prctl(36,previous.value,0,0,0)

    def test_real_locks_remain_held_and_inode_replacement_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);runtime,code,targets=self.setup_scope(root)
            with ReleaseGuard(targets,lambda:None,runtime=runtime,code_root=code,proc_root=self.procs(root)) as guard:
                result=subprocess.run([sys.executable,'-c',"import fcntl,sys; f=open(sys.argv[1],'r+'); fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)",str(runtime/'holder.lock')],capture_output=True)
                self.assertNotEqual(result.returncode,0)
                replacement=runtime/'new';replacement.write_text('');replacement.chmod(0o600);replacement.replace(runtime/'holder.lock')
                with self.assertRaisesRegex(RuntimeError,'owned_lock_inode_changed'):guard.check()
            with (runtime/'supervisor.lock').open('r+') as stream:fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)

    def test_installed_helper_requires_complete_journal_and_rejects_matching_live_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);runtime,code,targets=self.setup_scope(root);(code/'owned.py').write_text('')
            with self.assertRaisesRegex(ValueError,'retained_holder_journal_required'):
                with ReleaseGuard(targets,lambda:None,runtime=runtime,code_root=code,proc_root=self.procs(root)):pass
            journal=root/'journal';self.journal(journal,os.getpid(),proc_ticks(Path('/proc')/str(os.getpid())))
            with self.assertRaisesRegex(RuntimeError,'retained_holder_still_live'):
                with ReleaseGuard(targets,lambda:None,journal,runtime,code,proc_root=self.procs(root)):pass
            # Reused PID with a different start time is not the retained holder.
            self.journal(journal,os.getpid(),proc_ticks(Path('/proc')/str(os.getpid()))+1)
            with ReleaseGuard(targets,lambda:None,journal,runtime,code,proc_root=self.procs(root)):pass
            journal.write_text(journal.read_text()[:-1])
            with self.assertRaisesRegex(ValueError,'complete_holder_journal_required'):
                with ReleaseGuard(targets,lambda:None,journal,runtime,code,proc_root=self.procs(root)):pass

    def test_first_install_rejects_live_owned_code_and_unknown_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);runtime,code,targets=self.setup_scope(root)
            script=code/'running.py';script.write_text('import time; print(\"ready\",flush=True); time.sleep(20)\n')
            worker=subprocess.Popen([sys.executable,str(script)],stdout=subprocess.PIPE)
            self.assertEqual(worker.stdout.readline(),b'ready\n')
            try:
                guard=ReleaseGuard(targets,lambda:None,runtime=runtime,code_root=code,proc_root=self.procs(root,worker.pid))
                with self.assertRaisesRegex(RuntimeError,'owned_helper_process_still_live'):guard.census()
                with self.assertRaisesRegex(RuntimeError,'unknown_existing_helper_files'):
                    with guard:pass
            finally:worker.terminate();worker.wait(timeout=5);worker.stdout.close()

    def test_unit_inactivity_is_rechecked_and_guard_failure_releases_locks(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);runtime,code,targets=self.setup_scope(root);calls=[]
            def inactive():
                calls.append(True)
                if len(calls)==2:raise RuntimeError('helper_unit_not_inactive')
            with self.assertRaisesRegex(RuntimeError,'helper_unit_not_inactive'):
                with ReleaseGuard(targets,inactive,runtime=runtime,code_root=code,proc_root=self.procs(root)):pass
            with (runtime/'holder.lock').open('r+') as stream:fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)


if __name__=='__main__':unittest.main()
