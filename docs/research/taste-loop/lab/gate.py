"""The gate: one look at tier B for an item's registered comparison. Run by the orchestrator only.

    python3 gate.py <item>

It takes the item's latest registered run from the ledger, runs the same candidate against the same primary
reference on the tier B members (their ratings are read from the gate file named in the pack's manifest; the
population they are predicted from is tier A), and compares the paired difference in error with tier A's.

It prints one of `replicated` (same sign and at least half the tier A effect) or `not replicated`, and the number
of looks used. The numbers go to <data root>/gate/results/<pack>/ and nowhere else: not to the screen, not to the
ledger, not into a brief. One look per item, 8 looks per pack; a further look is refused.
"""
import argparse
import datetime
import json
import os
import pickle
import sys

from common import LAB, LOOP, append_ledger, read_ledger, sha256_file

LOOKS = 8


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('item')
    ap.add_argument('--pack')
    ap.add_argument('--loop-dir', default=LOOP)
    a = ap.parse_args()
    if os.environ.get('TASTE_RUN_SH') != '1':
        os.execv(os.path.join(LAB, 'run.sh'), ['run.sh', '--gate'] + sys.argv[1:])
    import run
    from pack import Pack
    loop_dir = os.path.abspath(a.loop_dir)
    ledger_path = os.path.join(loop_dir, 'ledger.jsonl')
    pack = Pack(a.pack) if a.pack else Pack()
    name = os.path.basename(pack.folder)
    registered = [x for x in read_ledger(ledger_path)
                  if x.get('item') == a.item and x.get('mode') == 'registered' and x.get('status') == 'ok'
                  and x.get('tier') == 'A' and x.get('pack_sha256') == pack.manifest['files_sha256']['pack.pkl']]
    if not registered:
        sys.exit(f'refused: item {a.item} has no registered run on this pack')
    old = registered[-1]
    ref = old['primary_ref']
    effect_a = old['measures']['others']['vs'][ref]['mae']['diff']
    paths = {}
    for p in [old['predictor']] + old['refs']:
        full = p['path'] if os.path.isabs(p['path']) else os.path.join(LAB, p['path'])
        paths[p['path']] = full
        if not os.path.isfile(full) or sha256_file(full) != p['sha256']:
            sys.exit(f'refused: {p["path"]} is not the file the registered run used')

    gate_folder = os.path.expanduser(pack.manifest['gate_folder'])
    out_dir = os.path.join(os.path.dirname(gate_folder), 'results', name)
    os.makedirs(out_dir, mode=0o700, exist_ok=True)
    looks_path = os.path.join(out_dir, 'looks.jsonl')
    looks = read_ledger(looks_path)
    if any(x['item'] == a.item for x in looks):
        sys.exit(f'refused: item {a.item} has had its look')
    if len(looks) >= LOOKS:
        sys.exit(f'refused: all {LOOKS} looks of pack {name} are used')

    gate_file = os.path.join(gate_folder, 'gate.pkl')
    if sha256_file(gate_file) != pack.manifest['gate_sha256']['gate.pkl']:
        sys.exit('refused: the gate file is not the one in the manifest')
    with open(gate_file, 'rb') as f:
        own = pickle.load(f)['ratings']

    new = run.execute(paths[old['predictor']['path']], [paths[ref]], item=a.item, mode='gate', tier='B', pack=pack,
                      loop_dir=loop_dir, own=own, use_cache=False, write_ledger=False, quiet=True,
                      work=os.path.join(os.path.dirname(gate_folder), 'work'))
    if new['status'] != 'ok':
        sys.exit('the gate run did not finish; no look was used (the log is in the gate results folder)')
    effect_b = new['measures']['others']['vs'][ref]['mae']['diff']
    replicated = bool(effect_a and effect_b and (effect_a > 0) == (effect_b > 0)
                      and abs(effect_b) >= 0.5 * abs(effect_a))
    verdict = 'replicated' if replicated else 'not replicated'
    stamp = f'{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}'
    with open(os.path.join(out_dir, f'{a.item}.json'), 'w') as f:
        json.dump({'item': a.item, 'time': stamp, 'registered_run': old['run_id'], 'gate_run': new['run_id'],
                   'reference': ref, 'tier_a_effect': effect_a, 'tier_b_effect': effect_b, 'verdict': verdict,
                   'tier_b': new}, f, indent=1)
    os.chmod(os.path.join(out_dir, f'{a.item}.json'), 0o600)
    used = len(looks) + 1
    append_ledger(looks_path, {'item': a.item, 'time': stamp, 'registered_run': old['run_id'], 'verdict': verdict})
    append_ledger(ledger_path, {'mode': 'gate', 'item': a.item, 'time': stamp, 'of': old['run_id'],
                                'verdict': verdict, 'looks_used': used, 'looks_allowed': LOOKS, 'pack': name})
    print(verdict)
    print(f'looks used: {used} of {LOOKS}')


if __name__ == '__main__':
    main()
