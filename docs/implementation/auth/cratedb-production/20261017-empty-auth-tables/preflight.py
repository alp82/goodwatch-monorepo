import base64, json, pathlib, subprocess, urllib.request, urllib.error, stat

def admin(stmt):
    p=subprocess.run(['docker','exec','-i','crate-01','curl','-sS','--max-time','60','-H','Content-Type: application/json','--data-binary','@-','http://127.0.0.1:4200/_sql'],input=json.dumps({'stmt':stmt}).encode(),capture_output=True,check=True)
    d=json.loads(p.stdout)
    assert 'error' not in d, d
    return d

root=pathlib.Path('/root/.config/goodwatch/crate-credentials')
p=root/'goodwatch_auth'
assert stat.S_IMODE(root.stat().st_mode)==0o700 and root.stat().st_uid==0
assert stat.S_IMODE(p.stat().st_mode)==0o600 and p.stat().st_uid==0
secret=p.read_text().strip()
out={'admin':{},'identity':{}}
queries=["SELECT current_user", "SELECT name,superuser FROM sys.users ORDER BY name", "SELECT grantee,class,ident,type,state FROM sys.privileges ORDER BY grantee,class,ident,type", "SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND (table_name LIKE 'auth_%' OR table_name='user_mcp_action') ORDER BY table_schema,table_name", "SELECT id,name,version['number'] FROM sys.nodes ORDER BY name", "SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health", "SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state", "SELECT column_name FROM information_schema.columns WHERE table_schema='sys' AND table_name='users' ORDER BY ordinal_position"]
for q in queries: out['admin'][q]=admin(q)
assert out['admin'][queries[0]]['rows']==[['crate']]
assert ['goodwatch_auth',False] in out['admin'][queries[1]]['rows']
assert not [r for r in out['admin'][queries[2]]['rows'] if r[0]=='goodwatch_auth']
assert not out['admin'][queries[3]]['rows'], 'STOP: unexpected existing target tables'
assert admin("SELECT granted_roles FROM sys.users WHERE name='goodwatch_auth'")['rows']==[[[]]], 'STOP: inherited role'
assert out['admin'][queries[5]]['rows']==[['GREEN',97,0,0]]
assert out['admin'][queries[6]]['rows']==[['STARTED','STARTED',986]]
for ip in ['10.0.0.11','10.0.0.12','10.0.0.13']:
    header=base64.b64encode(('goodwatch_auth:'+secret).encode()).decode()
    req=urllib.request.Request('http://'+ip+':4200/_sql',data=json.dumps({'stmt':'SELECT current_user'}).encode(),headers={'Content-Type':'application/json','Authorization':'Basic '+header})
    with urllib.request.urlopen(req,timeout=30) as res: d=json.load(res)
    assert d['rows']==[['goodwatch_auth']]
    out['identity'][ip]=d['rows']
print(json.dumps(out,indent=2))
