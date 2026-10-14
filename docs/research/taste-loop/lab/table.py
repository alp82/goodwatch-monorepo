"""The ladder table, rebuilt from the ledger alone.

    python3 table.py T1 > items/NNN-name/ladder-T1.md
    python3 table.py T2a > items/NNN-name/ladder-T2a.md
    python3 table.py T2b > items/NNN-name/ladder-T2b.md

For each rung and each `others` option it takes the newest finished run in mode `ladder`, on tier A, with every
member. No other mode is read: exploratory and registered runs are candidates' runs, and control, verify and gate
lines are never results. Every number is copied from a ledger line; nothing is computed here but the layout.

It refuses to build a table from rows that do not belong together: every row must carry the pack hash and the
harness hash of rung B0's row, and, within one `others` option, B0's views digest and title digest. In T2a, where
B0 has no place (it gives no order), the row of B2, the reference, takes B0's part.
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
                or o.get('shuffle_seed') is not None or o.get('plant') is not None or o.get('fold_check'):
            continue
        for label, path, _ in RUNGS:
            if line['predictor']['path'] == path:
                out[o['others']][label] = line
    return out


def check_one_cohort(runs, first='B0'):
    base = runs['all'].get(first)
    if not base:
        raise Mixed(f'no ladder run of {first} with others: all')
    problems = []
    for others, rows in runs.items():
        if not rows:
            continue
        b0 = rows.get(first)
        if not b0:
            problems.append(f'others: {others} has rungs but no run of {first}')
            continue
        for label, line in rows.items():
            for key, ref, where in (('pack_sha256', base, first), ('harness_sha256', base, first),
                                    ('titles_sha256', base, first)):
                if line.get(key) != ref.get(key):
                    problems.append(f'{label} (others: {others}, run {line["run_id"]}): {key} differs from {where}\'s')
            for key in ('digest', 'titles_digest'):
                if line['views'].get(key) != b0['views'].get(key):
                    problems.append(f'{label} (others: {others}, run {line["run_id"]}): views {key} differs from '
                                    f'{first}\'s in the same option')
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
    if task == 'T2a':
        return build_t2a(ledger)
    if task == 'T2b':
        return build_t2b(ledger)
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


# ------------------------------------------------------------------ T2a

T2A_RUNGS = [r for r in RUNGS if r[0] != 'B0']         # B0 gives no order
T2A_AGAINST = ('B2', 'B1', 'BP')
T2A_SCORER = {'B1': 'GoodWatch score', 'BP': 'Vote count'}
T2A_BOTH_MIN = 50                                       # score.T2A_BOTH_MIN, as the ledger line states it
T2A_KINDS = [('matched', 'Among equally well-rated titles',
              'This removes "it is simply a well-rated title" and leaves what is personal: candidates whose GoodWatch '
              'score lies within 3 points of the title\'s.'),
             ('popular', 'Among equally popular titles',
              'Candidates whose vote count lies within a factor of 1.5 of the title\'s, either way (item 004). This '
              'removes "it is simply a popular title".'),
             ('both', 'Among titles equally well-rated and equally popular',
              'Candidates within 3 GoodWatch points and within a factor of 2 in votes at once; a title counts only '
              'with 50 or more of them.')]


def val(d, digits=3, sign=False):
    return f((d or {}).get('value'), digits, sign)


def owner_interval(d):
    """The owner's interval over sittings, or n/a with the reason the harness gave."""
    return interval(d, ('sittings', 'hidden titles'))


def build_t2a(ledger):
    runs = newest(ledger, 'T2a')
    if not any(runs.values()):
        return 'No T2a ladder run in the ledger.\n'
    base = check_one_cohort(runs, 'B2')
    main = runs['all']
    m0 = base['measures']
    o, w0 = m0['others'], m0.get('owner')
    rows = [(label, text if label not in T2A_SCORER else T2A_SCORER[label], main.get(label))
            for label, _, text in T2A_RUNGS]

    def against(line, label, ref, who='others'):
        return None if label == ref else vs(line, ref, who)

    def diff(line, label, ref, name, who='others'):
        """A paired difference to a reference with its interval; 'reference' on the reference's own row."""
        if label == ref:
            return 'reference'
        d = (against(line, label, ref, who) or {}).get(name)
        if not d:
            return 'not run'
        return ci(d, 'diff', True) if who == 'others' else f(d.get('value'), sign=True)

    out = ['# The T2a ladder, tier A: the hidden-title test', '',
           f'Built by `lab/table.py T2a` from the `ladder` lines of `ledger.jsonl`. Pack {base["pack"]} '
           f'(`{base["pack_sha256"][:12]}`), harness `{base["harness_sha256"][:12]}`, {base["draws"]:,} bootstrap '
           f'draws, seed {base["seed"]}. Every row below carries this pack hash, harness hash and views digest '
           f'(`{base["views"]["digest"][:12]}`). Other members\' rows: all.', '',
           'What T2a measures (PROTOCOL.md, section 4a). A view hides a fold of a member\'s rated titles and treats '
           'them as unwatched. The scorer ranks them together with every title the member has not rated '
           f'(about {o["candidates"]["value"]:,.0f} candidates per view), from the member\'s other ratings. Each '
           'hidden title is then placed, alone, among those unrated candidates. Percentile: the share of '
           'candidates ranked below it; 1.0 is the top of the list and 0.5 is what a scorer with no order gives. '
           '"In the first 50": fewer than 50 candidates rank above it.', '',
           f'Separation is the primary measure: the mean percentile of the titles a member rated 8 or more minus '
           f'that of the titles the member rated 5 or less. A band counts for a member with {m0["band_min"]} or '
           f'more titles in it; the separation needs both bands. "Among equally well-rated" is the same '
           f'percentile, counted only against candidates whose GoodWatch score lies within '
           f'{m0["score_window"]:g} points of the hidden title\'s.', '',
           'A difference is the rung minus the reference, per member, then averaged. Intervals are 95%, from '
           'drawing members again. "Smallest detectable" is the difference this data would find four times out of '
           'five. The test only sees titles the member chose to watch: it says where a known favourite lands, '
           'not whether the unrated titles above it are any good.', '',
           '## Members other than the owner: where the hidden titles land', '',
           f'{o["n_members"]} members, {o["n_hidden"]:,} hidden titles in {o["views"]} views: {o["n_high"]:,} rated 8 '
           f'or more, {o["n_mid"]:,} rated 6 to 7, {o["n_low"]:,} rated 5 or less. {o["n_outside"]} more rated titles '
           f'lie outside the candidate universe; they are history in every view and never hidden. Members with '
           f'{m0["band_min"]} or more titles in the band: {o["members_high"]} (8 or more), {o["members_mid"]} (6 to 7), '
           f'{o["members_low"]} (5 or less). **{o["n_primary"]} members count for the separation.** Each member '
           f'counts once.', '',
           '| Rung | Scorer | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Run |',
           '|---|---|---:|---:|---:|---:|---|']
    for label, text, line in rows:
        if not line:
            out.append(f'| {label} | {text} | not run | | | | |')
            continue
        m = line['measures']['others']
        out.append(f'| {label} | {text} | {ci(m["pct_high"])} | {ci(m["pct_mid"])} | {ci(m["pct_low"])} | '
                   f'{ci(m["separation"])} | `{line["run_id"]}` |')

    out += ['', '### Separation against B2, B1 and BP', '',
            'Above zero the rung separates better than the reference.', '',
            '| Rung | Against B2 (today\'s taste) | Smallest detectable | Members improved | Against B1 (GoodWatch '
            'score) | Against BP (vote count) |', '|---|---:|---:|---:|---:|---:|']
    for label, text, line in rows:
        if not line:
            continue
        d = (against(line, label, 'B2') or {}).get('separation') or {}
        out.append(f'| {label} | {diff(line, label, "B2", "separation")} | {f(d.get("sde")) if d else ""} | '
                   + (f'{d.get("improved")} of {d["n"]}' if d else '') +
                   f' | {diff(line, label, "B1", "separation")} | {diff(line, label, "BP", "separation")} |')

    checks = {}
    for line in ledger:                                 # the fold check of item 004: its own lines, never the above
        opt = line.get('options', {})
        if line.get('mode') == 'ladder' and line.get('status') == 'ok' and line.get('task') == 'T2a' \
                and opt.get('fold_check') and opt.get('members') == 'all' and opt.get('others') == 'all' \
                and opt.get('shuffle_seed') is None and line.get('harness_sha256') == base['harness_sha256']:
            for label, path, _ in RUNGS:
                if line['predictor']['path'] == path:
                    checks[label] = line
    if checks:
        c0 = next(iter(checks.values()))['measures']['others']
        out += ['', '### Fold check: at most 5 hidden titles in a view', '',
                f'The members other than the owner with fewer than 60 ratings ({c0["n_members"]} members, '
                f'{c0["n_primary"]} of them with both bands), folds of at most 5 titles instead of the folds above, '
                'which hide a fifth of such a member\'s titles. Beside it the main figure, over all members above. '
                'Above zero the rung separates better than B2.', '',
                '| Rung | Separation, folds of 5 | Against B2, folds of 5 | Main figure: separation against B2 |',
                '|---|---:|---:|---:|']
        for label, text, line in rows:
            c = checks.get(label)
            if not c:
                continue
            m = c['measures']['others']
            out.append(f'| {label} | {ci(m["separation"])} | {diff(c, label, "B2", "separation")} | '
                       f'{diff(line, label, "B2", "separation") if line else "not run"} |')

    out += ['', '### Share of hidden titles in the first 50 and the first 200', '',
            'For titles rated 8 or more a larger share is better; for titles rated 5 or less a smaller one.', '',
            '| Rung | Rated 8 or more: first 50 | First 200 | Rated 5 or less: first 50 | First 200 | First 50 (8 or '
            'more) against B2 | First 200 (8 or more) against B2 |', '|---|---:|---:|---:|---:|---:|---:|']
    for label, text, line in rows:
        if not line:
            continue
        m = line['measures']['others']
        out.append(f'| {label} | {ci(m["first50_high"])} | {ci(m["first200_high"])} | {ci(m["first50_low"])} | '
                   f'{ci(m["first200_low"])} | {diff(line, label, "B2", "first50_high")} | '
                   f'{diff(line, label, "B2", "first200_high")} |')

    for kind, title, note in T2A_KINDS:
        if f'separation_{kind}' not in o:
            continue
        under = f' {o["both_under_min"]:,} of the {o["n_hidden"]:,} hidden titles have fewer than ' \
                f'{T2A_BOTH_MIN} such candidates and are left out.' if kind == 'both' else ''
        out += ['', f'### {title}', '', note + under, '',
                '| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Against B2 | '
                'Smallest detectable | Against B1 | Against BP | Rated 8 or more against B2 |',
                '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
        for label, text, line in rows:
            if not line:
                continue
            m = line['measures']['others']
            d = (against(line, label, 'B2') or {}).get(f'separation_{kind}') or {}
            out.append(f'| {label} | {ci(m[f"pct_{kind}_high"])} | {ci(m[f"pct_{kind}_mid"])} | '
                       f'{ci(m[f"pct_{kind}_low"])} | {ci(m[f"separation_{kind}"])} | '
                       f'{diff(line, label, "B2", f"separation_{kind}")} | {f(d.get("sde")) if d else ""} | '
                       f'{diff(line, label, "B1", f"separation_{kind}")} | '
                       f'{diff(line, label, "BP", f"separation_{kind}")} | {diff(line, label, "B2", f"pct_{kind}_high")} |')

    out += ['', '### Guards: the first 50 candidates', '',
            f'The {m0["top"]} unrated candidates a rung ranks highest in a view, averaged over a member\'s views, '
            f'then over the {o["n_members"]} members. The members\' own rated titles are '
            f'{o["own_shows"]["value"]:.0%} shows and {o["own_animation"]["value"]:.0%} animation (production method '
            f'"Animation"). "Against own mix" is the share in the first 50 minus the member\'s own share. A '
            f'franchise is a movie series of the pack; every other title is its own.', '',
            '| Rung | Shows | Shows against own mix | Animation | Animation against own mix | Most titles from one '
            'franchise | Median vote count |', '|---|---:|---:|---:|---:|---:|---:|']
    for label, text, line in rows:
        if not line:
            continue
        m = line['measures']['others']
        out.append(f'| {label} | {f(m["top_shows"]["value"])} | {ci(m["top_shows_vs_own"], sign=True)} | '
                   f'{f(m["top_animation"]["value"])} | {ci(m["top_animation_vs_own"], sign=True)} | '
                   f'{f(m["top_franchise_max"]["value"], 1)} | {m["top_votes_median"]["value"]:,.0f} |')
    out += ['', '| Rung | Shows against B2 | Animation against B2 | Most titles from one franchise against B2 | Median '
            'vote count against B2 |', '|---|---:|---:|---:|---:|']
    for label, text, line in rows:
        if not line or label == 'B2':
            continue
        v = against(line, label, 'B2') or {}
        votes = v.get('top_votes_median') or {}
        out.append(f'| {label} | {ci(v.get("top_shows"), "diff", True)} | {ci(v.get("top_animation"), "diff", True)} | '
                   f'{ci(v.get("top_franchise_max"), "diff", True)} | '
                   + (f'{votes["diff"]:+,.0f} ({votes["lo"]:+,.0f} to {votes["hi"]:+,.0f})' if votes.get('lo') is not None
                      else 'n/a') + ' |')

    scored = [(label, line) for label, _, line in rows if line and line['measures'].get('gives_score')]
    if scored:
        out += ['', '### Error of the predicted rating on the hidden titles', '',
                'Only for rungs that give a score (T2a has no calibrator). Error as in T1: the average distance '
                'between the rounded prediction and the rating, per member, then averaged.', '',
                '| Rung | Error | Rated 5 or less | Rated 6 to 7 | Rated 8 or more | Against B1 | Owner: error | '
                'Owner: against B1 |', '|---|---:|---:|---:|---:|---:|---:|---:|']
        for label, line in scored:
            m, w = line['measures']['others'], line['measures'].get('owner', {})
            out.append(f'| {label} | {ci(m["mae"])} | {f(m["mae_low"]["value"])} | {f(m["mae_mid"]["value"])} | '
                       f'{f(m["mae_high"]["value"])} | {diff(line, label, "B1", "mae")} | {val(w.get("mae"))} | '
                       f'{diff(line, label, "B1", "mae", "owner")} |')

    if w0:
        out += ['', '## The owner alone', '',
                f'One member: {w0["n_hidden"]} hidden titles in {w0["views"]} views ({w0["n_high"]} rated 8 or more, '
                f'{w0["n_mid"]} rated 6 to 7, {w0["n_low"]} rated 5 or less; {w0["n_outside"]} more rated titles lie '
                f'outside the candidate universe), rated in {w0["sittings"]} sittings. The numbers are plain '
                f'figures. An interval over sittings is given only when there are 10 or more sittings and none '
                f'holds more than a quarter of the titles; otherwise the column says why not (the separation reads '
                f'only titles rated 8 or more or 5 or less, which lie in {w0["separation"]["clusters"]} of the '
                f'sittings). "Franchises drawn '
                f'again" is a second figure, not that interval: whole movie series are resampled together and '
                f'every other title alone ({w0["franchises"]} units), with sittings ignored.', '',
                '| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Interval over '
                'sittings | Franchises drawn again | First 50 (8 or more) | First 200 (8 or more) | First 50 (5 or '
                'less) | First 200 (5 or less) |', '|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|']
        for label, text, line in rows:
            w = (line or {}).get('measures', {}).get('owner')
            if not w:
                continue
            out.append(f'| {label} | {val(w["pct_high"])} | {val(w["pct_mid"])} | {val(w["pct_low"])} | '
                       f'{val(w["separation"])} | {owner_interval(w["separation"])} | '
                       f'{interval(w["separation_franchise"])} | {val(w["first50_high"])} | '
                       f'{val(w["first200_high"])} | {val(w["first50_low"])} | {val(w["first200_low"])} |')
        out += ['', '| Rung | Separation against B2 | Franchises drawn again | Against B1 | Franchises drawn again | '
                'Against BP | Franchises drawn again |', '|---|---:|---:|---:|---:|---:|---:|']
        for label, text, line in rows:
            if not line or 'owner' not in line['measures']:
                continue
            cells = []
            for ref in T2A_AGAINST:
                v = against(line, label, ref, 'owner')
                cells += ['reference', ''] if label == ref else ['not run', ''] if not v else \
                    [val(v['separation'], sign=True), interval(v['separation_franchise'])]
            out.append(f'| {label} | ' + ' | '.join(cells) + ' |')
        for kind, title, _ in T2A_KINDS:
            if f'separation_{kind}' not in w0:
                continue
            under = f' ({w0["both_under_min"]} hidden titles have fewer than {T2A_BOTH_MIN} such candidates and are ' \
                    f'left out)' if kind == 'both' else ''
            out += ['', f'{title}{under}:', '',
                    '| Rung | Percentile, rated 8 or more | Rated 6 to 7 | Rated 5 or less | Separation | Franchises '
                    'drawn again | Against B2 | Franchises drawn again | Against B1 | Against BP |',
                    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
            for label, text, line in rows:
                w = (line or {}).get('measures', {}).get('owner')
                if not w:
                    continue
                v = {ref: against(line, label, ref, 'owner') for ref in T2A_AGAINST}
                cell = (lambda ref: 'reference' if label == ref else 'not run' if not v[ref]
                        else val(v[ref][f'separation_{kind}'], sign=True))
                out.append(f'| {label} | {val(w[f"pct_{kind}_high"])} | {val(w[f"pct_{kind}_mid"])} | '
                           f'{val(w[f"pct_{kind}_low"])} | {val(w[f"separation_{kind}"])} | '
                           f'{interval(w[f"separation_{kind}_franchise"])} | {cell("B2")} | '
                           + (interval(v['B2'][f'separation_{kind}_franchise']) if v['B2'] else '') +
                           f' | {cell("B1")} | {cell("BP")} |')
        out += ['', f'Guards, the first {m0["top"]} candidates. The owner\'s own rated titles are '
                f'{w0["own_shows"]["value"]:.0%} shows and {w0["own_animation"]["value"]:.0%} animation.', '',
                '| Rung | Shows | Shows against own mix | Animation | Animation against own mix | Most titles from '
                'one franchise | Median vote count |', '|---|---:|---:|---:|---:|---:|---:|']
        for label, text, line in rows:
            w = (line or {}).get('measures', {}).get('owner')
            if not w:
                continue
            out.append(f'| {label} | {val(w["top_shows"])} | {val(w["top_shows_vs_own"], sign=True)} | '
                       f'{val(w["top_animation"])} | {val(w["top_animation_vs_own"], sign=True)} | '
                       f'{val(w["top_franchise_max"], 1)} | {w["top_votes_median"]["value"]:,.0f} |')

    out += ['', '## Runs', '', '| Rung | Run | References | Seconds | Peak memory, MB | Predictor sha256 |',
            '|---|---|---|---:|---:|---|']
    label_of = {path: label for label, path, _ in RUNGS}
    for label, text, line in rows:
        if line:
            refs = ', '.join(label_of.get(r['path'], r['path']) + (' (stored)' if r.get('cached') else '')
                             for r in line['refs'])
            out.append(f'| {label} | `{line["run_id"]}` | {refs} | {line["seconds"]} | {line["peak_mb"]} | '
                       f'`{line["predictor"]["sha256"][:16]}` |')
    return '\n'.join(out) + '\n'


# ------------------------------------------------------------------ T2b

T2B_PARTS = [('sitting', 'before', 'Split by sitting, other members before the cutoff (the primary T2b)'),
             ('sitting', 'all', 'Split by sitting, other members as of the pull'),
             ('order', 'before', 'Split by entry order, other members before the cutoff: learning from the adds made '
                                 'earlier in the same visit'),
             ('order', 'all', 'Split by entry order, other members as of the pull')]


def newest_t2b(ledger):
    """(split, others) -> rung label -> the newest usable T2b ladder line."""
    out = {}
    for line in ledger:
        o = line.get('options', {})
        if line.get('mode') != 'ladder' or line.get('status') != 'ok' or line.get('task') != 'T2b' \
                or line.get('tier') != 'A' or o.get('members') != 'all' or o.get('shuffle_seed') is not None:
            continue
        for label, path, _ in T2A_RUNGS:
            if line['predictor']['path'] == path:
                out.setdefault((o.get('split'), o.get('others')), {})[label] = line
    return out


def build_t2b(ledger):
    runs = newest_t2b(ledger)
    if not runs:
        return 'No T2b ladder run in the ledger.\n'
    problems, base = [], None
    for part, rows in runs.items():
        b2 = rows.get('B2')
        if not b2:
            problems.append(f'{part} has rungs but no run of B2')
            continue
        base = base or b2
        for label, line in rows.items():
            for key in ('pack_sha256', 'harness_sha256', 'titles_sha256'):
                if line.get(key) != base.get(key):
                    problems.append(f'{label} {part} (run {line["run_id"]}): {key} differs')
            if line['views'].get('digest') != b2['views'].get('digest'):
                problems.append(f'{label} {part} (run {line["run_id"]}): views digest differs from B2\'s')
    if problems:
        raise Mixed('the newest T2b ladder rows do not belong together; run the stale rungs again:\n  '
                    + '\n  '.join(problems))
    m0 = base['measures']
    out = ['# The T2b ladder, tier A: ranking later Want to See adds', '',
           f'Built by `lab/table.py T2b` from the `ladder` lines of `ledger.jsonl`. Pack {base["pack"]} '
           f'(`{base["pack_sha256"][:12]}`), harness `{base["harness_sha256"][:12]}`, {base["draws"]:,} bootstrap '
           f'draws, seed {base["seed"]}. Within each part every row carries one views digest.', '',
           'What T2b measures (PROTOCOL.md, section 4b). A member\'s later Want to See adds are the targets. The '
           'scorer sees what the member wrote before the first target and ranks every title of the candidate '
           'universe the member had not rated, added, skipped or marked Not interested by then. Each target is '
           'placed, alone, among the listed titles that are not targets. Percentile: the share of them ranked '
           'below it (1.0 is the top, 0.5 is no order); it is the primary measure, per member, paired against B2. '
           '"In the first 50": fewer than 50 titles rank above it. "Equally well-rated", "equally popular" and '
           f'"both" count only titles within {m0["score_window"]:g} GoodWatch points, within a factor of '
           f'{m0["votes_factor"]:g} in votes, and within {m0["both"][0]:g} points and a factor of {m0["both"][1]:g} '
           f'at once (a target needs {m0["both"][2]} such titles for "both").', '',
           'Read every figure with its member count: few members add titles to Want to See in more than one visit, '
           'so the parts below rest on a handful of members. A difference is the rung minus the reference, per '
           'member, then averaged; intervals are 95%, from drawing members again.']
    for split, others, title in T2B_PARTS:
        rows_of = runs.get((split, others))
        if not rows_of:
            out += ['', f'## {title}', '', 'Not run.']
            continue
        rows = [(label, T2A_SCORER.get(label, text), rows_of.get(label)) for label, _, text in T2A_RUNGS]
        o = rows_of['B2']['measures']['others']
        w0 = rows_of['B2']['measures'].get('owner')

        def diff(line, label, ref, name, who='others'):
            if label == ref:
                return 'reference'
            d = (vs(line, ref, who) or {}).get(name)
            if not d:
                return 'not run'
            return ci(d, 'diff', True) if who == 'others' else f(d.get('value'), sign=True)

        out += ['', f'## {title}', '',
                f'{o["n_members"]} members other than the owner, {o["n_targets"]} targets (of {o["n_adds"]} adds; '
                f'{o["n_outside"]} later adds outside the universe and {o["n_touched"]} already touched before the '
                f'cutoff were dropped). About {o["candidates"]["value"]:,.0f} titles in a list. {o["members_later"]} '
                f'members have {m0["later_min"]} or more titles skipped or marked Not interested after the cutoff '
                f'({o["n_later"]} such titles). Titles touched before the cutoff found in any list: '
                f'{o["touched_listed"]}; in a first 50: {o["touched_first50"]}.', '',
                '| Rung | Scorer | Percentile | Against B2 | Smallest detectable | Members improved | Against B1 | '
                'Against BP | First 50 | First 200 | Equally well-rated | Equally popular | Both |',
                '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
        for label, text, line in rows:
            if not line:
                out.append(f'| {label} | {text} | not run |' + ' |' * 10)
                continue
            m = line['measures']['others']
            d = (vs(line, 'B2') or {}).get('pct') if label != 'B2' else None
            out.append(f'| {label} | {text} | {ci(m["pct"])} | {diff(line, label, "B2", "pct")} | '
                       f'{f(d.get("sde")) if d else ""} | ' + (f'{d.get("improved")} of {d["n"]}' if d else '') +
                       f' | {diff(line, label, "B1", "pct")} | {diff(line, label, "BP", "pct")} | {ci(m["first50"])} | '
                       f'{ci(m["first200"])} | {ci(m["pct_matched"])} | {ci(m["pct_popular"])} | {ci(m["pct_both"])} |')
        out += ['', f'Equally well-rated, equally popular and both, against B2; then the guards. The members\' own rated '
                f'and added titles are {f(o["own_shows"]["value"])} shows and {f(o["own_animation"]["value"])} '
                f'animation. Later skips: the mean percentile of the titles skipped or marked Not interested after the '
                f'cutoff (lower is better). Want to See against Skip: the chance a target ranks above such a title, a '
                f'stand-in.', '',
                '| Rung | Equally well-rated against B2 | Equally popular against B2 | Both against B2 | Shows against '
                'own mix | Animation against own mix | Most from one franchise | Median vote count | Later skips | '
                'Want to See against Skip (stand-in) |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
        for label, text, line in rows:
            if not line:
                continue
            m = line['measures']['others']
            out.append(f'| {label} | {diff(line, label, "B2", "pct_matched")} | {diff(line, label, "B2", "pct_popular")} | '
                       f'{diff(line, label, "B2", "pct_both")} | {ci(m["top_shows_vs_own"], sign=True)} | '
                       f'{ci(m["top_animation_vs_own"], sign=True)} | {f(m["top_franchise_max"]["value"], 1)} | '
                       f'{m["top_votes_median"]["value"]:,.0f} | {ci(m["later_pct"])} | {ci(m["auc"])} |')
        if w0:
            out += ['', f'The owner alone: {w0["n_targets"]} targets in {w0["sittings"]} add sittings, '
                    f'{w0["n_later"]} titles skipped after the cutoff. Plain figures; an interval over add sittings '
                    f'only where there are 10 or more and none holds more than a quarter of the targets; beside it the '
                    f'figure with whole franchises drawn again ({w0["franchises"]} units).', '',
                    '| Rung | Percentile | Interval over sittings | Franchises drawn again | Against B2 | Franchises '
                    'drawn again | Against B1 | Against BP | Equally well-rated | Equally popular | Both | First 50 | '
                    'First 200 | Later skips | Want to See against Skip |',
                    '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
            for label, text, line in rows:
                w = (line or {}).get('measures', {}).get('owner')
                if not w:
                    continue
                v2 = vs(line, 'B2', 'owner') if label != 'B2' else None
                cell = (lambda ref: 'reference' if label == ref else 'not run' if not vs(line, ref, 'owner')
                        else val(vs(line, ref, 'owner')['pct'], sign=True))
                out.append(f'| {label} | {val(w["pct"])} | {interval(w["pct"], ("sittings", "targets"))} | '
                           f'{interval(w["pct_franchise"])} | {cell("B2")} | '
                           f'{interval(v2["pct_franchise"]) if v2 else ""} | {cell("B1")} | {cell("BP")} | '
                           f'{val(w["pct_matched"])} | {val(w["pct_popular"])} | {val(w["pct_both"])} | '
                           f'{val(w["first50"])} | {val(w["first200"])} | {val(w["later_pct"])} | {val(w["auc"])} |')
    out += ['', '## Runs', '', '| Rung | Split | Others | Run | References | Seconds | Peak memory, MB | Predictor sha256 |',
            '|---|---|---|---|---|---:|---:|---|']
    label_of = {path: label for label, path, _ in RUNGS}
    for split, others, _ in T2B_PARTS:
        for label, _, _ in T2A_RUNGS:
            line = runs.get((split, others), {}).get(label)
            if line:
                refs = ', '.join(label_of.get(r['path'], r['path']) + (' (stored)' if r.get('cached') else '')
                                 for r in line['refs'])
                out.append(f'| {label} | {split} | {others} | `{line["run_id"]}` | {refs} | {line["seconds"]} | '
                           f'{line["peak_mb"]} | `{line["predictor"]["sha256"][:16]}` |')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('task', choices=['T1', 'T2a', 'T2b'])
    a = ap.parse_args()
    try:
        sys.stdout.write(build(read_ledger(os.path.join(LOOP, 'ledger.jsonl')), a.task))
    except Mixed as e:
        sys.exit(f'refused: {e}')
