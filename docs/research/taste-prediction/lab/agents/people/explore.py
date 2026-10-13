import sys; sys.path.insert(0,'.')
from harness import Data
import numpy as np, collections
D=Data()
idx,y=D.of(D.owner)
print(D.n, len(idx), np.bincount(y.astype(int)))
x=D.info[idx[0]]
for k,v in x.items():
    s=repr(v); print(k, ':', s[:160])
print(len(D.person_names))
# coverage
keys=list(x.keys())
for k in keys:
    nn=sum(1 for i in idx if D.info[i].get(k) not in (None,[],''))
    print(k, nn)
print({k:len(v) for k,v in D.signals.items()})
print(len(D.ratings), len(D.users()))
