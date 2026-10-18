"""Deterministic signal-only fallback. Dates are capture/export dates, never shifted."""
import datetime as dt
import json
import math
import statistics

FORMULA_VERSION = 'signals-rrf-28d-v1'
SOURCES = ('tmdb_popularity', 'trakt_trending', 'justwatch_chart')
MIN_TITLES = 20


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def rank_backup(titles, observations, day):
    series = {}
    for row in observations:
        if row['source'] in SOURCES and number(row.get('value')):
            series.setdefault((row['source'], row['title_key']), {})[row['day']] = row
    combined, metadata = {}, {}
    for source in SOURCES:
        ranked = []
        for title in titles:
            key = title['title_key']
            history = series.get((source, key), {})
            current = history.get(day.isoformat())
            if not current:
                continue
            value = current['value']
            baseline = [history.get((day-dt.timedelta(days=i)).isoformat(), {}).get('value') for i in range(1, 29)]
            mean = statistics.mean(baseline) if all(v is not None for v in baseline) else None
            floor = {'tmdb_popularity': 1, 'trakt_trending': 5, 'justwatch_chart': .01}[source]
            lift = value / max(mean, floor) if mean is not None else None
            if source == 'tmdb_popularity':
                if lift is None or value < 5 or value - mean < 2.5:
                    continue
            elif source == 'trakt_trending':
                if value < 5 or (mean is not None and value - mean < 2):
                    continue
            elif value <= 0 or (lift is not None and lift <= 1):
                continue
            raw = current.get('raw') or {}
            raw = json.loads(raw) if isinstance(raw, str) else raw
            # Trend only breaks ties; no undocumented direction-dependent arithmetic.
            trend = int(raw.get('trend') == 'UP') if source == 'justwatch_chart' else 0
            ranked.append((key, lift if lift is not None else value, value, trend))
            info = metadata.setdefault(key, {'kind': 'backup', 'sources_used': [], 'source_lifts': {}})
            info['sources_used'].append(source)
            if lift is not None:
                info['source_lifts'][source] = lift
            if source == 'tmdb_popularity':
                info['tmdb_lift'] = lift
            elif source == 'trakt_trending':
                info['trakt_watchers'] = value
            else:
                info['justwatch_rank'] = current['rank']
                info['justwatch_country'] = 'US'
                if isinstance(raw.get('trend'), str):
                    info['justwatch_trend'] = raw['trend']
        ranked.sort(key=lambda r: (-r[1], -r[2], -r[3], r[0]))
        for rank, (key, *_rest) in enumerate(ranked, 1):
            combined[key] = combined.get(key, 0) + 1/(60+rank)
    rows = []
    for title in titles:
        key = title['title_key']
        if key not in combined:
            continue
        history = series.get(('tmdb_popularity', key), {})
        baseline = [history.get((day-dt.timedelta(days=i)).isoformat(), {}).get('value') for i in range(1,29)]
        rows.append(dict(title_key=key, day=day.isoformat(), score=combined[key], eligible=True,
            views=history.get(day.isoformat(), {}).get('value'),
            mean28=statistics.mean(baseline) if all(v is not None for v in baseline) else None,
            sd28=None, z=None, curve=[dict(day=(day-dt.timedelta(days=i)).isoformat(),
                views=history.get((day-dt.timedelta(days=i)).isoformat(), {}).get('value')) for i in range(13,-1,-1)],
            card=dict(title), reasons=[], signal=metadata[key]))
    rows.sort(key=lambda r: (-r['score'], r['title_key']))
    for rank, row in enumerate(rows, 1):
        row['rank'] = rank
    return rows


def snapshot(titles, observations, day, now):
    rows = rank_backup(titles, observations, day)
    if len(rows) < MIN_TITLES:
        return None
    return dict(schema_version=1, formula_version=FORMULA_VERSION, source='backup_signals',
        day=day.isoformat(), baseline_days=28, curve_days=14, history_mode='daily',
        candidate_pool_collected_at=now.isoformat(), sources_used=sorted({s for r in rows[:20] for s in r['signal']['sources_used']}),
        diagnostics={'eligible': len(rows), 'minimum_titles': MIN_TITLES}, top20=rows[:20])
