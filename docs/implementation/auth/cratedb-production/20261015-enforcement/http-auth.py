import urllib.request,urllib.error,json,base64,secrets
assert endpoint in ('10.0.0.11','10.0.0.12','10.0.0.13')
for label,u,p,wanted in [('missing',None,None,401),('wrong',user,secrets.token_hex(24),401),('correct',user,password,200)]:
 h={'Content-Type':'application/json'}
 if u:h['Authorization']='Basic '+base64.b64encode((u+':'+p).encode()).decode()
 req=urllib.request.Request('http://'+endpoint+':4200/_sql',json.dumps({'stmt':'SELECT current_user'}).encode(),h)
 try:
  with urllib.request.urlopen(req,timeout=30) as r:code=r.status;data=json.load(r)
 except urllib.error.HTTPError as e:code=e.code;data={}
 ok=code==wanted and (label!='correct' or data.get('rows')==[[user]])
 print(json.dumps({'endpoint':endpoint,'client':client,'case':label,'status':code,'ok':ok}),flush=True)
 assert ok,'STOP: credential enforcement check failed'
