"""Offline public NDJSON validation; no network/application imports."""
import argparse,hashlib,json,math,os,struct
from pathlib import Path
PLAN_SHA='9442eb86a853abb71dccf456337356d15cc5eacbed9541e8289767f634711234'
READER_SHA='34a7ab907fd69e89dda9d53f9656779ddd15a244259209a64a4ee0c916456d6d'
INDEX_VALIDATION_SHA='ee84f7e1777d7b1a9bfb6d0b9aa8933c3190cfe0838e1186e9fa737d22a8b14a'
N=42934;D=74;MAX_BYTES=64*1024*1024+128*1024
class Refused(ValueError):pass
def require(v,reason):
 if not v:raise Refused(reason)
def sha(b):return hashlib.sha256(b).hexdigest()
def strict_object(pairs):
 out={}
 for k,v in pairs:
  require(k not in out,'duplicate_json_key');out[k]=v
 return out
def parse(b):
 try:return json.loads(b,object_pairs_hook=strict_object,parse_constant=lambda _:(_ for _ in ()).throw(Refused('nonfinite_json')))
 except (UnicodeError,json.JSONDecodeError):raise Refused('json_invalid')
def integer(v):return type(v) is int and 0<=v<=2**53-1
def number(v):return type(v) in (int,float) and math.isfinite(v)
def keys(obj,expected):require(type(obj) is dict and set(obj)==set(expected),'frame_keys_invalid')
def authenticate(plan_raw,reader_raw,index_gzip,validation_raw):
 require(sha(plan_raw)==PLAN_SHA,'plan_hash_changed');require(sha(reader_raw)==READER_SHA,'reader_hash_changed');p=parse(plan_raw);require(sha(validation_raw)==INDEX_VALIDATION_SHA,'index_validation_hash_changed');v=parse(validation_raw)
 require(p['pointCount']==N and p['batchCount']==87 and len(p['pointOrder'])==N and len(p['keyOrder'])==D,'plan_shape_invalid')
 require(sha(index_gzip)==p['titleTableGzipSha256'],'index_hash_changed');require(v['buildId']==p['indexBuildId'] and v['manifestSha256']==p['indexManifestSha256'] and v['rowCount']==N and v['titleMixPointOrderEqual'] is True,'index_context_invalid')
 import gzip
 title=parse(gzip.decompress(index_gzip));require(title['point_ids']==[x['pointId'] for x in p['pointOrder']],'index_order_changed');return p

def validate_stream(raw,p):
 require(len(raw)<=MAX_BYTES and raw.endswith(b'\n'),'stream_bound_or_eof');lines=raw.splitlines();require(len(lines)==N+2 and all(lines),'stream_frame_count');header=parse(lines[0]);keys(header,['kind','schema','planSha256','indexBuildId','indexManifestSha256','pointCount','keyOrder','currentCatalogNotHistoricalSnapshot'])
 require(header['currentCatalogNotHistoricalSnapshot'] is True and header=={'kind':'header','schema':'public-catalog-fingerprint-stream.v1','planSha256':PLAN_SHA,'indexBuildId':p['indexBuildId'],'indexManifestSha256':p['indexManifestSha256'],'pointCount':N,'keyOrder':p['keyOrder'],'currentCatalogNotHistoricalSnapshot':True},'header_binding_changed')
 terminal=parse(lines[-1]);keys(terminal,['kind','schema','status','complete','planSha256','calls','responseBytes','outputBytes','returnedRows','missingRows','validRows','invalidRows','omissionCounts','currentEligibility','batches','elapsedMs','sqlWrites','retries','currentCatalogNotHistoricalSnapshot','historicalRankParity'])
 require(terminal['kind']=='terminal' and terminal['schema']=='public-catalog-fingerprint-terminal.v1' and terminal['status']=='complete-acquisition-with-explicit-omissions' and terminal['complete'] is True,'terminal_refused')
 require(terminal['planSha256']==PLAN_SHA and type(terminal['sqlWrites']) is int and type(terminal['retries']) is int and terminal['sqlWrites']==0 and terminal['retries']==0 and terminal['currentCatalogNotHistoricalSnapshot'] is True and terminal['historicalRankParity'] is False,'terminal_binding_changed')
 for k in ['calls','responseBytes','outputBytes','returnedRows','missingRows','validRows','invalidRows']:require(integer(terminal[k]),'terminal_counts_invalid')
 require(terminal['calls']==87 and terminal['responseBytes']<=64*1024*1024 and number(terminal['elapsedMs']) and 0<=terminal['elapsedMs']<300000,'terminal_budget_invalid')
 require(terminal['outputBytes']==sum(len(l)+1 for l in lines[:-1]),'output_byte_accounting_changed')
 require(type(terminal['omissionCounts']) is dict and all(type(k) is str and integer(v) and v>0 for k,v in terminal['omissionCounts'].items()),'omission_counts_invalid')
 require(type(terminal['currentEligibility']) is dict and set(terminal['currentEligibility'])=={'adultTrue','adultNull','votesBelow2000','votesNull'} and all(integer(v) for v in terminal['currentEligibility'].values()),'eligibility_counts_invalid')
 require(type(terminal['batches']) is list and len(terminal['batches'])==87,'batch_count_invalid')
 mapping={};actual_batches={i:{'returned':0,'missing':0} for i in range(1,88)}
 for b in p['batches']:
  for id in b['args'][0]:mapping[(b['table'],id)]=b['ordinal']
 seen=set();last_batch=0;missing_started=set();raw_values=[[math.nan]*D for _ in range(N)];bitmap=bytearray(N);norms=[None]*N;omissions={};eligibility={'adultTrue':0,'adultNull':0,'votesBelow2000':0,'votesNull':0};counts={'returnedRows':0,'missingRows':0,'validRows':0,'invalidRows':0}
 for line in lines[1:-1]:
  r=parse(line);require(type(r) is dict and r.get('kind') in ['row','missing-row'],'row_kind_invalid')
  expected=['kind','indexRow','pointId','mediaType','tmdbId','validFingerprint','omissionReason']
  if r['kind']=='row':expected+=['scores','dnaUpdatedAt','adult','votes']
  keys(r,expected);require(integer(r['indexRow']) and r['indexRow']<N and r['indexRow'] not in seen,'row_duplicate_or_invalid');i=r['indexRow'];seen.add(i);identity=p['pointOrder'][i]
  require(r['pointId']==identity['pointId'] and r['mediaType']==identity['mediaType'] and r['tmdbId']==identity['tmdbId'] and type(r['pointId']) is int and type(r['tmdbId']) is int,'row_identity_changed')
  ordinal=mapping[(r['mediaType'],r['tmdbId'])];require(ordinal>=last_batch,'batch_order_changed');last_batch=ordinal
  if r['kind']=='missing-row':
   require(r['validFingerprint'] is False and r['omissionReason']=='catalog_row_missing','missing_row_invalid');counts['missingRows']+=1;actual_batches[ordinal]['missing']+=1;missing_started.add(ordinal);continue
  require(ordinal not in missing_started,'returned_after_missing');counts['returnedRows']+=1;actual_batches[ordinal]['returned']+=1
  require(type(r['validFingerprint']) is bool and type(r['scores']) is list and len(r['scores'])==D,'score_shape_invalid');scores=r['scores'];require(all(x is None or number(x) for x in scores),'score_component_invalid')
  require(r['dnaUpdatedAt'] is None or integer(r['dnaUpdatedAt']),'metadata_invalid');require(r['adult'] is None or type(r['adult']) is bool,'metadata_invalid');require(r['votes'] is None or (number(r['votes']) and r['votes']>=0),'metadata_invalid')
  eligibility['adultTrue']+=r['adult'] is True;eligibility['adultNull']+=r['adult'] is None;eligibility['votesNull']+=r['votes'] is None;eligibility['votesBelow2000']+=r['votes'] is not None and r['votes']<2000
  if r['validFingerprint']:
   require(r['omissionReason'] is None and all(type(x) is int and 0<=x<=10 for x in scores),'valid_score_invalid');norm=math.sqrt(sum(x*x for x in scores));require(norm>0,'valid_zero_norm');bitmap[i]=1;raw_values[i]=scores;norms[i]=norm;counts['validRows']+=1
  else:
   reason=r['omissionReason'];require(reason in ['missing_component','invalid_component','out_of_range','zero_norm'],'omission_reason_invalid')
   if reason=='missing_component':require(any(x is None for x in scores),'omission_inconsistent')
   elif reason=='invalid_component':require(any(x is None or (number(x) and not float(x).is_integer()) for x in scores),'omission_inconsistent')
   elif reason=='out_of_range':require(all(type(x) is int for x in scores) and any(x<0 or x>10 for x in scores),'omission_inconsistent')
   else:require(all(type(x) is int and x==0 for x in scores),'omission_inconsistent')
   omissions[reason]=omissions.get(reason,0)+1;counts['invalidRows']+=1
 require(len(seen)==N and counts['returnedRows']+counts['missingRows']==N,'row_coverage_invalid')
 require(all(terminal[k]==v for k,v in counts.items()) and terminal['omissionCounts']==omissions and terminal['currentEligibility']==eligibility,'terminal_accounting_changed')
 total_response=0
 for expected,b in zip(p['batches'],terminal['batches']):
  keys(b,['ordinal','table','requestedIds','returnedRows','responseBytes','responseSha256','elapsedMs']);ordinal=expected['ordinal'];a=actual_batches[ordinal]
  require(all(integer(b[k]) for k in ['ordinal','requestedIds','returnedRows','responseBytes']),'batch_counts_invalid')
  require(b['ordinal']==ordinal and b['table']==expected['table'] and b['requestedIds']==len(expected['args'][0]) and b['returnedRows']==a['returned'] and a['returned']+a['missing']==b['requestedIds'],'batch_accounting_changed')
  require(integer(b['responseBytes']) and 0<b['responseBytes']<=1048576 and type(b['responseSha256']) is str and len(b['responseSha256'])==64 and all(c in '0123456789abcdef' for c in b['responseSha256']) and number(b['elapsedMs']) and 0<=b['elapsedMs']<=10000,'batch_metrics_invalid');total_response+=b['responseBytes']
 require(total_response==terminal['responseBytes'],'response_byte_accounting_changed')
 return raw_values,bitmap,norms,terminal

def build(raw,p):
 values,bitmap,norms,terminal=validate_stream(raw,p);raw_matrix=bytearray();normalized=bytearray()
 for i,row in enumerate(values):
  raw_matrix.extend(struct.pack('<74f',*row));normalized.extend(struct.pack('<74f',*(x/norms[i] for x in row)) if bitmap[i] else struct.pack('<74f',*([math.nan]*D)))
 require(len(raw_matrix)==N*D*4 and len(normalized)==N*D*4 and len(bitmap)==N,'matrix_shape_invalid')
 return {'raw-fingerprint.f32':bytes(raw_matrix),'normalized-fingerprint.f32':bytes(normalized),'valid-fingerprint.u8':bytes(bitmap)},terminal

def main():
 a=argparse.ArgumentParser();a.add_argument('--plan',required=True);a.add_argument('--reader',required=True);a.add_argument('--title-table-gzip',required=True);a.add_argument('--index-validation',required=True);a.add_argument('--stream',required=True);a.add_argument('--output',required=True);args=a.parse_args()
 p=authenticate(Path(args.plan).read_bytes(),Path(args.reader).read_bytes(),Path(args.title_table_gzip).read_bytes(),Path(args.index_validation).read_bytes());stream=Path(args.stream);require(stream.stat().st_size<=MAX_BYTES,'stream_bytes_bound');raw=stream.read_bytes();files,t=build(raw,p);out=Path(args.output);out.mkdir(mode=0o700,exist_ok=False)
 for name,b in files.items():
  with (out/name).open('xb') as f:f.write(b)
 receipt={'schema':'offline-current-catalog-fingerprint-matrices.v1','status':'validated-current-catalog-acquisition','planSha256':PLAN_SHA,'readerSha256':READER_SHA,'inputSha256':sha(raw),'indexBuildId':p['indexBuildId'],'pointOrder':p['pointOrder'],'keyOrder':p['keyOrder'],'shape':[N,D],'dtype':'little-endian-float32','validityRequired':True,'invalidRowsAreNaN':True,'zeroNormInvalid':True,'rawMatrixIsNotNormalized':True,'validRows':t['validRows'],'invalidRows':t['invalidRows'],'missingRows':t['missingRows'],'files':{n:{'sha256':sha(b),'bytes':len(b)} for n,b in files.items()},'normalization':'L2 only on valid complete raw rows','historicalSnapshotEquality':False,'productionAcceptance':False}
 (out/'matrix-manifest.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:receipt[k] for k in ['status','validRows','invalidRows','missingRows']}))
if __name__=='__main__':main()
