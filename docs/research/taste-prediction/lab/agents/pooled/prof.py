import cProfile, pstats, ev, pool
from ev import *
D = Data(); us = D.users()
pool.fit_pool(D, us[0], k=5, als=0)
cProfile.run("pool.fit_pool(D, us[1], k=5, als=0); pool.fit_pool(D, us[2], k=5, als=0)", 'prof.out')
pstats.Stats('prof.out').sort_stats('cumtime').print_stats(14)
