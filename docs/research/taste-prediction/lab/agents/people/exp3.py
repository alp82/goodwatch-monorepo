import lab, pf, pf2, numpy as np, sys
D = lab.data(); S = pf.static(D); S2 = pf2.static2(D)
def mk(blocks, hist=False, gkw={}):
    X = np.hstack([S['base']] + [ {'E': S['extra'], 'F': S2['fr'], 'P': S2['pp']}[b] for b in blocks])
    def predict(D, user, tr_idx, tr_y, te_idx):
        Xtr, Xte = X[tr_idx], X[te_idx]
        if hist:
            Xtr = np.hstack([Xtr, pf2.franchise_history(D, tr_idx, tr_y, tr_idx)]); Xte = np.hstack([Xte, pf2.franchise_history(D, tr_idx, tr_y, te_idx)])
        return pf.gbm(**gkw).fit(Xtr, tr_y).predict(Xte)
    return predict
if __name__ == '__main__':
    for name, b, h in [('base+F', 'F', False), ('base+F+hist', 'F', True), ('base+P', 'P', False), ('base+E+F', 'EF', False), ('base+E+F+hist', 'EF', True), ('base+E+F+P', 'EFP', False), ('base+E+F+P+hist', 'EFP', True)]:
        lab.score(mk(b, h), name)
