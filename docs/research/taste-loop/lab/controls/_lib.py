"""Shared by the control scripts: start a control run through run.sh, read its ledger line, write the verdict."""
import argparse
import datetime
import os
import subprocess
import sys

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, LAB)
from common import LOOP, SEED, append_ledger, read_ledger  # noqa: E402

LADDER = os.path.join(LAB, 'ladder')
PREDICTORS = os.path.join(LAB, 'controls', 'predictors')
B0 = os.path.join(LADDER, 'b0_median.py')
B0_NAME = 'ladder/b0_median.py'
LEDGER = os.path.join(LOOP, 'ledger.jsonl')
FLOOR = 0.05                                          # PLAN.md 2.5: the T1 effect floor


def arguments(doc):
    ap = argparse.ArgumentParser(description=doc, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--item', default='002')
    return ap.parse_args()


def run(a, control, predictor, refs=(B0,), extra=()):
    """One control run. Returns (exit code, the ledger line it wrote or None, what it printed)."""
    before = len(read_ledger(LEDGER))
    cmd = [os.path.join(LAB, 'run.sh'), predictor, '--task', 'T1', '--tier', 'A', '--mode', 'control',
           '--control', control, '--item', a.item]
    for r in refs:
        cmd += ['--ref', r]
    done = subprocess.run(cmd + list(extra), capture_output=True, text=True)
    lines = read_ledger(LEDGER)[before:]
    lines = [x for x in lines if x.get('control') == control and 'predictor' in x]
    return done.returncode, (lines[-1] if lines else None), done.stdout + done.stderr


def verdict(a, control, passed, runs, detail):
    stamp = f'{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}'
    append_ledger(LEDGER, {'mode': 'control', 'control': control, 'verdict': 'pass' if passed else 'fail',
                           'item': a.item, 'time': stamp, 'runs': runs, 'detail': detail})
    print(f'{control}: {"PASS" if passed else "FAIL"}')
    sys.exit(0 if passed else 1)


def shows_skill(d):
    """PLAN.md 2.5, a win on T1: the interval of the paired difference lies below zero and the gain is at least the
    floor."""
    return d.get('diff') is not None and d.get('hi') is not None and d['hi'] < 0 and d['diff'] <= -FLOOR
