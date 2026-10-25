"""Audit every history scope, then enqueue a reviewed manifest through the daily path.

Default mode is SELECT-only, including Mongo. Never run --apply before review.
Use the deployed f/tmdb_api/list_offer_refresh consumer to publish queued titles.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))


HISTORY_SQL = """
SELECT media_tmdb_id,country_code,streaming_service_id,streaming_type,dropped_on,observed_at,
       last_seen_on,updated_at FROM (
 SELECT media_tmdb_id,country_code,streaming_service_id,streaming_type,dropped_on,observed_at,last_seen_on,updated_at,
        row_number() OVER (PARTITION BY media_tmdb_id,country_code,streaming_service_id,streaming_type
                           ORDER BY observed_at DESC) AS rn
 FROM availability_history WHERE media_type = ? AND media_tmdb_id = ANY(?)
 AND streaming_type IN ('flatrate','free','ads')
) latest WHERE rn = 1
"""


def compare_scope(media_type, country, history, offers, parents):
    """Compare the UNION of eligible types; rent/buy still belong in aggregates."""
    states = {}
    for row in history:
        key = (row['media_tmdb_id'], row['streaming_service_id'])
        state = states.setdefault(key, dict(expected=False, checked_at=0))
        state['expected'] |= row['dropped_on'] is None
        state['checked_at'] = max(state['checked_at'], row.get('updated_at') or 0,
                                  row['observed_at'], row.get('dropped_on') or 0, row.get('last_seen_on') or 0)
    eligible, any_offer = set(), set()
    for row in offers:
        key = (row['media_tmdb_id'], row['streaming_service_id'])
        any_offer.add(key)
        if row['streaming_type'] in ('flatrate', 'free', 'ads'):
            eligible.add(key)
    mismatches = []
    for (tmdb_id, service), state in sorted(states.items()):
        parent = parents.get(tmdb_id)
        token = f'{country}_{service}'
        aggregate_present = token in ((parent or {}).get('streaming_availabilities') or [])
        expected = state['expected']
        actual = (tmdb_id, service) in eligible
        reasons = []
        if expected != actual:
            reasons.append('arrival_missing' if expected else 'drop_still_present')
        if expected and (not aggregate_present or country not in ((parent or {}).get('streaming_country_codes') or [])
                         or service not in ((parent or {}).get('streaming_service_ids') or [])):
            reasons.append('aggregate_missing')
        if not expected and (tmdb_id, service) not in any_offer and aggregate_present:
            reasons.append('aggregate_still_present')
        if reasons:
            mismatches.append(dict(media_type=media_type, tmdb_id=tmdb_id, country=country,
                service_id=service, direction='arrival' if expected else 'drop', checked_at=state['checked_at'],
                child_present=actual, aggregate_present=aggregate_present, catalog_present=parent is not None,
                reasons=reasons))
    return mismatches


def scan_title_batch(connector, media_type, ids):
    # Read every country for each title once. A country-first audit rereads the
    # same large title aggregates as many as 139 times.
    history = connector.select(HISTORY_SQL, (media_type, ids))
    offers = connector.select(
        'SELECT media_tmdb_id,country_code,streaming_service_id,streaming_type FROM streaming_availability '
        'WHERE media_type = ? AND media_tmdb_id = ANY(?)', (media_type, ids))
    parents = {row['tmdb_id']: row for row in connector.select(
        f'SELECT tmdb_id,streaming_availabilities,streaming_country_codes,streaming_service_ids '
        f'FROM {media_type} WHERE tmdb_id = ANY(?)', (ids,))}
    by_country, offers_by_country = defaultdict(list), defaultdict(list)
    for row in history:
        by_country[row['country_code']].append(row)
    for row in offers:
        offers_by_country[row['country_code']].append(row)
    return [row for country, records in sorted(by_country.items())
            for row in compare_scope(media_type, country, records, offers_by_country[country], parents)]


def summarize(rows):
    groups = defaultdict(lambda: dict(arrivals=0, drops=0, titles=set()))
    for row in rows:
        group = groups[(row['country'], row['service_id'])]
        group['arrivals' if row['direction'] == 'arrival' else 'drops'] += 1
        group['titles'].add((row['media_type'], row['tmdb_id']))
    return dict(titles=len({(r['media_type'], r['tmdb_id']) for r in rows}), scopes=len(rows),
        arrivals=sum(r['direction'] == 'arrival' for r in rows), drops=sum(r['direction'] == 'drop' for r in rows),
        arrival_titles=len({(r['media_type'], r['tmdb_id']) for r in rows if r['direction'] == 'arrival'}),
        drop_titles=len({(r['media_type'], r['tmdb_id']) for r in rows if r['direction'] == 'drop'}),
        catalog_missing_titles=len({(r['media_type'], r['tmdb_id']) for r in rows if not r['catalog_present']}),
        by_country_service=[dict(country=c, service_id=s, arrivals=g['arrivals'], drops=g['drops'], titles=len(g['titles']))
                           for (c, s), g in sorted(groups.items())])


def manifest(rows):
    rows = sorted(rows, key=lambda r: (r['media_type'], r['tmdb_id'], r['country'], r['service_id']))
    return dict(version=1, generated_at=datetime.now(timezone.utc).isoformat(),
                summary=summarize(rows), rows=rows, sha256=hashlib.sha256(
                    json.dumps(rows, sort_keys=True, separators=(',', ':')).encode()).hexdigest())


def write_plan(path, plan):
    # Keep resumable checkpoints intact if the local audit is interrupted.
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(plan, indent=2) + '\n')
    temporary.replace(path)


def enqueue_manifest(db, plan, *, dry_run=True):
    from f.tmdb_api.list_offer_refresh import enqueue
    if plan.get('version') != 1 or manifest(plan['rows'])['sha256'] != plan['sha256']:
        raise ValueError('Invalid or edited manifest')
    dry_run = dry_run is not False
    if not dry_run and not plan.get('scan_complete'):
        raise ValueError('Refusing to apply an incomplete audit')
    targets = defaultdict(dict)
    for row in plan['rows']:
        targets[(row['media_type'], row['tmdb_id'])][f"{row['country']}_{row['service_id']}"] = row['checked_at']
    if not dry_run:
        for (media, tmdb_id), scopes in sorted(targets.items()):
            enqueue(db, media, tmdb_id, scopes)
    return dict(dry_run=dry_run, titles=len(targets), scopes=len(plan['rows']), sha256=plan['sha256'])


def source_eligibility(db, plan):
    """Read-only preflight for titles that need the full ingestion/identity path."""
    reasons = {}
    for media, collection in (('movie', db.tmdb_movie_details), ('show', db.tmdb_tv_details)):
        ids = sorted({row['tmdb_id'] for row in plan['rows'] if row['media_type'] == media})
        catalog_missing = {row['tmdb_id'] for row in plan['rows']
                           if row['media_type'] == media and not row['catalog_present']}
        for offset in range(0, len(ids), 1000):
            batch = ids[offset:offset + 1000]
            sources = defaultdict(list)
            for row in collection.find({'tmdb_id': {'$in': batch}}, {'tmdb_id': 1, 'tmdb_deleted': 1}):
                sources[row['tmdb_id']].append(row)
            quarantined = {row['tmdb_id'] for row in db.provider_identity_unresolved.find({
                'media': 'movie' if media == 'movie' else 'tv', 'tmdb_id': {'$in': batch},
                'status': {'$in': ['unresolved', 'resolved_alias']}}, {'tmdb_id': 1})}
            for tmdb_id in batch:
                blocked = []
                if not sources[tmdb_id] or any(row.get('tmdb_deleted') for row in sources[tmdb_id]):
                    blocked.append('active_details_missing')
                if len(sources[tmdb_id]) > 1:
                    blocked.append('duplicate_details_identity')
                if tmdb_id in catalog_missing:
                    blocked.append('catalog_title_missing')
                if tmdb_id in quarantined:
                    blocked.append('quarantined')
                if blocked:
                    reasons[f'{media}:{tmdb_id}'] = blocked
    return dict(blocked_titles=len(reasons), eligible_titles=plan['summary']['titles'] - len(reasons), reasons=reasons)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Write a local review manifest (no production writes)')
    parser.add_argument('--manifest', type=Path, help='Preview or enqueue exactly this reviewed manifest')
    parser.add_argument('--resume', action='store_true', help='Resume completed title batches in --output')
    parser.add_argument('--workers', type=int, default=1, choices=(1, 2), help='At most two concurrent read-only title batches')
    parser.add_argument('--apply', action='store_true', help='AFTER REVIEW ONLY: enqueue manifest in Mongo')
    parser.add_argument('--drain', action='store_true', help='Preview pending queue, or consume it with --apply')
    parser.add_argument('--preview-offers', action='store_true', help='With --drain: fresh read-only source/offer/history diff')
    parser.add_argument('--check-sources', action='store_true', help='Read Mongo eligibility for --manifest; never writes')
    parser.add_argument('--limit', type=int, default=1000, help='Titles per manual consumer batch (1..20000)')
    parser.add_argument('--max-requests', type=int, default=20000, help='Shared consumer HTTP budget, including retries')
    parser.add_argument('--wm-helper', type=Path, help='Local Windmill req helper; credentials remain in memory')
    args = parser.parse_args()
    if args.apply and not (args.manifest or args.drain):
        parser.error('--apply requires a reviewed --manifest or --drain')
    if args.drain and args.manifest:
        parser.error('--drain and --manifest are separate steps')
    if args.preview_offers and (not args.drain or args.apply):
        parser.error('--preview-offers requires --drain without --apply')
    if args.wm_helper:
        import importlib.util
        import wmill
        spec = importlib.util.spec_from_file_location('wm_helper', args.wm_helper)
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        def variable(name):
            status, body = helper.req('GET', '/variables/get_value/' + name)
            if status != 200:
                raise RuntimeError('Windmill variable read failed')
            return json.loads(body)
        wmill.get_variable = variable
    if args.drain:
        from f.tmdb_api.list_offer_refresh import main as consume
        result = consume(dry_run=not args.apply, limit=args.limit, max_requests=args.max_requests,
                         preview_offers=args.preview_offers)
        if args.output:
            write_plan(args.output, result)
            print(json.dumps({key: value for key, value in result.items() if key != 'plans'}, indent=2))
        else:
            print(json.dumps(result, indent=2))
        return
    if args.manifest:
        plan = json.loads(args.manifest.read_text())
        if not args.apply:
            preview = enqueue_manifest(None, plan)
            if args.check_sources:
                from f.db.mongodb import init_mongodb, close_mongodb
                from mongoengine import get_db
                init_mongodb()
                try:
                    plan['source_eligibility'] = source_eligibility(get_db(), plan)
                finally:
                    close_mongodb()
                preview['source_eligibility'] = plan['source_eligibility']
                if args.output:
                    write_plan(args.output, plan)
            print(json.dumps(preview, indent=2))
            return
        from f.db.mongodb import init_mongodb, close_mongodb
        from mongoengine import get_db
        init_mongodb()
        try:
            print(json.dumps(enqueue_manifest(get_db(), plan, dry_run=False), indent=2))
        finally:
            close_mongodb()
        return
    from f.db.cratedb import CrateConnector
    connector = CrateConnector()
    try:
        countries = [row['country_code'] for row in connector.select(
            'SELECT DISTINCT country_code FROM availability_history ORDER BY country_code')]
        previous = json.loads(args.output.read_text()) if args.resume and args.output and args.output.exists() else {}
        rows = previous.get('rows', [])
        if previous and manifest(rows)['sha256'] != previous.get('sha256'):
            raise ValueError('Invalid resume manifest')
        cursors = previous.get('title_cursors', {})
        def read_batch(batch):
            media, ids = batch
            reader = CrateConnector()
            try:
                return media, ids, scan_title_batch(reader, media, ids)
            finally:
                reader.disconnect()
        todo = []
        for media in ('movie', 'show'):
            ids = [row['media_tmdb_id'] for row in connector.select(
                'SELECT DISTINCT media_tmdb_id FROM availability_history '
                'WHERE media_type = ? AND media_tmdb_id > ? ORDER BY media_tmdb_id',
                (media, cursors.get(media, 0)))]
            todo.extend((media, ids[offset:offset + 1000]) for offset in range(0, len(ids), 1000))
        with ThreadPoolExecutor(max_workers=args.workers) as workers:
            for media, ids, found in workers.map(read_batch, todo):
                rows.extend(found)
                cursors[media] = ids[-1]
                print(json.dumps(dict(media_type=media, last_tmdb_id=ids[-1], titles=len(ids), mismatches=len(found))), flush=True)
                # Local checkpoint only; a stopped audit can still be inspected.
                if args.output:
                    write_plan(args.output, manifest(rows) | {'title_cursors': cursors})
        result = manifest(rows)
        result['countries_scanned'] = countries
        result['title_cursors'] = cursors
        result['scan_complete'] = True
        if args.output:
            write_plan(args.output, result)
        print(json.dumps(result['summary'], indent=2))
    finally:
        connector.disconnect()


if __name__ == '__main__':
    main()
