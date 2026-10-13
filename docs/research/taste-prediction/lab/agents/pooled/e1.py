import ev, pool, numpy as np, time
from ev import *
import gbm_facts
D = Data()
P = {'gbm_facts': gbm_facts.predict}
P['pool k=0'] = pool.make(k=0)
P['pool k=5 als0'] = pool.make(k=5, als=0)
P['pool k=5 als1'] = pool.make(k=5, als=1)
P['pool k=5 als4'] = pool.make(k=5, als=4)
full(D, P)
