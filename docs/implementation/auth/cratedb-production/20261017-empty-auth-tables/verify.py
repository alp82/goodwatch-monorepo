import atexit, base64, datetime, json, pathlib, subprocess, urllib.request, urllib.error
from collections import Counter

models=['user','account','session','verification','jwks','oauth_client','oauth_resource','oauth_client_resource','oauth_consent','oauth_access_token','oauth_refresh_token','oauth_client_assertion','rate_limit','capacity','user_email']
tables=['auth_'+m for m in models]
all_tables=tables+['user_mcp_action']
root=pathlib.Path('/root/.config/goodwatch/crate-credentials')
out={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'admin':{},'identities':[],'allowed_reads':[],'negative_checks':[]}
atexit.register(lambda: print(json.dumps(out,indent=2)))

def admin(stmt):
    p=subprocess.run(['docker','exec','-i','crate-01','curl','-sS','--max-time','60','-H','Content-Type: application/json','--data-binary','@-','http://127.0.0.1:4200/_sql'],input=json.dumps({'stmt':stmt}).encode(),capture_output=True,check=True)
    d=json.loads(p.stdout)
    assert 'error' not in d, d
    out['admin'][stmt]=d
    return d

def query(ip,role,stmt,password=None):
    if password is None: password=(root/role).read_text().strip()
    header=base64.b64encode((role+':'+password).encode()).decode()
    req=urllib.request.Request('http://'+ip+':4200/_sql',data=json.dumps({'stmt':stmt}).encode(),headers={'Content-Type':'application/json','Authorization':'Basic '+header})
    try:
        with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        data=e.read()
        try:return e.code,json.loads(data)
        except ValueError:return e.code,{}

quoted=','.join("'"+t+"'" for t in all_tables)
settings=admin("SELECT table_name,number_of_shards,number_of_replicas,settings['write']['wait_for_active_shards'],settings['translog']['durability'] FROM information_schema.tables WHERE table_schema='doc' AND table_name IN ("+quoted+") ORDER BY table_name")
assert len(settings['rows'])==16
for t,n,reps,wait,durability in settings['rows']:
    assert n==(3 if t=='user_mcp_action' else 1) and str(reps)=='2' and str(wait)=='1' and durability=='REQUEST', (t,n,reps,wait,durability)
shards=admin("SELECT table_name,id,primary,state,routing_state,node['name'],num_docs FROM sys.shards WHERE schema_name='doc' AND table_name IN ("+quoted+") ORDER BY table_name,id,primary DESC,node['name']")
assert len(shards['rows'])==54
for t in all_tables:
    for shard in range(3 if t=='user_mcp_action' else 1):
        rows=[r for r in shards['rows'] if r[0]==t and r[1]==shard]
        assert len(rows)==3 and sum(r[2] for r in rows)==1
        assert {r[5] for r in rows}=={'crate-01','crate-02','crate-03'}
        assert all(r[3:5]==['STARTED','STARTED'] and r[6]==0 for r in rows),rows
grants=admin("SELECT grantee,class,ident,type,state FROM sys.privileges ORDER BY grantee,class,ident,type")['rows']
auth=[r for r in grants if r[0]=='goodwatch_auth']
expected={('goodwatch_auth','TABLE','doc.'+t,k,'GRANT') for t in tables for k in ['DQL','DML']}
expected|={('goodwatch_auth','TABLE',t,'DQL','GRANT') for t in ['sys.cluster','sys.nodes']}
assert {tuple(r) for r in auth}==expected
denies={('goodwatch_webapp',k) for k in ['DQL','DML']}|{('goodwatch_search','DQL'),('goodwatch_readonly','DQL')}|{('goodwatch_windmill',k) for k in ['DQL','DML','DDL']}
for t in tables:
    actual={tuple(r) for r in grants if r[2]=='doc.'+t and r[0]!='goodwatch_auth'}
    assert actual=={(role,'TABLE','doc.'+t,k,'DENY') for role,k in denies}
assert admin("SELECT granted_roles FROM sys.users WHERE name='goodwatch_auth'")['rows']==[[[]]]
for t in all_tables: assert admin('SELECT count(*) FROM doc.'+t)['rows']==[[0]]
for ip in ['10.0.0.11','10.0.0.12','10.0.0.13']:
    for role in ['goodwatch_auth','goodwatch_webapp','goodwatch_search','goodwatch_windmill','goodwatch_readonly','goodwatch_backup','goodwatch_monitoring']:
        status,d=query(ip,role,'SELECT current_user')
        assert status==200 and d['rows']==[[role]]
        out['identities'].append({'coordinator':ip,'role':role,'current_user':d['rows'][0][0]})
    for t in tables:
        status,d=query(ip,'goodwatch_auth','SELECT count(*) FROM doc.'+t)
        assert status==200 and d['rows']==[[0]]
        out['allowed_reads'].append({'coordinator':ip,'stmt':'SELECT count(*) FROM doc.'+t,'rows':d['rows']})
    for stmt in ['SELECT id FROM sys.cluster','SELECT name FROM sys.nodes']:
        status,d=query(ip,'goodwatch_auth',stmt)
        assert status==200
        out['allowed_reads'].append({'coordinator':ip,'stmt':stmt,'rowcount':d['rowcount']})
    negatives=[('goodwatch_auth',s) for s in ['SELECT * FROM doc.movie LIMIT 0','SELECT * FROM doc.tv LIMIT 0','SELECT * FROM doc.user_mcp_action LIMIT 0','CREATE TABLE doc.auth_user (id TEXT PRIMARY KEY)','GRANT DQL ON TABLE doc.auth_user TO goodwatch_auth']]
    for t in tables:
        for role in ['goodwatch_webapp','goodwatch_search','goodwatch_windmill','goodwatch_readonly','goodwatch_backup','goodwatch_monitoring']:
            negatives.append((role,'SELECT * FROM doc.'+t+' LIMIT 0'))
        for role in ['goodwatch_webapp','goodwatch_windmill']:
            negatives.append((role,'DELETE FROM doc.'+t+' WHERE false'))
        negatives.append(('goodwatch_windmill','ALTER TABLE doc.'+t+' SET ("write.wait_for_active_shards"=1)'))
    for role,stmt in negatives:
        status,d=query(ip,role,stmt)
        code=d.get('error',{}).get('code')
        assert status in [401,403,404] and code in [4011,4041,4045], (ip,role,stmt,status,d)
        out['negative_checks'].append({'coordinator':ip,'role':role,'stmt':stmt,'status':status,'code':code,'message':d['error']['message']})
    status,_=query(ip,'goodwatch_auth','SELECT current_user',password='intentionally-invalid-auth-14')
    assert status==401
    out['negative_checks'].append({'coordinator':ip,'role':'goodwatch_auth','check':'wrong password','status':status})
health=admin("SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health")
assert len(health['rows'])==1 and health['rows'][0][0]=='GREEN' and health['rows'][0][2:]==[0,0]
out['summary']={'tables':16,'auth_tables':15,'started_target_copies':54,'auth_grants':len(auth),'table_deny_entries':105,'identities':len(out['identities']),'allowed_reads':len(out['allowed_reads']),'negative_checks':len(out['negative_checks'])}
