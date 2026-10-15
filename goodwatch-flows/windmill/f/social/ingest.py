# extra_requirements:
# wmill==1.817.0
# requests==2.34.2
# rapidfuzz==3.14.6
# numpy==2.5.3
# onnxruntime==1.30.0
# tokenizers==0.23.2
"""Bounded discovery/backfill; sources fail independently, all accepted matches publish."""
import json
from collections import Counter
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from f.social import bluesky, mastodon, rss, youtube, quality
from f.social.common import SOURCES, now, stamp
from f.social.deterministic import DeterministicMatcher
from f.social.settings import load
from f.social.store import Crate, Store
from f.social.rejudge import RelevanceCrate, run as rejudge

ADAPTERS = {'youtube': youtube, 'rss': rss, 'bluesky': bluesky, 'mastodon': mastodon}


def run(settings, *, source='all', days=2, pages=2, max_posts=400, window_end=None, disabled_lanes=(), vector_enabled=True):
    if source != 'all' and source not in SOURCES:
        raise ValueError('Unknown source')
    if not 1 <= days <= 30 or not 1 <= pages <= 18 or not 1 <= max_posts <= 10000:
        raise ValueError('Unbounded collection request')
    end = stamp(window_end) if window_end else now()
    start = end - timedelta(days=days)
    db = Crate(settings)
    store = Store(db)
    store.initialize()
    # LLM-free (owner, #556): no model calls, no inference cost. vector_enabled is
    # still accepted from the scheduled flow inputs but no longer used.
    matcher = DeterministicMatcher(db.select)
    results = []
    fresh_posts = []
    for name in SOURCES if source == 'all' else (source,):
        run_id, started = uuid4().hex, now().isoformat()
        counts = {'collected': 0, 'processed': 0, 'published': 0}
        status, details = 'running', {}
        record = {'source': name, 'started_at': started, 'window_start': start.isoformat(), 'window_end': end.isoformat()}
        store.run_record(run_id, **record, status=status, **counts)
        try:
            collected = ADAPTERS[name].collect(settings, start, end, pages=pages)
            fresh_posts.extend(collected['posts'])
            status = collected['status']
            details = {k: v for k, v in collected.items() if k not in ('posts', 'status')}
            counts['collected'] = len(collected['posts'])
            screened = store.save_posts(collected['posts']) or {}
            decisions = [screened[p['post_id']] for p in collected['posts'] if p['post_id'] in screened]
            details['content_quality'] = {'version': quality.VERSION,
                'pass': sum(d['status'] == 'pass' for d in decisions),
                'reject': sum(d['status'] == 'reject' for d in decisions),
                'reasons': dict(Counter(r for d in decisions for r in d['reasons']))}
            pending = store.pending(name, max_posts)
            # Only source HTTP/model/catalog reads run concurrently. Publication
            # stays sequential and the queue holds at most three eight-post batches.
            with ThreadPoolExecutor(max_workers=3) as pool:
                for wave in range(0, len(pending), 24):
                    batches = [pending[i:i + 8] for i in range(wave, min(wave + 24, len(pending)), 8)]
                    futures = [pool.submit(matcher.match, batch) for batch in batches]
                    for batch, future in zip(batches, futures):
                        matched = future.result()
                        for item in batch:
                            links = matched[item['post_id']]
                            counts['published'] += store.publish(item, links)
                            counts['processed'] += 1
                        store.refresh('social_post', 'social_title_link')
                        store.run_record(run_id, **record, status='running', **counts)
                        print(json.dumps({'source': name, **counts}), flush=True)
            details['pending_after_run'] = len(store.pending(name, 10000))
            details['matcher'] = 'deterministic'
            details['disabled_lanes_for_readers'] = list(disabled_lanes)
        except Exception as exc:
            status = 'failed'
            # No raw exception URLs/bodies: may contain provider credentials or post text.
            details['error_type'] = type(exc).__name__
            message = str(exc)
            for key in ('CRATE_PASS', 'YOUTUBE_API_KEY', 'QDRANT_API_KEY'):
                if settings.get(key):
                    message = message.replace(settings[key], '[redacted]')
            details['error'] = message[:500]
            print(json.dumps({'source': name, 'status': status, 'error_type': type(exc).__name__}), flush=True)
        store.run_record(run_id, **record, finished_at=now().isoformat(), status=status, **counts,
                         details=json.dumps(details, ensure_ascii=False), inference_cost_usd=0.0)
        result = {'run_id': run_id, 'source': name, 'status': status, **counts,
                  'inference_cost_usd': 0.0, 'details': details}
        results.append(result)
    store.refresh()
    # Judge only current quality-passing links, after matching/publication. The
    # new writer cannot mutate existing tables; metrics stay out of quality rows.
    relevance = rejudge(RelevanceCrate(settings, apply=True), apply=True,
                        hydrate=False, fresh_posts=fresh_posts)
    return {'window_start': start.isoformat(), 'window_end': end.isoformat(), 'sources': results,
            'relevance': {k: v for k, v in relevance.items() if k != 'decisions'}}


def main(source: str = 'all', days: int = 2, pages: int = 2, max_posts: int = 400,
         vector_enabled: bool = True):
    result = run(load(), source=source, days=days, pages=pages, max_posts=max_posts, vector_enabled=vector_enabled)
    failed = [row['source'] for row in result['sources'] if row['status'] == 'failed']
    if failed:
        raise RuntimeError('Social sources failed (see social_ingest_run): ' + ','.join(failed))
    return result
