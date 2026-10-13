import copy
import hashlib
import io
import json
import struct
import tempfile
import unittest
from pathlib import Path
import validate as v

PLAN_PATH=Path('../offline-bm25-reader-20261013/PLAN-v2.json')
TERM_PATH=Path('../index-readonly-acquisition-20261013/verified-index/term_statistics.json.gz')
PLAN=json.loads(PLAN_PATH.read_bytes())
def sha(b):return hashlib.sha256(b).hexdigest()
def physical(p):b=Path(p).read_bytes();return {'bytes':len(b),'sha256':sha(b)}
def observation(kind):
 p={'collection':v.COLLECTION,'vector':v.VECTOR,'modifier':None,'pointsCount':244262,'status':'green','shards':6,'replication':1}
 return {'kind':kind,'observedAt':'2026-10-13T00:20:00.000Z',**p,'configurationProjectionSha256':sha(json.dumps(p,separators=(',',':')).encode())}
def frame(i):
 return {'kind':'point','row':i,'id':PLAN['ids'][i],'presence':'present','valid':True,'empty':False,'reason':None,'indices':[1,4294967295],'observedValues':[0.33333334,0],'float32Values':[struct.unpack('<f',struct.pack('<f',0.33333334))[0],0]}
def stream(path,mutation=None):
 count={'rows':42934,'valid':42934,'missing':0,'invalid':0,'empty':0,'entries':85868};total=0
 with open(path,'wb') as f:
  def emit(row):
   nonlocal total
   b=(json.dumps(row,separators=(',',':'))+'\n').encode();f.write(b);total+=len(b)
  emit({'kind':'header','schema':v.SCHEMA,'planSha256':v.PLAN_SHA,'readerSha256':v.READER_SHA,'collection':v.COLLECTION,'vector':v.VECTOR,'expectedRows':42934,'float32Reconstruction':'Math.fround(observedDecimal)','historicalSnapshotEqualityProven':False})
  emit(observation('collection-before'))
  for i in range(42934):
   row=frame(i)
   if mutation and i==0:row=mutation(row,count)
   emit(row)
  emit(observation('collection-after'))
  emit({'kind':'terminal','schema':v.SCHEMA,'complete':True,'requests':88,'pointRequests':86,**count,'responseBytes':100000,'outputBytesBeforeTerminal':total,'elapsedMs':1000,'productionWrites':0,'searchRequests':0,'modelCalls':0,'historicalSnapshotEqualityProven':False})
def invocation(out,err):
 return {'schema':'root-readonly-bm25-acquisition.v1','wrapperSha256':v.WRAPPER_SHA,'readerSha256':v.READER_SHA,'driverSha256':v.DRIVER_SHA,'executedSourceSha256':v.EXECUTED_SHA,'planSha256':v.PLAN_SHA,'planBytes':602788,'container':v.CONTAINER,'requiredCommit':v.COMMIT,'nodeLifetimeMs':620000,'remoteTimeoutSeconds':630,'transportTimeoutSeconds':650,'requestsMax':88,'outputBytesMax':v.MAX_OUTPUT,'stderrBytesMax':1048576,'authorization':'existing task scope: fixed public catalog vector retrieval; no production writes or searches','retries':0,'started':'2026-10-13T00:20:00+00:00','finished':'2026-10-13T00:20:01+00:00','elapsedSeconds':1,'sshDockerNodeExitCode':0,'outerRefusal':None,'output':physical(out),'privateStderr':physical(err),'terminalValidationPending':True}
class Cases(unittest.TestCase):
 def test_utc_and_refused_output_bounds(self):
  for value in ('nonsenseZ','2026-99-13T00:00:00Z','2026-10-13T00:00:00','2026-10-13T00:00:00+01:00',False):
   with self.subTest(value=value),self.assertRaises(v.Refusal):v.utc_time(value)
  self.assertEqual(v.utc_time('2026-10-13T00:00:00Z'),v.utc_time('2026-10-13T00:00:00+00:00'))
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'out';stream(p)
   with patch.object(v,'MAX_UNKNOWN',1),self.assertRaisesRegex(v.Refusal,'unknown_output_bound'):v.validate_stream(p,PLAN,{1},io.BytesIO())
   with patch.object(v,'MAX_OUTPUT',1),self.assertRaisesRegex(v.Refusal,'physical_output_bound'):v.validate_stream(p,PLAN,{1},io.BytesIO())
 def test_authenticated_real_inputs_no_vectors_or_hosts(self):
  p,known=v.validate_inputs(PLAN_PATH,TERM_PATH);self.assertEqual(len(p['ids']),42934);self.assertEqual(len(known),650794)
 def test_full_stream_known_and_unknown_float32_short_decimal_zero_and_eof(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'out';stream(p);unknown=io.BytesIO();r=v.validate_stream(p,PLAN,{1},unknown)
   self.assertTrue(r['validatedAcquisitionComplete']);self.assertEqual(r['rows'],42934);self.assertEqual(r['unknownTermEntries'],42934);self.assertEqual(r['rowsWithUnknownTerms'],42934);self.assertEqual(r['entries'],85868);self.assertEqual(r['stdoutSha256'],physical(p)['sha256']);self.assertEqual(r['unknownSidecarSha256'],sha(unknown.getvalue()));self.assertFalse(r['historicalSnapshotEqualityProven']);self.assertFalse(r['qualityPass'])
   self.assertEqual(json.loads(unknown.getvalue().splitlines()[0])['unknownTermIds'],[4294967295])
 def test_missing_invalid_and_empty_are_distinct_with_exact_counts(self):
  shapes=[({'presence':'point-missing','valid':False,'reason':'point_missing'},'missing'),({'presence':'omitted','valid':False,'reason':'vector_omitted'},'missing'),({'presence':'null','valid':False,'reason':'vector_null'},'missing'),({'presence':'present','valid':False,'reason':'vector_values'},'invalid'),({'presence':'present','valid':True,'empty':True,'reason':None,'indices':[],'observedValues':[],'float32Values':[]},'empty')]
  for shape,kind in shapes:
   with self.subTest(kind=kind,shape=shape),tempfile.TemporaryDirectory() as d:
    def edit(row,c):
     c['entries']-=2
     if kind=='empty':c['empty']+=1
     else:c['valid']-=1;c[kind]+=1
     return {'kind':'point','id':row['id'],'row':0,**shape}
    p=Path(d)/'out';stream(p,edit);r=v.validate_stream(p,PLAN,{1},io.BytesIO());self.assertEqual(r[kind],1)
 def test_corrupt_numeric_alignment_duplicate_and_schema_rows(self):
  edits=[lambda r:r.update(row=True),lambda r:r.update(id=PLAN['ids'][1]),lambda r:r.update(valid=1),lambda r:r.update(indices=[1,1]),lambda r:r.update(indices=[2,1]),lambda r:r.update(indices=[1,True]),lambda r:r.update(indices=[1,4294967296]),lambda r:r.update(observedValues=[0.33333334,-1]),lambda r:r.update(observedValues=[0.33333334,float('inf')]),lambda r:r.update(observedValues=[1e-50,0]),lambda r:r.update(float32Values=[0.33333334,0]),lambda r:r.update(observedValues=[True,0]),lambda r:r.update(payload={'secret':'not valid'}),lambda r:r.update(empty=True)]
  for edit in edits:
   r=frame(0);edit(r)
   with self.subTest(row=r),self.assertRaises(v.Refusal):v.point(r,PLAN['ids'][0],0,{1})
 def test_truncated_missing_newline_terminal_extra_data_and_counter_mismatch(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'out';stream(p);good=p.read_bytes();lines=good.splitlines(keepends=True)
   bad=[good[:-1],b''.join(lines[:-1]),good+b'{}\n']
   t=json.loads(lines[-1]);t['valid']-=1;bad.append(b''.join(lines[:-1])+(json.dumps(t)+'\n').encode())
   t=json.loads(lines[-1]);t['requests']=89;bad.append(b''.join(lines[:-1])+(json.dumps(t)+'\n').encode())
   t=json.loads(lines[-1]);t['outputBytesBeforeTerminal']-=1;bad.append(b''.join(lines[:-1])+(json.dumps(t)+'\n').encode())
   t=json.loads(lines[-1]);t['productionWrites']=True;bad.append(b''.join(lines[:-1])+(json.dumps(t)+'\n').encode())
   for data in bad:
    p.write_bytes(data)
    with self.assertRaises(v.Refusal):v.validate_stream(p,PLAN,{1},io.BytesIO())
 def test_bound_line_duplicate_json_and_prohibited_snapshot_claim(self):
  with self.assertRaises(v.Refusal):v.parse(b'{"id":1,"id":2}')
  with self.assertRaises(v.Refusal):v.parse(b'{"value":NaN}')
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'out';p.write_bytes(b' '* (v.MAX_LINE+1))
   with self.assertRaisesRegex(v.Refusal,'line_bound'):v.validate_stream(p,PLAN,set(),io.BytesIO())
   stream(p);data=p.read_bytes().replace(b'"historicalSnapshotEqualityProven":false',b'"historicalSnapshotEqualityProven":true',1);p.write_bytes(data)
   with self.assertRaisesRegex(v.Refusal,'header_binding'):v.validate_stream(p,PLAN,set(),io.BytesIO())
 def test_cli_stderr_physical_sha_and_wrapper_executed_hash_are_all_required(self):
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'out';err=Path(d)/'err';out.write_bytes(b'public\n');err.write_bytes(b'');inv=invocation(out,err);v.invocation_proof(inv,out,err)
   for key,value in [('sshDockerNodeExitCode',1),('outerRefusal','transport_timeout'),('readerSha256','0'*64),('wrapperSha256','0'*64),('executedSourceSha256','0'*64),('terminalValidationPending',False),('retries',True)]:
    bad=copy.deepcopy(inv);bad[key]=value
    with self.subTest(key=key),self.assertRaises(v.Refusal):v.invocation_proof(bad,out,err)
   out.write_bytes(b'changed\n')
   with self.assertRaisesRegex(v.Refusal,'output_physical_binding'):v.invocation_proof(inv,out,err)
   err.write_bytes(b'error');inv=invocation(out,err)
   with self.assertRaisesRegex(v.Refusal,'stderr_nonempty'):v.invocation_proof(inv,out,err)
 def test_projection_digest_modifier_type_and_change(self):
  x=observation('collection-before');v.observation(x,'collection-before')
  for change in [{'modifier':'idf'},{'pointsCount':True},{'configurationProjectionSha256':'0'*64},{'unexpected':'not projected'}]:
   r={**x,**change}
   with self.assertRaises(v.Refusal):v.observation(r,'collection-before')
if __name__=='__main__':unittest.main()
