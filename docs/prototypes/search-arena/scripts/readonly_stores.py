import urllib.error
import json, os, sys, base64, urllib.request
def env():
    e={}
    for l in open('/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/search-arena/goodwatch-webapp/.env'):
        l=l.strip()
        if l and not l.startswith('#') and '=' in l:
            k,v=l.split('=',1); e[k]=v.strip().strip('"').strip("'")
    return e
E=env()
def sql(stmt,args=None):
    assert stmt.lstrip().upper().startswith('SELECT'), 'read-only'
    h=E['CRATE_HOSTS'].split(',')[0]
    req=urllib.request.Request(f"http://{h}:{E.get('CRATE_PORT','4200')}/_sql",data=json.dumps({'stmt':stmt,'args':args or []}).encode(),headers={'Content-Type':'application/json','Authorization':'Basic '+base64.b64encode(f"{E['CRATE_USER']}:{E['CRATE_PASS']}".encode()).decode()})
    try: return json.load(urllib.request.urlopen(req,timeout=300))
    except urllib.error.HTTPError as e: raise RuntimeError(e.read().decode()[:500])
if __name__=='__main__':
    print(json.dumps(sql(sys.argv[1]))[:4000])
