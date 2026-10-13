"""Rerun a ledgered run in a fresh process and fail unless every measure matches.

    python3 verify.py <run id>

The rerun goes through run.sh (lock slot, thread, time and memory limits), builds the views again from the pack,
runs the candidate and every reference again (no stored answers are used) and compares the measures, the views
digest, the pack hash and the predictor hashes with the ledger line. It appends one line of mode `verify` to the
ledger; that line holds no measures and uses no budget. Exit code 0 only when everything matches.
"""
import argparse
import datetime
import os
import sys

from common import LAB, LOOP, append_ledger, read_ledger, sha256_file


def differences(a, b, path=''):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += differences(a.get(k), b.get(k), f'{path}/{k}')
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return [d for i, (x, y) in enumerate(zip(a, b)) for d in differences(x, y, f'{path}[{i}]')]
    return [] if a == b else [f'{path}: ledger {a!r}, rerun {b!r}']


def count(x):
    if isinstance(x, dict):
        return sum(count(v) for v in x.values())
    if isinstance(x, list):
        return sum(count(v) for v in x)
    return 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('run_id')
    ap.add_argument('--pack')
    ap.add_argument('--loop-dir', default=LOOP)
    a = ap.parse_args()
    if os.environ.get('TASTE_RUN_SH') != '1':
        os.execv(os.path.join(LAB, 'run.sh'), ['run.sh', '--verify'] + sys.argv[1:])
    import run
    from pack import Pack
    loop_dir = os.path.abspath(a.loop_dir)
    ledger_path = os.path.join(loop_dir, 'ledger.jsonl')
    lines = [x for x in read_ledger(ledger_path) if x.get('run_id') == a.run_id and 'predictor' in x]
    if len(lines) != 1:
        sys.exit(f'{len(lines)} ledger lines have run id {a.run_id}')
    old = lines[0]
    if old.get('tier') != 'A':
        sys.exit('only tier A runs are verified')
    pack = Pack(a.pack) if a.pack else Pack()
    problems = []
    if pack.manifest['files_sha256']['pack.pkl'] != old['pack_sha256']:
        problems.append('the pack is not the one the run used')
    paths = {}
    for p in [old['predictor']] + old['refs']:
        full = p['path'] if os.path.isabs(p['path']) else os.path.join(LAB, p['path'])
        paths[p['path']] = full
        if not os.path.isfile(full) or sha256_file(full) != p['sha256']:
            problems.append(f'{p["path"]} is not the file the run used')
    if problems:
        sys.exit('cannot verify: ' + '; '.join(problems))
    o = old['options']
    new = run.execute(paths[old['predictor']['path']], [paths[r['path']] for r in old['refs']], item=old['item'],
                      mode='verify', pack=pack, loop_dir=loop_dir,
                      members=None if o['members'] == 'all' else o['members'], others=o['others'],
                      shuffle_seed=o['shuffle_seed'], plant=o['plant'], use_cache=False, write_ledger=False,
                      quiet=True)
    diff = differences({'measures': old.get('measures'), 'views': old.get('views'), 'status': old.get('status')},
                       {'measures': new.get('measures'), 'views': new.get('views'), 'status': new.get('status')})
    stamp = datetime.datetime.now(datetime.timezone.utc)
    append_ledger(ledger_path, {'mode': 'verify', 'item': old['item'], 'of': a.run_id, 'run_id': new['run_id'],
                                'time': f'{stamp:%Y-%m-%dT%H:%M:%SZ}', 'match': not diff,
                                'harness_same': new['harness_sha256'] == old['harness_sha256'],
                                'seconds': new['seconds']})
    if diff:
        print(f'NOT REPRODUCED: {len(diff)} values differ')
        print('\n'.join(diff[:40]))
        sys.exit(1)
    print(f'verified {a.run_id}: {count(old.get("measures"))} measure values, the views digest and the status match '
          f'(rerun {new["run_id"]}, {new["seconds"]} s)')


if __name__ == '__main__':
    main()
