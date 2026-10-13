import hashlib,json,subprocess,time
H=lambda value,ascii:hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=ascii,allow_nan=False).encode()).hexdigest()
child=subprocess.run(['/usr/bin/docker','inspect','gw-qdrant-cold-406-20261011','gw-qdrant-cpu0-100-20261012'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','DOCKER_HOST':'unix:///var/run/docker.sock'})
if child.returncode!=0 or len(child.stdout)>2*1024**2:raise RuntimeError('readonly_inspect_refused')
rows=json.loads(child.stdout)
if not isinstance(rows,list) or len(rows)!=2:raise RuntimeError('readonly_scope_changed')
expected=[('old','gw-qdrant-cold-406-20261011','30aca59a60c971e246894f614f767930190046ce3138c89e6c9ce5d64e069ff7','d538f05de305362096286b0fbd6611d3e9171d305f4db59b291fa9754567798d'),('new','gw-qdrant-cpu0-100-20261012','c67d813c0e32872228fdc13a515e49c45b3ae68166f19531ee83bcfdf69548ea','a05ad0714e9c0227ac80097a86376ddcc192983499cf66c0d7098ad0aa0ee9c5')]
public={}
for value,(tag,name,identity,hosthash) in zip(rows,expected):
 if hashlib.sha256(value['Id'].encode()).hexdigest()!=identity or value['Name']!='/'+name or value['Image']!='sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b':raise RuntimeError('readonly_target_changed')
 noncpu={k:v for k,v in value['HostConfig'].items() if k not in ('NanoCpus','CpuQuota','CpuPeriod')}
 a=H(noncpu,True);u=H(noncpu,False)
 public[tag]={'containerIdHash':identity,'originalGeneratorHash':u,'recoveryCanonicalHash':a,'encodingIdentical':a==u,'bothMatchOriginalProof':a==u==hosthash,'running':value['State']['Running'],'pid':value['State']['Pid'],'startedAt':value['State']['StartedAt'],'finishedAt':value['State']['FinishedAt'],'exitCode':value['State']['ExitCode'],'OOMKilled':value['State']['OOMKilled'],'restartCount':value['RestartCount'],'status':value['State']['Status']}
print(json.dumps({'schema':'cpu0-readonly-recovery-hash-encoding.v1','atUnix':time.time(),'sourceWrites':0,'signals':0,'ordinarySearches':0,'historyWrites':0,'productionAcceptance':False,'objects':public},sort_keys=True))
