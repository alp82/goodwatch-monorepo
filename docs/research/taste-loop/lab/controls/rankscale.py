"""Control: the rank scale. controls/predictors/rankscale.py is rung B2 with a constant added to every rank of a
view (the number of ratings the view shows). The order inside every view is B2's, but the scale no longer means the
same from one view to the next, which the contract asks of a predictor without a score: the calibrator learns its
steps on calibration views and applies them to another view.

Which of the two outcomes the harness gives: the run fails the contract check. A predictor without a score must
give rank in 0..1, and this one does not. Status failed, no measures, a non-zero exit code.

What the check does not catch: a shift small enough to stay inside 0..1. No check on answers alone can, because no
title is ranked in two views of one block. The rule is in the contract; the range check enforces its coarse part.

    python3 controls/rankscale.py
"""
import os

import _lib

if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    code, line, out = _lib.run(a, 'rankscale', os.path.join(_lib.PREDICTORS, 'rankscale.py'))
    passed = bool(code != 0 and line and line['status'] == 'failed' and 'measures' not in line
                  and 'rank in 0..1' in line.get('error', ''))
    print(f'B2 plus a constant per view: exit code {code}, status {line and line["status"]}, '
          f'error: {line and line.get("error")}')
    _lib.verdict(a, 'rankscale', passed, [line['run_id']] if line else [],
                 {'outcome': 'fails the contract check' if passed else 'ran', 'error': line and line.get('error')})
