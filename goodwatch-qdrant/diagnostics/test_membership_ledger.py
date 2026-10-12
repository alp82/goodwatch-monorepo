import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('resource_window',Path(__file__).with_name('resource_window.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def member(proc,pid,ticks,comm):
    root=proc/str(pid);root.mkdir(exist_ok=True)
    parts=['0']*22;parts[19]=str(ticks)
    (root/'stat').write_text(str(pid)+' (private stat name) '+' '.join(parts))
    (root/'comm').write_text(comm+'\n');(root/'status').write_text('VmLck: 0 kB')
    (root/'cmdline').write_text('PRIVATE argv sentinel'*1000)

class LedgerTests(unittest.TestCase):
    def group(self,root):
        group=root/'group';group.mkdir();(group/'cgroup.procs').write_text('10\n')
        for name,keys in [('memory.stat',m.STAT),('memory.events.local',m.EVENTS),('cpu.stat',m.CPU)]:
            (group/name).write_text('\n'.join(key+' 0'for key in keys))
        for name in ('memory.current','memory.swap.current'):(group/name).write_text('0')
        for name in ('memory.pressure','io.pressure'):(group/name).write_text('some avg10=0 total=0\nfull avg10=0 total=0')
        source=m.Source.__new__(m.Source);source.group=group;source.proc=root/'proc';source.proc.mkdir();source.expected={'pid':10,'startTicks':100};source.reader_birth=500;source.backup_hash='a'*64;source.ancestor_hash='b'*64
        member(source.proc,10,100,'qdrant');(source.proc/'10'/'io').write_text('read_bytes: 0')
        (source.proc/'meminfo').write_text('\n'.join(key+': 0 kB'for key in m.MEM))
        (source.proc/'vmstat').write_text('\n'.join(key+' 0'for key in m.VM))
        pressure=source.proc/'pressure';pressure.mkdir()
        for name in ('memory','io'):(pressure/name).write_text('some avg10=0 total=0\nfull avg10=0 total=0')
        return source
    def test_actual_group_member_added_between_sample_fences_keeps_failure_and_births(self):
        with tempfile.TemporaryDirectory()as name:
            source=self.group(Path(name))
            def census(*args,**kwargs):
                member(source.proc,11,110,'sh');(source.group/'cgroup.procs').write_text('10\n11\n');return {'complete':True}
            with patch.object(source,'fence'),patch.object(source,'reader_proof',return_value={}),patch.object(m,'process_census',side_effect=census),patch.object(m,'siblings',return_value={'complete':True}):
                with self.assertRaises(m.GuardFailure)as caught:source.sample()
        self.assertEqual(str(caught.exception),'source_changed');proof=caught.exception.diagnostic
        self.assertEqual(proof['trigger'],'sample_membership');self.assertEqual(proof['beforeCount'],1);self.assertEqual(proof['afterCount'],2)
        self.assertEqual(proof['beforeMembers'],[{'pid':10,'startTicks':100,'commClass':'qdrant','birthVerified':True}])
        self.assertEqual(proof['afterMembers'][-1],{'pid':11,'startTicks':110,'commClass':'shell','birthVerified':True})
        self.assertTrue(proof['beforeLedgerComplete']);self.assertTrue(proof['afterLedgerComplete'])
    def test_private_comm_and_argv_are_never_read_or_emitted(self):
        with tempfile.TemporaryDirectory()as name:
            proc=Path(name);member(proc,12,120,'PRIVATE comm sentinel')
            original=m.read;reads=[]
            def observed(path,*args):
                reads.append(Path(path).name);return original(path,*args)
            with patch.object(m,'read',side_effect=observed):ledger=m.membership_ledger(proc,[12])
        self.assertEqual(set(reads),{'stat','comm'});self.assertEqual(ledger['members'][0]['commClass'],'other');self.assertNotIn('PRIVATE',json.dumps(ledger))
    def test_changed_birth_and_disappearance_are_unavailable(self):
        with tempfile.TemporaryDirectory()as name:
            proc=Path(name);member(proc,10,100,'qdrant');original=m.read
            def replaced(path,*args):
                if Path(path).name=='comm':member(proc,10,101,'qdrant')
                return original(path,*args)
            with patch.object(m,'read',side_effect=replaced):ledger=m.membership_ledger(proc,[10,11])
        self.assertFalse(ledger['complete']);self.assertTrue(all(row['startTicks']is None and row['birthVerified']is False and row['commClass']=='unavailable'for row in ledger['members']))
    def test_sixteen_member_limit_and_time_bound_are_explicit(self):
        with tempfile.TemporaryDirectory()as name:
            proc=Path(name)
            for pid in range(1,18):member(proc,pid,pid*10,'python3')
            ledger=m.membership_ledger(proc,list(range(17,0,-1)))
            self.assertTrue(ledger['truncated']);self.assertFalse(ledger['complete']);self.assertEqual([r['pid']for r in ledger['members']],list(range(1,17)))
            times=iter((0,1));expired=m.membership_ledger(proc,[1],clock=lambda:next(times))
            self.assertFalse(expired['complete']);self.assertFalse(expired['members'][0]['birthVerified'])
    def test_original_membership_failure_survives_failed_diagnostic_collection(self):
        with tempfile.TemporaryDirectory()as name:
            source=self.group(Path(name))
            def census(*args,**kwargs):
                member(source.proc,11,110,'python');(source.group/'cgroup.procs').write_text('10\n11\n');return {'complete':True}
            with patch.object(m,'membership_ledger',side_effect=OSError('PRIVATE failure')),patch.object(source,'fence'),patch.object(source,'reader_proof',return_value={}),patch.object(m,'process_census',side_effect=census),patch.object(m,'siblings',return_value={'complete':True}):
                with self.assertRaises(m.GuardFailure)as caught:source.sample()
        self.assertEqual(str(caught.exception),'source_changed');self.assertEqual(caught.exception.diagnostic['trigger'],'sample_membership');self.assertFalse(caught.exception.diagnostic['beforeLedgerComplete']);self.assertNotIn('PRIVATE',json.dumps(caught.exception.diagnostic))
    def test_unchanged_group_retains_exact_original_public_frame_fields(self):
        with tempfile.TemporaryDirectory()as name:
            source=self.group(Path(name));before=source.group_read();after=source.group_read()
            self.assertEqual(before,after);self.assertNotIn('members',before);self.assertNotIn('startTicks',before)
    def test_final_membership_change_retains_ledger_and_original_failure(self):
        with tempfile.TemporaryDirectory()as name:
            source=self.group(Path(name))
            def reader():
                member(source.proc,11,110,'python3');(source.group/'cgroup.procs').write_text('10\n11\n');return {}
            with patch.object(source,'fence'),patch.object(source,'reader_proof',side_effect=reader):
                with self.assertRaises(m.GuardFailure)as caught:source.finish()
        self.assertEqual(str(caught.exception),'source_changed');self.assertEqual(caught.exception.diagnostic['trigger'],'final_membership');self.assertEqual(caught.exception.diagnostic['afterMembers'][-1]['commClass'],'python')
    def test_maximum_encoded_failure_stays_inside_frame_budget_and_rejects_bad_ledger(self):
        entries=[{'pid':2**64-1-i,'startTicks':2**64-1,'birthVerified':True,'commClass':'qdrant'}for i in range(16)]
        self.assertTrue(all(len(json.dumps(row,separators=(',',':')).encode())<=128 for row in entries))
        ledger={'members':entries,'complete':False,'truncated':True};before={'processCount':64,'processMembershipHash':'a'*64};after={'processCount':64,'processMembershipHash':'b'*64}
        error=m.membership_failure('sample_membership','after_sample',before,after,ledger,ledger)
        frame={'event':'resource-window.failed.v1','at':'2026-10-12T14:12:06.063142+00:00','reason':str(error),'continuousCoverage':False,'futureCeilingEstablished':False,'productionAcceptance':False,**m.diagnostic(error)}
        self.assertLessEqual(len((json.dumps(frame)+'\n').encode()),8192)
        output=io.StringIO();m.Output(output).emit(frame);self.assertNotIn('members',before)
        invalid={'members':[{'pid':True,'startTicks':1,'birthVerified':True,'commClass':'PRIVATE'}],'complete':True,'truncated':False}
        bad=m.membership_failure('sample_membership','after_sample',before,after,invalid,ledger)
        self.assertEqual(str(bad),'source_changed');self.assertFalse(bad.diagnostic['beforeLedgerComplete']);self.assertNotIn('PRIVATE',json.dumps(bad.diagnostic))
        empty=m.membership_failure('sample_membership','after_sample',before,after,{'members':[],'complete':True,'truncated':False},ledger)
        self.assertFalse(empty.diagnostic['beforeLedgerComplete']);self.assertTrue(empty.diagnostic['beforeLedgerTruncated'])

if __name__=='__main__':unittest.main()
