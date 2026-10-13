from ev import ev; import lib
ev(lib.make([]), 'base', setref='b')
for k in (['poolz'], ['pool'], ['kin'], ['pool', 'kin'], ['aud'], ['aud', 'pool'], ['aud', 'pool', 'ost']): ev(lib.make(k), 'gbm+' + '+'.join(k), ref='b')
