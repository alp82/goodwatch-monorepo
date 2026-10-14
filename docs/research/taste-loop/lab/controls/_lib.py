"""Shared by the control scripts: start a control run through run.sh, read its ledger line, write the verdict."""
import argparse
import datetime
import os
import subprocess
import sys

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, LAB)
from common import LOOP, SEED, append_ledger, harness_sha256, read_ledger, sha256_file  # noqa: E402

LADDER = os.path.join(LAB, 'ladder')
PREDICTORS = os.path.join(LAB, 'controls', 'predictors')
B0 = os.path.join(LADDER, 'b0_median.py')
B0_NAME = 'ladder/b0_median.py'
LEDGER = os.path.join(LOOP, 'ledger.jsonl')
FLOOR = 0.05                                          # PLAN.md 2.5: the T1 effect floor


def arguments(doc):
    ap = argparse.ArgumentParser(description=doc, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--item', default='002')
    ap.add_argument('--task', default='T1', choices=['T1', 'T2a', 'T2b'])
    ap.add_argument('--split', default='sitting', choices=['sitting', 'order'], help='T2b only')
    ap.add_argument('--only', action='append', help='shuffled: run these rung files only, write no verdict')
    ap.add_argument('--reuse', action='store_true', help='shuffled: take the runs the ledger already holds')
    ap.add_argument('--seed', type=int, action='append', help='shuffled, T2a and T2b, with --only: these shuffles only')
    return ap.parse_args()


def run(a, control, predictor, refs=(B0,), extra=()):
    """One control run. Returns (exit code, the ledger line it wrote or None, what it printed)."""
    before = len(read_ledger(LEDGER))
    cmd = [os.path.join(LAB, 'run.sh'), predictor, '--task', a.task, '--tier', 'A', '--mode', 'control',
           '--control', control, '--item', a.item]
    for r in refs:
        cmd += ['--ref', r]
    if a.task == 'T2b':
        cmd += ['--split', a.split]
    done = subprocess.run(cmd + list(extra), capture_output=True, text=True)
    lines = read_ledger(LEDGER)[before:]
    lines = [x for x in lines if x.get('control') == control and 'predictor' in x and x.get('task') == a.task
             and x.get('options', {}).get('split') == (a.split if a.task == 'T2b' else None)]
    return done.returncode, (lines[-1] if lines else None), done.stdout + done.stderr


def stored(a, control, predictor, shuffle_seed=None):
    """The newest finished run of this control in the ledger that is this run exactly: the same task, item,
    harness code, predictor file and options, on all members. For a control whose runs are started one at a time
    (`--only`) and judged together afterwards (`--reuse`). None when there is none."""
    harness, sha = harness_sha256(), sha256_file(predictor)
    others, split = ('before', a.split) if a.task == 'T2b' else ('all', None)
    for x in reversed(read_ledger(LEDGER)):
        o = x.get('options', {})
        if x.get('control') == control and x.get('mode') == 'control' and x.get('task') == a.task \
                and x.get('item') == a.item and x.get('status') == 'ok' and x.get('harness_sha256') == harness \
                and x.get('predictor', {}).get('sha256') == sha and o.get('shuffle_seed') == shuffle_seed \
                and o.get('members') == 'all' and o.get('others') == others and o.get('plant') is None \
                and o.get('split') == split:
            return x
    return None


def verdict(a, control, passed, runs, detail, outcome=None):
    """Write the control's verdict line. `outcome` names a verdict other than pass or fail (the shuffled control
    of T2a and T2b can be inconclusive); exit code 0 for pass and inconclusive, 1 for fail."""
    stamp = f'{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}'
    outcome = outcome or ('pass' if passed else 'fail')
    append_ledger(LEDGER, {'mode': 'control', 'control': control, 'verdict': outcome,
                           'item': a.item, 'task': a.task, 'time': stamp, 'runs': runs, 'detail': detail,
                           **({'split': a.split} if a.task == 'T2b' else {})})
    print(f'{control} ({a.task}{", " + a.split if a.task == "T2b" else ""}): {outcome.upper()}')
    sys.exit(1 if outcome == 'fail' else 0)


def shows_skill(d):
    """PLAN.md 2.5, a win on T1: the interval of the paired difference lies below zero and the gain is at least the
    floor."""
    return d.get('diff') is not None and d.get('hi') is not None and d['hi'] < 0 and d['diff'] <= -FLOOR
