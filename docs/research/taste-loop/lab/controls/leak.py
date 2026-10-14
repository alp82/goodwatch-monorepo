"""Control: the leak canary. controls/predictors/leak_canary.py tries to read the pack, the answer files, other
views, the harness's memory and frames, other processes and the network. Where it finds a hidden rating it answers
with it; elsewhere it answers like B0. The control passes when its error equals B0's for every member (it found
nothing) and the harness reports its attempts in the ledger line. The report is advisory; the equal error is the
test. The canary never touches anything under a `gate` folder.

With `--task T2a` the canary runs on the hidden-title views, behind the same boundary. Where it finds a hidden
rating it also puts that title at the top of its order; everywhere else its rank is one constant. The control
passes when, for every member, its error on the hidden titles equals B0's and every hidden title stands at
percentile 0.5 exactly (the canary could not tell one hidden title from the candidates around it), and the harness
reports its attempts.

    python3 controls/leak.py [--task T2a] [--item NNN]
"""
import json
import os

import _lib
from common import DATA_ROOT


def t2a(a):
    code, line, out = _lib.run(a, 'leak', os.path.join(_lib.PREDICTORS, 'leak_canary.py'))
    if not line or 'measures' not in line:
        print(out)
        _lib.verdict(a, 'leak', False, [], {'error': 'the run did not finish'})
    m = line['measures']
    o = m['others']['vs'][_lib.B0_NAME]['mae']
    w = m['owner']['vs'][_lib.B0_NAME]['mae'] if 'owner' in m else {'value': 0.0}
    with open(os.path.join(DATA_ROOT, 'results', line['run_id'], 'result.json')) as f:
        per = json.load(f)['per_member']
    same_error = all(r['mae'] == r[f'mae:{_lib.B0_NAME}'] for r in per)
    no_order = all(r['pct_min'] == 0.5 and r['pct_max'] == 0.5 for r in per)
    nothing = o['diff'] == 0 and o['improved'] == 0 and o['worse'] == 0 and w['value'] == 0 and same_error and no_order
    reported = line['status'] == 'attempts' and line['sandbox']['attempts'] > 0
    print(f'leak canary, T2a: error against B0 {o["diff"]:+.6f} for members ({o["improved"]} better, {o["worse"]} '
          f'worse), {w["value"]:+.6f} for the owner; the same error as B0 for every one of {len(per)} members: '
          f'{same_error}; every hidden title at percentile 0.5: {no_order}; attempts reported: '
          f'{line["sandbox"]["attempts"]}; landlock {line["sandbox"]["landlock"]}, network closed '
          f'{line["sandbox"]["net_isolated"]}')
    for e in line['sandbox']['examples'][:5]:
        print('  refused:', e)
    _lib.verdict(a, 'leak', nothing and reported, [line['run_id']],
                 {'others': o, 'owner': w, 'members': len(per), 'same_error_every_member': same_error,
                  'every_hidden_title_at_0.5': no_order, 'attempts': line['sandbox']['attempts'],
                  'landlock': line['sandbox']['landlock'], 'net_isolated': line['sandbox']['net_isolated']})


if __name__ == '__main__':
    a = _lib.arguments(__doc__)
    if a.task == 'T2a':
        t2a(a)
    code, line, out = _lib.run(a, 'leak', os.path.join(_lib.PREDICTORS, 'leak_canary.py'))
    if not line or 'measures' not in line:
        print(out)
        _lib.verdict(a, 'leak', False, [], {'error': 'the run did not finish'})
    m = line['measures']
    o = m['others']['vs']['ladder/b0_median.py']['mae']
    anyone = [s['others']['vs']['ladder/b0_median.py']['mae'] for s in m['strata'].values() if 'others' in s]
    w = m['owner']['vs']['ladder/b0_median.py']['mae'] if 'owner' in m else {'diff': 0.0}
    nothing = o['diff'] == 0 and o['improved'] == 0 and o['worse'] == 0 and w['diff'] == 0 and \
        all(d['improved'] == 0 and d['worse'] == 0 for d in anyone)
    reported = line['status'] == 'attempts' and line['sandbox']['attempts'] > 0
    print(f'leak canary: error against B0 {o["diff"]:+.6f} for members ({o["improved"]} better, {o["worse"]} worse), '
          f'{w["diff"]:+.6f} for the owner; attempts reported: {line["sandbox"]["attempts"]}; '
          f'landlock {line["sandbox"]["landlock"]}, network closed {line["sandbox"]["net_isolated"]}')
    for e in line['sandbox']['examples'][:5]:
        print('  refused:', e)
    _lib.verdict(a, 'leak', nothing and reported, [line['run_id']],
                 {'others': o, 'owner': w, 'attempts': line['sandbox']['attempts'],
                  'landlock': line['sandbox']['landlock'], 'net_isolated': line['sandbox']['net_isolated']})
