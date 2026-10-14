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

With `--task T2a` the same shuffle is run through the hidden-title test, and with `--task T2b` (`--split
sitting|order`) the views are the real ones but each member's targets are swapped for as many random titles of the
same list that are not targets. Changed in item 004, the rule for both, fixed before any result was seen:

- every rung runs on three independent shuffles (seeds 20261013, 20261014 and 20261015);
- the figures: T2a, the separation and the separation among equally well-rated titles; T2b, the mean percentile
  minus 0.5 and the paired difference to B2; each for members other than the owner and for the owner;
- for members, a member's figure is the mean of the three shuffles, and the interval is drawn over members; for the
  owner, the mean of the three figures with whole franchises drawn again, with the three standard errors combined
  (independent shuffles) into a 95% interval on the normal curve; a figure the owner's data cannot give an interval
  for is shown and not judged;
- **pass** only when every judged figure's 95% interval lies within plus or minus 0.015 (half the T2a and T2b win
  floor of 0.03); otherwise **inconclusive**: the data cannot show the bias is that small. The widest figure is
  reported, and a figure whose interval lies wholly outside the band is named, without a third verdict: with few
  members and two dozen figures that happens by chance (the made-up pack of the tests shows it). A run that does
  not finish fails the control.

    python3 controls/shuffled.py [--task T2a|T2b] [--split sitting|order] [--item NNN] [--only <rung file> ...] [--reuse]

`--only` runs the named rungs (with `--seed`, on the named shuffles only) and writes no verdict; `--reuse` takes, for every rung, the run the ledger already
holds for exactly this control (same task, item, harness code, rung file and seed) and runs only what is missing.
Together they let the six runs be started one at a time and judged together.
"""
import os
import sys

import _lib

RUNGS = ('b1_public.py', 'b2_taste_today.py', 'b3_taste_standardized.py', 'b4_consensus.py', 'b5_pooled.py',
         'bp_votes.py')

TOLERANCE = 0.015                                     # T2a, T2b: half the win floor of 0.03 (item 004)
SEEDS = (_lib.SEED, _lib.SEED + 1, _lib.SEED + 2)     # T2a, T2b: three independent shuffles
B2 = 'ladder/b2_taste_today.py'


def judge(figures):
    """figures: name -> {'value', 'lo', 'hi'} (lo None: not judged). Returns (outcome, the widest judged figure)."""
    judged = {k: d for k, d in figures.items() if d.get('lo') is not None}
    if not judged:
        return 'inconclusive', None
    widest = max(judged, key=lambda k: max(abs(judged[k]['lo']), abs(judged[k]['hi'])))
    if all(-TOLERANCE <= d['lo'] and d['hi'] <= TOLERANCE for d in judged.values()):
        return 'pass', widest
    return 'inconclusive', widest


def t2(a):
    """T2a and T2b: three shuffles per rung, judged against the tolerance."""
    import json
    import numpy as np
    from common import DATA_ROOT, DRAWS
    from stats import mean_interval
    b2 = os.path.join(_lib.LADDER, 'b2_taste_today.py')
    ok, runs, detail, outcomes, lines_of = True, [], {}, [], {}
    if a.seed and (not a.only or not set(a.seed) <= set(SEEDS)):
        sys.exit(f'--seed goes with --only and names one of {", ".join(map(str, SEEDS))}')
    for seed in (a.seed or SEEDS):
        for name in sorted(chosen(a), key=lambda x: x != 'b2_taste_today.py'):    # B2 first: the others reuse it
            code, line, out = one(a, name, (b2,), seed)
            if code != 0 or not line or line['status'] != 'ok':
                print(out)
                ok = False
                continue
            runs.append(line['run_id'])
            lines_of.setdefault(name, []).append(line)
    if a.only:
        print(f'{len(runs)} runs on {len(a.seed or SEEDS)} shuffles; no verdict (--only)')
        sys.exit(0 if ok else 1)
    for name in RUNGS:
        lines = lines_of.get(name, [])
        if len(lines) != len(SEEDS):
            ok = False
            continue
        per = []
        for line in lines:
            with open(os.path.join(DATA_ROOT, 'results', line['run_id'], 'result.json')) as f:
                per.append({r['member']: r for r in json.load(f)['per_member']})
        owner = lines[0]['measures'].get('owner') is not None
        members = sorted(h for h in set.intersection(*(set(p) for p in per)) if not per[0][h].get('owner'))
        if a.task == 'T2a':
            member_of = {'others': lambda r: r.get('separation'),
                         'others, equally well-rated': lambda r: r.get('separation_matched')}
            owner_of = {'owner': lambda m: m['owner'].get('separation_franchise', {}),
                        'owner, equally well-rated': lambda m: m['owner'].get('separation_matched_franchise', {})}
        else:
            member_of = {'others, percentile minus 0.5': lambda r: None if r.get('pct') is None else r['pct'] - 0.5,
                         'others, against B2': lambda r: None if r.get('pct') is None or r.get(f'pct:{B2}') is None
                         else r['pct'] - r[f'pct:{B2}']}
            owner_of = {'owner, percentile minus 0.5': lambda m: {
                            'value': None if m['owner']['pct_franchise'].get('value') is None
                            else m['owner']['pct_franchise']['value'] - 0.5, 'se': m['owner']['pct_franchise'].get('se')},
                        'owner, against B2': lambda m: m['owner']['vs'][B2]['pct_franchise']
                        if B2 in m['owner']['vs'] else {'value': 0.0, 'se': 0.0}}
        figures = {}
        for label, of in member_of.items():
            values = [np.mean([of(p[h]) for p in per]) for h in members
                      if all(of(p[h]) is not None for p in per)]
            m = mean_interval(np.array(values, float), DRAWS, _lib.SEED)
            figures[label] = {'value': m['value'], 'lo': m['lo'], 'hi': m['hi'], 'n': m['n']}
        if owner:
            for label, of in owner_of.items():
                got = [of(line['measures']) for line in lines]
                if any(g.get('value') is None or g.get('se') is None for g in got):
                    figures[label] = {'value': None, 'lo': None, 'hi': None, 'note': 'not judged'}
                    continue
                v = float(np.mean([g['value'] for g in got]))
                se = float(np.sqrt(sum(g['se'] ** 2 for g in got)) / len(got))
                figures[label] = {'value': round(v, 6), 'lo': round(v - 1.959964 * se, 6),
                                  'hi': round(v + 1.959964 * se, 6), 'se': round(se, 6)}
        outcome, widest = judge(figures)
        outcomes.append(outcome)
        outside = [k for k, d in figures.items() if d.get('lo') is not None
                   and (d['lo'] > TOLERANCE or d['hi'] < -TOLERANCE)]
        detail[name] = {'figures': figures, 'outcome': outcome, 'widest': widest, 'wholly_outside': outside}
        num = (lambda d: 'not judged' if d.get('lo') is None
               else f'{d["value"]:+.3f} ({d["lo"]:+.3f} to {d["hi"]:+.3f})')
        print(f'{name:28s} ' + '  '.join(f'{k} {num(d)}' for k, d in figures.items()) + f'  {outcome.upper()}'
              + (f' (wholly outside the band: {", ".join(outside)})' if outside else ''))
    overall = 'fail' if not ok else 'pass' if all(o == 'pass' for o in outcomes) else 'inconclusive'
    widest = max(((name, d['widest'], d['figures'][d['widest']]) for name, d in detail.items() if d['widest']),
                 key=lambda x: max(abs(x[2]['lo']), abs(x[2]['hi'])), default=None)
    if widest:
        print(f'widest figure: {widest[0]}, {widest[1]}: {widest[2]["value"]:+.3f} '
              f'({widest[2]["lo"]:+.3f} to {widest[2]["hi"]:+.3f}); tolerance plus or minus {TOLERANCE}')
    detail['_rule'] = {'tolerance': TOLERANCE, 'seeds': list(SEEDS),
                       'widest': widest and {'rung': widest[0], 'figure': widest[1], **widest[2]}}
    _lib.verdict(a, 'shuffled', overall == 'pass', runs, detail, outcome=overall)


def one(a, name, refs, seed=_lib.SEED):
    """One rung on shuffled labels: (exit code, ledger line, output)."""
    path = os.path.join(_lib.LADDER, name)
    line = _lib.stored(a, 'shuffled', path, seed) if a.reuse else None
    if line:
        return 0, line, ''
    return _lib.run(a, 'shuffled', path, refs=refs, extra=['--shuffle-seed', str(seed)])


def chosen(a):
    """The rungs of this call; with --only, no verdict is written."""
    unknown = [x for x in a.only or () if x not in RUNGS]
    if unknown:
        sys.exit(f'--only names a rung file: {", ".join(RUNGS)}')
    return [x for x in RUNGS if not a.only or x in a.only]


if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    if a.task in ('T2a', 'T2b'):
        t2(a)
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
