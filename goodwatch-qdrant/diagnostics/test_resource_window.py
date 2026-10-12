import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('resource_window',Path(__file__).with_name('resource_window.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class FakeClock:
    def __init__(self):self.value=0
    def wall(self):return 1000+self.value
    def clock(self):return self.value
    def sleep(self,seconds):self.value+=seconds

class Reader:
    def __init__(self,clock,delay=0):self.clock=clock;self.delay=delay;self.check=self;self.calls=0
    def sample(self):
        self.calls+=1;self.clock.sleep(self.delay)
        return {'durationSeconds':self.delay,'sshUserspace':{'complete':True},'otherCgroups':{'complete':True}}
    def fence(self):pass
    def verify(self):pass

def utc(seconds):return m.dt.datetime.fromtimestamp(seconds,m.dt.timezone.utc).isoformat()

class ResourceTests(unittest.TestCase):
    def test_default_does_not_inspect(self):
        with patch.object(m,'Source',side_effect=AssertionError),patch.object(m,'preflight',side_effect=AssertionError),patch('sys.argv',['resource_window.py']),contextlib.redirect_stdout(io.StringIO())as out:
            self.assertEqual(m.main(),0)
        self.assertEqual(json.loads(out.getvalue())['hostOperations'],0)
    def test_missing_counter_and_wrong_unit_fail(self):
        for text in ('Dirty: 1 MB','Dirty: 1 kB\nDirty: 2 kB',''):
            with self.assertRaises(ValueError):m.fields(text,('Dirty',),True)
    def test_proc_fields_use_actual_indices(self):
        with tempfile.TemporaryDirectory()as name:
            p=Path(name);parts=['0']*22
            parts[1]='12';parts[7]='31';parts[9]='7';parts[19]='888';parts[21]='2'
            (p/'stat').write_text('99 (a tricky ) comm) '+' '.join(parts))
            self.assertEqual(m.proc_identity(p),{'startTicks':888,'parentPid':12,'minorFaults':31,'majorFaults':7,'rssBytes':2*m.os.sysconf('SC_PAGE_SIZE')})
    def test_prestart_wait_does_not_consume_run(self):
        c=FakeClock();reader=Reader(c);out=io.StringIO()
        m.run(reader,m.Output(out),utc(1100),utc(1106),c.wall,c.clock,c.sleep)
        rows=[json.loads(v)for v in out.getvalue().splitlines()]
        self.assertEqual(reader.calls,3);self.assertTrue(rows[-1]['continuousCoverage']);self.assertEqual(c.value,106)
    def test_slow_samples_do_not_claim_coverage(self):
        c=FakeClock();reader=Reader(c,3);out=io.StringIO()
        m.run(reader,m.Output(out),utc(1000),utc(1006),c.wall,c.clock,c.sleep)
        self.assertFalse(json.loads(out.getvalue().splitlines()[-1])['continuousCoverage'])
    def test_final_source_fence_failure_never_completes(self):
        c=FakeClock();reader=Reader(c);reader.fence=lambda:(_ for _ in ()).throw(ValueError('source_changed'));out=io.StringIO()
        with self.assertRaisesRegex(ValueError,'source_changed'):m.run(reader,m.Output(out),utc(1000),utc(1004),c.wall,c.clock,c.sleep)
        self.assertNotIn('resource-window.complete',out.getvalue())
    def test_timezone_must_be_explicit_utc(self):
        c=FakeClock()
        for start in ('1970-01-01T00:16:40','1970-01-01T01:16:40+01:00'):
            with self.assertRaisesRegex(ValueError,'window_invalid'):m.run(Reader(c),m.Output(io.StringIO()),start,utc(1004),c.wall,c.clock,c.sleep)
    def test_schedule_does_not_publish_private_command_or_claim_timezone(self):
        secret='/private/qdrant/backup.py';text='TZ=Europe/Berlin\n15 * * * * python3 '+secret+' --token PRIVATEVALUE\n'
        result=m.schedule_metadata(text,0,True);encoded=json.dumps(result)
        self.assertNotIn(secret,encoded);self.assertNotIn('PRIVATEVALUE',encoded)
        self.assertFalse(result['nextBackupUtcEstablished']);self.assertFalse(result['applicationTimezoneControlsScheduler'])
    def test_multiple_schedules_fail(self):
        with self.assertRaisesRegex(ValueError,'backup_identity_required'):m.schedule_metadata('15 * * * * /qdrant/backup.py\n20 * * * * /qdrant/backup.py',0,True)
    def test_fuse_option_visibility_is_not_negotiation_proof(self):
        result=m.mount_mode_metadata('1 0 0:1 / / rw - ext4 /secret rw\n2 1 0:2 / /private rw - fuse.sshfs secret@remote rw,writeback_cache', '/private/snapshots')
        self.assertTrue(result['visibleWritebackCache']);self.assertFalse(result['negotiatedFuseIoModeEstablished']);self.assertNotIn('secret',json.dumps(result))
    def test_sibling_hierarchy_is_not_double_summed(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);source=root/'source';source.mkdir();sibling=root/'sibling';sibling.mkdir();(sibling/'nested').mkdir()
            (sibling/'memory.current').write_text('100');(sibling/'memory.stat').write_text('\n'.join(k+' 3'for k in m.STAT))
            result=m.siblings(source);self.assertEqual(result['currentBytes'],100);self.assertEqual(result['childCount'],1)
    def test_config_staleness_does_not_wait_for_inspection(self):
        check=m.ConfigCheck.__new__(m.ConfigCheck);check.last=0;check.failed=False;check.clock=lambda:17
        with self.assertRaisesRegex(ValueError,'source_config_check_stale'):check.verify()
    def test_required_numeric_is_bounded(self):
        for value in ('-1','nan',str(2**64),'1'*200):
            with self.assertRaisesRegex(ValueError,'invalid_numeric'):m.natural(value)
    def test_process_census_classifies_ssh_and_keeps_args_private(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name)
            for pid,comm,parent in ((10,'sshfs',1),(11,'ssh',10),(12,'ssh',1),(13,'python3',1)):
                node=root/str(pid);node.mkdir();parts=['0']*22;parts[1]=str(parent);parts[19]=str(pid*10)
                (node/'stat').write_text(str(pid)+' (comm) '+' '.join(parts))
                (node/'comm').write_text(comm)
                args='/secret/qdrant/backup.py'if pid==13 else '/private/process --secret VALUE'
                (node/'cmdline').write_text(args+'\0')
                (node/'status').write_text('\n'.join(k+': 2 kB'for k in m.RSS))
            result=m.process_census(root,m.hashlib.sha256(b'/secret/qdrant/backup.py').hexdigest())
            self.assertEqual(result['backup']['count'],1)
            self.assertEqual([result['classes'][k]['processCount']for k in ('sshfs','sshfs-child-ssh','other-ssh')],[1,1,1])
            self.assertNotIn('/secret',json.dumps(result));self.assertNotIn('VALUE',json.dumps(result))
            self.assertFalse(result['rssAccountingExact'])
    def test_process_disappearance_makes_census_incomplete(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);(root/'42').mkdir()
            result=m.process_census(root,'a'*64)
            self.assertFalse(result['complete']);self.assertEqual(result['disappearedDuringCensus'],1)
    def test_pid_reuse_fails_source_fence(self):
        source=m.Source.__new__(m.Source);source.check=Reader(FakeClock());source.proc=Path('/private');source.expected={'pid':9,'startTicks':100}
        with patch.object(m,'read',return_value='qdrant'),patch.object(m.os,'readlink',return_value='/usr/bin/qdrant'),patch.object(m,'proc_identity',return_value={'startTicks':101}):
            with self.assertRaisesRegex(ValueError,'source_changed'):source.fence()
    def test_rich_numeric_row_fits_declared_budget(self):
        biggest=2**64-1;memory={k:biggest for k in m.STAT};pressure={kind:{'avg10':100.0,'total':biggest}for kind in ('some','full')}
        group={'currentBytes':biggest,'memory':memory,'events':{k:biggest for k in m.EVENTS},'cpu':{k:biggest for k in m.CPU},'swapBytes':biggest,'memoryPsi':pressure,'ioPsi':pressure,'processCount':64,'processVmLckBytes':biggest}
        row={'event':'resource-window.sample.v1','startedAt':'2026-10-12T00:00:00.123456+00:00','finishedAt':'2026-10-12T00:00:00.123456+00:00','durationSeconds':2.0,'host':{k:biggest for k in m.MEM},'hostPsi':{'memory':pressure,'io':pressure},'hostReclaim':{k:biggest for k in m.VM},'process':{k:biggest for k in ('startTicks','parentPid','minorFaults','majorFaults','rssBytes','readBytes','VmLck')},'sourceBefore':group,'sourceAfter':group,'sshUserspace':{'classes':{k:{'processCount':64,'bytes':{k:biggest for k in m.RSS}}for k in ('sshfs','sshfs-child-ssh','other-ssh')},'identityHash':'a'*64,'complete':True,'disappearedDuringCensus':0,'backup':{'count':64,'running':True,'identityHash':'a'*64,'complete':True},'rssAccountingExact':False},'otherCgroups':{'childCount':256,'currentBytes':biggest,'memory':memory,'identityHash':'a'*64,'complete':True,'scope':'direct-source-parent-siblings-hierarchical-no-descendant-double-sum','otherHostBranchesMeasured':False},'sourcePid':biggest,'sourceStartTicks':biggest,'sourceIdentityHash':'a'*64,'ancestorLimitHash':'a'*64,'sourceGroupHash':'a'*64,'metadataOnly':True,'archiveResidentBytesMeasured':False,'sample':1499}
        stream=io.StringIO();m.Output(stream).emit(row)
        self.assertLessEqual(len(stream.getvalue().encode()),m.ROW_BYTES)
    def test_output_budget_and_total_worst_case(self):
        self.assertLess((m.ROWS+2)*m.ROW_BYTES,m.OUTPUT_BYTES)
        with self.assertRaisesRegex(ValueError,'output_bound'):m.Output(io.StringIO()).emit({'x':'z'*m.ROW_BYTES})

if __name__=='__main__':unittest.main()
