"""Write a member's profile in plain language. usage: render.py <first chars of member id | owner | all> [out.md]"""
import sys, json, os, warnings, numpy as np
warnings.filterwarnings('ignore')
import feats, lib
HERE = os.path.dirname(os.path.abspath(__file__))
KIND = {1: ('Irreverent comedy and satire', 'absurd, ironic, satirical, self-aware', 'Hot Fuzz, Deadpool, The Big Lebowski'),
        0: ('Warm human drama and romance', 'character-led, romantic, coming-of-age, family, hopeful', 'Good Will Hunting, Dead Poets Society, The Notebook'),
        4: ('Big spectacle adventure', 'spectacle, wonder, fantasy worlds, fast action', 'Star Wars, The Avengers, Raiders of the Lost Ark'),
        3: ('Strange, stylized and mind-bending', 'futuristic, surreal, uncanny, philosophical, strong visual style', 'The Matrix, Inception, Blade Runner'),
        5: ('Light, easygoing comedy', 'sitcom and slapstick humor, wholesome, upbeat, simple plots', 'American Pie, The Big Bang Theory, Meet the Parents'),
        2: ('Tense crime, thriller and war', 'tension, crime, intrigue, violence', 'The Departed, Heat, The Silence of the Lambs')}   # indexes of the frozen kinds6.npz
def pts(v): return f"{abs(v):.1f}" if abs(v) >= 0.95 else f"{abs(v):.2f}".rstrip('0').rstrip('.') if False else f"{abs(v):.1f}"
def rng(lo, hi): a, b = sorted((abs(lo), abs(hi))); return f"{a:.2f} to {b:.2f}"
STOP = {'high', 'driven', 'good', 'feel', 'friendly', 'new', 'york', 'story', 'paced', 'non', 'linear', 'building', 'found', 'dynamics', 'viewing', 'cat', 'mouse', 'age', 'piece', 'burn', 'plot', 'life', 'true', 'octane', 'struggles', 'stakes'}
def words(l): return ', '.join([w for w in l if w not in STOP][:4]).replace('sci', 'sci-fi').replace('coming', 'coming-of-age')
def ex(D, rows, y, k=3, worst=False, key=None):
    o = sorted(range(len(rows)), key=lambda i: ((y[i] if worst else -y[i]), -(key[i] if key is not None else 0)))[:k]
    names = [D.info[rows[i]]['title'] for i in o]
    return ', '.join(f"{n}{' ' + str(D.info[rows[i]].get('release_year')) if names.count(n) > 1 else ''} ({y[i]:.0f})" for n, i in zip(names, o))
GATES = {'quality': 40, 'gap': 80, 'kinds': 80, 'facts': 80, 'themes': 80}   # ratings needed before a statement type is shown (sizes.py)
def render(D, u, idx, y, cfg=None):
    P = lib.fit(D, idx, y, cfg or {'min_ratings': GATES}); F = feats.get(D); TD = json.load(open(os.path.join(HERE, 'theme_desc.json'))); L = []; A = L.append
    A(f"# Your taste, in statements that hold up\n"); A(f"Based on {len(y)} ratings. Your usual rating is {P.usual:.1f}. Every line below is measured on your own ratings, and each one adds to the lines before it.\n")
    q = {s.key: s for s in P.S if s.type == 'quality'}
    A("## How much \"well made\" counts\n")
    if 'well made' in q:
        s = q['well made']; e, lo, hi = P.effect(s); pub = (F['aud'] + F['crit']) / 2
        A(f"- **You rate {'with' if e > 0 else 'against'} the public.** A title that scores 10 points higher with audiences and critics gets {pts(e)} points {'more' if e > 0 else 'less'} from you (likely range {rng(lo, hi)}; {s.n} titles).")
        top = pub[idx] >= np.quantile(pub[idx], 0.75); bot = pub[idx] <= np.quantile(pub[idx], 0.25)
        A(f"  - Highly rated by everyone: you gave {y[top].mean():.1f} on average. For example {ex(D, idx[top], y[top], key=pub[idx][top])}.")
        A(f"  - Poorly rated by everyone: you gave {y[bot].mean():.1f} on average. For example {ex(D, idx[bot], y[bot], worst=True, key=-pub[idx][bot])}.")
    else: A("- Public scores do not tell us what you will rate. We found no reliable link.")
    if 'audiences over critics' in q:
        s = q['audiences over critics']; e, lo, hi = P.effect(s); g = F['aud'] - F['crit']; m = F['has_crit'][idx]
        A(f"- **You side with {'audiences' if e > 0 else 'critics'}.** When audiences score a title 10 points above the critics, you rate it {pts(e)} points {'higher' if e > 0 else 'lower'} (likely range {rng(lo, hi)}; {int(m.sum())} titles with both scores).")
        wm = q.get('well made'); r = y - P.usual - (wm.contrib(idx) if wm else 0)
        hi_g = m & (g[idx] >= np.quantile(g[idx][m], 0.8)); lo_g = m & (g[idx] <= np.quantile(g[idx][m], 0.2)); ud = lambda v: f"{abs(v):.1f} points {'above' if v > 0 else 'below'}"
        A(f"  - Titles audiences liked much more than critics did: you rated them {ud(r[hi_g].mean())} what their overall score suggests. For example {ex(D, idx[hi_g], y[hi_g], worst=e < 0, key=r[hi_g] * np.sign(e))}.")
        A(f"  - Titles critics liked much more than audiences did: you rated them {ud(r[lo_g].mean())} what their overall score suggests. For example {ex(D, idx[lo_g], y[lo_g], worst=e > 0, key=-r[lo_g] * np.sign(e))}.")
    elif 'well made' in q: A("- Audiences or critics: no reliable lean either way.")
    A("\n## Kinds of titles you rate above or below how well made they are\n")
    G = feats.soft(D, 6); lab = feats.kinds(D, 6)[0]; ks = [s for s in P.S if s.type == 'kinds']; shown = set()
    for s in sorted(ks, key=lambda s: -s.b):
        nm, at, tl = KIND[s.key]; e, lo, hi = P.effect(s); m = lab[idx] == s.key; shown.add(s.key)
        A(f"- **{nm}** (titles like {tl}: {at}). You rate these {pts(e)} points {'above' if e > 0 else 'below'} what their quality predicts (likely range {rng(lo, hi)}; {s.n} titles).")
        A(f"  - Loved: {ex(D, idx[m], y[m], key=G[idx[m], s.key])}. Did not work: {ex(D, idx[m], y[m], worst=True, key=G[idx[m], s.key])}.")
    rest = [f"{KIND[j][0]} ({int((lab[idx] == j).sum())} titles)" for j in range(6) if j not in shown]
    if len(y) < GATES['kinds']: A(f"- Not yet. Kinds of titles, sequels and themes need {GATES['kinds']} ratings before they hold up. You have {len(y)}.")
    elif not ks: A("- No kind of title stands out. You rate every kind about as its quality predicts.")
    if rest and len(y) >= GATES['kinds']: A(f"- No reliable difference: {'; '.join(rest)}.")
    fs = [s for s in P.S if s.type in ('facts', 'genres', 'dials')]
    if fs:
        A("\n## Other things that move your rating\n")
        for s in fs:
            e, lo, hi = P.effect(s); m = s.grp[idx]
            A(f"- **Titles that are {s.key}**: {pts(e)} points {'above' if e > 0 else 'below'} the rest, on top of everything above (likely range {rng(lo, hi)}; {int(m.sum())} such titles, {int((~m).sum())} others).")
            A(f"  - Loved: {ex(D, idx[m], y[m])}. Did not work: {ex(D, idx[m], y[m], worst=True)}.")
    ts = [s for s in P.S if s.type == 'themes']
    if ts:
        A("\n## Themes, from how titles are described\n")
        for s in ts:
            e, lo, hi = P.effect(s); d = TD[s.key]; a, b = (d['hi'], d['lo']) if e > 0 else (d['lo'], d['hi']); up, dn = (s.grp[idx], s.low[idx]) if e > 0 else (s.low[idx], s.grp[idx])
            A(f"- **More \"{words(a)}\", less \"{words(b)}\"**: titles described the first way get {pts(e)} points more from you than titles described the second way (likely range {rng(lo, hi)}; {int(up.sum())} against {int(dn.sum())} titles).")
            A(f"  - First way, loved: {ex(D, idx[up], y[up])}. Second way, did not work: {ex(D, idx[dn], y[dn], worst=True)}.")
    if P.trust:
        t = P.trust; A("\n## How far to trust a predicted score\n")
        A(f"- When these statements add up to a high score for you (the top third), you rated {t[0]['mean']:.1f} on average and gave {int(P.low_at)} or less to {t[0]['low']:.0%} of them.")
        A(f"- In the bottom third you rated {t[2]['mean']:.1f} on average and gave {int(P.low_at)} or less to {t[2]['low']:.0%}.")
        if t[0]['low'] <= 0.05 and t[2]['low'] - t[0]['low'] >= 0.08: A("- So a high prediction is safe, and a low one is a gamble.")
        elif t[2]['low'] - t[0]['low'] >= 0.08: A("- So a high prediction is the better bet, but not a safe one.")
        else: A("- So a high prediction means a better evening on average, not a sure thing.")
    return '\n'.join(L), P
def short(D, u, idx, y):
    P = lib.fit(D, idx, y, {'min_ratings': GATES}); out = [f"{u[:8]} n={len(y)} usual {P.usual:.2f} sd {P.sd:.2f}"]
    for s in P.S:
        e, lo, hi = P.effect(s); out.append(f"   {s.type:8s} {str(KIND[s.key][0] if s.type == 'kinds' else s.key):36s} {e:+.2f} [{lo:+.2f},{hi:+.2f}] n={s.n}")
    return '\n'.join(out)
if __name__ == '__main__':
    from harness import Data
    D = Data(); who = sys.argv[1]
    if who == 'all':
        for u in [D.owner] + D.users(): print(short(D, u, *D.of(u)))
    else:
        u = D.owner if who == 'owner' else [x for x in D.users() if x.startswith(who)][0]; txt, P = render(D, u, *D.of(u))
        if len(sys.argv) > 2: open(sys.argv[2], 'w').write(txt + '\n')
        print(txt)
