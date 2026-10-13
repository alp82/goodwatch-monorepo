"""risk agent: a small ordinal location-scale model of a rating distribution.

    P(rating <= k | title) = sigmoid( (theta_k - a * s - xl . gamma) * exp(-(c * (s - sbar) + xs . tau)) + [k <= 5] * xt . delta )

    s      the point score (out-of-fold on the fitting rows)                      a: how sharply the score separates ratings
    theta  nine ordered thresholds (the member's own use of the 1..10 scale)
    gamma  LOCATION inputs: shift the whole distribution                            (xl)
    tau    SPREAD inputs: widen or narrow it; c lets the spread depend on the score (xs)
    delta  LOW-TAIL inputs: move only the mass at 5 or less (skew)                  (xt)
gamma, tau, delta are penalised towards given prior values (zero, or what was learned across the other members).
"""
import numpy as np
from scipy.optimize import minimize
from scipy.special import expit

def _unpack(w, nl, ns, nt):
    t1 = w[0]; d = w[1:9]; a = w[9]; c = w[10]; g = w[11:11 + nl]; tau = w[11 + nl:11 + nl + ns]; de = w[11 + nl + ns:11 + nl + ns + nt]
    return t1, d, a, c, g, tau, de

def _eta(theta, a, c, g, tau, de, s, sbar, XL, XS, XT):
    mu = a * s + XL @ g; om = c * (s - sbar) + XS @ tau; e = np.exp(-om)
    eta = (theta[None, :] - mu[:, None]) * e[:, None]
    tail = XT @ de; eta[:, :5] += tail[:, None]
    return eta, mu, e

def cum(par, s, XL, XS, XT):
    """P(rating <= k), k = 1..9, n x 9, made monotone."""
    eta, _, _ = _eta(par['theta'], par['a'], par['c'], par['g'], par['tau'], par['de'], s, par['sbar'], XL, XS, XT)
    return np.maximum.accumulate(expit(eta), axis=1)

def dist(par, s, XL, XS, XT):
    C = cum(par, s, XL, XS, XT); n = len(s)
    return np.diff(np.c_[np.zeros(n), C, np.ones(n)], axis=1)

def fit(s, y, XL=None, XS=None, XT=None, lam=(5., 5., 5.), prior=None, lam_c=2.0, use_c=True, fixed=None, maxiter=300):
    """Fit one member. lam: penalties on (gamma, tau, delta) around prior = (gamma0, tau0, delta0). fixed: (theta, a, c) to hold the base fixed."""
    n = len(s); z = np.zeros((n, 0)); XL = z if XL is None else XL; XS = z if XS is None else XS; XT = z if XT is None else XT
    nl, ns, nt = XL.shape[1], XS.shape[1], XT.shape[1]; y = np.asarray(y).astype(int); sbar = float(np.mean(s))
    pr = [np.zeros(nl), np.zeros(ns), np.zeros(nt)] if prior is None else [np.asarray(v, float) for v in prior]
    sd = max(float(np.std(y - s)), 0.3); a0 = 1.8 / sd
    w0 = np.r_[a0 * 1.5, np.full(8, np.log(a0)), a0, 0.0, pr[0], pr[1], pr[2]]; d0 = w0[1:9].copy()
    iu = np.clip(y - 1, 0, 8); il = np.clip(y - 2, 0, 8); hu = y <= 9; hl = y >= 2; rows = np.arange(n)
    def f(w):
        t1, d, a, c, g, tau, de = _unpack(w, nl, ns, nt)
        if not use_c: c = 0.0
        ed = np.exp(d); theta = t1 + np.r_[0, np.cumsum(ed)]
        eta, mu, e = _eta(theta, a, c, g, tau, de, s, sbar, XL, XS, XT); F = expit(eta)
        Fu = np.where(hu, F[rows, iu], 1.0); Fl = np.where(hl, F[rows, il], 0.0); p = np.maximum(Fu - Fl, 1e-9)
        L = -np.log(p).sum()
        G = np.zeros((n, 9)); fu = Fu * (1 - Fu) / p; fl = Fl * (1 - Fl) / p
        np.add.at(G, (rows[hu], iu[hu]), -fu[hu]); np.add.at(G, (rows[hl], il[hl]), fl[hl])
        Ge = G * e[:, None]; gs = Ge.sum(1)
        dth = Ge.sum(0); dt1 = dth.sum(); dd = np.array([dth[j + 1:].sum() for j in range(8)]) * ed
        da = -(gs * s).sum(); dg = -XL.T @ gs
        dom = -((theta[None, :] - mu[:, None]) * Ge).sum(1)
        dc = (dom * (s - sbar)).sum() if use_c else 0.0; dtau = XS.T @ dom; dde = XT.T @ G[:, :5].sum(1)
        L += 0.5 * ((d - d0) ** 2).sum() * 1.0 + lam_c * c * c + lam[0] * ((g - pr[0]) ** 2).sum() + lam[1] * ((tau - pr[1]) ** 2).sum() + lam[2] * ((de - pr[2]) ** 2).sum()
        gr = np.r_[dt1, dd + (d - d0), da, dc + 2 * lam_c * c, dg + 2 * lam[0] * (g - pr[0]), dtau + 2 * lam[1] * (tau - pr[1]), dde + 2 * lam[2] * (de - pr[2])]
        return L, gr
    r = minimize(f, w0, jac=True, method='L-BFGS-B', options={'maxiter': maxiter})
    t1, d, a, c, g, tau, de = _unpack(r.x, nl, ns, nt)
    return {'theta': t1 + np.r_[0, np.cumsum(np.exp(d))], 'a': a, 'c': c if use_c else 0.0, 'g': g, 'tau': tau, 'de': de, 'sbar': sbar, 'nll': r.fun, '_f': f, '_w': r.x}

def fit_shared(groups, nl, ns, nt, lam=(1., 1., 1.)):
    """Population values of (gamma, tau, delta): every member keeps the thresholds, sharpness and score-spread of their own base fit
    (par from fit() without inputs); only the input effects are shared. groups: list of (par, s, y, XL, XS, XT)."""
    pre = []
    for par, s, y, XL, XS, XT in groups:
        y = np.asarray(y).astype(int); n = len(y)
        base = par['theta'][None, :] - (par['a'] * s)[:, None]; om0 = par['c'] * (s - par['sbar'])
        pre.append((base, om0, XL, XS, XT, np.clip(y - 1, 0, 8), np.clip(y - 2, 0, 8), y <= 9, y >= 2, np.arange(n)))
    def f(w):
        g, tau, de = w[:nl], w[nl:nl + ns], w[nl + ns:]; L = 0.0; gr = np.zeros_like(w)
        for base, om0, XL, XS, XT, iu, il, hu, hl, rows in pre:
            e = np.exp(-(om0 + XS @ tau)); num = base - (XL @ g)[:, None]; eta = num * e[:, None]; eta[:, :5] += (XT @ de)[:, None]; F = expit(eta)
            Fu = np.where(hu, F[rows, iu], 1.0); Fl = np.where(hl, F[rows, il], 0.0); p = np.maximum(Fu - Fl, 1e-9); L -= np.log(p).sum()
            G = np.zeros_like(F); fu = Fu * (1 - Fu) / p; fl = Fl * (1 - Fl) / p
            np.add.at(G, (rows[hu], iu[hu]), -fu[hu]); np.add.at(G, (rows[hl], il[hl]), fl[hl])
            Ge = G * e[:, None]
            gr[:nl] -= XL.T @ Ge.sum(1); gr[nl:nl + ns] += XS.T @ (-(num * Ge).sum(1)); gr[nl + ns:] += XT.T @ G[:, :5].sum(1)
        L += lam[0] * (g ** 2).sum() + lam[1] * (tau ** 2).sum() + lam[2] * (de ** 2).sum()
        gr += 2 * np.r_[lam[0] * g, lam[1] * tau, lam[2] * de]
        return L, gr
    r = minimize(f, np.zeros(nl + ns + nt), jac=True, method='L-BFGS-B')
    return r.x[:nl], r.x[nl:nl + ns], r.x[nl + ns:]

if __name__ == '__main__':      # gradient check
    from scipy.optimize import check_grad
    rng = np.random.default_rng(0); n = 300; s = rng.normal(7, 1, n); X = rng.normal(size=(n, 2)); y = np.clip(np.round(s + 0.5 * X[:, 0] + rng.normal(0, 1, n) * np.exp(0.3 * X[:, 1])), 1, 10)
    m = fit(s, y, X, X, X); w = m['_w'] + rng.normal(0, 0.05, len(m['_w']))
    print('grad err', check_grad(lambda v: m['_f'](v)[0], lambda v: m['_f'](v)[1], w), 'g', m['g'], 'tau', m['tau'], 'de', m['de'], 'a', m['a'], 'c', m['c'])
    b = fit(s, y); g = fit_shared([(b, s, y, X, X, X)], 2, 2, 2); print('shared', g)
    P = dist(m, s, X, X, X); print(P.sum(1)[:3], P.min())
