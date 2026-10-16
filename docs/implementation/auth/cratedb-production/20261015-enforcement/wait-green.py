from ops import *
observer=int(sys.argv[1]);deadline=time.monotonic()+1800
while time.monotonic()<deadline:
 h=sql(observer,'SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health')['rows']
 sh=sql(observer,'SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state')['rows']
 checks=sql(observer,'SELECT count(*),sum(CASE WHEN passed THEN 0 ELSE 1 END) FROM sys.node_checks')['rows']
 emit(recovery_health=h,shards=sh,checks=checks)
 assert all(r[2]==0 for r in h),'STOP: missing primary during recovery'
 assert all(r[1]==0 for r in checks),'STOP: failed node checks during recovery'
 if all(r[0]=='GREEN' and r[2:]==[0,0] for r in h) and all(r[:2]==['STARTED','STARTED'] for r in sh) and checks==[[21,0]]:
  for host in (11,12,13):health(host)
  break
 time.sleep(20)
else:raise SystemExit('STOP: GREEN recovery not observed in 30 minutes')
