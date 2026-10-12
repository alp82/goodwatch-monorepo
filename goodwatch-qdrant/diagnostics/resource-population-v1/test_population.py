import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import reader
import auditor

HERE=Path(__file__).parent

def old_module():
    spec=importlib.util.spec_from_file_location('strict_reader_reference',HERE/'strict-reader-v3.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def status(value=0):return 'VmLck: '+str(value)+' kB\n'

def stat(pid,birth=100):
    values=['0']*22;values[1]='1';values[7]='0';values[9]='0';values[19]=str(birth);values[21]='0'
    return str(pid)+' (fake) '+ ' '.join(values)

class PopulationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.proc=self.root/'proc';self.proc.mkdir();self.cgroot=self.root/'cg';self.group=self.cgroot/'source';self.group.mkdir(parents=True)
        self.source=reader.Source.__new__(reader.Source);self.source.proc=self.proc;self.source.cgroot=self.cgroot;self.source.group=self.group;self.source.expected={'pid':1}
        self.add(1);self.list([1])
    def add(self,pid,locked=0,missing_lock=False):
        root=self.proc/str(pid);root.mkdir();(root/'stat').write_text(stat(pid));(root/'comm').write_text('other\n');(root/'status').write_text('Name: fake\n' if missing_lock else status(locked));(root/'cgroup').write_text('0::/source\n')
    def list(self,pids): (self.group/'cgroup.procs').write_text('\n'.join(map(str,pids))+'\n')
    def test_verified_aux_churn_is_not_primary_change(self):
        self.add(2);self.list([1,2]);before=self.source.population();self.list([1]);after=self.source.population()
        self.assertEqual(before['status'],'endpoint-verified');self.assertEqual(after['status'],'endpoint-verified');self.assertNotEqual(before['membershipHash'],after['membershipHash'])
    def test_zombie_or_missing_vm_lock_is_unknown(self):
        self.add(2,missing_lock=True);self.list([1,2]);row=self.source.population()
        self.assertEqual(row['unknownLocks'],1);self.assertEqual(row['members'][1],[2,None,'unavailable',None,'unknown']);self.assertEqual(row['status'],'partial')
    def test_positive_then_vanish_still_fatal(self):
        self.add(2,locked=1);self.list([1,2])
        with self.assertRaisesRegex(reader.GuardFailure,'source_locked')as failure:self.source.population()
        self.assertEqual(failure.exception.diagnostic['lockedBytes'],1024)
    def test_birth_reuse_unknown_not_zero(self):
        self.add(2);self.list([1,2]);original=reader.proc_identity;counts={}
        def identity(root):
            row=original(root);counts[str(root)]=counts.get(str(root),0)+1
            if root.name=='2'and counts[str(root)]==2:row['startTicks']+=1
            return row
        with patch.object(reader,'proc_identity',side_effect=identity):row=self.source.population()
        self.assertEqual(row['unknownLocks'],1)
    def test_duplicate_and_overbound_list_partial(self):
        self.list([1,1]);self.assertEqual(self.source.population()['status'],'partial')
        self.list(list(range(2,70)))
        # Main is proved separately by mandatory source fences; truncated list does not assert absence.
        self.assertEqual(self.source.population()['status'],'partial')
    def test_complete_unique_main_absent_fatal(self):
        self.list([2])
        with self.assertRaisesRegex(ValueError,'source_changed'):self.source.population()
    def test_aux_disappeared_is_unknown(self):
        self.list([1,2]);self.assertEqual(self.source.population()['unknownLocks'],1)
    def test_directory_inode_change_fatal(self):
        self.source.group_identity=self.source.directory_identity();self.source.check=SimpleNamespace(verify=lambda:None)
        previous=self.group.rename(self.cgroot/'old');self.group.mkdir()
        with self.assertRaisesRegex(ValueError,'group_identity_changed'):self.source.fence()
    def test_symlink_directory_fatal(self):
        other=self.cgroot/'other';other.mkdir();(self.group/'cgroup.procs').unlink();self.group.rmdir();self.group.symlink_to(other)
        with self.assertRaisesRegex(ValueError,'group_identity_changed'):self.source.directory_identity()

class GuardTests(unittest.TestCase):
    def test_docker_top_second_qdrant_keeps_original_fatal(self):
        data={'id':'a','image':reader.IMAGE,'running':True,'mounts':[{'Source':'/owned','Destination':'/qdrant/storage','Type':'bind','RW':True}],'memory':0,'swap':0,'cpu':0}
        with patch.object(reader,'command',side_effect=[json.dumps(data),'PID COMM\n1 qdrant\n2 qdrant\n']):
            with self.assertRaisesRegex(ValueError,'source_changed'):reader.docker_frame(Path('/fake'))
    def test_table_preserves_exact_old_metric_names(self):
        old=old_module();table=json.loads(reader.OUTCOME_TABLE_BYTES)
        for source,key in [('MEM','hostMeminfo'),('VM','hostVmstat'),('STAT','sourceMemoryStat'),('EVENTS','sourceMemoryEventsLocal'),('CPU','sourceCpuStat')]:
            self.assertEqual(table['requiredMetrics'][key],list(getattr(old,source)));self.assertEqual(table['requiredMetrics'][key],list(getattr(reader,source)))
        self.assertEqual(hashlib.sha256(reader.OUTCOME_TABLE_BYTES).hexdigest(),reader.OUTCOME_TABLE_SHA256)
    def test_old_reference_hashes_unchanged(self):
        self.assertEqual(hashlib.sha256((HERE/'strict-reader-v3.py').read_bytes()).hexdigest(),'17e692e8c44c751a2ddbc4b1f98bd6d651323c12cf2bff42369c7d98ac8093b8')
    def test_output_permission_false_and_foreign_coverage_refused(self):
        out=io.StringIO();reader.Output(out).emit({'event':'resource-population.prepared-only.v1'})
        self.assertTrue(all(json.loads(out.getvalue())[key]is False for key in reader.PERMISSIONS))
        with self.assertRaisesRegex(ValueError,'invalid_numeric'):reader.Output(io.StringIO()).emit({'coverage':'complete'})
    def test_old_journal_not_applicable_and_new_journal_old_unknown(self):
        self.assertEqual(auditor.audit([{'event':'resource-window.sample.v1'}],{},'a'*64)['status'],'not-applicable')
        spec=importlib.util.spec_from_file_location('strict_auditor',HERE/'strict-auditor-v3.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
        self.assertEqual(old.audit([{'event':'resource-population.sample.v1'}],{})['coverage'],'UNKNOWN')



def fixture():
    zero=lambda names:{key:0 for key in names}
    psi={'some':{'avg10':0,'total':0},'full':{'avg10':0,'total':0}}
    population={'status':'endpoint-verified','observedCount':1,'duplicateCount':0,'unresolvedCount':0,'truncatedCount':0,'unknownLocks':0,'verifiedZeroLocks':1,'positiveLocks':0,'members':[[1,100,'qdrant',0,'verified']],'membershipHash':'a'*64}
    group={'currentBytes':0,'swapBytes':0,'memory':zero(reader.STAT),'events':zero(reader.EVENTS),'cpu':zero(reader.CPU),'memoryPsi':psi,'ioPsi':psi,'population':population}
    proof={'outsideSourceCgroup':True,'placementUnchanged':True,'VmLckBytes':0,'groupHash':'b'*64}
    row={'event':'resource-population.sample.v1','sample':0,'startedAt':'2026-10-12T00:00:00+00:00','finishedAt':'2026-10-12T00:00:00.100000+00:00','startedMonotonicSeconds':10,'finishedMonotonicSeconds':10.1,'durationSeconds':.1,'host':zero(reader.MEM),'hostReclaim':zero(reader.VM),'hostPsi':{'memory':psi,'io':psi},'process':zero(('startTicks','parentPid','minorFaults','majorFaults','rssBytes','readBytes','VmLck')),'sourceBefore':copy.deepcopy(group),'sourceAfter':copy.deepcopy(group),'readerBefore':proof,'readerAfter':proof,'sourcePid':1,'sourceStartTicks':100,'sourceIdentityHash':'a'*64,'ancestorLimitHash':'a'*64,'sourceGroupHash':'a'*64,'sourceDirectoryIdentityHash':'a'*64,'dimensions':{'primaryIdentity':'observed-bracket','requiredMetrics':'observed-bracket','auxiliaryPopulation':'endpoint-verified','auxiliaryLocks':'endpoint-zero-verified','sshCensus':'observed-census','backupCensus':'observed-census','siblingCensus':'observed-census'}}
    row['sshUserspace']={'complete':True,'ownedReaderExcludedCount':1,'enumeratedCount':1,'unresolvedCount':0,'reasons':[],'identityHash':'a'*64,'classes':{name:{'processCount':0,'observedBytes':zero(reader.RSS)}for name in ('sshfs','sshfs-child-ssh','other-ssh')},'backup':{'complete':True,'observedCount':0,'identityHash':'a'*64,'occurrenceStatus':'none-observed-in-bounded-census'},'rssAccountingExact':False,'observedSumsAreTotal':False}
    row['otherCgroups']={'complete':True,'observedChildCount':0,'observedCurrentBytes':0,'observedMemory':zero(reader.STAT),'unresolvedCount':0,'reasons':[],'identityHash':'a'*64,'scope':'direct-source-parent-siblings-hierarchical-no-descendant-double-sum','otherHostBranchesMeasured':False,'observedSumsAreTotal':False}
    row['metadataOnly']=True;row['archiveResidentBytesMeasured']=False
    row['process']['startTicks']=100
    start={'event':'resource-population.started.v1','at':'2026-10-12T00:00:00+00:00','scheduledStart':'2026-10-12T00:00:00+00:00','scheduledEnd':'2026-10-12T00:00:02+00:00','intervalSeconds':2,'maximumGapSeconds':3,'startedMonotonicSeconds':10}
    final={'reader':proof,'sourceIdentityHash':'a'*64,'sourceDirectoryIdentityHash':'a'*64,'sourceBefore':copy.deepcopy(group),'sourceAfter':copy.deepcopy(group),'sourceLockStatus':'endpoint-zero-verified'}
    end={'event':'resource-population.complete.v1','at':'2026-10-12T00:00:02+00:00','samplingEndedAt':'2026-10-12T00:00:02+00:00','samplingStatus':'scheduled-samples-observed','fullScheduledWindowObserved':True,'elapsedMonotonicSeconds':2,'wallClockDriftSeconds':0,'samples':1,'finishedMonotonicSeconds':12,'finalResourceFence':final}
    rows=[{**v,**reader.PERMISSIONS,'schema':'resource-population.measurement.v1','outcomeTableSha256':reader.OUTCOME_TABLE_SHA256}for v in (start,row,end)]
    receipt={'event':'resource-population.reader-exit.v1','sourceSha256':'c'*64,'exitCode':0,'readerGoneProven':True,'clean':True,'termSent':False,'killSent':False,'readerPid':9,'readerStartTicks':123}
    return rows,receipt

class AuditTests(unittest.TestCase):
    def test_valid_required_sample_qualified_not_permission(self):
        rows,receipt=fixture();result=auditor.audit(rows,receipt,'c'*64)
        self.assertEqual(result['reasons'],[]);self.assertTrue(all(result[key]is False for key in reader.PERMISSIONS));self.assertNotIn('coverage',result)
    def test_each_required_metric_missing_refuses(self):
        for outer,names in [('host',reader.MEM),('hostReclaim',reader.VM)]:
            for name in names:
                rows,receipt=fixture();del rows[1][outer][name]
                self.assertEqual(auditor.audit(rows,receipt,'c'*64)['status'],'observation-incomplete-or-refused')
        for outer,names in [('memory',reader.STAT),('events',reader.EVENTS),('cpu',reader.CPU)]:
            for name in names:
                rows,receipt=fixture();del rows[1]['sourceBefore'][outer][name]
                self.assertIn('required-proof-missing',auditor.audit(rows,receipt,'c'*64)['reasons'])
    def test_swap_nonzero_refused(self):
        rows,receipt=fixture();rows[1]['host']['SwapTotal']=4096
        self.assertIn('source-lock-or-swap',auditor.audit(rows,receipt,'c'*64)['reasons'])
    def test_unknown_cannot_launder_endpoint_zero(self):
        rows,receipt=fixture();population=rows[1]['sourceBefore']['population'];population.update(members=[[1,None,'unavailable',None,'unknown']],verifiedZeroLocks=0,unknownLocks=1,unresolvedCount=1)
        self.assertIn('required-proof-missing',auditor.audit(rows,receipt,'c'*64)['reasons'])
        population['status']='partial';result=auditor.audit(rows,receipt,'c'*64)
        self.assertEqual(result['status'],'required-resource-samples-observed-with-census-unknowns')
    def test_endpoint_member_hash_churn_allowed_main_identity_not(self):
        rows,receipt=fixture();population=rows[1]['sourceAfter']['population'];population.update(members=[[1,100,'qdrant',0,'verified'],[2,200,'other',0,'verified']],observedCount=2,verifiedZeroLocks=2,membershipHash='d'*64)
        self.assertEqual(auditor.audit(rows,receipt,'c'*64)['reasons'],[])
        rows[2]['finalResourceFence']['sourceIdentityHash']='f'*64
        self.assertIn('final-source-fence',auditor.audit(rows,receipt,'c'*64)['reasons'])
    def test_clock_sample_and_receipt_failures(self):
        mutations=[lambda r,e:r[2].update(wallClockDriftSeconds=2),lambda r,e:r[1].update(durationSeconds=3),lambda r,e:r[1]['readerAfter'].update(outsideSourceCgroup=False),lambda r,e:e.update(readerStartTicks=None),lambda r,e:r[2]['finalResourceFence'].update(sourceDirectoryIdentityHash='d'*64)]
        for mutation in mutations:
            rows,receipt=fixture();mutation(rows,receipt)
            self.assertEqual(auditor.audit(rows,receipt,'c'*64)['status'],'observation-incomplete-or-refused')
    def test_two_sixteen_member_ledgers_worst_case_bounded_counted(self):
        rows,_=fixture();row=rows[1]
        def inflate(value):
            if isinstance(value,dict):
                for k,v in value.items():
                    if type(v)is int:value[k]=2**64-1
                    else:inflate(v)
            elif isinstance(value,list):
                for v in value:inflate(v)
        inflate(row)
        row['sshUserspace']['ownedReaderExcludedCount']=1
        row['sshUserspace']['complete']=False;row['sshUserspace']['reasons']=['census_bound'];row['sshUserspace']['unresolvedCount']=4096
        for index,item in enumerate(row['sshUserspace']['classes'].values()):item['processCount']=64 if index==0 else 0
        row['otherCgroups']['observedChildCount']=256;row['otherCgroups']['unresolvedCount']=256;row['otherCgroups']['complete']=False;row['otherCgroups']['reasons']=['census_bound']
        for key in ('sourceBefore','sourceAfter'):
            row[key]['population'].update(members=[[2147483647-i,None,'unavailable',None,'unknown']for i in range(16)],observedCount=16,duplicateCount=0,truncatedCount=0,unresolvedCount=16,unknownLocks=16,verifiedZeroLocks=0,positiveLocks=0)
        output=io.StringIO();reader.Output(output).emit(row);encoded=output.getvalue().encode();self.assertLessEqual(len(encoded),8192)
        result=json.loads(encoded)
        for key in ('sourceBefore','sourceAfter'):
            population=result[key]['population'];self.assertEqual(len(population['members'])+population['truncatedCount'],16)
        self.assertTrue(any(result[key]['population']['truncatedCount']>0 for key in ('sourceBefore','sourceAfter')));self.assertEqual(result['host'],row['host']);self.assertEqual(result['sourceBefore']['memory'],row['sourceBefore']['memory'])
    def test_total_output_bound_no_extra_write(self):
        output=io.StringIO();sink=reader.Output(output);sink.total=reader.OUTPUT_BYTES
        with self.assertRaisesRegex(ValueError,'output_bound'):sink.emit({'event':'resource-population.prepared-only.v1'})
        self.assertEqual(output.getvalue(),'')

class OptionalCensusTests(unittest.TestCase):
    def test_partial_ssh_retains_known_sum_and_reader_exclusion(self):
        with tempfile.TemporaryDirectory()as temporary:
            root=Path(temporary);own=root/str(os.getpid());own.mkdir();(own/'stat').write_text(stat(os.getpid()))
            good=root/'1';good.mkdir();(good/'comm').write_text('ssh');(good/'stat').write_text(stat(1));(good/'status').write_text(''.join(k+': 4 kB\n'for k in reader.RSS))
            missing=root/'2';missing.mkdir()
            value=reader.process_census(root,'a'*64,own_reader_birth=100)
            self.assertFalse(value['complete']);self.assertEqual(value['classes']['other-ssh']['processCount'],1);self.assertEqual(value['classes']['other-ssh']['observedBytes']['VmRSS'],4096);self.assertEqual(value['ownedReaderExcludedCount'],1)
            (own/'stat').write_text(stat(os.getpid(),101))
            with self.assertRaisesRegex(ValueError,'reader_identity_changed'):reader.process_census(root,'a'*64,own_reader_birth=100)
    def test_sibling_partial_retains_known_aggregate_symlink_fatal(self):
        with tempfile.TemporaryDirectory()as temporary:
            root=Path(temporary);source=root/'source';source.mkdir();good=root/'good';good.mkdir();(good/'memory.stat').write_text(''.join(k+' 4\n'for k in reader.STAT));(good/'memory.current').write_text('123');(root/'missing').mkdir()
            value=reader.siblings(source);self.assertFalse(value['complete']);self.assertEqual(value['observedCurrentBytes'],123)
            (root/'link').symlink_to(good)
            with self.assertRaisesRegex(ValueError,'source_cgroup_scope_invalid'):reader.siblings(source)
    def test_actual_child_inherits_parent_cgroup_no_source_placement_claim(self):
        import subprocess,sys
        parent=Path('/proc/self/cgroup').read_bytes()
        child=subprocess.run([sys.executable,'-I','-B','-c',"from pathlib import Path;import hashlib;print(hashlib.sha256(Path('/proc/self/cgroup').read_bytes()).hexdigest())"],capture_output=True,text=True,timeout=3,check=True)
        self.assertEqual(child.stdout.strip(),hashlib.sha256(parent).hexdigest())



class FenceTests(PopulationTests):
    def ready(self):
        source=self.source;source.group_identity=source.directory_identity();source.check=SimpleNamespace(verify=lambda:None);source.expected={'pid':1,'startTicks':100};source.expected_limits={};source.ancestor_hash='a'*64
        root=self.proc/'1';(root/'comm').write_text('qdrant');(root/'exe').symlink_to('/fixture/qdrant')
        return source
    def test_birth_executable_cgroup_and_limits_remain_fatal(self):
        source=self.ready()
        with patch.object(reader,'limits',return_value={}),patch.object(reader,'ancestors',return_value='a'*64):
            source.fence();(self.proc/'1'/'stat').write_text(stat(1,101))
            with self.assertRaisesRegex(reader.GuardFailure,'source_changed'):source.fence()
            (self.proc/'1'/'stat').write_text(stat(1));(self.proc/'1'/'exe').unlink();(self.proc/'1'/'exe').symlink_to('/fixture/other')
            with self.assertRaisesRegex(reader.GuardFailure,'source_changed'):source.fence()
            (self.proc/'1'/'exe').unlink();(self.proc/'1'/'exe').symlink_to('/fixture/qdrant');(self.cgroot/'other').mkdir();(self.proc/'1'/'cgroup').write_text('0::/other')
            with self.assertRaisesRegex(reader.GuardFailure,'source_changed'):source.fence()
            (self.proc/'1'/'cgroup').write_text('0::/source')
            with patch.object(reader,'limits',return_value={'changed':True}):
                with self.assertRaisesRegex(ValueError,'source_limits_changed'):source.fence()
    def test_main_vm_lock_missing_or_positive_fatal(self):
        source=self.ready();(self.proc/'1'/'status').write_text('Name: missing')
        with self.assertRaisesRegex(ValueError,'missing_required'):source.fence()
        (self.proc/'1'/'status').write_text(status(1))
        with self.assertRaisesRegex(reader.GuardFailure,'source_locked'):source.fence()
    def test_reader_move_birth_and_lock_fatal(self):
        source=self.ready();own=os.getpid();self.add(own);(self.cgroot/'reader').mkdir();(self.proc/str(own)/'cgroup').write_text('0::/reader');source.reader_pid=own;source.reader_birth=100;source.reader_group=self.cgroot/'reader'
        source.reader_proof();(self.proc/str(own)/'stat').write_text(stat(own,101))
        with self.assertRaisesRegex(ValueError,'reader_identity_changed'):source.reader_proof()
        (self.proc/str(own)/'stat').write_text(stat(own));(self.proc/str(own)/'status').write_text(status(1))
        with self.assertRaisesRegex(ValueError,'source_locked'):source.reader_proof()
        (self.proc/str(own)/'status').write_text(status());(self.proc/str(own)/'cgroup').write_text('0::/source')
        with self.assertRaisesRegex(ValueError,'reader_identity_changed'):source.reader_proof()
    def test_positive_lock_does_not_attempt_later_vanished_birth(self):
        self.add(2,locked=1);self.list([1,2]);original=reader.proc_identity;calls=[]
        def identity(root):
            if root.name=='2':
                calls.append(root)
                if len(calls)>1:raise FileNotFoundError()
            return original(root)
        with patch.object(reader,'proc_identity',side_effect=identity):
            with self.assertRaisesRegex(reader.GuardFailure,'source_locked'):self.source.population()
        self.assertEqual(len(calls),1)
    def test_ledger_time_bound_counted_unknown_not_zero(self):
        self.add(2);self.list([1,2])
        with patch.object(reader.time,'monotonic',side_effect=[0,1]):result=self.source.population()
        self.assertEqual(result['members'],[]);self.assertEqual(result['truncatedCount'],2);self.assertEqual(result['status'],'partial')
    def test_old_finish_churn_refusal_stays_exact(self):
        old=old_module();source=old.Source.__new__(old.Source);source.fence=lambda *args:None;source.reader_proof=lambda:{}
        for counts in ((1,2),(2,1)):
            groups=[{'processMembershipHash':str(count)*64,'processCount':count,'processVmLckBytes':0}for count in counts]
            source.group_read=lambda:groups.pop(0)
            with self.assertRaisesRegex(old.GuardFailure,'source_changed'):source.finish()



class SchedulerTests(unittest.TestCase):
    def schedule(self,duration):
        rows,_=fixture();ticks=[0.0];base=1791763200.0
        def sleep(amount):ticks[0]+=amount
        def sample():
            before=ticks[0];ticks[0]+=duration;row=copy.deepcopy(rows[1]);row.update(durationSeconds=duration,startedAt=stamp(before),finishedAt=stamp(ticks[0]));return row
        def stamp(value):
            import datetime
            return datetime.datetime.fromtimestamp(base+value,datetime.timezone.utc).isoformat()
        source=SimpleNamespace(sample=sample,fence=lambda:None,check=SimpleNamespace(verify=lambda:None),finish=lambda:rows[2]['finalResourceFence'])
        output=io.StringIO()
        with patch.object(reader,'stamp',side_effect=lambda:stamp(ticks[0])):
            reader.run(source,reader.Output(output),stamp(0),stamp(8),wall=lambda:base+ticks[0],clock=lambda:ticks[0],sleep=sleep)
        return [json.loads(row)for row in output.getvalue().splitlines()]
    def test_existing_sample_ceiling_not_relaxed_for_optional_work(self):
        self.assertEqual(self.schedule(.1)[-1]['samplingStatus'],'scheduled-samples-observed')
        self.assertEqual(self.schedule(3.1)[-1]['samplingStatus'],'sampling-incomplete')
    def test_optional_unclassified_error_and_exclusion_never_downgraded(self):
        with tempfile.TemporaryDirectory()as temporary:
            root=Path(temporary);own=root/str(os.getpid());own.mkdir();(own/'stat').write_text(stat(os.getpid()))
            with patch.object(Path,'glob',return_value=[]):
                with self.assertRaisesRegex(ValueError,'reader_identity_changed'):reader.process_census(root,'a'*64,own_reader_birth=100)
            with patch.object(reader,'read',side_effect=RuntimeError('unknown')):
                with self.assertRaises(RuntimeError):reader.process_census(root,'a'*64,own_reader_birth=100)
    def test_new_failed_journal_is_not_applicable(self):
        rows,receipt=fixture();rows.append({**rows[0],'event':'resource-population.failed.v1'})
        self.assertEqual(auditor.audit(rows,receipt,'c'*64)['status'],'not-applicable')



class SuccessorRegressionTests(unittest.TestCase):
    def test_optional_false_claims_cannot_promote_and_missing_refuses(self):
        rows,receipt=fixture();ssh=rows[1]['sshUserspace'];ssh.update(complete=False,reasons=['process_disappeared'],unresolvedCount=1);ssh['backup']['complete']=False
        result=auditor.audit(rows,receipt,'c'*64);self.assertEqual(result['dimensions']['sshCensus'],'partial');self.assertEqual(result['dimensions']['backupCensus'],'partial');self.assertEqual(result['censusEvidence'][0]['sshCensus']['unresolvedCount'],1)
        rows[1]['otherCgroups']={'complete':False,'reason':'optional_unreadable'}
        result=auditor.audit(rows,receipt,'c'*64);self.assertEqual(result['dimensions']['siblingCensus'],'unavailable')
        for key in ('sshUserspace','otherCgroups'):
            missing=copy.deepcopy(rows);del missing[1][key];self.assertEqual(auditor.audit(missing,receipt,'c'*64)['status'],'observation-incomplete-or-refused')
        ssh['ownedReaderExcludedCount']=0
        self.assertEqual(auditor.audit(rows,receipt,'c'*64)['dimensions']['requiredMetrics'],'not-established')
    def test_refused_dimensions_never_claim_observed(self):
        rows,receipt=fixture();rows[2]['wallClockDriftSeconds']=2
        result=auditor.audit(rows,receipt,'c'*64);self.assertTrue(all(value=='not-established'for value in result['dimensions'].values()))
    def test_final_second_population_validated_after_first_partial(self):
        rows,receipt=fixture();pop=rows[2]['finalResourceFence']['sourceBefore']['population'];pop.update(status='partial',observedCount=2,duplicateCount=1);rows[2]['finalResourceFence']['sourceLockStatus']='unknown'
        rows[2]['finalResourceFence']['sourceAfter']['population']['positiveLocks']=1
        self.assertEqual(auditor.audit(rows,receipt,'c'*64)['status'],'observation-incomplete-or-refused')
    def test_final_metadata_latency_not_clock_drift(self):
        rows,receipt=fixture();rows[2]['at']='2026-10-12T00:00:02.900000+00:00'
        self.assertEqual(auditor.audit(rows,receipt,'c'*64)['reasons'],[])
    def test_bad_input_typed_not_traceback(self):
        for rows,receipt in (([None],{}),([{'event':123}],{}),([],None)):
            self.assertEqual(auditor.audit(rows,receipt,'c'*64)['status'],'observation-incomplete-or-refused')
    def test_bound_reader_exclusion_proved_before_early_census_stop(self):
        with tempfile.TemporaryDirectory()as temporary:
            root=Path(temporary);own=root/str(os.getpid());own.mkdir();(own/'stat').write_text(stat(os.getpid()));other=root/'1';other.mkdir()
            with patch.object(Path,'glob',return_value=[other,own]),patch.object(reader,'read',wraps=reader.read):
                values=iter([0,2]);row=reader.process_census(root,'a'*64,clock=lambda:next(values),own_reader_birth=100)
            self.assertEqual(row['ownedReaderExcludedCount'],1);self.assertFalse(row['complete']);self.assertEqual(row['reasons'],['census_bound'])
    def test_byte_truncated_list_partial_main_proven_separately(self):
        with tempfile.TemporaryDirectory()as temporary:
            root=Path(temporary);group=root/'source';group.mkdir();(group/'cgroup.procs').write_text('2\n'*5000)
            source=reader.Source.__new__(reader.Source);source.group=group;source.proc=root;source.cgroot=root;source.expected={'pid':1}
            result=source.population();self.assertEqual(result['status'],'partial');self.assertGreater(result['truncatedCount'],0)
    def test_hashes_freeze_originals_and_consumer_modules(self):
        provenance=json.loads((HERE/'provenance.json').read_text());freeze=json.loads((HERE/'source-freeze.json').read_text())
        for name,value in freeze['files'].items():self.assertEqual(hashlib.sha256((HERE/name).read_bytes()).hexdigest(),value['sha256'])
        for name,key in [('strict-reader-v3.py','oldReaderSha256'),('strict-auditor-v3.py','oldAuditorSha256')]:self.assertEqual(hashlib.sha256((HERE/name).read_bytes()).hexdigest(),provenance[key])
        self.assertEqual(hashlib.sha256((HERE.parent/'resource_window.py').read_bytes()).hexdigest(),provenance['oldReaderSha256'])
        for name,value in provenance['unchangedOriginalTests'].items():self.assertEqual(hashlib.sha256((HERE.parent/name).read_bytes()).hexdigest(),value['sha256'])
        for name,value in provenance['unchangedOriginalAuditTests'].items():self.assertEqual(hashlib.sha256((HERE/('strict-'+name.replace('_','-'))).read_bytes()).hexdigest(),value['sha256'])
        for name,value in provenance['unchangedIdleConsumerFiles'].items():self.assertEqual(hashlib.sha256((HERE.parent/'pinning-prototype'/name).read_bytes()).hexdigest(),value['sha256'])



class LedgerAccountingTests(unittest.TestCase):
    def test_main_birth_mismatch_refuses_even_present(self):
        rows,receipt=fixture();rows[1]['sourceBefore']['population']['members'][0][1]=101
        self.assertEqual(auditor.audit(rows,receipt,'c'*64)['status'],'observation-incomplete-or-refused')
    def test_partial_observed_count_bound_and_accounting(self):
        for value in (None,'secret',-1,4097,2):
            rows,receipt=fixture();pop=rows[1]['sourceBefore']['population'];pop.update(status='partial',observedCount=value)
            result=auditor.audit(rows,receipt,'c'*64);self.assertEqual(result['status'],'observation-incomplete-or-refused');self.assertNotIn('secret',json.dumps(result))

if __name__=='__main__':unittest.main()
