"""Control: shuffled labels. Every member's ratings are permuted among that member's titles (seed in the ledger)
before the views are built, for the predicted member and for everyone else. A title then says nothing about its
rating, so no rung may show skill against B0:

- error: for members and for the owner, no paired difference to B0 may be a win by the plan's own rule (interval
  below zero and a gain of 0.05 points or more). The owner has no interval over sittings (stats.cluster_mean), so
  for the owner the rule is read on the second figure, the interval with whole franchises drawn again;
- order: every rung's pair accuracy for members must lie within 0.05 of 0.5, the value of a scorer with no order.

What shuffling does not remove is the level a rung predicts for a member (B0: the median so far; B4 and B5: a mean
shrunk toward the population's). A rung may therefore differ from B0 a little in error while knowing nothing about
titles; the order criterion cannot be passed that way.

With `--task T2a` the same shuffle is run through the hidden-title test. A title then says nothing about its
rating, so no rung may place the titles a member rated 8 or more above the titles the member rated 5 or less: every
rung's separation must be level with zero, in the plain percentile and among equally well-rated titles, for members
and for the owner. "Level with zero" is: a two-sided test of the figure against zero does not reject at 0.001. For
members that is Student's t on the per-member separations (the mean over its standard error, the spread over the
root of the number of members); for the owner it is the figure over the spread of the separation with whole
franchises drawn again, read on the normal curve (the owner has no interval over sittings). The level is 0.001 and
not 0.05 because twenty-four figures are checked at once (six rungs, two measures, members and owner): with true
zeros the control then fails about once in forty times.

    python3 controls/shuffled.py [--task T2a] [--item NNN] [--only <rung file> ...] [--reuse]

`--only` runs the named rungs and writes no verdict; `--reuse` takes, for every rung, the run the ledger already
holds for exactly this control (same task, item, harness code, rung file and seed) and runs only what is missing.
Together they let the six runs be started one at a time and judged together.
"""
import os
import sys

from scipy import stats as distributions

import _lib

RUNGS = ('b1_public.py', 'b2_taste_today.py', 'b3_taste_standardized.py', 'b4_consensus.py', 'b5_pooled.py',
         'bp_votes.py')

LEVEL = 0.001                                         # T2a: the level of the two-sided test of a figure against zero


def p_value(d):
    """Of a figure against zero: Student's t over members when the figure is a mean over `n` members, the normal
    curve for the owner's figure (its standard error comes from franchises drawn again). None without a figure."""
    if d.get('value') is None or d.get('se') is None:
        return None
    if d['se'] == 0:
        return 1.0 if d['value'] == 0 else 0.0
    z = abs(d['value']) / d['se']
    return float(2 * (distributions.t.sf(z, d['n'] - 1) if 'n' in d else distributions.norm.sf(z)))


def level(d):
    p = p_value(d)
    return p is not None and p >= LEVEL


def one(a, name, refs):
    """One rung on shuffled labels: (exit code, ledger line, output)."""
    path = os.path.join(_lib.LADDER, name)
    line = _lib.stored(a, 'shuffled', path, _lib.SEED) if a.reuse else None
    if line:
        return 0, line, ''
    return _lib.run(a, 'shuffled', path, refs=refs, extra=['--shuffle-seed', str(_lib.SEED)])


def chosen(a):
    """The rungs of this call; with --only, no verdict is written."""
    unknown = [x for x in a.only or () if x not in RUNGS]
    if unknown:
        sys.exit(f'--only names a rung file: {", ".join(RUNGS)}')
    return [x for x in RUNGS if not a.only or x in a.only]


def t2a(a):
    passed, runs, detail = True, [], {}
    b2 = os.path.join(_lib.LADDER, 'b2_taste_today.py')
    for name in sorted(chosen(a), key=lambda x: x != 'b2_taste_today.py'):   # B2 first: the others reuse its answers
        code, line, out = one(a, name, (b2,))
        if code != 0 or not line or line['status'] != 'ok':
            print(out)
            passed = False
            continue
        runs.append(line['run_id'])
        o, w = line['measures']['others'], line['measures'].get('owner', {})
        figures = {'others': o['separation'], 'others, equally well-rated': o['separation_matched'],
                   'owner': w.get('separation_franchise', {}),
                   'owner, equally well-rated': w.get('separation_matched_franchise', {})}
        bad = [k for k, d in figures.items() if not level(d)]
        passed &= not bad
        detail[name] = {**{k: {**d, 'p': p_value(d)} for k, d in figures.items()}, 'not_level': bad}
        num = (lambda d: 'n/a' if p_value(d) is None else f'{d["value"]:+.3f} (se {d["se"]:.3f}, p {p_value(d):.3f})')
        print(f'{name:28s} ' + '  '.join(f'{k} {num(d)}' for k, d in figures.items())
              + f'  {"NOT LEVEL: " + ", ".join(bad) if bad else "level with zero"}')
    if a.only:
        sys.exit(0 if passed else 1)
    _lib.verdict(a, 'shuffled', passed and len(runs) == len(RUNGS), runs, detail)


if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    if a.task == 'T2a':
        t2a(a)
    passed, runs, detail = True, [], {}
    for name in chosen(a):
        code, line, out = one(a, name, (_lib.B0,))
        if code != 0 or not line or line['status'] != 'ok':
            print(out)
            passed = False
            continue
        runs.append(line['run_id'])
        m = line['measures']
        o = m['others']['vs']['ladder/b0_median.py']
        wv = m.get('owner', {}).get('vs', {}).get('ladder/b0_median.py', {})
        w = wv.get('mae', {})
        if w.get('hi') is None and wv.get('mae_franchise'):
            w = {**wv['mae_franchise'], 'figure': 'franchises drawn again'}
        pa = m['others']['pair_acc']
        bad = _lib.shows_skill(o['mae']) or _lib.shows_skill(w) or abs(pa['value'] - 0.5) > 0.05
        passed &= not bad
        detail[name] = {'others': o['mae'], 'owner': w, 'pair_acc': pa, 'shows_skill': bad}
        print(f'{name:28s} others {o["mae"]["diff"]:+.3f} ({o["mae"]["lo"]:+.3f} to {o["mae"]["hi"]:+.3f})  '
              f'owner {w.get("diff", float("nan")):+.3f} ({w.get("lo") or 0:+.3f} to {w.get("hi") or 0:+.3f})  '
              f'pair accuracy {pa["value"]:.3f} ({pa["lo"]:.3f} to {pa["hi"]:.3f})  '
              f'{"SHOWS SKILL" if bad else "no skill"}')
    if a.only:
        sys.exit(0 if passed else 1)
    _lib.verdict(a, 'shuffled', passed and len(runs) == len(RUNGS), runs, detail)
