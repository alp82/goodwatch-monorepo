import copy
import hashlib
import json
import os
import selectors
import subprocess
import time
import tempfile
import contextlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
l=load('launch_preflight');a=load('audit_window');s=load('schedule_probe')
l.SOURCE=Path(__file__).parents[1]/'resource_window.py'

def fixture():
    reader={'outsideSourceCgroup':True,'placementUnchanged':True,'VmLckBytes':0,'groupHash':'a'*64}
    group={'processMembershipHash':'b'*64,'processVmLckBytes':0}
    rows=[{'event':'resource-window.started.v1','at':'2026-10-12T10:00:00+00:00','scheduledStart':'2026-10-12T10:00:00+00:00','scheduledEnd':'2026-10-12T10:00:06+00:00','intervalSeconds':2,'maximumGapSeconds':3,'startedMonotonicSeconds':100}]
    for i in range(3):rows.append({'event':'resource-window.sample.v1','sample':i,'startedMonotonicSeconds':100+i*2,'finishedMonotonicSeconds':100+i*2+.1,'durationSeconds':.1,'startedAt':f'2026-10-12T10:00:0{i*2}+00:00','finishedAt':f'2026-10-12T10:00:0{i*2}.1+00:00','sourcePid':1,'sourceStartTicks':2,'sourceIdentityHash':'c'*64,'ancestorLimitHash':'d'*64,'sourceGroupHash':'e'*64,'sshUserspace':{'complete':True,'backup':{'complete':True}},'otherCgroups':{'complete':True},'sourceBefore':copy.deepcopy(group),'sourceAfter':copy.deepcopy(group),'readerBefore':copy.deepcopy(reader),'readerAfter':copy.deepcopy(reader)})
    rows.append({'event':'resource-window.complete.v1','at':'2026-10-12T10:00:06+00:00','continuousCoverage':True,'fullScheduledWindowObserved':True,'elapsedMonotonicSeconds':6,'finishedMonotonicSeconds':106,'wallClockDriftSeconds':0,'samples':3,'finalResourceFence':{'reader':reader,'sourceProcessVmLckBytes':0,'sourceMembershipHash':'b'*64,'sourceIdentityHash':'c'*64}})
    receipt={'event':'resource-window.reader-exit.v1','sourceSha256':a.SHA,'exitCode':0,'readerGoneProven':True,'termSent':False,'killSent':False,'clean':True,'pid':7,'startTicks':8}
    return rows,receipt

class Tests(unittest.TestCase):
    def test_launcher_default_never_connects(self):
        with patch.object(l.subprocess,'run',side_effect=AssertionError),patch('sys.argv',['launch_preflight.py']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(l.main(),0)
    def test_schedule_default_never_inspects(self):
        with patch.object(s,'probe',side_effect=AssertionError),patch('sys.argv',['schedule_probe.py']),contextlib.redirect_stdout(io.StringIO()):self.assertEqual(s.main(),0)
    def test_schedule_failures_never_emit_raw_private_error(self):
        with patch.object(s,'probe',side_effect=ValueError('/private env SECRET')),patch('sys.argv',['schedule_probe.py','--inspect']),contextlib.redirect_stdout(io.StringIO())as out:self.assertEqual(s.main(),1)
        self.assertNotIn('/private',out.getvalue());self.assertNotIn('SECRET',out.getvalue())
    def test_bool_exit_code_and_noninteger_identities_are_invalid(self):
        rows,receipt=fixture();receipt['exitCode']=False
        self.assertIn('clean_reader_exit_missing',a.audit(rows,receipt)['problems'])
        for value in (True,1.5,float('nan'),0):
            rows,receipt=fixture();rows[1]['sourcePid']=value
            self.assertIn('source_identity_invalid',a.audit(rows,receipt)['problems'])
    def local_transport(self,source,birth_failure=False):
        sha=hashlib.sha256(source).hexdigest();code=l.script(source,sha)
        if birth_failure:code=code.replace('ticks=birth(pid)','ticks=(_ for _ in ()).throw(OSError())')
        return subprocess.Popen(['/usr/bin/python3','-I','-B','-'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE),code
    def test_actual_supervisor_term_cleans_blocking_reader(self):
        child,code=self.local_transport(b'import time;time.sleep(60)')
        try:
            child.stdin.write(code.encode());child.stdin.close();child.stdin=None
            sel=selectors.DefaultSelector();sel.register(child.stdout,selectors.EVENT_READ)
            self.assertTrue(sel.select(5));born=json.loads(child.stdout.readline());self.assertEqual(born['event'],'preflight.reader-born.v1')
            child.terminate();out,err=child.communicate(timeout=12)
            receipt=json.loads(out.splitlines()[-1]);self.assertTrue(receipt['readerGoneProven']);self.assertTrue(receipt['termSent']);self.assertFalse(receipt['clean']);self.assertEqual(err,b'')
        finally:
            if child.poll()is None:child.kill();child.wait(timeout=5)
            if child.stdout is not None:child.stdout.close()
            if child.stderr is not None:child.stderr.close()
    def test_actual_birth_read_failure_cleans_owned_reader(self):
        child,code=self.local_transport(b'import time;time.sleep(60)',True)
        try:
            out,err=child.communicate(code.encode(),timeout=12)
            receipt=json.loads(out.splitlines()[-1]);self.assertIsNone(receipt['startTicks']);self.assertTrue(receipt['readerGoneProven']);self.assertTrue(receipt['termSent']);self.assertFalse(receipt['clean']);self.assertEqual(err,b'')
        finally:
            if child.poll()is None:child.kill();child.wait(timeout=5)
            if child.stdout is not None:child.stdout.close()
            if child.stderr is not None:child.stderr.close()
    def test_actual_supervisor_kill_releases_reader_via_parent_death(self):
        child,code=self.local_transport(b'import time;time.sleep(60)');fd=None
        try:
            child.stdin.write(code.encode());child.stdin.close();child.stdin=None
            sel=selectors.DefaultSelector();sel.register(child.stdout,selectors.EVENT_READ);self.assertTrue(sel.select(5))
            born=json.loads(child.stdout.readline());fd=os.pidfd_open(born['pid'])
            # Give the child time to enter Python; parent verification also covers loss before prctl.
            child.kill();child.wait(timeout=5)
            ready=selectors.DefaultSelector();ready.register(fd,selectors.EVENT_READ)
            self.assertTrue(ready.select(5))
        finally:
            if fd is not None:os.close(fd)
            if child.poll()is None:child.kill();child.wait(timeout=5)
            if child.stdout is not None:child.stdout.close()
            if child.stderr is not None:child.stderr.close()
    def test_hash_sequence_and_duration_malformed_proof_fails(self):
        rows,receipt=fixture();rows[1]['sourceIdentityHash']='private arbitrary';rows[1]['sample']=False
        result=a.audit(rows,receipt);self.assertIn('source_hash_invalid',result['problems']);self.assertIn('sample_sequence',result['problems'])
        for duration in (-1,float('nan'),1.0):
            rows,receipt=fixture();rows[1]['durationSeconds']=duration
            self.assertEqual(a.audit(rows,receipt)['coverage'],'UNKNOWN')
        rows,receipt=fixture();rows[1]['finishedAt']='2026-10-12T10:00:01+00:00'
        self.assertIn('sample_wall_drift',a.audit(rows,receipt)['problems'])
    def test_actual_daemon_fence_detects_exe_or_timezone_change(self):
        with tempfile.TemporaryDirectory()as name:
            node=Path(name);parts=['0']*22;parts[19]='123'
            (node/'stat').write_text('9 (cron) '+' '.join(parts));(node/'comm').write_text('cron');(node/'environ').write_bytes(b'TZ=UTC\0SECRET=hidden\0');(node/'exe').symlink_to('/usr/sbin/cron')
            daemon={'startTicks':123,'comm':'cron'}
            s.daemon_fence(node,daemon,'/usr/sbin/cron',[b'UTC'])
            (node/'environ').write_bytes(b'TZ=Europe/Berlin\0')
            with self.assertRaisesRegex(ValueError,'daemon_changed'):s.daemon_fence(node,daemon,'/usr/sbin/cron',[b'UTC'])
            (node/'environ').write_bytes(b'TZ=UTC\0');(node/'exe').unlink();(node/'exe').symlink_to('/different/cron')
            with self.assertRaisesRegex(ValueError,'daemon_changed'):s.daemon_fence(node,daemon,'/usr/sbin/cron',[b'UTC'])
    def test_schedule_transport_pins_new_source(self):
        compile(l.script(l.SCHEDULE.read_bytes(),l.SCHEDULE_SHA,'--inspect','cron-schedule-identity.v1'),'<schedule>','exec')
    def test_transport_hash_fences_source_and_compiles(self):
        with self.assertRaisesRegex(ValueError,'source_hash'):l.script(b'wrong')
        compile(l.script(l.SOURCE.read_bytes()),'<prepared>','exec')
    def test_complete_fixture_is_descriptive(self):
        rows,receipt=fixture();result=a.audit(rows,receipt)
        self.assertEqual(result['coverage'],'complete');self.assertFalse(result['productionAcceptance']);self.assertFalse(result['futureCeilingEstablished'])
    def test_incomplete_class_is_unknown(self):
        rows,receipt=fixture();rows[2]['otherCgroups']['complete']=False
        self.assertEqual(a.audit(rows,receipt)['coverage'],'UNKNOWN')
    def test_missing_terminal_even_gone_is_unknown(self):
        rows,receipt=fixture();result=a.audit(rows[:-1],receipt)
        self.assertEqual(result['coverage'],'UNKNOWN');self.assertTrue(result['readerGoneProven'])
    def test_signal_exit_is_not_clean_coverage(self):
        rows,receipt=fixture();receipt.update(exitCode=-15,termSent=True,clean=False)
        self.assertEqual(a.audit(rows,receipt)['coverage'],'UNKNOWN')
    def test_sequence_and_cadence_gaps_are_unknown(self):
        rows,receipt=fixture();rows[2]['sample']=8;rows[2]['startedMonotonicSeconds']=104
        result=a.audit(rows,receipt);self.assertIn('sample_sequence',result['problems']);self.assertIn('cadence_gap',result['problems'])
    def test_drift_or_early_end_is_unknown(self):
        rows,receipt=fixture();rows[-1]['wallClockDriftSeconds']=9
        self.assertEqual(a.audit(rows,receipt)['coverage'],'UNKNOWN')
        rows,receipt=fixture();rows[-1]['fullScheduledWindowObserved']=False
        self.assertEqual(a.audit(rows,receipt)['coverage'],'UNKNOWN')
    def test_reader_placement_or_source_turnover_invalidates(self):
        rows,receipt=fixture();rows[2]['readerAfter']['VmLckBytes']=4096;rows[2]['sourceStartTicks']=99
        result=a.audit(rows,receipt);self.assertIn('reader_placement',result['problems']);self.assertIn('source_or_membership_turnover',result['problems'])
    def test_gap_at_end_invalidates_otherwise_complete_claim(self):
        rows,receipt=fixture();rows.pop(-2);rows[-1]['samples']=2
        self.assertIn('edge_gap',a.audit(rows,receipt)['problems'])
    def test_unknown_event_invalidates(self):
        rows,receipt=fixture();rows.insert(2,{'event':'unreviewed'})
        self.assertIn('unknown_event',a.audit(rows,receipt)['problems'])

if __name__=='__main__':unittest.main()
