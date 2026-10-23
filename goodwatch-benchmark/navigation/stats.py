import json,sys,math,statistics as st
def load(f):
  out={}
  for run in json.load(open(f)):
    for s in run:
      if s.get('error') or s['paint'] is None: continue
      k=s['step'];
      if k in('back','forward'): k='back/forward'
      out.setdefault(k,[]).append(s['paint'])
  return out
files=sys.argv[1:]
data=[load(f) for f in files]
keys=[]
for d in data:
  for k in d:
    if k not in keys: keys.append(k)
print('%-16s'%'step'+''.join('%-26s'%f.replace('.json','')[:25] for f in files))
for k in keys:
  row='%-16s'%k
  for d in data:
    v=d.get(k)
    row+='%-26s'%(('med %4d  max %4d  n%d'%(st.median(v),max(v),len(v))) if v else '-')
  print(row)
allv=[[x for v in d.values() for x in v] for d in data]
print('%-16s'%'ALL'+''.join('%-26s'%('med %4d  p90 %4d'%(st.median(v),sorted(v)[math.ceil(len(v)*0.9)-1])) for v in allv))
