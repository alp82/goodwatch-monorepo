from exp4 import *
import cacheplus, pickle, os
def stackw(comps, power=1.0, plus=None):
    fs = [lin2(c) for c in comps]
    def f(u, tr, y, te, c):
        if plus is not None:
            c = plus[u][f.i % len(plus[u])]; f.i += 1
        m = y.mean(); P = [c['pte'] - m]; O = [c['oof'] - m]
        for g in fs:
            p, o = g(tr, y, te); P.append(p - m); O.append(o - m)
        O = np.array(O).T; P = np.array(P).T
        band = np.where(y <= 5, 0, np.where(y <= 7, 1, 2)); cnt = np.bincount(band, minlength=3).astype(float)
        sw = (len(y) / 3 / np.maximum(cnt[band], 3)) ** power; sw /= sw.mean()
        # weighted nnls with free intercept: add +1/-1 columns
        A = np.c_[O, np.ones(len(y)), -np.ones(len(y))] * np.sqrt(sw)[:, None]
        w = nnls(A, (y - m) * np.sqrt(sw))[0]
        return m + P @ w[:-2] + w[-2] - w[-1]
    f.i = 0
    return f
if __name__ == '__main__':
    for seed in (0, 1):
        print('seed', seed)
        for pw in (0, 0.5, 1.0):
            evaluate(stackw(['facts', 'en', 'tagsvd'], pw), f'stack facts,en,tagsvd band-weight^{pw}', seed=seed)
        p = os.path.join(rig.HERE, f'plus_cache_{seed}.pkl')
        if os.path.exists(p):
            pc = pickle.load(open(p, 'rb'))
            g = stackw([], 0, pc); g2 = lambda u, a, b, c, d: pc[u][[i for i, x in enumerate(pc[u]) if len(x['te']) == len(c) and (x['te'] == d['te']).all()][0]]['pte']
            evaluate(g2, 'gbm+ alone', seed=seed)
            for pw in (0, 1.0):
                evaluate(stackw(['facts', 'en', 'tagsvd'], pw, pc), f'stack gbm+,facts,en,tagsvd band-weight^{pw}', seed=seed)
