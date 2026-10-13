import pickle, numpy as np
d = pickle.load(open('explore_fam.pkl','rb')); R = d['rows']; Q = d['q']
q = np.array([r[1:] for r in Q], float); ow = np.array([r[0] for r in Q]) == Q[0][0]
# cols: N, bq_a, bg_a, seq_a, seg_a, bq_h, bg_h, seq_h, seg_h
for who, m in (('owner', ow), ('others', ~ow)):
    for nm, c in (('well made slope', 1), ('audience-critic gap', 2)):
        z = np.abs(q[m, c]) / q[m, c + 2]
        for lo, hi in ((0, 1), (1, 1.64), (1.64, 2.5), (2.5, 99)):
            s = (z >= lo) & (z < hi)
            if s.sum(): print(f'{who:6s} {nm:20s} z {lo}-{hi}: n={s.sum():4d} sign {np.mean(np.sign(q[m,c][s])==np.sign(q[m,c+4][s])):.2f} size slope {(q[m,c][s]*q[m,c+4][s]).sum()/(q[m,c][s]**2).sum():.2f} mean claim {np.abs(q[m,c][s]).mean():.2f}')
print()
for fam in ('sequel','facts','genres','dials','themes'):
    a = np.array([r[2:] for r in R if r[0]==fam], float)   # owner N rep j na b se nh bh seh
    for who in (1, 0):
        x = a[a[:,0]==who]; z = np.abs(x[:,5])/x[:,6]
        out = []
        for lo, hi in ((0,1),(1,1.64),(1.64,2),(2,2.5),(2.5,3),(3,99)):
            s = (z>=lo)&(z<hi)
            if s.sum()>=5: out.append(f'z{lo}-{hi}: n={s.sum()} sign {np.mean(np.sign(x[s,5])==np.sign(x[s,8])):.2f} ratio {(x[s,5]*x[s,8]).sum()/(x[s,5]**2).sum():.2f}')
        print(fam, 'owner' if who else 'others', ' | '.join(out))
