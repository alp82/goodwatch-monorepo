"""Equal-member scoring, using the existing lab bootstrap for all paired columns.

Pooled-triple exact binomial p is a descriptive independence approximation only:
triples share members and distractors. It never supplies an extra population vote
or replaces the member bootstrap. S alone is the primary; no format search/Holm.
"""
import math
import statistics
from collections import Counter

from scipy.stats import binom
from stats import mean_interval, paired
from .cases import LABELS, SEED, controls_for, order

DRAWS = 10000


def power(n):
    """Conservative one-triple/member planning; extra triples are not extra members."""
    k = next((k for k in range(n + 1) if n and k / n >= 1 / 3 + .1 and 2 * binom.sf(k - 1, n, 1 / 3) < .05), None)
    return {'n': n, 'null_sde': 2.80 * math.sqrt(2 / (9 * n)) if n else None,
            'nominal_correct_needed': k, 'power_at_floor': float(binom.sf(k - 1, n, 1 / 3 + .1)) if k else None,
            'assumption': 'independent members, one Bernoulli trial each; optimistic with shared distractors'}


def permutation_answers(cases):
    """Independent answer-key permutations; stored answers are never called again."""
    return {c['id']: sorted(LABELS, key=lambda label: order('answer_permutation', c['id'], label))[
        LABELS.index(c['answer'])] for c in cases}


def _summary(values, correct, count):
    excess = paired(values, [1 / 3] * len(values), DRAWS, SEED, lower_is_better=False)
    excess['tied'] = excess['n'] - excess.get('improved', 0) - excess.get('worse', 0)
    return {'share': mean_interval(values, DRAWS, SEED), 'excess': excess,
            'pooled_correct': correct, 'triples': count,
            'binomial_p_pooled_diagnostic': min(1., float(2 * binom.sf(correct - 1, count, 1 / 3)))
            if count and correct / count > 1 / 3 else 1.}


def _screen(summary):
    value = summary['share']['value']
    lower = summary['excess'].get('lo')
    return value is not None and value >= 1 / 3 + .1 - 1e-6 and lower is not None and lower > 0


def _analysis(cases, records):
    """All columns share sorted members and bootstrap draws, including in subsets."""
    members = sorted({c['member'] for c in cases})
    answers = permutation_answers(cases)
    summaries = {}
    for reader in ('haiku', 'astra'):
        columns, summaries[reader] = {}, {}
        for control in controls_for(cases) + ('permuted',):
            per_member = {m: [] for m in members}
            failures = Counter()
            correct = 0
            for c in cases:
                record = records[(reader, 's' if control == 'permuted' else control, c['id'])]
                result = record['result']
                failures[result['status']] += 1
                answer = answers[c['id']] if control == 'permuted' else c['answer']
                ok = int(result['status'] == 'ok' and result['choice'] == answer)
                per_member[c['member']].append(ok)
                correct += ok
            values = [statistics.mean(per_member[m]) for m in members]
            columns[control] = values
            summaries[reader][control] = {**_summary(values, correct, len(cases)), 'responses': dict(failures)}
        difference = paired(columns['s'], columns['numbers'], DRAWS, SEED, lower_is_better=False)
        difference['tied'] = difference['n'] - difference.get('improved', 0) - difference.get('worse', 0)
        summaries[reader]['s_minus_numbers'] = difference
        if 'noun' in columns:
            # What the full description adds beyond its genre nouns (item 016, descriptive).
            noun = paired(columns['s'], columns['noun'], DRAWS, SEED, lower_is_better=False)
            noun['tied'] = noun['n'] - noun.get('improved', 0) - noun.get('worse', 0)
            summaries[reader]['s_minus_noun'] = noun
        summaries[reader]['pass'] = bool(_screen(summaries[reader]['s']) and difference.get('lo') is not None and
                                         difference['lo'] > 0 and not _screen(summaries[reader]['none']) and
                                         not _screen(summaries[reader]['permuted']))
    return {'members': len(members), 'triples': len(cases), 'readers': summaries}


VOID_STATUSES = ('tool_use', 'transport')
VOID_CAP = .10


def _clear(summary):
    """Clearly above chance: the 95% interval for share correct lies above 1/3."""
    lower = summary['share'].get('lo')
    return lower is not None and lower > 1 / 3


def astra_share_rule(primary):
    """Owner's rule for #674 (October 16, 2026): Astra's share correct clearly above chance; Haiku descriptive.
    Validity guard: if any Astra control (numbers only, no description, permuted key) is clearly above chance, a
    shortcut exists and the run is invalid rather than a pass."""
    astra = primary['readers']['astra']
    shortcut = [c for c in ('numbers', 'none', 'permuted') if _clear(astra[c])]
    return {'rule': 'astra_share', 'astra_clear': _clear(astra['s']), 'shortcut_controls': shortcut,
            'pass': bool(primary['members'] and _clear(astra['s']) and not shortcut)}


def score(cases, records, rule='both_readers'):
    """Void a triple across paired columns; >10% void triples per reader is incomplete.

    Malformed/abstaining completed answers stay incorrect. Missing records and
    integrity failures are never treated as permitted voids. No new reader calls.
    """
    expected = {(reader, control, c['id']) for reader in ('haiku', 'astra')
                for control in controls_for(cases) for c in cases}
    if set(records) != expected:
        raise ValueError('incomplete suite or extra responses')
    voids, excluded = {}, set()
    for reader in ('haiku', 'astra'):
        bad = set()
        statuses = Counter()
        for c in cases:
            for control in controls_for(cases):
                status = records[(reader, control, c['id'])]['result']['status']
                if status not in ('ok', 'malformed', *VOID_STATUSES):
                    raise ValueError('unknown response status')
                statuses[status] += 1
                if status in VOID_STATUSES:
                    bad.add(c['id'])
        share = len(bad) / len(cases) if cases else 0
        voids[reader] = {'cases': len(bad), 'share': share, 'responses': dict(statuses),
                         'incomplete': share > VOID_CAP}
        excluded.update(bad)
    # Use the union so reader and control contrasts retain identical cases and
    # members. A member leaves only when none of their triples survives.
    kept = [c for c in cases if c['id'] not in excluded]
    primary = _analysis(kept, records)
    unedited = [c for c in kept if c.get('edited_labels', 0) == 0]
    strata = {
        'early_size': {
            'under_40': [c for c in kept if c.get('early_size', 0) < 40],
            '40_to_79': [c for c in kept if 40 <= c.get('early_size', 0) < 80],
            '80_to_159': [c for c in kept if 80 <= c.get('early_size', 0) < 160],
            '160_plus': [c for c in kept if c.get('early_size', 0) >= 160]},
        'show_share': {
            'movies_only': [c for c in kept if c.get('show_share', 0) == 0],
            'under_half': [c for c in kept if 0 < c.get('show_share', 0) < .5],
            'at_least_half': [c for c in kept if c.get('show_share', 0) >= .5]}}
    invalid = any(v['incomplete'] for v in voids.values())
    return {**primary, 'invalid': invalid, 'incomplete': invalid,
            'frozen_members': len({c['member'] for c in cases}), 'frozen_triples': len(cases),
            'voids': voids, 'excluded_void_triples': len(excluded), 'void_cap': VOID_CAP,
            'sensitivity_unedited': _analysis(unedited, records),
            'strata': {name: {label: _analysis(subset, records) for label, subset in groups.items()}
                       for name, groups in strata.items()},
            **({'rule': 'both_readers',
                'pass': bool(primary['members'] and not invalid and all(v['pass'] for v in primary['readers'].values()))}
               if rule == 'both_readers' else
               {**astra_share_rule(primary), 'pass': bool(not invalid and astra_share_rule(primary)['pass'])}),
            'seed': SEED, 'draws': DRAWS,
            'binomial_note': 'pooled-triple diagnostic assumes independent trials; decision uses equal-member bootstrap',
            'scope': 'unreplicated model screen; no product authorization'}


def markdown(aggregate):
    """A report table built only from aggregates; synthetic readers are labelled by caller."""
    def number(value):
        return 'n/a' if value is None else f'{100 * value:.1f}%'
    lines = [f"T5 preparation aggregate: {aggregate['members']} members, {aggregate['triples']} triples.", '',
             '| Reader | Input | Correct | 95% interval | Excess over 1/3 | SDE |',
             '|---|---|---:|---|---:|---:|']
    for reader in ('haiku', 'astra'):
        data = aggregate['readers'][reader]
        for control in [c for c in ('s', 'noun', 'numbers', 'none', 'permuted') if c in data]:
            row = data[control]
            share, excess = row['share'], row['excess']
            lines.append(f"| {reader} | {control} | {number(share['value'])} | "
                         f"{number(share['lo'])} to {number(share['hi'])} | {number(excess['diff'])} | {number(excess.get('sde'))} |")
        if 's_minus_noun' in data:
            n = data['s_minus_noun']
            lines += ['', f"{reader} S minus nouns only: {number(n['diff'])}, 95% interval {number(n['lo'])} to {number(n['hi'])}."]
        d = data['s_minus_numbers']
        lines += ['', f"{reader} S minus numbers: {number(d['diff'])}, 95% interval "
                  f"{number(d['lo'])} to {number(d['hi'])}; SDE {number(d.get('sde'))}.", '']
    lines += ['', '| Descriptive subset | Reader | Members | Triples | S correct (95% interval) | S minus numbers (95% interval) |',
              '|---|---|---:|---:|---|---|']
    subsets = {'unedited lists': aggregate['sensitivity_unedited']}
    subsets.update({f'{name}: {label}': aggregate['strata'][name][label]
                    for name in sorted(aggregate['strata']) for label in sorted(aggregate['strata'][name])})
    for name, summary in subsets.items():
        for reader in ('haiku', 'astra'):
            data = summary['readers'][reader]
            share, diff = data['s']['share'], data['s_minus_numbers']
            lines.append(f"| {name} | {reader} | {summary['members']} | {summary['triples']} | "
                         f"{number(share['value'])} ({number(share['lo'])} to {number(share['hi'])}) | "
                         f"{number(diff['diff'])} ({number(diff['lo'])} to {number(diff['hi'])}) |")
    lines += ['', 'Subsets are descriptive and do not change the decision. Unedited excludes any triple with an edited rating in any list.',
              f"Void triples excluded across paired columns: {aggregate['excluded_void_triples']} of {aggregate['frozen_triples']}."]
    for reader in ('haiku', 'astra'):
        void = aggregate['voids'][reader]
        lines.append(f"{reader}: {void['cases']} void triples ({number(void['share'])}); incomplete: {void['incomplete']}.")
    if aggregate.get('rule') == 'astra_share':
        lines += ["Rule: GPT-6 Astra's share correct must have a 95% interval above 1/3; Haiku is descriptive. "
                  f"Astra clearly above chance: {aggregate['astra_clear']}. "
                  f"Astra controls clearly above chance (shortcut): {', '.join(aggregate['shortcut_controls']) or 'none'}."]
    lines += [f"Screen passes: {aggregate['pass']}. Invalid/incomplete: {aggregate['invalid']}.",
              aggregate['binomial_note'] + '.', 'A null is absence of evidence at the reported SDE.',
              aggregate['scope'] + '.', '']
    return '\n'.join(lines)
