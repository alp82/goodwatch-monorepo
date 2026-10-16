import pathlib,json,secrets,psycopg,os
os.environ.pop("PGPASSWORD",None)
user='goodwatch_readonly';password=pathlib.Path('/root/.config/goodwatch/crate-credentials',user).read_text().rstrip('\n')
for label,u,p,expected in [('missing','crate',None,False),('client-missing',user,None,False),('wrong',user,secrets.token_hex(24),False),('correct',user,password,True)]:
 try:
  with psycopg.connect(host=endpoint,port=5432,user=u,password=p,dbname='doc',connect_timeout=15,sslmode='disable',passfile='/dev/null') as connection:
   with connection.cursor() as cursor:cursor.execute('SELECT current_user');actual=cursor.fetchone()[0]
  success=actual==user;state=None
 except psycopg.OperationalError as e:
  success=False;state=e.sqlstate
  # Missing SQLSTATE is accepted only with a password/auth rejection diagnostic, never network failure.
  reason=str(e).lower();assert any(x in reason for x in ('password','authentication','no pg_hba')),'STOP: PostgreSQL probe failed for non-auth reason'
 assert success==expected,'STOP: PostgreSQL enforcement mismatch'
 print(json.dumps({'endpoint':endpoint,'protocol':'postgresql','case':label,'authenticated':success,'expected':expected,'sqlstate':state,'passed':True}),flush=True)
