"""Conservative later-entry evidence; title spelling and keywords are irrelevant."""
from datetime import date
import math

import numpy as np

LABEL = 'a later movie in a franchise'


def release(value):
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return date.fromisoformat(value).toordinal()
        except ValueError:
            return None
    if not math.isfinite(value) or value == np.iinfo(np.int64).min:
        return None
    return value


def series(info):
    value = info.get('movie_series_id')
    return value if info.get('media_type') == 'movie' and value is not None and value >= 0 else None


def classify(catalog):
    """Return tri-state values (NaN is unknown) plus auditable evidence categories."""
    groups = {}
    for key in catalog.keys:
        info = catalog.info[int(key)]
        if series(info) is not None:
            groups.setdefault(series(info), []).append(int(key))
    values, states = [], []
    for key in catalog.keys:
        info = catalog.info[int(key)]
        group, when = series(info), release(info.get('release_date'))
        value = np.nan
        if info.get('media_type') != 'movie':
            state = 'not_movie'
        elif group is None:
            state = 'missing_membership'
        elif when is None:
            state = 'missing_date'
        else:
            others = [release(catalog.info[k].get('release_date')) for k in groups[group] if k != key]
            if any(d is not None and d < when for d in others):
                state, value = 'later', 1.0
            elif when in others:
                state = 'tied_date'
            elif any(d is None for d in others):
                state = 'incomplete_order'
            elif set(catalog.complete_series.get(group, ())) == set(groups[group]):
                state, value = 'first_confirmed', 0.0
            else:
                state = 'earliest_observed_incomplete'
        values.append(value)
        states.append(state)
    return np.asarray(values), tuple(states)
