import ast
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
    def finish(self):return {}

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
        row.update(readerBefore={'outsideSourceCgroup':True,'VmLckBytes':0,'placementUnchanged':True,'groupHash':'a'*64},readerAfter={'outsideSourceCgroup':True,'VmLckBytes':0,'placementUnchanged':True,'groupHash':'a'*64},startedMonotonicSeconds=123456.123456,finishedMonotonicSeconds=123458.123456)
        group['processMembershipHash']='a'*64
        stream=io.StringIO();m.Output(stream).emit(row)
        self.assertLessEqual(len(stream.getvalue().encode()),m.ROW_BYTES)
    def test_sleep_jitter_inside_explicit_gap_budget_passes(self):
        c=FakeClock();reader=Reader(c);out=io.StringIO()
        def sleep(seconds):c.sleep(seconds+0.001 if seconds else 0)
        m.run(reader,m.Output(out),utc(1000),utc(1006),c.wall,c.clock,sleep)
        rows=[json.loads(v)for v in out.getvalue().splitlines()]
        self.assertTrue(rows[-1]['continuousCoverage']);self.assertEqual(rows[0]['maximumGapSeconds'],3)
        self.assertTrue(all('startedMonotonicSeconds'in row for row in rows[1:-1]))
    def test_gap_over_three_seconds_fails_coverage(self):
        c=FakeClock();reader=Reader(c);out=io.StringIO()
        def sleep(seconds):c.sleep(seconds+1.01 if seconds else 0)
        m.run(reader,m.Output(out),utc(1000),utc(1010),c.wall,c.clock,sleep)
        self.assertFalse(json.loads(out.getvalue().splitlines()[-1])['continuousCoverage'])
    def test_forward_wall_jump_cannot_claim_full_window(self):
        c=FakeClock();reader=Reader(c);out=io.StringIO()
        wall=lambda:c.wall()+(100 if reader.calls else 0)
        m.run(reader,m.Output(out),utc(1000),utc(1010),wall,c.clock,c.sleep)
        last=json.loads(out.getvalue().splitlines()[-1])
        self.assertFalse(last['continuousCoverage']);self.assertFalse(last['fullScheduledWindowObserved']);self.assertEqual(last['wallClockDriftSeconds'],100)
    def test_unrelated_huge_cmdline_is_never_read(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);node=root/'42';node.mkdir();(node/'comm').write_text('unrelated');(node/'cmdline').write_text('private'*20000)
            result=m.process_census(root,'a'*64)
            self.assertTrue(result['complete']);self.assertEqual(result['backup']['count'],0)
    def test_reader_outside_source_and_unlocked_proof(self):
        source=m.Source.__new__(m.Source);source.proc=Path('/proc');source.cgroot=Path('/cg');source.group=Path('/cg/source');source.reader_group=Path('/cg');source.reader_pid=1;source.reader_birth=100
        with patch.object(m.os,'getpid',return_value=1),patch.object(m,'proc_identity',return_value={'startTicks':100}),patch.object(m,'group_path',return_value=Path('/cg')),patch.object(m,'read',return_value='VmLck: 0 kB'):
            self.assertTrue(source.reader_proof()['outsideSourceCgroup'])
        with patch.object(m.os,'getpid',return_value=1),patch.object(m,'proc_identity',return_value={'startTicks':100}),patch.object(m,'group_path',return_value=Path('/cg')),patch.object(m,'read',return_value='VmLck: 1 kB'):
            with self.assertRaisesRegex(ValueError,'source_locked'):source.reader_proof()
    def test_cgroup_membership_missing_actual_source_fails(self):
        source=m.Source.__new__(m.Source);source.group=Path('/cg');source.expected={'pid':99}
        with patch.object(m,'read',return_value='1 2'):
            with self.assertRaisesRegex(ValueError,'census_bound'):source.group_read()
    def test_output_budget_and_total_worst_case(self):
        self.assertLess((m.ROWS+2)*m.ROW_BYTES,m.OUTPUT_BYTES)
        with self.assertRaisesRegex(ValueError,'output_bound'):m.Output(io.StringIO()).emit({'x':'z'*m.ROW_BYTES})

    def test_source_birth_guard_retains_fixed_numeric_trigger(self):
        source=m.Source.__new__(m.Source);source.check=Reader(FakeClock());source.proc=Path('/private');source.expected={'pid':9,'startTicks':100}
        with patch.object(m,'read',return_value='qdrant'),patch.object(m.os,'readlink',return_value='/private/qdrant'),patch.object(m,'proc_identity',return_value={'startTicks':101}):
            with self.assertRaises(m.GuardFailure)as caught:source.fence('after_sample')
        self.assertEqual(str(caught.exception),'source_changed')
        self.assertEqual(caught.exception.diagnostic,{'trigger':'source_birth','phase':'after_sample','expectedStartTicks':100,'observedStartTicks':101})
        self.assertNotIn('/private',json.dumps(m.diagnostic(caught.exception)))

    def test_added_group_process_still_rejects_sample_with_trigger(self):
        source=m.Source.__new__(m.Source);source.proc=Path('/private');source.expected={'pid':9,'startTicks':100};source.reader_birth=200
        before={'processMembershipHash':m.digest([9]),'processCount':1,'processVmLckBytes':0}
        after={'processMembershipHash':m.digest([9,10]),'processCount':2,'processVmLckBytes':0}
        def read(path,size=65536):
            if path.name=='io' and path.parent.name!='pressure':return 'read_bytes: 0'
            if path.name=='status':return 'VmLck: 0 kB'
            if path.name=='meminfo':return '\n'.join(k+': 0 kB'for k in m.MEM)
            if path.name=='vmstat':return '\n'.join(k+' 0'for k in m.VM)
            return 'some avg10=0 total=0\nfull avg10=0 total=0'
        with patch.object(source,'fence'),patch.object(source,'reader_proof',return_value={}),patch.object(source,'group_read',side_effect=[before,after]),patch.object(m,'proc_identity',return_value={'startTicks':100}),patch.object(m,'read',side_effect=read),patch.object(m,'process_census',return_value={'complete':True}),patch.object(m,'siblings',return_value={'complete':True}):
            with self.assertRaises(m.GuardFailure)as caught:source.sample()
        proof=caught.exception.diagnostic
        self.assertEqual(str(caught.exception),'source_changed');self.assertEqual(proof['trigger'],'sample_membership')
        self.assertEqual((proof['beforeCount'],proof['afterCount']),(1,2));self.assertNotEqual(proof['beforeMembershipHash'],proof['afterMembershipHash'])

    def test_reviewed_embedded_reader_argv_reproduces_census_failure(self):
        repo=Path(__file__).resolve().parents[2]
        fixture=repo/'docs/implementation/search-ranking/resource-window-failure-20261012-1110/executed-reader-v1.py'
        original=fixture.read_bytes();self.assertEqual(m.hashlib.sha256(original).hexdigest(),'c01c7030a24daa0e4e8ca865d926f195cd94e9a87e269331550dfd7be38c36c5')
        launcher=Path(__file__).with_name('resource-window-prepared-transport-v1')/'launch_window_v1.py'
        tree=ast.parse(launcher.read_text());text=next(ast.literal_eval(n.value)for n in tree.body if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='SUPERVISOR'for t in n.targets))
        expression=next(n.value for n in ast.walk(ast.parse(text))if isinstance(n,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='code'for t in n.targets))
        args=['resource_window.py','--execute','--start-utc','2026-10-12T11:10:00+00:00','--end-utc','2026-10-12T11:40:00+00:00','--expected-source-sha256','921098a80d6ed1259c9473bcbde4d30736ca544560bdfcb1d380d9db72dbc37f','--backup-path-sha256','3a5f18b515069b168b9004e1a3fac4b83c6e4448af3ae9418758a0e4b5b9488c']
        code=eval(compile(ast.Expression(expression),'reviewed-child-expression','eval'),{'READER_ARGS':args,'source':original})
        raw=b'\0'.join(x.encode()for x in ['/usr/bin/python3','-I','-B','-c',code,'784907'])+b'\0'
        self.assertEqual(len(raw),27678)
        old={};exec(compile(original,'historical-reader','exec'),old)
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);node=root/'42';node.mkdir();(node/'comm').write_text('python3');(node/'cmdline').write_bytes(raw)
            with self.assertRaisesRegex(ValueError,'census_bound'):old['process_census'](root,'a'*64)
            with self.assertRaises(m.GuardFailure)as caught:m.process_census(root,'a'*64)
        self.assertEqual(caught.exception.diagnostic,{'trigger':'argv_limit','phase':'process_census'})
        self.assertNotIn('prctl',json.dumps(m.diagnostic(caught.exception)))

    def test_failure_frame_keeps_guard_diagnostic_and_no_unsafe_errors(self):
        source=type('FakeSource',(),{'close':lambda self:None})()
        args=['resource_window.py','--execute','--expected-source-sha256','a'*64,'--backup-path-sha256','b'*64]
        for error,reason,trigger in [(m.GuardFailure('source_changed','source_birth','before_sample',expectedStartTicks=3,observedStartTicks=4),'source_changed','source_birth'),(OSError('/secret VALUE'),'sample_failed',None)]:
            out=io.StringIO()
            with patch('sys.argv',args),patch.object(m,'Source',return_value=source),patch.object(m,'run',side_effect=error),contextlib.redirect_stdout(out):self.assertEqual(m.main(),1)
            row=json.loads(out.getvalue());self.assertEqual(row['reason'],reason);self.assertFalse(row['continuousCoverage'])
            self.assertEqual(row.get('diagnostic',{}).get('trigger'),trigger);self.assertNotIn('/secret',out.getvalue());self.assertNotIn('VALUE',out.getvalue())

    def test_diagnostic_rejects_private_or_malformed_fields(self):
        for evidence in [{'path':'/secret'},{'expectedStartTicks':True},{'expectedGroupHash':'private'}]:
            with self.assertRaisesRegex(ValueError,'invalid_numeric'):m.GuardFailure('source_changed','source_birth','before_sample',**evidence)

    def test_only_current_reader_is_excluded_and_other_python_stays_bounded(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);own=root/'42';own.mkdir();parts=['0']*22;parts[19]='100'
            (own/'stat').write_text('42 (python3) '+' '.join(parts));(own/'comm').write_text('python3');(own/'cmdline').write_text('private'*5000)
            with patch.object(m.os,'getpid',return_value=42):
                result=m.process_census(root,'a'*64,own_reader_birth=100)
                self.assertTrue(result['complete']);self.assertEqual(result['ownedReaderExcludedCount'],1)
                with self.assertRaises(m.GuardFailure):m.process_census(root,'a'*64)
                other=root/'43';other.mkdir();(other/'comm').write_text('python3');(other/'cmdline').write_text('other-private'*5000)
                with self.assertRaises(m.GuardFailure)as caught:m.process_census(root,'a'*64,own_reader_birth=100)
                self.assertEqual(caught.exception.diagnostic['trigger'],'argv_limit')

    def test_reader_birth_or_missing_identity_cannot_be_exempted(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);own=root/'42';own.mkdir();parts=['0']*22;parts[19]='100';(own/'stat').write_text('42 (python3) '+' '.join(parts))
            with patch.object(m.os,'getpid',return_value=42):
                for birth in [99,True]:
                    with self.assertRaisesRegex(ValueError,'reader_identity_changed'):m.process_census(root,'a'*64,own_reader_birth=birth)
                original=m.proc_identity
                count=0
                def changed(path):
                    nonlocal count
                    count+=1;value=original(path)
                    if count>=3:value['startTicks']=101
                    return value
                with patch.object(m,'proc_identity',side_effect=changed):
                    with self.assertRaisesRegex(ValueError,'reader_identity_changed'):m.process_census(root,'a'*64,own_reader_birth=100)
                (own/'stat').unlink()
                with self.assertRaisesRegex(ValueError,'reader_identity_changed'):m.process_census(root,'a'*64,own_reader_birth=100)

    def test_reader_mandatory_presence_even_when_stat_fence_passes(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name)
            with patch.object(m.os,'getpid',return_value=42),patch.object(m,'proc_identity',return_value={'startTicks':100}):
                with self.assertRaisesRegex(ValueError,'reader_identity_changed'):m.process_census(root,'a'*64,own_reader_birth=100)

    def test_default_census_has_zero_owned_exclusions(self):
        with tempfile.TemporaryDirectory()as name:
            self.assertEqual(m.process_census(Path(name),'a'*64)['ownedReaderExcludedCount'],0)

    def test_reader_proof_rejects_birth_change_before_placement(self):
        source=m.Source.__new__(m.Source);source.reader_pid=42;source.reader_birth=100;source.proc=Path('/private')
        with patch.object(m.os,'getpid',return_value=42),patch.object(m,'proc_identity',return_value={'startTicks':101}),patch.object(m,'group_path',side_effect=AssertionError):
            with self.assertRaisesRegex(ValueError,'reader_identity_changed'):source.reader_proof()

    def test_actual_embedded_reader_proc_argv_needs_only_own_exclusion(self):
        import subprocess,os
        source=Path(__file__).with_name('resource_window.py').read_bytes()
        with tempfile.TemporaryDirectory()as name:
            prefix="import ctypes,os,signal,sys;libc=ctypes.CDLL(None,use_errno=True);expected=int(sys.argv[1]);checked=libc.prctl(1,signal.SIGKILL,0,0,0)==0 and os.getppid()==expected;checked or sys.exit(1);"
            code=prefix+"ns={'__name__':'reviewed_resource_fixture'};exec(compile("+repr(source)+",'<reviewed-resource-window>','exec'),ns);"+"from pathlib import Path;import json;root=Path("+repr(name)+");pid=os.getpid();(root/str(pid)).symlink_to(Path('/proc')/str(pid));birth=ns['proc_identity'](root/str(pid))['startTicks'];"
            code+="\ntry:ns['process_census'](root,'a'*64)\nexcept ns['GuardFailure'] as error:before=error.diagnostic['trigger']\nelse:before='unexpected_success'\n"
            code+="after=ns['process_census'](root,'a'*64,own_reader_birth=birth);raw=ns['read'](Path('/proc')/str(pid)/'cmdline',65536);print(json.dumps({'beforeTrigger':before,'complete':after['complete'],'excluded':after['ownedReaderExcludedCount'],'actualArgvBytes':len(raw.encode()),'VmLckBytes':ns['fields'](ns['read'](Path('/proc')/str(pid)/'status'),('VmLck',),True)['VmLck']}))"
            result=subprocess.run(['/usr/bin/python3','-I','-B','-c',code,str(os.getpid())],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10,check=True)
        row=json.loads(result.stdout)
        self.assertEqual(row['beforeTrigger'],'argv_limit');self.assertGreater(row['actualArgvBytes'],8192)
        self.assertTrue(row['complete']);self.assertEqual(row['excluded'],1);self.assertEqual(row['VmLckBytes'],0)

if __name__=='__main__':unittest.main()
