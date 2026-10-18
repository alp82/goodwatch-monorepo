# extra_requirements:
# crate==2.3.0
# pydantic==2.13.5
# wmill==1.817.0
"""Collect and publish daily buzz; no catalog mutations and no Valkey client."""
import datetime as dt
import time

from f.buzz.backup import snapshot as backup_snapshot
from f.buzz.collect import Signals, reason_hints
from f.buzz.score import FORMULA_VERSION, rank_day
from f.buzz.store import BuzzStore


# Stable, high-traffic articles make missing-day probes independent of catalog mappings.
PUBLICATION_PROBES = ('https://en.wikipedia.org/wiki/Breaking_Bad',
                      'https://en.wikipedia.org/wiki/The_Godfather')
FINAL_ATTEMPT_UTC = (23, 30)


def wait_or_fail(stats, now, status, message):
    if (now.hour, now.minute) >= FINAL_ATTEMPT_UTC:
        raise RuntimeError(message)
    return dict(stats, status=status, message=message)


def run(store, signals, *, now=None):
    now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc)
    end = now.date() - dt.timedelta(days=1)
    start = end - dt.timedelta(days=59)
    stats = {'score_day': end.isoformat(), 'window_start': start.isoformat()}
    store.initialize()
    published = store.published_days()
    if end.isoformat() in published:
        # Also repair a crash between the immutable date write and advancing current.
        store.publish(end.isoformat(), None, now)
        return dict(stats, status='already_published')
    source = 'wikipedia_api'
    if not any(end.isoformat() in signals.pageviews(article, end, end)
               for article in PUBLICATION_PROBES):
        source = 'wikipedia_dumps'
    if source == 'wikipedia_dumps' and not signals.dumps_available(end):
        if (now.hour, now.minute) >= (9, 30):
            trending = store.read_trending(now)
            if trending is None:
                trending = signals.trending()
                store.save_trending(trending, now)
            titles = store.candidates(trending)
            payload = backup_snapshot(titles, store.read_backup_signals(titles, end), end, now)
            if payload:
                store.publish(end.isoformat(), payload, now)
                return dict(stats, status='published_backup', sources_used=payload['sources_used'])
        return wait_or_fail(stats, now, 'waiting_for_publication',
                            f'Wikimedia has not published {end.isoformat()}; current snapshot preserved')
    trending = store.read_trending(now)
    if trending is None:
        trending = signals.trending()
        store.save_trending(trending, now)
    titles = store.candidates(trending)
    if not titles:
        raise RuntimeError('Empty catalog candidate pool; current snapshot preserved')
    stats['candidates'] = len(titles)
    stats['candidate_kinds'] = {kind: sum(t['kind'] == kind for t in titles) for kind in ('movie', 'tv')}
    cached = store.read_titles()
    need_mapping = []
    for title in titles:
        old = cached.get(title['title_key'], {})
        title.update({k: old.get(k) for k in ('article', 'qid', 'mapping_status', 'mapping_checked_at')})
        checked = title.get('mapping_checked_at')
        ttl = 30 if title.get('mapping_status') == 'matched' else 7
        if not checked or (now - dt.datetime.fromisoformat(checked)).total_seconds() >= ttl * 86400:
            need_mapping.append(title)
        title['last_candidate_at'] = now.isoformat()
    mappings = signals.mappings(need_mapping)
    for title in need_mapping:
        title.update(mappings[title['title_key']], mapping_checked_at=now.isoformat())
    store.save_titles(titles)
    matched = [t for t in titles if t.get('article')]
    stats['mapped'] = len(matched)
    if not matched:
        raise RuntimeError('No enwiki mappings; current snapshot preserved')
    series = store.read_pageviews(matched, start, end)
    if source == 'wikipedia_dumps':
        values = signals.dump_pageviews([t['article'] for t in matched], end)
        if values is None:
            return wait_or_fail(stats, now, 'waiting_for_publication', 'Wikipedia hourly files disappeared; current preserved')
        for title in matched:
            observed = {end.isoformat(): values[title['article']]}
            store.save_pageviews(title, observed, now, source=source)
            series.setdefault(title['title_key'], {}).update(observed)
    for index, title in enumerate(matched):
        existing = series.setdefault(title['title_key'], {})
        missing = [start + dt.timedelta(days=i) for i in range(60)
                   if (start + dt.timedelta(days=i)).isoformat() not in existing]
        if missing:
            values = signals.pageviews(title['article'], min(missing), max(missing))
            store.save_pageviews(title, values, now)
            existing.update(values)
        if index % 25 == 0:
            print(f"Pageviews {index + 1}/{len(matched)}", flush=True)
    stats['observations_in_window'] = sum(len(v) for v in series.values())
    stats['complete_60_day_titles'] = sum(len(series[t['title_key']]) == 60 for t in matched)
    latest_rows = rank_day(matched, series, end)
    stats['scorable_latest'] = len(latest_rows)
    # A source outage must not publish an empty/reduced replacement over a healthy snapshot.
    if len(latest_rows) < 0.8 * len(matched):
        return wait_or_fail(stats, now, 'waiting_for_coverage',
                            f"Only {len(latest_rows)}/{len(matched)} titles have the latest 29 days; retry after Wikimedia completes publication")
    published = store.published_days()
    all_days = [(start + dt.timedelta(days=i), rank_day(matched, series, start + dt.timedelta(days=i)))
                for i in range(28, 60) if (start + dt.timedelta(days=i)).isoformat() not in published]
    # Never supersede a fallback with a partially recovered historical cohort.
    all_days = [(day, rows) for day, rows in all_days if len(rows) >= 0.8 * len(matched)]
    netflix = signals.netflix(store.catalog_names) if all_days else []
    featured = {r['title_key'] for _, rows in all_days for r in rows if r['rank'] and r['rank'] <= 20}
    details = {}
    for title in matched:
        if title['title_key'] in featured:
            details[title['title_key']] = signals.details(title)
            if len(details) % 20 == 0:
                print(f'Reason metadata {len(details)}/{len(featured)}', flush=True)
    for day, rows in all_days:
        available = [r for r in netflix if r['available_from'] <= day.isoformat()]
        latest_week = max((r['week'] for r in available), default=None)
        chart_day = [r for r in available if r['week'] == latest_week]
        for row in rows:
            row['reasons'] = reason_hints(row['card'], details.get(row['title_key'], {}), chart_day, day)
        store.save_scores(day.isoformat(), rows)
        top = [r for r in rows if r['rank'] and r['rank'] <= 20]
        payload = dict(schema_version=1, formula_version=FORMULA_VERSION, day=day.isoformat(),
                       source=source if day == end else 'wikipedia_api',
                       baseline_days=28, curve_days=14, candidate_pool_collected_at=now.isoformat(),
                       history_mode='current-candidate-pool backfill' if day < end else 'daily',
                       diagnostics=dict(stats, scorable=len(rows), eligible=sum(r['eligible'] for r in rows)), top20=top)
        store.publish(day.isoformat(), payload, now)
    # Repair a crash between a date snapshot and moving current, using the same payload.
    store.publish(end.isoformat(), None, now)
    store.cleanup(now)
    stats['status'] = 'published'
    stats['top20'] = [dict(rank=r['rank'], title_key=r['title_key'], title=r['card']['title'],
                           score=round(r['score'], 3), views=r['views']) for r in latest_rows if r['rank'] and r['rank'] <= 20]
    return stats


def main():
    import wmill
    from f.db.cratedb import CrateConnector

    started = time.monotonic()
    crate = CrateConnector()
    try:
        result = run(BuzzStore(crate), Signals(wmill.get_variable('u/Alp/TMDB_API_KEY')))
        result['seconds'] = round(time.monotonic() - started, 1)
        return result
    finally:
        crate.disconnect()
