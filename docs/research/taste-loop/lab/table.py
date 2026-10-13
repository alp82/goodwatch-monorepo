"""The ladder table, rebuilt from the ledger alone.

    python3 table.py T1 > items/NNN-name/ladder-T1.md

For each rung and each `others` option it takes the newest finished run in mode `ladder`, on tier A, with every
member. No other mode is read: exploratory and registered runs are candidates' runs, and control, verify and gate
lines are never results. Every number is copied from a ledger line; nothing is computed here but the layout.

It refuses to build a table from rows that do not belong together: every row must carry the pack hash and the
harness hash of rung B0's row, and, within one `others` option, B0's views digest and title digest.
"""
import argparse
import os
import sys

from common import LOOP, OTHERS, read_ledger

RUNGS = [('B0', 'ladder/b0_median.py', 'Median of the member\'s ratings so far'),
         ('B1', 'ladder/b1_public.py', 'GoodWatch score plus the member\'s shrunk offset'),
         ('B2', 'ladder/b2_taste_today.py', 'Today\'s taste'),
         ('B3', 'ladder/b3_taste_standardized.py', 'Taste on standardized fingerprints'),
         ('B4', 'ladder/b4_consensus.py', 'Consensus with offset and slope per member'),
         ('B5', 'ladder/b5_pooled.py', 'Pooled predictor, personal weights on'),
         ('BP', 'ladder/bp_votes.py', 'Vote count (ranking rung)')]
PATH = {label: path for label, path, _ in RUNGS}
STRATA_ORDER = ['sitting', 'block', 'media', 'provenance', 'fingerprint', 'released', 'label']
AGAINST = [('B2', 'B1'), ('B3', 'B2'), ('B4', 'B2'), ('B5', 'B2'), ('B3', 'B1'), ('B4', 'B1'), ('B5', 'B1'), ('B5', 'B4')]
OTHERS_TEXT = {'all': 'all: everything other members wrote up to the pull',
               'before': 'before: only what other members had written before the block',
               'no-owner': 'no-owner: as "all", without the owner\'s rows'}
NOT_LIKE = 'not like for like'


class Mixed(Exception):
    """The newest ladder rows do not belong to one pack, one harness and one set of views."""


def f(x, digits=3, sign=False):
    if x is None:
        return 'n/a'
    x = round(x, digits) + 0.0                         # never "-0.000"
    return f'{x:+.{digits}f}' if sign else f'{x:.{digits}f}'


def ci(d, key='value', sign=False):
    """A number with its interval; a number alone when the ledger holds no interval for it."""
    if not d or d.get(key) is None:
        return 'n/a'
    if d.get('lo') is None:
        return f(d[key], sign=sign)
    return f'{f(d[key], sign=sign)} ({f(d["lo"], sign=sign)} to {f(d["hi"], sign=sign)})'


def interval(d, units=('clusters', 'rows')):
    """The interval alone, or n/a with the reason the harness gave (in the words of what was resampled)."""
    if not d or d.get('lo') is None:
        why = d.get('why', '') if d else ''
        return 'n/a' + (f': {why.replace("clusters", units[0]).replace("rows", units[1])}' if why else '')
    return f'{f(d["lo"], sign=True)} to {f(d["hi"], sign=True)}'


def newest(ledger, task):
    """others option -> rung label -> its newest usable line."""
    out = {o: {} for o in OTHERS}
    for line in ledger:
        o = line.get('options', {})
        if line.get('mode') != 'ladder' or line.get('status') != 'ok' or line.get('task') != task \
                or line.get('tier') != 'A' or o.get('members') != 'all' or o.get('others') not in out \
                or o.get('shuffle_seed') is not None or o.get('plant') is not None:
            continue
        for label, path, _ in RUNGS:
            if line['predictor']['path'] == path:
                out[o['others']][label] = line
    return out


def check_one_cohort(runs):
    base = runs['all'].get('B0')
    if not base:
        raise Mixed('no ladder run of B0 with others: all')
    problems = []
    for others, rows in runs.items():
        if not rows:
            continue
        b0 = rows.get('B0')
        if not b0:
            problems.append(f'others: {others} has rungs but no run of B0')
            continue
        for label, line in rows.items():
            for key, ref, where in (('pack_sha256', base, 'B0'), ('harness_sha256', base, 'B0'),
                                    ('titles_sha256', base, 'B0')):
                if line.get(key) != ref.get(key):
                    problems.append(f'{label} (others: {others}, run {line["run_id"]}): {key} differs from {where}\'s')
            for key in ('digest', 'titles_digest'):
                if line['views'].get(key) != b0['views'].get(key):
                    problems.append(f'{label} (others: {others}, run {line["run_id"]}): views {key} differs from '
                                    f'B0\'s in the same option')
    if problems:
        raise Mixed('the newest ladder rows do not belong together; run the stale rungs again:\n  '
                    + '\n  '.join(problems))
    return base


def like(line, a, b):
    """Is an error comparison of rungs a and b like for like: both self-scoring, or both calibrated?"""
    cal = set(line.get('calibrated', ()))
    return (PATH[a] in cal) == (PATH[b] in cal)


def vs(line, ref, who='others'):
    return (line or {}).get('measures', {}).get(who, {}).get('vs', {}).get(PATH[ref])


def build(ledger, task='T1'):
    runs = newest(ledger, task)
    if not any(runs.values()):
        return 'No ladder run in the ledger.\n'
    base = check_one_cohort(runs)
    main, b0 = runs['all'], PATH['B0']
    o = base['measures']['others']
    strata = base['measures'].get('strata', {})
    same, later = (strata.get(f'sitting:{k}', {}).get('others', {}).get('n_targets', 0) for k in ('same', 'later'))
    out = [f'# The {task} ladder, tier A', '',
           f'Built by `lab/table.py {task}` from the `ladder` lines of `ledger.jsonl`. Pack {base["pack"]} '
           f'(`{base["pack_sha256"][:12]}`), harness `{base["harness_sha256"][:12]}`, {base["draws"]:,} bootstrap '
           f'draws, seed {base["seed"]}. Every row below carries this pack and harness hash and, within one '
           f'`others` option, one views digest.', '',
           f'What T1 measures (PROTOCOL.md, "What T1 measures"): of the {same + later:,} targets of members other '
           f'than the owner, {same:,} ({same / max(same + later, 1):.0%}) were typed in the same sitting as the '
           f'member\'s last history rating and {later:,} in a later one. This is learning from the ratings a '
           f'member has entered so far in a sitting. It says little about titles watched later.', '',
           'Error is the average distance between the rounded prediction and the rating. A difference is the rung '
           'minus the reference, per member, then averaged: below zero the rung is better for error, above zero '
           'for pair accuracy. Pair accuracy is the share of a member\'s target pairs with different ratings, '
           'inside one block, that the rung\'s rank orders correctly (0.5 is no order). Intervals are 95%. '
           '"Smallest detectable" is the difference this data would find four times out of five.', '',
           'B2, B3 and BP give no score; the harness calibrates one from the member\'s history, and below 40 '
           'history ratings that score is B0\'s. Their error is therefore the error of rung plus calibrator. An '
           f'error comparison between such a rung and a rung that gives its own score is marked "{NOT_LIKE}": '
           'read pair accuracy there.', '']

    def scorer(label, text, line):
        return text + (' (calibrated)' if line and PATH[label] in line.get('calibrated', ()) else '')

    out += ['## Each rung against B0: members other than the owner', '',
            f'{o["n_members"]} members with {base["measures"]["min_targets"]} or more targets, '
            f'{o["n_targets"]:,} targets. Each member counts once. Others: all.', '',
            '| Rung | Scorer | Error | Error: difference to B0 | Smallest detectable | Members improved | Skill | '
            'Pair accuracy | Pair accuracy: difference to B0 | Error comparison | Run |',
            '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|']
    for label, path, text in RUNGS:
        line = main.get(label)
        v = vs(line, 'B0')
        if not line or not v:
            out.append(f'| {label} | {text} | not run | | | | | | | | |')
            continue
        m, d = line['measures']['others'], v['mae']
        out.append(f'| {label} | {scorer(label, text, line)} | {ci(m["mae"])} | {ci(d, "diff", True)} | '
                   f'{f(d.get("sde"))} | {d.get("improved")} of {d["n"]} | {f(v.get("skill"))} | '
                   f'{ci(m["pair_acc"])} | {ci(v.get("pair_acc"), "diff", True)} | '
                   f'{"like for like" if like(line, label, "B0") else NOT_LIKE} | `{line["run_id"]}` |')

    floors = [(label, main[label]) for label, _, _ in RUNGS
              if label in main and 'calibrator_floor' in main[label]['measures']]
    if floors:
        c0 = floors[0][1]['measures']['calibrator_floor']
        out += ['', '## The calibrator floor', '',
                f'What the calibrator alone does to a rank-only rung: the rung\'s own answers with the ranks permuted '
                f'within every view, calibrated the same way, averaged over {c0["permutations"]} permutations. A '
                f'scorer that knows nothing must land on B0: the floor has to lie within {c0["tolerance"]} of B0 '
                f'for members other than the owner. "Rung against its floor" is what the rung\'s order adds to its '
                f'error.', '',
                '| Rung | Others: floor error | Floor minus B0 | Within tolerance | Rung against its floor | '
                'Owner: floor minus B0 | Owner: rung against its floor |', '|---|---:|---:|---|---:|---:|---:|']
        for label, line in floors:
            c = line['measures']['calibrator_floor']
            co, cw = c['others'], c.get('owner', {})
            out.append(f'| {label} | {ci(co["mae"])} | {ci(co["vs_b0"], "diff", True)} | '
                       f'{"yes" if co["within_tolerance"] else "NO"} | {ci(co["rung_vs_floor"], "diff", True)} | '
                       f'{f(cw.get("vs_b0", {}).get("diff"), sign=True)} | '
                       f'{f(cw.get("rung_vs_floor", {}).get("diff"), sign=True)} |')

    out += ['', '## What the others had written: all, before the block, without the owner', '',
            'The same members and targets under three views of other members\' data. ' +
            '; '.join(OTHERS_TEXT[x] for x in OTHERS) + '. B0, B2, B3 and BP do not read other members\' rows.', '',
            '| Rung | ' + ' | '.join(f'{x}: error | {x}: difference to B0 | {x}: pair accuracy' for x in OTHERS) + ' |',
            '|---|' + '---:|---:|---:|' * len(OTHERS)]
    for label, path, text in RUNGS:
        cells = []
        for x in OTHERS:
            line = runs[x].get(label)
            v = vs(line, 'B0')
            if not line or not v:
                cells += ['not run', '', '']
                continue
            m = line['measures']['others']
            cells += [f(m['mae']['value']), ci(v['mae'], 'diff', True), f(m['pair_acc']['value'])]
        out.append(f'| {label} | ' + ' | '.join(cells) + ' |')

    out += ['', '## Each rung against B0: the owner alone', '',
            'One member. The numbers are plain figures. An interval over sittings is given only when the owner has '
            '10 or more sittings with targets and none of them holds more than a quarter of the targets; otherwise '
            'the column says why not. "Franchises drawn again" is a second figure, not that interval: whole movie '
            'series are resampled together and every other title alone, with sittings ignored, so it is too '
            'narrow as a statement about the owner\'s future ratings.', '',
            '| Rung | Targets | Sittings | Error | Skill | Difference to B0 | Interval over sittings | Franchises '
            'drawn again | Pair accuracy | Pair accuracy: difference to B0 | Error comparison |',
            '|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---|']
    for label, path, text in RUNGS:
        line = main.get(label)
        v = vs(line, 'B0', 'owner')
        if not line or not v:
            continue
        w = line['measures']['owner']
        out.append(f'| {label} | {w["n_targets"]} | {w["sittings"]} | {f(w["mae"]["value"])} | {f(v.get("skill"))} | '
                   f'{f(v["mae"]["diff"], sign=True)} | {interval(v["mae"], ("sittings", "targets"))} | '
                   f'{interval(v.get("mae_franchise"))} | {f(w.get("pair_acc", {}).get("value"))} | '
                   f'{f(v.get("pair_acc", {}).get("diff"), sign=True)} | '
                   f'{"like for like" if like(line, label, "B0") else NOT_LIKE} |')
    out += ['', '| Rung | ' + ' | '.join(f'{x}: error | {x}: difference to B0 | {x}: pair accuracy' for x in OTHERS)
            + ' |', '|---|' + '---:|---:|---:|' * len(OTHERS)]
    for label, path, text in RUNGS:
        cells = []
        for x in OTHERS:
            line = runs[x].get(label)
            v = vs(line, 'B0', 'owner')
            if not line or not v:
                cells += ['not run', '', '']
                continue
            w = line['measures']['owner']
            cells += [f(w['mae']['value']), f(v['mae']['diff'], sign=True), f(w.get('pair_acc', {}).get('value'))]
        out.append(f'| {label} | ' + ' | '.join(cells) + ' |')

    out += ['', '## Rung against rung', '',
            'Others: all unless the row says otherwise. For every pair the difference in error and, beside it, the '
            'difference in pair accuracy.', '',
            '| Rung | Reference | Others option | Error comparison | Others: error difference | Smallest detectable '
            '| Members improved | Others: pair accuracy difference | Owner: error difference | Owner: franchises '
            'drawn again | Owner: pair accuracy difference |', '|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|']
    for x in OTHERS:
        for label, ref in AGAINST:
            line = runs[x].get(label)
            v = vs(line, ref)
            if x != 'all' and not (line and v):
                continue
            if not line or not v:
                out.append(f'| {label} | {ref} | {x} | not run | | | | | | | |')
                continue
            d, w = v['mae'], vs(line, ref, 'owner') or {}
            out.append(f'| {label} | {ref} | {x} | {"like for like" if like(line, label, ref) else NOT_LIKE} | '
                       f'{ci(d, "diff", True)} | {f(d.get("sde"))} | {d.get("improved")} of {d["n"]} | '
                       f'{ci(v.get("pair_acc"), "diff", True)} | {f(w.get("mae", {}).get("diff"), sign=True)} | '
                       f'{interval(w.get("mae_franchise"))} | {f(w.get("pair_acc", {}).get("diff"), sign=True)} |')

    out += ['', '## Targets whose rating was edited later', '',
            f'A target keeps its current score as the label. {o.get("n_targets_edited", 0)} of the {o["n_targets"]:,} '
            f'targets of the members above carry a rating that was edited after it was first written. The primary '
            f'measure with all targets and with those left out (same members). Others: all.', '',
            '| Rung | Error, all targets | Difference to B0 | Error, never edited | Difference to B0 | Owner: error, '
            'all | Owner: error, never edited |', '|---|---:|---:|---:|---:|---:|---:|']
    for label, path, text in RUNGS:
        line = main.get(label)
        v = vs(line, 'B0')
        if not line or not v:
            continue
        m, w = line['measures']['others'], line['measures'].get('owner', {})
        out.append(f'| {label} | {f(m["mae"]["value"])} | {ci(v["mae"], "diff", True)} | '
                   f'{f(m["mae_unedited"]["value"])} | {ci(v.get("mae_unedited"), "diff", True)} | '
                   f'{f(w.get("mae", {}).get("value"))} | {f(w.get("mae_unedited", {}).get("value"))} |')

    out += ['', '## Guards: members other than the owner', '',
            'Low-rating AUC: the chance that a title rated 5 or less ranks below one rated higher, for members '
            'with 5 or more of each. Reported, never optimised: error on ratings of 5 or less, 6 to 7, 8 or more. '
            'Others: all.', '',
            '| Rung | Low-rating AUC | Members | Error, low | Error, middle | Error, high |',
            '|---|---:|---:|---:|---:|---:|']
    for label, path, text in RUNGS:
        line = main.get(label)
        if not line:
            continue
        m = line['measures']['others']
        out.append(f'| {label} | {ci(m["low_auc"])} | {m["low_auc"]["n"]} | {f(m["mae_low"]["value"])} | '
                   f'{f(m["mae_mid"]["value"])} | {f(m["mae_high"]["value"])} |')
    line = main.get('B0')
    if line and 'brier' in line['measures']['others']:
        m = line['measures']['others']
        out += ['', f'Chance of a rating of 5 or less: the member\'s own share so far has a Brier score of '
                f'{ci(m["brier_ref"])} for other members (B0 gives that share as `p_low`: {ci(m["brier"])}). No '
                'other rung of the ladder gives a chance.']
        rel = line['measures'].get('reliability', {}).get('others', {}).get('p_low')
        if rel:
            out += ['', '| Own share so far | Targets | Mean predicted | Share rated 5 or less |', '|---|---:|---:|---:|']
            out += [f'| {r["bin"]} | {r["n"]:,} | {r["predicted"]:.3f} | {r["observed"]:.3f} |' for r in rel]

    labels = [label for label, _, _ in RUNGS if label != 'B0' and vs(main.get(label), 'B0')]
    names = list(main[labels[0]]['measures']['strata']) if labels else []
    names.sort(key=lambda s: (STRATA_ORDER.index(s.split(':')[0]), int(s.split(':')[1]) if s.startswith('block')
                              else 0))
    for who, title in (('others', 'members other than the owner'), ('owner', 'the owner alone')):
        out += ['', f'## Strata, error difference to B0: {title}', '']
        if who == 'others':
            out += ['Every member with a target in the stratum counts once, whatever their number of targets. '
                    'Others: all.', '']
        else:
            out += ['Plain figures; an interval over sittings only where the rule above allows one.', '']
        out += ['| Stratum | ' + ('Members | ' if who == 'others' else '') + 'Targets | ' + ' | '.join(labels) + ' |',
                '|---|' + ('---:|' if who == 'others' else '') + '---:|' + '---:|' * len(labels)]
        for name in names:
            cells, head = [], None
            for label in labels:
                s = main[label]['measures']['strata'].get(name, {}).get(who)
                if not s:
                    cells.append('n/a')
                    continue
                head = (f'{s["n_members"]} | ' if who == 'others' else '') + f'{s["n_targets"]:,}'
                cells.append(ci(s['vs'][b0]['mae'], 'diff', True))
            if head:
                out.append(f'| {name} | {head} | ' + ' | '.join(cells) + ' |')

    out += ['', '## Runs', '', '| Rung | Others | Run | Seconds | Peak memory, MB | Predictor sha256 | Views digest |',
            '|---|---|---|---:|---:|---|---|']
    for x in OTHERS:
        for label, path, text in RUNGS:
            line = runs[x].get(label)
            if line:
                out.append(f'| {label} | {x} | `{line["run_id"]}` | {line["seconds"]} | {line["peak_mb"]} | '
                           f'`{line["predictor"]["sha256"][:16]}` | `{line["views"]["digest"][:12]}` |')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('task', choices=['T1'])
    a = ap.parse_args()
    try:
        sys.stdout.write(build(read_ledger(os.path.join(LOOP, 'ledger.jsonl')), a.task))
    except Mixed as e:
        sys.exit(f'refused: {e}')
