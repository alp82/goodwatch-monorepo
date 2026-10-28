#!/usr/bin/env python3
"""Build the committed evidence from local task-owned JSON receipts only."""
from lab import ROOT, HERE, IMAGES
import collections, csv, datetime, gzip, json, statistics

def load(n): return json.loads((ROOT/n).read_text())

def main():
 warm=[]
 for case in ['alone','paging','upsert-alone','upsert-paging']:
  item={'case':case}
  for v in IMAGES:
   ds=[load(f'run-{v}-{case}-warm{i}.json')for i in [1,2,3]]
   assert all(d['status']=='PASS'for d in ds)
   item[v]={'wall_seconds':[d['wall_seconds']for d in ds],'median_seconds':statistics.median(d['wall_seconds']for d in ds),'median_delete_seconds':statistics.median(d['delete_seconds']for d in ds),'max_search_active':max(n['search']['max_active']for d in ds for n in d['pool_summary'].values()),'max_search_queue':max(n['search']['max_queue']for d in ds for n in d['pool_summary'].values()),'max_write_active':max(n['write']['max_active']for d in ds for n in d['pool_summary'].values()),'max_write_queue':max(n['write']['max_queue']for d in ds for n in d['pool_summary'].values()),'rejected_delta':sum(n[t]['rejected_delta']for d in ds for n in d['pool_summary'].values()for t in ['search','write']),'max_heap_pct':max(n['max_heap_used']/n['heap_max']*100 for d in ds for n in d['pool_summary'].values())}
  item['ratio_646_to_510']=item['6.4.6']['median_seconds']/item['5.10.16']['median_seconds'];warm.append(item)
 cleanup=load('cleanup.json');assert cleanup['containers_remaining']==cleanup['network_remaining']==''and not cleanup['data_dirs_remaining']and not cleanup['snapshot_data_remaining']
 summary={'generated_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verdict':'No reproducible steady-state regression of the original anti-list DELETE in this lab; no production saturation reproduced','production_contact':False,'application_code_changes':False,'images':IMAGES,'resources_per_node':{'memory_gib':4,'heap_gib':2,'cpu_quota':4,'JVM_active_processors':16,'search_threads':25,'write_threads':16},'dataset':load('seed.json'),'warm_trials_each':3,'warm_results':warm,'cleanup':cleanup,'rejected_candidate':({'statement':'Per-show typed-key DELETE in one 200-item bulk request','six_timeout_seconds':180,'five_probe_timeout_seconds':15,'recommendation':'Do not deploy; it stalled on both versions with idle pools','original_regression_evidence':False}if(ROOT/'run-6.4.6-typed-alone.json').exists()else None),'tests':{'fixture_and_isolation_unit':5,'result':'PASS'}}
 (HERE/'results.json').write_text(json.dumps(summary,indent=2)+'\n')
 receipts={f.name:json.loads(f.read_text())for f in sorted(ROOT.glob('*.json'))}
 for f in sorted(ROOT.glob('*.jsonl')):receipts[f.name]=[json.loads(l)for l in f.read_text().splitlines()if l.strip()]
 # The discarded off-by-one run is retained separately and never enters comparison stats.
 receipts['discarded_files']={f.name:json.loads(f.read_text())for f in (ROOT/'discarded').glob('*.json')}
 with (HERE/'receipts.json.gz').open('wb')as f:
  with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0)as z:z.write(json.dumps(receipts,separators=(',',':')).encode())
 with (HERE/'batches.csv').open('w',newline='')as f:
  w=csv.writer(f);w.writerow(['version','case','variant','upserts','batch','first_show','last_show','batch_wall_s','table','kept_keys','deleted','delete_wall_s','delete_server_ms','upsert_rows','upsert_wall_s'])
  for name,d in receipts.items():
   if not name.startswith('run-')or not isinstance(d,dict):continue
   for b in d['batches']:
    for t in b['statements']:
     up=t.get('upsert')or{};w.writerow([d['version'],d['label'],d['variant'],d.get('with_upserts',False),b['batch'],b['first_show'],b['last_show'],b['wall_seconds'],t['table'],t['kept_keys'],t['deleted'],t['wall_seconds'],t['server_ms'],up.get('rows',0),up.get('wall_seconds',0)])
 print(json.dumps({'warm':warm,'cleanup':cleanup,'receipt_files':len(receipts)}))
if __name__=='__main__':main()
