import pickle, numpy as np
d = pickle.load(open('explore_kinds.pkl','rb')); R = d['rows']; P = d['pred']
names = ['shared6','shared8','shared12','shared16','shared20','own','loved','genre1']
arr = {nm: np.array([r[2:] for r in R if r[0]==nm], float) for nm in names}
# cols: owner, N, j, n, m, se, d, psd, nh, mh, seh
print('variant   who    | shown/member-split | sign repl (z>=1.64) | size slope | sign repl all | gain R2 over quality | share of ridge74 gain | mae gain')
for who in ('owner','others'):
    for nm in names:
        a = arr[nm]; a = a[a[:,0]==(who=='owner')]
        z = np.abs(a[:,6])/a[:,7]; sh = (z>=1.64)
        sg = np.sign(a[:,6])==np.sign(a[:,9])
        slope = (a[sh,6]*a[sh,9]).sum()/(a[sh,6]**2).sum() if sh.any() else np.nan
        pp = [e for e in P if (e['u']==P[0]['u'])==(who=='owner') and nm in e]
        nsplit = len(pp)
        # per member mean first
        us = sorted({e['u'] for e in pp}); g=[]; gr=[]; gm=[]
        for u in us:
            ee=[e for e in pp if e['u']==u]; q=np.mean([e['quality'] for e in ee]); c=np.mean([e['const'] for e in ee])
            g.append((q-np.mean([e[nm] for e in ee]))/c); gr.append((q-np.mean([e['ridge74'] for e in ee]))/c); gm.append(np.mean([e['mae_quality']-e['mae_'+nm] for e in ee]))
        print(f'{nm:9s} {who:6s} | {sh.sum()/nsplit:5.2f} | {sg[sh].mean() if sh.any() else np.nan:.3f} (n={sh.sum()}) | {slope:.2f} | {sg.mean():.3f} | {np.mean(g):+.4f} | ridge74 {np.mean(gr):+.4f} | {np.mean(gm):+.4f}')
