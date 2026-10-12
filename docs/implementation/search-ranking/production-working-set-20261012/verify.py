"""Strict public receipt/privacy/hash validation and exact nine offline fixtures."""
import hashlib,json,os,re,sys,unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
FIELDS=set('accountingAfter accountingBefore archiveContentReads classesMeasured codeSha256 contentFixed contractSha256 cpuLimitDelta deletedMappingsExcluded elapsedMs event extentRangesHashed helperVmas hostMemoryAfter hostMemoryBefore kernelRelease lockedBytes mappedCohortSha256 mappedCohortUnchanged mappedContentReads maxMapCount memoryEventDelta modelContentReads nofileLimits ownFdCohortUnchanged ownFdCountAfter ownFdCountBefore ownFdCountUnchanged ownNofileRestored ownOomScoreAdjUnchanged ownVmLockedBytesAfter ownVmLockedBytesBefore pageBytes parentOutsideSourceCgroup payloadSelectedBytes phase queries readOnlySharedMappings selectedBytesLe2GiB selectedDataBytes selectedResidentDataBytes selectionHash sourceAllocationUnchanged sourceIdentitySha256 sourceOomGroupZero sourcePid sourceStartTicks storageWrites vmLockedBytes'.split())
BOOLS=set('contentFixed extentRangesHashed mappedCohortUnchanged ownFdCohortUnchanged ownFdCountUnchanged ownNofileRestored ownOomScoreAdjUnchanged parentOutsideSourceCgroup readOnlySharedMappings selectedBytesLe2GiB sourceAllocationUnchanged sourceOomGroupZero'.split())
HASHES=set('codeSha256 contractSha256 mappedCohortSha256 selectionHash sourceIdentitySha256'.split())
NESTED={'accountingBefore':set('anonBytes availableBytes currentBytes fileBytes kernelBytes unevictableBytes'.split()),'accountingAfter':set('anonBytes availableBytes currentBytes fileBytes kernelBytes unevictableBytes'.split()),'hostMemoryBefore':{'MemAvailable','Dirty','Writeback'},'hostMemoryAfter':{'MemAvailable','Dirty','Writeback'},'cpuLimitDelta':{'nr_throttled','throttled_usec'},'memoryEventDelta':{'max','oom','oom_kill'}}

def numbers(row,keys):
 assert type(row)is dict and set(row)==keys
 assert all(type(value)is int and value>=0 for value in row.values())

def validate(rows):
 assert len(rows)==2
 row,transport=rows
 assert type(row)is dict and set(row)==FIELDS
 assert row['event']=='qdrant.working-set-measure.v1'and row['phase']=='completed'
 assert type(row['kernelRelease'])is str and re.fullmatch('[A-Za-z0-9._+-]{1,96}',row['kernelRelease'])
 for key in BOOLS:assert type(row[key])is bool
 for key in HASHES:assert type(row[key])is str and re.fullmatch('[a-f0-9]{64}',row[key])
 for key,fields in NESTED.items():numbers(row[key],fields)
 numeric=FIELDS-BOOLS-HASHES-set(NESTED)-{'classesMeasured','nofileLimits','event','phase','kernelRelease'}
 assert all(type(row[k])is int and row[k]>=0 for k in numeric)
 assert set(row['classesMeasured'])=={'vector','graph','sparse','other','payload'}
 for fields in row['classesMeasured'].values():
  numbers(fields,set('dataBytes dataPages dataRangeCount files rawExtentCount residentDataBytes residentDataPages'.split()))
  assert fields['dataBytes']==fields['dataPages']*row['pageBytes']and fields['residentDataBytes']==fields['residentDataPages']*row['pageBytes']
  assert fields['residentDataPages']<=fields['dataPages']
 nofile=row['nofileLimits'];assert set(nofile)==set('hardChanged hardLimit mappedFileBound openFdCount raised requiredSoft reserveFds softAfter softBefore'.split())
 assert type(nofile['hardChanged'])is bool and type(nofile['raised'])is bool
 assert all(type(v)is int and v>=0 for k,v in nofile.items()if k not in('hardChanged','raised'))
 assert nofile['hardChanged']is False and nofile['softAfter']<=nofile['hardLimit']
 assert nofile['requiredSoft']==nofile['openFdCount']+nofile['mappedFileBound']+nofile['reserveFds']
 assert row['contentFixed']is False
 for key in BOOLS-{'contentFixed'}:assert row[key]is True
 for key in ('archiveContentReads','mappedContentReads','modelContentReads','lockedBytes','payloadSelectedBytes','queries','storageWrites','vmLockedBytes','ownVmLockedBytesBefore','ownVmLockedBytesAfter'):assert row[key]==0
 assert not any(row['cpuLimitDelta'].values())and not any(row['memoryEventDelta'].values())
 selected=('vector','graph','sparse','other')
 assert row['selectedDataBytes']==sum(row['classesMeasured'][k]['dataBytes']for k in selected)
 assert row['selectedResidentDataBytes']==sum(row['classesMeasured'][k]['residentDataBytes']for k in selected)
 assert row['selectedDataBytes']<=2*1024**3 and row['ownFdCountBefore']==row['ownFdCountAfter']
 assert transport=={'event':'qdrant.working-set-transport.v1','remoteExit':0,'execution':True}
 return row

def main():
 provenance=json.loads((HERE/'provenance.json').read_text())
 for name,proof in provenance['artifacts'].items():
  raw=(HERE/name).read_bytes();assert len(raw)==proof['bytes']and hashlib.sha256(raw).hexdigest()==proof['sha256'],name
 raw=(HERE/'actual-frames.jsonl').read_bytes()
 assert hashlib.sha256(raw).hexdigest()=='c6ee4169bf75b082c58a72531f257f4707d2887e1264676aeba19a193fb00a9e'
 measured=validate([json.loads(line)for line in raw.splitlines()])
 receipt=json.loads((HERE/'receipt.json').read_text())
 assert receipt['selectedDataBytes']==measured['selectedDataBytes']==1711960064
 assert receipt['selectedResidentDataBytes']==measured['selectedResidentDataBytes']==1374248960
 assert receipt['selectedNonresidentDataBytes']==measured['selectedDataBytes']-measured['selectedResidentDataBytes']
 assert receipt['futurePinBudgetEstablished']is False and receipt['latencyBenefitEstablished']is False
 manifest=json.loads((HERE/'manifest.json').read_text());code=hashlib.sha256()
 for name in ('pin.py','runtime.py','production.py'):
  content=(HERE/name).read_bytes();assert hashlib.sha256(content).hexdigest()==manifest['codeFiles'][name];code.update(name.encode()+b'\0'+content+b'\0')
 assert code.hexdigest()==manifest['codeSha256']==measured['codeSha256']
 sys.path.insert(0,str(HERE));os.chdir(HERE)
 import test_measure
 result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromModule(test_measure))
 print(json.dumps({'publicFixtureTests':result.testsRun,'passed':result.wasSuccessful(),'strictReceiptWhitelisted':True,'privateContractIncluded':False,'codeSha256':code.hexdigest(),'actualFrames':2}))
 return 0 if result.wasSuccessful()else 1
if __name__=='__main__':raise SystemExit(main())
