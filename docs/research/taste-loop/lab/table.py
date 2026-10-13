"""The ladder table, rebuilt from the ledger alone.

    python3 table.py T1 [--loop-dir <folder>] > items/NNN-name/ladder-T1.md

For each rung it takes the newest finished run in mode explore or registered, on tier A, with every member and
the default view options. Control, verify and gate lines are never read. Every number is copied from a ledger
line; nothing is computed here but the layout.
"""
import argparse
import os
import sys

from common import LOOP, read_ledger

RUNGS = [('B0', 'ladder/b0_median.py', 'Median of the member\'s ratings so far'),
         ('B1', 'ladder/b1_public.py', 'GoodWatch score plus the member\'s shrunk offset'),
         ('B2', 'ladder/b2_taste_today.py', 'Today\'s taste (score calibrated by the harness)'),
         ('B3', 'ladder/b3_taste_standardized.py', 'Taste on standardized fingerprints (calibrated)'),
         ('B4', 'ladder/b4_consensus.py', 'Consensus with offset and slope per member'),
         ('B5', 'ladder/b5_pooled.py', 'Pooled predictor, personal weights on'),
         ('BP', 'ladder/bp_votes.py', 'Vote count (calibrated; ranking rung)')]
PATH = {label: path for label, path, _ in RUNGS}
STRATA_ORDER = ['sitting', 'block', 'media', 'provenance', 'fingerprint', 'released']
AGAINST = [('B3', 'B2'), ('B4', 'B2'), ('B5', 'B2'), ('B3', 'B1'), ('B4', 'B1'), ('B5', 'B1'), ('B5', 'B4')]


def f(x, digits=3, sign=False):
    if x is None:
        return 'n/a'
    return f'{x:+.{digits}f}' if sign else f'{x:.{digits}f}'


def ci(d, key='value', sign=False):
    if not d or d.get(key) is None:
        return 'n/a'
    if d.get('lo') is None:
        return f(d[key], sign=sign)
    return f'{f(d[key], sign=sign)} ({f(d["lo"], sign=sign)} to {f(d["hi"], sign=sign)})'


def newest(ledger, task, others='all'):
    """rung label -> list of its usable lines, oldest first."""
    out = {}
    for line in ledger:
        if line.get('mode') not in ('explore', 'registered') or line.get('status') != 'ok':
            continue
        o = line.get('options', {})
        if line.get('task') != task or line.get('tier') != 'A' or o.get('members') != 'all' \
                or o.get('others') != others or o.get('shuffle_seed') is not None or o.get('plant') is not None:
            continue
        for label, path, _ in RUNGS:
            if line['predictor']['path'] == path:
                out.setdefault(label, []).append(line)
    return out


def with_ref(lines, ref):
    """The newest line of a rung that carries a comparison against `ref`."""
    for line in reversed(lines or []):
        if ref in line['measures']['others']['vs']:
            return line
    return None


def build(ledger, task='T1'):
    runs = newest(ledger, task)
    if not runs:
        return 'No ladder run in the ledger.\n'
    b0 = PATH['B0']
    any_line = next(iter(runs.values()))[-1]
    out = [f'# The {task} ladder, tier A', '',
           f'Built by `lab/table.py {task}` from `ledger.jsonl`. Pack {any_line["pack"]}, '
           f'{any_line["draws"]:,} bootstrap draws, seed {any_line["seed"]}.', '',
           'Error is the average distance between the rounded prediction and the rating. A difference is the rung '
           'minus the reference, per member, then averaged: below zero the rung is better. Intervals are 95%. '
           '"Smallest detectable" is the difference this data would find four times out of five.', '']

    first = with_ref(runs.get('B1'), b0) or any_line
    o = first['measures']['others']
    out += [f'## Each rung against B0: members other than the owner', '',
            f'{o["n_members"]} members with {first["measures"]["min_targets"]} or more targets, '
            f'{o["n_targets"]:,} targets. Each member counts once.', '',
            '| Rung | Scorer | Error | Skill | Difference to B0 | Smallest detectable | Median member | Members '
            'improved | Run |', '|---|---|---:|---:|---:|---:|---:|---:|---|']
    for label, path, text in RUNGS:
        line = with_ref(runs.get(label), b0)
        if not line:
            out.append(f'| {label} | {text} | not run | | | | | | |')
            continue
        m = line['measures']['others']
        v = m['vs'][b0]
        d = v['mae']
        out.append(f'| {label} | {text} | {ci(m["mae"])} | {f(v.get("skill"))} | {ci(d, "diff", True)} | '
                   f'{f(d.get("sde"))} | {f(d.get("median"), sign=True)} | {d.get("improved")} of {d["n"]} | '
                   f'`{line["run_id"]}` |')

    out += ['', '## Each rung against B0: the owner alone', '',
            'One member, so the interval comes from drawing the owner\'s sittings again.', '',
            '| Rung | Targets | Sittings | Error | Skill | Difference to B0 | Smallest detectable |',
            '|---|---:|---:|---:|---:|---:|---:|']
    for label, path, text in RUNGS:
        line = with_ref(runs.get(label), b0)
        if not line or 'owner' not in line['measures']:
            continue
        w = line['measures']['owner']
        v = w['vs'][b0]
        out.append(f'| {label} | {w["n_targets"]} | {w["sittings"]} | {ci(w["mae"])} | {f(v.get("skill"))} | '
                   f'{ci(v["mae"], "diff", True)} | {f(v["mae"].get("sde"))} |')

    out += ['', '## Challengers against B2 and B1', '',
            '| Rung | Reference | Others: difference | Smallest detectable | Members improved | Owner: difference | '
            'Smallest detectable |', '|---|---|---:|---:|---:|---:|---:|']
    for label, ref in AGAINST:
        line = with_ref(runs.get(label), PATH[ref])
        if not line:
            out.append(f'| {label} | {ref} | not run | | | | |')
            continue
        d = line['measures']['others']['vs'][PATH[ref]]['mae']
        w = line['measures'].get('owner', {}).get('vs', {}).get(PATH[ref], {}).get('mae', {})
        out.append(f'| {label} | {ref} | {ci(d, "diff", True)} | {f(d.get("sde"))} | {d.get("improved")} of '
                   f'{d["n"]} | {ci(w, "diff", True)} | {f(w.get("sde"))} |')

    out += ['', '## Guards: members other than the owner', '',
            'Pair accuracy: among a member\'s target pairs in one block with different ratings, the share the rank '
            'orders correctly (0.5 is no order). Low-rating AUC: the chance that a title rated 5 or less ranks below '
            'one rated higher, for members with 5 or more of each. Reported, never optimised: error on ratings of '
            '5 or less, 6 to 7, 8 or more.', '',
            '| Rung | Pair accuracy | Difference to B0 | Low-rating AUC | Members | Error, low | Error, middle | '
            'Error, high |', '|---|---:|---:|---:|---:|---:|---:|---:|']
    for label, path, text in RUNGS:
        line = with_ref(runs.get(label), b0)
        if not line:
            continue
        m = line['measures']['others']
        v = m['vs'][b0]
        out.append(f'| {label} | {ci(m["pair_acc"])} | {ci(v.get("pair_acc"), "diff", True)} | {ci(m["low_auc"])} | '
                   f'{m["low_auc"]["n"]} | {f(m["mae_low"]["value"])} | {f(m["mae_mid"]["value"])} | '
                   f'{f(m["mae_high"]["value"])} |')
    line = with_ref(runs.get('B0'), b0)
    if line and 'brier' in line['measures']['others']:
        m = line['measures']['others']
        out += ['', f'Chance of a rating of 5 or less: the member\'s own share so far has a Brier score of '
                f'{ci(m["brier_ref"])} for other members (B0 gives that share as `p_low`: {ci(m["brier"])}). No '
                'other rung of the ladder gives a chance.']
        rel = line['measures'].get('reliability', {}).get('others', {}).get('p_low')
        if rel:
            out += ['', '| Own share so far | Targets | Mean predicted | Share rated 5 or less |', '|---|---:|---:|---:|']
            out += [f'| {r["bin"]} | {r["n"]:,} | {r["predicted"]:.3f} | {r["observed"]:.3f} |' for r in rel]

    labels = [label for label, _, _ in RUNGS if label != 'B0' and with_ref(runs.get(label), b0)]
    names = list(with_ref(runs.get(labels[0]), b0)['measures']['strata']) if labels else []
    names.sort(key=lambda s: (STRATA_ORDER.index(s.split(':')[0]), int(s.split(':')[1]) if s.startswith('block')
                              else 0))
    for who, title in (('others', 'members other than the owner'), ('owner', 'the owner alone')):
        out += ['', f'## Strata, difference to B0: {title}', '']
        if who == 'others':
            out += ['Every member with a target in the stratum counts once, whatever their number of targets.', '']
        out += ['| Stratum | ' + ('Members | ' if who == 'others' else '') + 'Targets | ' + ' | '.join(labels) + ' |',
                '|---|' + ('---:|' if who == 'others' else '') + '---:|' + '---:|' * len(labels)]
        for name in names:
            cells, head = [], None
            for label in labels:
                s = with_ref(runs.get(label), b0)['measures']['strata'].get(name, {}).get(who)
                if not s:
                    cells.append('n/a')
                    continue
                head = (f'{s["n_members"]} | ' if who == 'others' else '') + f'{s["n_targets"]:,}'
                cells.append(ci(s['vs'][b0]['mae'], 'diff', True))
            if head:
                out.append(f'| {name} | {head} | ' + ' | '.join(cells) + ' |')

    no_owner = newest(ledger, task, 'no-owner')
    if no_owner:
        out += ['', '## A population fit with the owner left out', '',
                'The same views, but no predictor sees the owner\'s rows. Members other than the owner.', '',
                '| Rung | Error | Difference to B0 | Smallest detectable | Run |', '|---|---:|---:|---:|---|']
        for label, path, text in RUNGS:
            line = with_ref(no_owner.get(label), b0)
            if line:
                m = line['measures']['others']
                d = m['vs'][b0]['mae']
                out.append(f'| {label} | {ci(m["mae"])} | {ci(d, "diff", True)} | {f(d.get("sde"))} | '
                           f'`{line["run_id"]}` |')

    out += ['', '## Runs', '', '| Rung | Run | Seconds | Peak memory, MB | Predictor sha256 |', '|---|---|---:|---:|---|']
    for label, path, text in RUNGS:
        for line in (runs.get(label) or [])[-1:]:
            out.append(f'| {label} | `{line["run_id"]}` | {line["seconds"]} | {line["peak_mb"]} | '
                       f'`{line["predictor"]["sha256"][:16]}` |')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('task', choices=['T1'])
    ap.add_argument('--loop-dir', default=LOOP)
    a = ap.parse_args()
    sys.stdout.write(build(read_ledger(os.path.join(a.loop_dir, 'ledger.jsonl')), a.task))
