"""Control: shuffled labels. Every member's ratings are permuted among that member's titles (seed in the ledger)
before the views are built, for the predicted member and for everyone else. A title then says nothing about its
rating, so no rung may show skill against B0:

- error: for members and for the owner, no paired difference to B0 may be a win by the plan's own rule (interval
  below zero and a gain of 0.05 points or more);
- order: every rung's pair accuracy for members must lie within 0.05 of 0.5, the value of a scorer with no order.

What shuffling does not remove is the level a rung predicts for a member (B0: the median so far; B4 and B5: a mean
shrunk toward the population's). A rung may therefore differ from B0 a little in error while knowing nothing about
titles; the order criterion cannot be passed that way.

    python3 controls/shuffled.py
"""
import os

import _lib

RUNGS = ('b1_public.py', 'b2_taste_today.py', 'b3_taste_standardized.py', 'b4_consensus.py', 'b5_pooled.py',
         'bp_votes.py')

if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    passed, runs, detail = True, [], {}
    for name in RUNGS:
        code, line, out = _lib.run(a, 'shuffled', os.path.join(_lib.LADDER, name),
                                   extra=['--shuffle-seed', str(_lib.SEED)])
        if code != 0 or not line or line['status'] != 'ok':
            print(out)
            passed = False
            continue
        runs.append(line['run_id'])
        m = line['measures']
        o = m['others']['vs']['ladder/b0_median.py']
        w = m.get('owner', {}).get('vs', {}).get('ladder/b0_median.py', {}).get('mae', {})
        pa = m['others']['pair_acc']
        bad = _lib.shows_skill(o['mae']) or _lib.shows_skill(w) or abs(pa['value'] - 0.5) > 0.05
        passed &= not bad
        detail[name] = {'others': o['mae'], 'owner': w, 'pair_acc': pa, 'shows_skill': bad}
        print(f'{name:28s} others {o["mae"]["diff"]:+.3f} ({o["mae"]["lo"]:+.3f} to {o["mae"]["hi"]:+.3f})  '
              f'owner {w.get("diff", float("nan")):+.3f} ({w.get("lo") or 0:+.3f} to {w.get("hi") or 0:+.3f})  '
              f'pair accuracy {pa["value"]:.3f} ({pa["lo"]:.3f} to {pa["hi"]:.3f})  '
              f'{"SHOWS SKILL" if bad else "no skill"}')
    _lib.verdict(a, 'shuffled', passed and len(runs) == len(RUNGS), runs, detail)
