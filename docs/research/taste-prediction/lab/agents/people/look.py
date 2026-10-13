import lab, pf, numpy as np, pickle, collections
D = lab.data(); S = pf.static(D)
O = pickle.load(open('oof_base.pkl','rb')); idx,y,p = O[D.owner]
by = collections.defaultdict(list)
for i,yy,pp in zip(idx,y,p):
    s = D.info[i].get('movie_series_id')
    if s is not None: by[s].append((D.info[i]['release_year'], D.info[i]['title'], yy, round(pp,1)))
# catalog series sizes
cs = collections.Counter(x.get('movie_series_id') for x in D.info if x.get('movie_series_id') is not None)
print('catalog series', len(cs), 'with>=2', sum(v>=2 for v in cs.values()), 'titles in series', sum(cs.values()))
n=0
for s,v in sorted(by.items(), key=lambda kv:-len(kv[1])):
    if len(v)>=3 and n<25: n+=1; print(sorted(v))
# order within series effect
pos=[];res=[]
allby = collections.defaultdict(list)
for i,x in enumerate(D.info):
    if x.get('movie_series_id') is not None: allby[x['movie_series_id']].append((x['release_year'] or 9999, i))
rank = {}
for s,v in allby.items():
    for k,(yr,i) in enumerate(sorted(v)): rank[i]=(k,len(v))
for i,yy,pp in zip(idx,y,p):
    if i in rank: pos.append(rank[i][0]); res.append(yy-pp)
pos=np.array(pos);res=np.array(res)
for k in range(5): print('pos',k,(pos==k).sum(), res[pos==k].mean().round(3))
r=y-p; ins=np.array([i in rank for i in idx]); print('in series resid',r[ins].mean().round(3),'raw',y[ins].mean().round(2),'not', y[~ins].mean().round(2), r[~ins].mean().round(3))
