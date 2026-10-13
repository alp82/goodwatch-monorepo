"""Control: the contract canary. controls/predictors/bare_array.py returns a bare array. The harness must reject
the run: status failed, no measures, a non-zero exit code.

    python3 controls/contract.py
"""
import os

import _lib

if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    code, line, out = _lib.run(a, 'contract', os.path.join(_lib.PREDICTORS, 'bare_array.py'))
    passed = bool(code != 0 and line and line['status'] == 'failed' and 'measures' not in line
                  and 'not a dict' in line.get('error', ''))
    print(f'bare array: exit code {code}, status {line and line["status"]}, error: {line and line.get("error")}')
    _lib.verdict(a, 'contract', passed, [line['run_id']] if line else [], {'error': line and line.get('error')})
