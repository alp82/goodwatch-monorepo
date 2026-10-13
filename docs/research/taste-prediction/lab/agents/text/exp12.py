from exp4 import *
import pickle, os
def stk(comps, pc, lam):
    fs = [lin2(c) for c in comps]
    def f(u, tr, y, te, c0):
        c = [x for x in pc[u] if len(x['te']) == len(te) and (x['te'] == c0['te']).all()][0]
        m = y.mean(); P = [c['pte'] - m]; O = [c['oof'] - m]
        for g in fs:
            p, o = g(tr, y, te); P.append(p - m); O.append(o - m)
        O = np.array(O).T; P = np.array(P).T
        w = nnls(O, y - m)[0]; l = lam(len(y))
        return l * c['pte'] + (1 - l) * (m + P @ w)
    return f
if __name__ == '__main__':
    for seed in (0, 1):
        pc = pickle.load(open(os.path.join(rig.HERE, f'plus3_cache_{seed}.pkl'), 'rb')); print('seed', seed)
        for nm, lam in [('0.5', lambda n: 0.5), ('n/(n+150)', lambda n: n / (n + 150)), ('n/(n+300)', lambda n: n / (n + 300)), ('n/(n+600)', lambda n: n / (n + 600))]:
            evaluate(stk(['facts', 'en', 'tagsvd'], pc, lam), f'trees*l + stack*(1-l), l={nm}', seed=seed)
