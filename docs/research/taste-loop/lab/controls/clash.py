"""Control: a name clash. controls/predictors/clash/a/best.py answers 1 for every target, .../b/best.py answers 10.
Both are named best.py. Each is run as the candidate with the other as its reference. They must give their own
results: for every member the two errors add up to 9 (|y - 1| + |10 - y| = 9), each run's difference against the
other is its own error minus the other's, and the two runs mirror each other.

    python3 controls/clash.py
"""
import os

import _lib

if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    pa, pb = (os.path.join(_lib.PREDICTORS, 'clash', x, 'best.py') for x in 'ab')
    ra, rb = 'controls/predictors/clash/a/best.py', 'controls/predictors/clash/b/best.py'
    code_a, la, out_a = _lib.run(a, 'clash', pa, refs=(pb,))
    code_b, lb, out_b = _lib.run(a, 'clash', pb, refs=(pa,))
    if not la or not lb or la['status'] != 'ok' or lb['status'] != 'ok':
        print(out_a, out_b)
        _lib.verdict(a, 'clash', False, [], {'error': 'a run did not finish'})
    ea, eb = la['measures']['others']['mae']['value'], lb['measures']['others']['mae']['value']
    da, db = la['measures']['others']['vs'][rb]['mae']['diff'], lb['measures']['others']['vs'][ra]['mae']['diff']
    close = (lambda x, y: abs(x - y) < 1e-5)
    passed = close(ea + eb, 9) and close(da, ea - eb) and close(db, eb - ea) and \
        la['predictor']['sha256'] != lb['predictor']['sha256']
    print(f'a/best.py error {ea:.4f}, b/best.py error {eb:.4f}, sum {ea + eb:.4f} (must be 9); '
          f'a against b {da:+.4f}, b against a {db:+.4f}')
    _lib.verdict(a, 'clash', passed, [la['run_id'], lb['run_id']], {'a': ea, 'b': eb, 'a_vs_b': da, 'b_vs_a': db})
