from exp5 import *
ou_all = {}
def pooled(u, te, names=('en',), alpha=None, resid_public=False):
    """Text model of what the other members like (centered per member), trained without the test titles. Returns score for all rated rows."""
    if u not in ou_all: ou_all[u] = D.others(u)
    uu, ti, sc = ou_all[u]
    cen = np.zeros(len(sc))
    for m in np.unique(uu):
        k = uu == m; cen[k] = sc[k] - sc[k].mean()
    keep = ~np.isin(ti, te); ti, cen = ti[keep], cen[keep]
    n = np.bincount(pos[ti], minlength=len(rated)).astype(float); s = np.bincount(pos[ti], weights=cen, minlength=len(rated))
    has = n > 0; t = s[has] / n[has]; K = sum(gram(x) for x in names)
    a = np.where(has)[0]
    p, loo = kridge2(K[np.ix_(a, a)], t, K[:, a])
    p[a] = loo   # titles used in training get their leave-one-out score
    return p
def with_pooled(names=('en',)):
    def f(u, tr, y, te, c):
        p = pooled(u, te, names); Xb = np.c_[XGm[rated], S[rated], p]
        return hgb(Xb[pos[tr]], y, Xb[pos[te]])
    return f
if __name__ == '__main__':
    us = [D.owner] if 'owner' in sys.argv else None
    evaluate(with_pooled(('en',)), 'gbm + seq + pooled-text(en)', users=us)
    evaluate(with_pooled(('en', 'multi', 'tagsvd', 'alltags')), 'gbm + seq + pooled-text(en,multi,tags)', users=us)
    evaluate(with_pooled(('facts', 'en', 'tagsvd')), 'gbm + seq + pooled(facts,en,tagsvd)', users=us)
