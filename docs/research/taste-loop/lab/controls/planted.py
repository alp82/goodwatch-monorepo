"""Control: a planted effect. Rung B1's rounded prediction is moved one point toward the true rating on a random
share of each member's targets, chosen so that the member's expected error falls by 0.15 points (run.py,
plant_signal). The harness must find it: the paired difference of the planted rung against the untouched rung must
have an interval below zero and an estimate within 0.05 of -0.15, for members and for the owner.

    python3 controls/planted.py
"""
import os

import _lib

EFFECT = 0.15

if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    b1 = os.path.join(_lib.LADDER, 'b1_public.py')
    code, line, out = _lib.run(a, 'planted', b1, refs=(b1, _lib.B0), extra=['--plant', str(EFFECT)])
    if code != 0 or not line or line['status'] != 'ok':
        print(out)
        _lib.verdict(a, 'planted', False, [], {'error': 'the run did not finish'})
    m = line['measures']
    o = m['others']['vs']['ladder/b1_public.py']['mae']
    w = m['owner']['vs']['ladder/b1_public.py']['mae'] if 'owner' in m else None
    ok = (lambda d: d['hi'] is not None and d['hi'] < 0 and abs(d['diff'] + EFFECT) <= 0.05)
    passed = ok(o) and (w is None or ok(w))
    print(f'planted {EFFECT} into B1, against B1: others {o["diff"]:+.3f} ({o["lo"]:+.3f} to {o["hi"]:+.3f}), '
          f'smallest detectable {o["sde"]}')
    if w:
        print(f'  owner {w["diff"]:+.3f} ({w["lo"]:+.3f} to {w["hi"]:+.3f}), smallest detectable {w["sde"]}')
    _lib.verdict(a, 'planted', passed, [line['run_id']], {'planted': EFFECT, 'others': o, 'owner': w})
