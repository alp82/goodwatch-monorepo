"""Control: a name clash. controls/predictors/clash/a/best.py answers 1 for every target, .../b/best.py answers 10.
Both are named best.py. Each is run as the candidate against rung B0 (a reference is always a rung). They must give
their own results: for every member the two errors add up to 9 (|y - 1| + |10 - y| = 9), and the two files have
different hashes in their ledger lines.

    python3 controls/clash.py
"""
import json
import os

import _lib
from common import DATA_ROOT

if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    pa, pb = (os.path.join(_lib.PREDICTORS, 'clash', x, 'best.py') for x in 'ab')
    code_a, la, out_a = _lib.run(a, 'clash', pa)
    code_b, lb, out_b = _lib.run(a, 'clash', pb)
    if not la or not lb or la['status'] != 'ok' or lb['status'] != 'ok':
        print(out_a, out_b)
        _lib.verdict(a, 'clash', False, [], {'error': 'a run did not finish'})
    ea, eb = la['measures']['others']['mae']['value'], lb['measures']['others']['mae']['value']
    per = []
    for line in (la, lb):
        with open(os.path.join(DATA_ROOT, 'results', line['run_id'], 'result.json')) as f:
            per.append({r['member']: r['mae'] for r in json.load(f)['per_member']})
    close = (lambda x, y: abs(x - y) < 1e-5)
    every = set(per[0]) == set(per[1]) and all(close(per[0][m] + per[1][m], 9) for m in per[0])
    passed = close(ea + eb, 9) and every and la['predictor']['sha256'] != lb['predictor']['sha256'] and \
        la['predictor']['path'] != lb['predictor']['path']
    print(f'a/best.py error {ea:.4f}, b/best.py error {eb:.4f}, sum {ea + eb:.4f} (must be 9); '
          f'the two errors add up to 9 for every one of {len(per[0])} members: {every}')
    _lib.verdict(a, 'clash', passed, [la['run_id'], lb['run_id']], {'a': ea, 'b': eb, 'members': len(per[0]),
                                                                  'every_member': every})
