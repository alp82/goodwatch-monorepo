"""Deterministic L text and structured registry of every title explicitly named."""
from dataclasses import dataclass

import numpy as np

from . import feats, lib, trust


@dataclass
class Description:
    text: str
    named_titles: tuple
    profile: object
    cross_fit: object
    diagnostics: dict

    @property
    def named_title_keys(self):
        return tuple(row['title_key'] for row in self.named_titles)


def trust_lines(table):
    lines = ['Cross-fitted historical checks (not forward calibration):']
    for row in table:
        lo, hi = row['wilson']
        lines.append(f"- {row['band'].capitalize()} third: n={row['n']}, mean rating {row['mean']:.1f}; "
                     f"rated 5 or less: {row['low_count']}/{row['n']} ({100*row['low_fraction']:.1f}%; "
                     f"Wilson 95% interval {100*lo:.1f}% to {100*hi:.1f}%).")
    return lines


def render(catalog, artifact, history_keys, ratings):
    """The caller provides eligible early history only. No member/outer labels accepted."""
    keys, y = np.asarray(history_keys, dtype=np.int64), np.asarray(ratings, dtype=float)
    if len(keys) != len(y) or len(set(keys.tolist())) != len(keys):
        raise ValueError('one rating per distinct early-history title is required')
    if not len(y) or not np.isfinite(y).all() or np.any((y < 1) | (y > 10)):
        raise ValueError('nonempty early-history ratings in 1..10 required')
    rows = catalog.rows(keys)
    keep = catalog.has_fingerprint[rows]
    lost = int((~keep).sum())
    keys, y, rows = keys[keep], y[keep], rows[keep]
    # Stable ordering makes examples and folds independent of input row order.
    order = np.argsort(keys)
    keys, y, rows = keys[order], y[order], rows[order]
    diagnostics = dict(input_history=len(keep), usable_history=len(y), fingerprint_losses=lost,
                       kinds_160_plus=bool(len(y) >= 160))
    if not len(y):
        return Description('Not enough evidence yet: no eligible history titles have fingerprints.', (), None, None, diagnostics)
    features = feats.build(catalog, artifact)
    profile = lib.fit(features, rows, y)
    checked = trust.cross_fit(features, keys, y)
    registry = {}

    def name(key, source):
        info = catalog.info[int(key)]
        title = info.get('title')
        if not title:
            return None
        if int(key) not in registry:
            registry[int(key)] = dict(title_key=int(key), title=title, aliases=list(info.get('aliases') or []), sources=[])
        if source not in registry[int(key)]['sources']:
            registry[int(key)]['sources'].append(source)
        return str(title)

    def examples(mask, worst=False):
        chosen = sorted(np.flatnonzero(mask), key=lambda i: (y[i] if worst else -y[i], int(keys[i])))[:3]
        values = []
        for i in chosen:
            title = name(keys[i], 'early example')
            if title is not None:
                values.append(f'{title} ({y[i]:g})')
        return ', '.join(values)

    lines = [f'Based on {len(y)} eligible early ratings. Your usual rating is {profile.usual:.1f}.']
    if profile.fallback:
        lines.append('Usual rating uses the history-only median fallback (fewer than 40 ratings).')
    for family in ('quality', 'kinds', 'facts', 'themes'):
        statements = [s for s in profile.statements if s.family == family]
        if not statements:
            lines.append(f'{family.capitalize()}: not enough evidence yet for a supported effect.')
        for statement in statements:
            effect, lo, hi = statement.effect()
            if family == 'kinds':
                label = artifact['kind_names'][statement.key]
                pool_examples = [name(k, 'pool kind exemplar') for k in artifact['exemplars'][statement.key]]
                labels = [v for v in pool_examples if v is not None]
                if labels:
                    label += ' (pool examples: ' + ', '.join(labels) + ')'
            elif family == 'themes':
                terms = artifact['theme_names'][statement.key]
                label = 'more ' + ', '.join(terms['hi']) + '; less ' + ', '.join(terms['lo'])
            else:
                label = statement.key
            units = ' per 10 public-score points' if family == 'quality' else ''
            lines.append(f'- {label}: {effect:+.2f} rating points{units}, after preceding statements '
                         f'(90% effect interval {lo:+.2f} to {hi:+.2f}; '
                         f'{statement.n_high} high/with, {statement.n_low} low/without).')
            high = statement.high[rows]
            low = statement.low[rows]
            first, second = examples(high, effect < 0), examples(low, effect > 0)
            if first:
                lines.append('  Early high/with examples: ' + first + '.')
            if second:
                lines.append('  Early low/without examples: ' + second + '.')
    if not any(s.key == 'audiences over critics' for s in profile.statements):
        lines.append('Audience–critic lean: not enough evidence yet for a supported effect.')
    if checked.table is not None:
        lines.extend(trust_lines(checked.table))
    else:
        lines.append('Historical trust table suppressed: ' + checked.suppressed + '.')
    if checked.fallback_folds:
        lines.append(f'History-only median fallback required in {len(checked.fallback_folds)} of five folds; no differentiated trust table.')
    diagnostics.update(franchise_states={state: features.franchise_states.count(state) for state in sorted(set(features.franchise_states))},
                       fallback_folds=len(checked.fallback_folds), trust_suppressed=checked.suppressed)
    return Description('\n'.join(lines), tuple(registry[k] for k in sorted(registry)), profile, checked, diagnostics)
