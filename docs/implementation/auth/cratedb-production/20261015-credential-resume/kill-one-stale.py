import json,subprocess,datetime,uuid,time
assert target_node in ('crate-02','crate-03')
assert str(uuid.UUID(target_id))==target_id

def sql(stmt,args=()):
 r=subprocess.run(['docker','exec','-i',target_node,'curl','-fsS','--max-time','60','-H','Content-Type:application/json','--data-binary','@-','http://127.0.0.1:4200/_sql'],input=json.dumps({'stmt':stmt,'args':list(args)}),text=True,capture_output=True)
 if r.returncode:raise SystemExit('STOP: SQL HTTP failure; body suppressed')
 d=json.loads(r.stdout)
 if 'error' in d:raise SystemExit('STOP: SQL failure; body suppressed')
 return d
rows=sql("SELECT node['name'],job_id,name,started FROM sys.operations WHERE job_id=?",[target_id])['rows']
assert rows and all(r[0]==target_node for r in rows),'STOP: context location changed'
assert sql("SELECT count(*) FROM sys.operations WHERE job_id=? AND started >= current_timestamp - INTERVAL '1 hour'",[target_id])['rows']==[[0]],'STOP: context not stale'
assert sql("SELECT count(*) FROM sys.health WHERE health <> 'GREEN'")['rows']==[[0]],'STOP: cluster not GREEN'
# This is deliberately the last SQL request before KILL; no job statement or args are read.
jobs=sql('SELECT id FROM sys.jobs WHERE id=?',[target_id])['rows']
checked=datetime.datetime.now(datetime.timezone.utc).isoformat()
if jobs:
 print(json.dumps({'node':target_node,'id':target_id,'checked_utc':checked,'matching_jobs':len(jobs),'kill_sent':False}),flush=True)
 raise SystemExit('STOP: matching live job; KILL forbidden')
result=sql("KILL '"+target_id+"'")
print(json.dumps({'node':target_node,'id':target_id,'checked_utc':checked,'kill_completed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'matching_jobs':0,'operations_before':len(rows),'kill_sent':True,'kill_rowcount':result.get('rowcount')}),flush=True)
for delay in (0,5,25):
 if delay:time.sleep(delay)
 remaining=sql("SELECT node['name'],count(*) FROM sys.operations WHERE job_id=? GROUP BY node['name']",[target_id])['rows']
 print(json.dumps({'node':target_node,'id':target_id,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'operations_remaining':remaining}),flush=True)
 if not remaining:break
else:raise SystemExit('STOP: stale contexts did not clear; no further KILL or restart')
