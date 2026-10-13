from exp4 import *
import pickle, os
def stk(comps, pc, mode='nnls'):
    fs = [lin2(c) for c in comps]
    def f(u, tr, y, te, c0):
        c = [x for x in pc[u] if len(x['te']) == len(te) and (x['te'] == c0['te']).all()][0]
        m = y.mean(); P = [c['pte'] - m]; O = [c['oof'] - m]
        for g in fs:
            p, o = g(tr, y, te); P.append(p - m); O.append(o - m)
        O = np.array(O).T; P = np.array(P).T
        if mode == 'none': return c['pte']
        w = nnls(O, y - m)[0]
        return m + P @ w
    return f
if __name__ == '__main__':
    for seed in (0, 1):
        pc = pickle.load(open(os.path.join(rig.HERE, f'plus3_cache_{seed}.pkl'), 'rb')); print('seed', seed)
        evaluate(lambda u, a, b, c, d: d['pte'], 'gbm baseline', seed=seed)
        evaluate(stk([], pc, 'none'), 'gbm+text feats', seed=seed)
        for comps in [['facts'], ['facts', 'en', 'tagsvd'], ['en', 'tagsvd'], ['facts', 'en', 'tagsvd', 'tfidf_ess']]:
            evaluate(stk(comps, pc), f'gbm+text feats, stacked {comps}', seed=seed)
