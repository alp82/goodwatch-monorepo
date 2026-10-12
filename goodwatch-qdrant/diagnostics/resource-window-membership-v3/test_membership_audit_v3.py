import copy,importlib.util,unittest
from pathlib import Path
def load(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
a=load('audit_membership_v3');m=load('audit_transport_membership_v3')
def fixture():
    reader={'outsideSourceCgroup':True,'placementUnchanged':True,'VmLckBytes':0,'groupHash':'a'*64}
    group={'processMembershipHash':'b'*64,'processVmLckBytes':0}
    rows=[{'event':'resource-window.started.v1','at':'2026-10-12T10:00:00+00:00','scheduledStart':'2026-10-12T10:00:00+00:00','scheduledEnd':'2026-10-12T10:00:06+00:00','intervalSeconds':2,'maximumGapSeconds':3,'startedMonotonicSeconds':100}]
    for i in range(3):rows.append({'event':'resource-window.sample.v1','sample':i,'startedMonotonicSeconds':100+i*2,'finishedMonotonicSeconds':100+i*2+.1,'durationSeconds':.1,'startedAt':f'2026-10-12T10:00:0{i*2}+00:00','finishedAt':f'2026-10-12T10:00:0{i*2}.1+00:00','sourcePid':1,'sourceStartTicks':2,'sourceIdentityHash':'c'*64,'ancestorLimitHash':'d'*64,'sourceGroupHash':'e'*64,'sshUserspace':{'ownedReaderExcludedCount':1,'complete':True,'backup':{'complete':True}},'otherCgroups':{'complete':True},'sourceBefore':copy.deepcopy(group),'sourceAfter':copy.deepcopy(group),'readerBefore':copy.deepcopy(reader),'readerAfter':copy.deepcopy(reader)})
    rows.append({'event':'resource-window.complete.v1','at':'2026-10-12T10:00:06+00:00','continuousCoverage':True,'fullScheduledWindowObserved':True,'elapsedMonotonicSeconds':6,'finishedMonotonicSeconds':106,'wallClockDriftSeconds':0,'samples':3,'finalResourceFence':{'reader':reader,'sourceProcessVmLckBytes':0,'sourceMembershipHash':'b'*64,'sourceIdentityHash':'c'*64}})
    receipt={'event':'resource-window.reader-exit.v1','sourceSha256':a.SHA,'exitCode':0,'readerGoneProven':True,'termSent':False,'killSent':False,'clean':True,'pid':7,'startTicks':8}
    return rows,receipt
def combined():
    rows,receipt=fixture();born={'event':'resource-window.reader-born.v1','pid':receipt['pid'],'startTicks':receipt['startTicks'],'sourceSha256':receipt['sourceSha256']};return[born,*rows,receipt]
class Tests(unittest.TestCase):
    def test_complete_numeric_transport(self):self.assertEqual(m.audit(combined())['coverage'],'complete')
    def test_old_source_receipts_rejected_even_with_matching_birth(self):
        rows=combined()
        for row in(rows[0],rows[-1]):row['sourceSha256']='572ad7ca417ea4e5336b1415a4d015b7095d78f21cb0b5552f360f73914394d2'
        self.assertEqual(m.audit(rows)['coverage'],'UNKNOWN')
    def test_missing_or_false_receipt_cannot_pass(self):
        self.assertEqual(m.audit(combined()[:-1])['coverage'],'UNKNOWN')
        rows=combined();rows[-1]['exitCode']=False;self.assertEqual(m.audit(rows)['coverage'],'UNKNOWN')
    def test_missing_bool_or_multiple_exclusions_cannot_pass(self):
        for value in [None,True,0,2]:
            rows=combined();rows[2]['sshUserspace']['ownedReaderExcludedCount']=value
            self.assertIn('owned_reader_exclusion_invalid',m.audit(rows)['problems'])
    def test_birth_source_or_membership_drift_cannot_pass(self):
        rows=combined();rows[0]['startTicks']+=1;self.assertEqual(m.audit(rows)['coverage'],'UNKNOWN')
        rows=combined();rows[-1]['sourceSha256']='c01c7030a24daa0e4e8ca865d926f195cd94e9a87e269331550dfd7be38c36c5';self.assertEqual(m.audit(rows)['coverage'],'UNKNOWN')
        rows=combined();rows[3]['sourceAfter']['processMembershipHash']='f'*64;self.assertEqual(m.audit(rows)['coverage'],'UNKNOWN')
    def test_incomplete_class_or_unknown_event_cannot_pass(self):
        rows=combined();rows[2]['sshUserspace']['complete']=False;self.assertEqual(m.audit(rows)['coverage'],'UNKNOWN')
        rows=combined();rows.insert(1,{'event':'unreviewed'});self.assertEqual(m.audit(rows)['coverage'],'UNKNOWN')
if __name__=='__main__':unittest.main()
