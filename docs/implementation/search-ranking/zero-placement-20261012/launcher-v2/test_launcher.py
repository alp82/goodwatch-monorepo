import base64,contextlib,hashlib,io,json,os,signal,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import stage_and_run as s


FROZEN_MODULES=Path('/home/alper/projects/search-100-evidence/production-zero-placement-review-v1-20261012')
sys.path.insert(0,str(FROZEN_MODULES))
import production,runtime,zero_placement as zero

def actual_zero_child(connection,spec,digest):
    # Only the local foreign-CG boundary is faked; actual reviewed child and
    # Holder close/send/PIDfd/reap paths produce the captured frames.
    with patch.object(runtime,'prepare_self'),patch.object(runtime,'validate_source_locally',side_effect=lambda source:source):
        zero.child(connection,spec,digest)

class Tests(unittest.TestCase):
    def test_actual_zero_run_holder_close_shapes_pass_public_schema(self):
        with tempfile.TemporaryDirectory()as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),production.own_group(),spec)
            actual=[];workers=[]
            def factory(_target,args):
                worker=production.Holder(actual_zero_child,args,cleanup_seconds=.1);workers.append(worker);return worker
            with patch.object(zero,'limits',return_value={}):
                zero.run({},spec,lambda _:True,actual.append,worker_factory=factory,check_source=lambda *_:source,poll=.01)
            exits=[row for row in actual if row['phase']=='exited']
            self.assertEqual([r['exitCode']for r in exits],[0,-signal.SIGTERM,-signal.SIGKILL])
            self.assertTrue(all(r['holderExited']is True and r['released']is True for r in exits))
            for row in actual:
                s.public_frame(json.dumps({'event':'qdrant.zero-placement.v1','at':'2026-10-12T08:28:43Z',**row}))
            self.assertTrue(all(not worker.alive_owned()for worker in workers))
            for wrong in (1,0,None,'true'):
                malformed={'event':'qdrant.zero-placement.v1','at':'2026-10-12T08:28:43Z',**exits[0],'holderExited':wrong}
                self.assertRaisesRegex(RuntimeError,'invalid_public_frame',s.public_frame,json.dumps(malformed))

    def test_default_does_not_read_input_inspect_stage_or_spawn(self):
        with patch.object(s,'stage',side_effect=AssertionError()),patch.object(s,'run_cli',side_effect=AssertionError()),contextlib.redirect_stdout(io.StringIO())as output:
            self.assertEqual(s.main([]),0)
        self.assertEqual(json.loads(output.getvalue())['execution'],False)

    def test_packet_hash_and_whitelist_fail_closed_without_echo(self):
        self.assertRaisesRegex(RuntimeError,'private_input',s.payload,b'{"secret":"credential"}')
        frozen=Path('/home/alper/projects/search-100-evidence/production-zero-placement-review-v1-20261012')
        private=Path('/home/alper/projects/search-production-pin-preflight-406/private-production-source-contract.json')
        packet={'code':{n:base64.b64encode((frozen/n).read_bytes()).decode()for n in s.FILES},'contract':base64.b64encode(private.read_bytes()).decode()}
        files,raw,contract=s.payload(json.dumps(packet).encode());self.assertEqual(hashlib.sha256(raw).hexdigest(),s.CONTRACT)
        packet['code']['unknown.py']='';self.assertRaisesRegex(RuntimeError,'private_input',s.payload,json.dumps(packet).encode())

    def test_source_fence_precedes_all_writes_and_existing_stage_refuses(self):
        with tempfile.TemporaryDirectory()as d,patch.object(s,'ROOT',Path(d)),patch.object(s,'STAGE',Path(d)/'stage'),patch.object(s,'private'):
            with patch.object(s,'source_fence',side_effect=RuntimeError('source_fence')):
                self.assertRaisesRegex(RuntimeError,'source_fence',s.stage,{},b'',{})
            self.assertFalse(s.STAGE.exists());s.STAGE.mkdir()
            with patch.object(s,'source_fence',side_effect=AssertionError()):self.assertRaisesRegex(RuntimeError,'stage_exists',s.stage,{},b'',{})

    def test_public_frames_reject_private_strings_and_unknown_fields(self):
        for row in [{'event':'qdrant.zero-placement.v1','secret':'password'},{'event':'qdrant.zero-placement.failed.v1','reason':'private-error'},{'event':'qdrant.zero-placement.v1','holderPid':'raw'}]:
            self.assertRaisesRegex(RuntimeError,'invalid_public_frame',s.public_frame,json.dumps(row))
        self.assertEqual(s.public_frame('{"event":"qdrant.zero-placement.v1","phase":"complete","lockedBytes":0}')['lockedBytes'],0)

    def test_real_owned_cli_term_kill_exit_and_source_pid_refusal(self):
        self.assertRaisesRegex(RuntimeError,'owned_exit_unproven',s.owned,s.SOURCE_PID,1)
        # Actual owned process ignores TERM; cleanup must use its PIDfd for KILL.
        p=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print("ready",flush=True);time.sleep(30)'],stdout=subprocess.PIPE)
        self.assertEqual(p.stdout.readline(),b'ready\n');fd=s.owned(p.pid,s.ticks(p.pid))
        try:
            with patch.object(s,'births',return_value=(b'',[])):
                proof=s.cleanup(p,fd)
            self.assertTrue(proof['cliExited']);self.assertEqual(p.returncode,-signal.SIGKILL)
            self.assertTrue(proof['registeredHoldersExited']);self.assertTrue(proof['unknownEarlyChildrenPossible'])
        finally:
            if p.poll()is None:s.send(fd,signal.SIGKILL);p.wait(3)
            os.close(fd);p.stdout.close()

    def test_registered_never_joined_actual_holder_is_killed_and_reaped(self):
        cli=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'])
        holder=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print(1,flush=True);time.sleep(30)'],stdout=subprocess.PIPE)
        self.assertEqual(holder.stdout.readline(),b'1\n')
        fd=s.owned(cli.pid,s.ticks(cli.pid));birth=(holder.pid,s.ticks(holder.pid))
        try:
            with patch.object(s,'births',return_value=(b'fixed-sanitized-journal',[birth])):
                proof=s.cleanup(cli,fd)
            self.assertTrue(proof['cliExited']);self.assertTrue(proof['registeredHoldersExited']);self.assertEqual(proof['registeredHolders'],1)
            # cleanup was our adopted-child reaper, so Popen no longer owns wait.
            self.assertFalse(Path('/proc',str(holder.pid)).exists())
            holder.returncode=-signal.SIGKILL
        finally:
            if cli.poll()is None:s.send(fd,signal.SIGKILL);cli.wait(3)
            if Path('/proc',str(holder.pid)).exists():holder.kill();holder.wait(3)
            holder.stdout.close();os.close(fd)

    def test_real_cli_parent_death_terminates_unregistered_child(self):
        import ctypes
        kernel=ctypes.CDLL(None,use_errno=True);old=ctypes.c_int()
        self.assertEqual(kernel.prctl(37,ctypes.byref(old),0,0,0),0)
        self.assertEqual(kernel.prctl(36,1,0,0,0),0)
        child=None;fd=None;parent=None
        try:
            # This parent invokes the ACTUAL outer preexec arm then dies before
            # any birth/join command. Our local subreaper can prove/reap exit.
            source="import os,subprocess,sys;import stage_and_run as s;p=subprocess.Popen([sys.executable,'-c','import time;print(1,flush=True);time.sleep(30)'],stdout=subprocess.PIPE,preexec_fn=lambda:s.child_arm(os.getpid()));p.stdout.readline();print(p.pid,flush=True);os._exit(0)"
            # Capture the parent's PID BEFORE fork, as the real launcher does.
            source=source.replace("p=subprocess.Popen", "owner=os.getpid();p=subprocess.Popen").replace("s.child_arm(os.getpid())", "s.child_arm(owner)")
            parent=subprocess.Popen([sys.executable,'-B','-c',source],stdout=subprocess.PIPE)
            child=int(parent.stdout.readline());fd=os.pidfd_open(child)
            parent.wait(3);self.assertEqual(parent.returncode,0)
            self.assertTrue(s.select.select([fd],[],[],3)[0])
            pid,status=os.waitpid(child,0);child=None
            self.assertTrue(os.WIFSIGNALED(status));self.assertEqual(os.WTERMSIG(status),signal.SIGTERM)
        finally:
            if child is not None:
                if fd is None:fd=os.pidfd_open(child)
                s.send(fd,signal.SIGKILL);os.waitpid(child,0)
            if fd is not None:os.close(fd)
            if parent is not None:
                if parent.poll()is None:parent.kill();parent.wait(3)
                parent.stdout.close()
            kernel.prctl(36,old.value,0,0,0)

    def test_birth_journal_requires_frozen_sequence_before_owned_signal(self):
        with tempfile.TemporaryDirectory()as d,patch.object(s,'STAGE',Path(d)),patch.object(s,'private'):
            row={'schema':'qdrant.helper-journal.v1','sequence':1,'codeSha256':s.CODE,'policySha256':s.CONTRACT,'serviceSha256':s.CODE,'kind':'helper.event','data':{'phase':'holder_started','holderPid':1234,'holderStartTicks':99,'pidfdOwned':True}}
            path=Path(d)/'journal.jsonl';path.write_text(json.dumps(row)+'\n')
            self.assertEqual(s.births()[1],[(1234,99)])
            row['sequence']=2;path.write_text(json.dumps(row)+'\n');self.assertRaisesRegex(RuntimeError,'owned_exit_unproven',s.births)
if __name__=='__main__':unittest.main()
