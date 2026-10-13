import sys; from ev import ev; import lib
sets = {'base': [], 'dis': ['dis'], 'sig': ['sig'], 'ost': ['ost'], 'gemb': ['gemb'], 'kg': ['kg'], 'cf': ['cf'], 'all': ['dis', 'sig', 'ost', 'gemb', 'kg', 'cf']}
for k in (sys.argv[1:] or sets): ev(lib.make(sets[k]), k)
