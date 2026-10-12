import copy,hashlib,json,math,struct,unittest
from pathlib import Path
from build import authenticate,validate_stream,build,Refused,PLAN_SHA,READER_SHA,N,D
ROOT=Path('/home/alper/projects/search-100-evidence');PLAN=(ROOT/'offline-raw-fingerprint-retrieval-plan-20261013/retrieval-plan.json').read_bytes();P=json.loads(PLAN)
def enc(x):return json.dumps(x,separators=(',',':'),ensure_ascii=False).encode()+b'\n'
def fixture():
 header={'kind':'header','schema':'public-catalog-fingerprint-stream.v1','planSha256':PLAN_SHA,'indexBuildId':P['indexBuildId'],'indexManifestSha256':P['indexManifestSha256'],'pointCount':N,'keyOrder':P['keyOrder'],'currentCatalogNotHistoricalSnapshot':True};rows=[];batches=[];response_bytes=0
 index={(e['mediaType'],e['tmdbId']):(i,e) for i,e in enumerate(P['pointOrder'])}
 for b in P['batches']:
  for id in reversed(b['args'][0]):
   i,e=index[(b['table'],id)];rows.append({'kind':'row','indexRow':i,'pointId':e['pointId'],'mediaType':e['mediaType'],'tmdbId':id,'scores':[5]*D,'validFingerprint':True,'omissionReason':None,'dnaUpdatedAt':1700000000000,'adult':False,'votes':5000})
  batches.append({'ordinal':b['ordinal'],'table':b['table'],'requestedIds':len(b['args'][0]),'returnedRows':len(b['args'][0]),'responseBytes':1000,'responseSha256':'a'*64,'elapsedMs':1});response_bytes+=1000
 terminal={'kind':'terminal','schema':'public-catalog-fingerprint-terminal.v1','status':'complete-acquisition-with-explicit-omissions','complete':True,'planSha256':PLAN_SHA,'calls':87,'responseBytes':response_bytes,'outputBytes':0,'returnedRows':N,'missingRows':0,'validRows':N,'invalidRows':0,'omissionCounts':{},'currentEligibility':{'adultTrue':0,'adultNull':0,'votesBelow2000':0,'votesNull':0},'batches':batches,'elapsedMs':1000,'sqlWrites':0,'retries':0,'currentCatalogNotHistoricalSnapshot':True,'historicalRankParity':False}
 return [header,*rows,terminal]
def serialize(frames):
 raw=b''.join(enc(x) for x in frames[:-1]);frames[-1]['outputBytes']=len(raw);return raw+enc(frames[-1])
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.f=fixture();cls.raw=serialize(cls.f)
 def test_actual_plan_source_index_auth(self):
  p=authenticate(PLAN,(ROOT/'offline-raw-fingerprint-reader-20261013/reader.mjs').read_bytes(),(ROOT/'index-readonly-acquisition-20261013/verified-index/title_table.json.gz').read_bytes(),(ROOT/'index-readonly-acquisition-20261013/actual-index-v2-validation.json').read_bytes());self.assertEqual(len(p['pointOrder']),N)
 def test_complete_shuffled_raw_vs_normalized_and_bitmap(self):
  files,t=build(self.raw,P);self.assertEqual(len(files['valid-fingerprint.u8']),N);self.assertEqual(set(files['valid-fingerprint.u8']),{1});self.assertEqual(struct.unpack('<f',files['raw-fingerprint.f32'][:4])[0],5);norm=struct.unpack('<74f',files['normalized-fingerprint.f32'][:296]);self.assertAlmostEqual(sum(x*x for x in norm),1,places=5)
 def test_omitted_and_missing_are_nan_not_valid_zero(self):
  f=copy.deepcopy(self.f);row=f[1];i=row['indexRow'];row.update(scores=[0]*D,validFingerprint=False,omissionReason='zero_norm');f[-1]['validRows']-=1;f[-1]['invalidRows']+=1;f[-1]['omissionCounts']={'zero_norm':1};files,t=build(serialize(f),P);self.assertEqual(files['valid-fingerprint.u8'][i],0);self.assertTrue(math.isnan(struct.unpack_from('<f',files['raw-fingerprint.f32'],i*D*4)[0]))
 def test_missing_row_gets_nan_and_bitmap_zero(self):
  f=copy.deepcopy(self.f);old=f[500];i=old['indexRow'];f[500]={k:old[k] for k in ['indexRow','pointId','mediaType','tmdbId']};f[500].update(kind='missing-row',validFingerprint=False,omissionReason='catalog_row_missing');f[-1]['returnedRows']-=1;f[-1]['validRows']-=1;f[-1]['missingRows']+=1;f[-1]['batches'][0]['returnedRows']-=1
  files,t=build(serialize(f),P);self.assertEqual(files['valid-fingerprint.u8'][i],0);self.assertTrue(math.isnan(struct.unpack_from('<f',files['raw-fingerprint.f32'],i*D*4)[0]));self.assertEqual(t['missingRows'],1)
 def test_truncated_no_eof_missing_terminal_extra_frame(self):
  for raw in [self.raw[:-1],b'\n'.join(self.raw.splitlines()[:-1])+b'\n',self.raw+b'{}\n']:
   with self.assertRaises(Refused):validate_stream(raw,P)
 def test_duplicate_wrong_alignment_and_header(self):
  for mode in ['duplicate','point','keyorder','headerbool']:
   f=copy.deepcopy(self.f)
   if mode=='duplicate':f[2]=copy.deepcopy(f[1])
   elif mode=='point':f[1]['pointId']+=1
   elif mode=='keyorder':f[0]['keyOrder'].reverse()
   else:f[0]['currentCatalogNotHistoricalSnapshot']=1
   with self.assertRaises(Refused):validate_stream(serialize(f),P)
 def test_refused_terminal_counts_and_bool_count(self):
  for field,value in [('complete',False),('validRows',N-1),('calls',True),('sqlWrites',False),('currentEligibility',{'adultTrue':False,'adultNull':0,'votesBelow2000':0,'votesNull':0})]:
   f=copy.deepcopy(self.f);f[-1][field]=value
   with self.assertRaises(Refused):validate_stream(serialize(f),P)
 def test_invalid_valid_score_or_omission_lie(self):
  for mode in ['null','zero','bool','omission']:
   f=copy.deepcopy(self.f)
   if mode=='null':f[1]['scores'][0]=None
   elif mode=='zero':f[1]['scores']=[0]*D
   elif mode=='bool':f[1]['scores'][0]=True
   else:f[1]['validFingerprint']=False;f[1]['omissionReason']='missing_component'
   with self.assertRaises(Refused):validate_stream(serialize(f),P)
 def test_byte_batch_and_deadline_ledger(self):
  for mode in ['bytes','batch','deadline']:
   f=copy.deepcopy(self.f)
   if mode=='bytes':raw=serialize(f);f[-1]['outputBytes']+=1;raw=b'\n'.join(raw.splitlines()[:-1])+b'\n'+enc(f[-1])
   elif mode=='batch':f[-1]['batches'][0]['returnedRows']-=1;raw=serialize(f)
   else:f[-1]['elapsedMs']=300000;raw=serialize(f)
   with self.assertRaises(Refused):validate_stream(raw,P)
 def test_plan_source_drift_refuses(self):
  for plan,source in [(PLAN+b' ',b'bad'),(PLAN,b'bad')]:
   with self.assertRaises(Refused):authenticate(plan,source,b'',b'{}')
if __name__=='__main__':unittest.main()
