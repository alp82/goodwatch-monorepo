"""Control: the leak canary. controls/predictors/leak_canary.py tries to read the pack, the gate file, the answer
files, other views, the harness's memory, other processes and the network. Where it finds a hidden rating it
answers with it; elsewhere it answers like B0. The control passes when its error equals B0's for every member
(it found nothing) and the harness reports its attempts in the ledger line.

    python3 controls/leak.py
"""
import os

import _lib

if __name__ == '__main__':
    a = _lib.arguments(__doc__)
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
