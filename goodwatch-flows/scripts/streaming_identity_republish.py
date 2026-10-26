"""Bounded, HTTP-free republish through the canonical streaming writer.

Preview is read-only. Apply archives and receipts run inside the existing title
publication lease. Rollback restores only streaming-owned title fields and exact
scoped snapshots, refusing source/target changes outside a recorded write intent.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from contextlib import contextmanager
from copy import deepcopy
from pathlib import Path
import sys

from bson import json_util

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from provider_identity_repair import durable, digest, encoded
from f.data_source.title_identity import canonical_title_id
from f.tmdb_web.provider_identity import provider_id_from_url, provider_name_from_url

TABLES = ('streaming_availability', 'streaming_evidence', 'availability_history')
AGGREGATES = ('streaming_country_codes', 'streaming_service_ids', 'streaming_availabilities',
              'tmdb_providers_created_at', 'tmdb_providers_updated_at')
PRIMARY_KEYS = {
    'streaming_availability': ('media_tmdb_id', 'media_type', 'country_code', 'streaming_service_id', 'streaming_type'),
    'streaming_evidence': ('media_tmdb_id', 'media_type', 'country_code'),
    'availability_history': ('media_tmdb_id', 'media_type', 'country_code', 'streaming_service_id', 'streaming_type', 'observed_at'),
}


def ordered(rows):
    return sorted(deepcopy(rows), key=encoded)


def scope(media, ids, cap):
    if media not in ('movie', 'show') or not 1 <= cap <= 100:
        raise ValueError('Expected movie/show and explicit cap between 1 and 100')
    ids = sorted(set(ids))
    if not ids or len(ids) > cap or any(type(value) is not int or value <= 0 for value in ids):
        raise ValueError('Explicit positive title IDs must fit the cap')
    if any(canonical_title_id(media, value) != value for value in ids):
        raise ValueError('Use canonical title IDs')
    return ids


def source_snapshot(db, connector, media, tmdb_id):
    prefix = 'tmdb_movie' if media == 'movie' else 'tmdb_tv'
    return dict(
        details=ordered(list(db[prefix + '_details'].find({'tmdb_id': tmdb_id}))),
        providers=ordered(list(db[prefix + '_providers'].find({'tmdb_id': tmdb_id}))),
        quarantine=ordered(list(db.provider_identity_unresolved.find(
            {'media': 'movie' if media == 'movie' else 'tv', 'tmdb_id': tmdb_id}))),
        catalog=ordered(connector.select('SELECT * FROM streaming_service WHERE media_type = ?', (media,))),
    )


def targets(db, connector, media, tmdb_id, *, refresh=False):
    result = {}
    for table in TABLES:
        if refresh:
            connector.run('REFRESH TABLE ' + table)
        result[table] = ordered(connector.select(
            f'SELECT * FROM {table} WHERE media_tmdb_id = ANY(?) AND media_type = ?', ([tmdb_id], media)))
    if refresh:
        connector.run('REFRESH TABLE ' + media)
    rows = connector.select('SELECT tmdb_id, ' + ', '.join(AGGREGATES) + f' FROM {media} WHERE tmdb_id = ?', (tmdb_id,))
    result['aggregate'] = ({field: rows[0].get(field) for field in AGGREGATES} if rows else None)
    result['history_pending'] = db.streaming_history_pending.find_one({'_id': f'{media}:{tmdb_id}'})
    return result


def catalog_by_name(source):
    catalog = defaultdict(list)
    for row in source['catalog']:
        catalog[row['name']].append(row)
    return dict(catalog)


def offer_key(row):
    return tuple(row.get(field) for field in PRIMARY_KEYS['streaming_availability'])


def differences(before, after):
    old, new = {offer_key(r): r for r in before}, {offer_key(r): r for r in after}
    return dict(removed_keys=sorted(old.keys() - new.keys()), added_keys=sorted(new.keys() - old.keys()),
                changed_keys=sorted(key for key in old.keys() & new.keys() if digest(old[key]) != digest(new[key])))


def plan_title(db, connector, media, tmdb_id, publisher):
    source = source_snapshot(db, connector, media, tmdb_id)
    if len(source['details']) != 1:
        raise ValueError('Exactly one source details document is required')
    if any(row.get('status') in ('unresolved', 'resolved_alias') for row in source['quarantine']):
        raise ValueError('Quarantined identity requires separate repair')
    current = targets(db, connector, media, tmdb_id)
    if current['aggregate'] is None or source['details'][0].get('tmdb_deleted') is True:
        raise ValueError('Republish requires an existing nondeleted published title')
    catalog = catalog_by_name(source)
    (rows, _, api), deferred = publisher.reconcile_deferring_unmapped(
        tmdb_id, media, current['streaming_availability'], source['details'][0], source['providers'], catalog)
    expected = ordered(list(rows.values()))
    inventory = []
    for country in source['providers']:
        for offer in country.get('streaming_links') or []:
            url = offer.get('stream_url')
            name = provider_name_from_url(url) or offer.get('provider_name')
            service = publisher.scoped_provider_id(name, country.get('country_code'), offer.get('stream_type'),
                                                    catalog, api, clickout_url=url)
            inventory.append(dict(country_code=country.get('country_code'), streaming_type=offer.get('stream_type'),
                                  clickout_provider_id=provider_id_from_url(url), canonical_service_id=service))
    body = dict(version=1, media=media, tmdb_id=tmdb_id, source=source, before=current,
                expected_availability=expected, inventory=ordered(inventory), deferred_countries=sorted(deferred),
                audit=differences(current['streaming_availability'], expected),
                apple_350_store_rows=sum(row.get('streaming_service_id') == 350 and row.get('streaming_type') in ('rent', 'buy')
                                         for row in current['streaming_availability']))
    return {**body, 'id': digest(body)}


def verify_plan(plan):
    if plan.get('version') != 1 or digest({key: value for key, value in plan.items() if key != 'id'}) != plan.get('id'):
        raise ValueError('Plan hash mismatch')
    scope(plan['media'], [plan['tmdb_id']], 1)


def paths(directory, plan):
    base = Path(directory) / f"{plan['media']}-{plan['tmdb_id']}-{plan['id']}"
    return base.with_suffix('.archive.json'), base.with_suffix('.receipt.json')


def read(path):
    return json_util.loads(Path(path).read_bytes())


def apply_title(db, connector, plan, directory, publisher):
    verify_plan(plan)
    media, tmdb_id = plan['media'], plan['tmdb_id']
    archive_path, receipt_path = paths(directory, plan)
    outcome = {}

    @contextmanager
    def audit(check_owned):
        check_owned()
        source = source_snapshot(db, connector, media, tmdb_id)
        if digest(source) != digest(plan['source']):
            raise RuntimeError('Source changed since plan')
        current = targets(db, connector, media, tmdb_id, refresh=True)
        receipt = read(receipt_path) if receipt_path.exists() else None
        if receipt and receipt.get('plan_id') != plan['id']:
            raise RuntimeError('Receipt does not match plan')
        if receipt and receipt.get('phase') == 'applied':
            if digest(current) != digest(receipt['after']) or digest(source) != receipt['source_hash']:
                raise RuntimeError('Applied target/source changed; preview a new plan')
            outcome.update(receipt)
            # Existing receipt is idempotent, without running the writer again.
            raise AlreadyApplied
        if receipt and receipt.get('phase') != 'applying':
            raise RuntimeError('Repair was rolled back or rollback is in progress')
        if not receipt:
            if digest(current) != digest(plan['before']):
                raise RuntimeError('Published state changed since plan')
            durable(archive_path, dict(plan=plan, source=source, before=current))
            receipt = dict(plan_id=plan['id'], phase='applying', archive_path=str(archive_path),
                           source_hash=digest(source))
            durable(receipt_path, receipt)
        else:
            archive = read(archive_path)
            if 'partial_after' in receipt and digest(current) != digest(receipt['partial_after']):
                raise RuntimeError('Target changed after interrupted apply')
            if digest(archive['plan']) != digest(plan) or receipt['source_hash'] != digest(source):
                raise RuntimeError('Interrupted apply archive/source mismatch')
        check_owned()
        try:
            yield
        finally:
            # Persist actual partial writes even on exception. Same-source resume
            # reuses the canonical history writer and its existing pending intent.
            check_owned()
            after = targets(db, connector, media, tmdb_id, refresh=True)
            receipt['partial_after'] = after
            durable(receipt_path, receipt)
        if publication.get('history_errors'):
            raise RuntimeError('History publication failed; resume through existing pending intent')
        if digest(source_snapshot(db, connector, media, tmdb_id)) != receipt['source_hash']:
            raise RuntimeError('Source changed during publication; inspect archived partial result')
        receipt.update(phase='applied', after=after,
                       audit=differences(plan['before']['streaming_availability'], after['streaming_availability']))
        durable(receipt_path, receipt)
        outcome.update(read(receipt_path))

    publication = {'status': 'success', 'titles': {}}
    counts = defaultdict(lambda: {'records_received': 0, 'rows_upserted': 0})
    prefix = 'tmdb_movie' if media == 'movie' else 'tmdb_tv'
    try:
        publisher.publish_title(db, connector, tmdb_id, media,
            publisher.Movie if media == 'movie' else publisher.Show,
            db[prefix + '_details'], db[prefix + '_providers'], catalog_by_name(plan['source']), 0,
            publisher.RefreshBudget(0), counts, publication, True, audit_context=audit)
    except AlreadyApplied:
        pass
    return outcome


class AlreadyApplied(Exception):
    pass


def restore_step(db, connector, media, tmdb_id, name, baseline):
    if name in TABLES:
        connector.run(f'DELETE FROM {name} WHERE media_tmdb_id = ? AND media_type = ?', (tmdb_id, media))
        for row in baseline[name]:
            columns = list(row)
            if any(not column.replace('_', '').isalnum() for column in columns):
                raise ValueError('Unsafe archived column')
            connector.run(f'INSERT INTO {name} (' + ', '.join('"' + col + '"' for col in columns) + ') VALUES (' +
                          ', '.join('?' for _ in columns) + ')', tuple(row[col] for col in columns))
    elif name == 'aggregate':
        row = baseline['aggregate'] or {}
        connector.run(f'UPDATE {media} SET ' + ', '.join(field + ' = ?' for field in AGGREGATES) + ' WHERE tmdb_id = ?',
                      tuple(row.get(field) for field in AGGREGATES) + (tmdb_id,))
    elif name == 'history_pending':
        identity = {'_id': f'{media}:{tmdb_id}'}
        if baseline[name] is None:
            db.streaming_history_pending.delete_one(identity)
        else:
            db.streaming_history_pending.replace_one(identity, baseline[name], upsert=True)


def allowed_interruption(current, intent):
    before, after, name = intent['before'], intent['after'], intent['step']
    if digest(current) in (digest(before), digest(after)):
        return True
    if name not in TABLES:
        return False
    # DELETE followed by bounded INSERTs can leave an exact subset of originals.
    # Every other table/aggregate/pending intent must still match this step.
    untouched = [key for key in current if key != name]
    return (all(digest(current[key]) == digest(before[key]) for key in untouched)
            and {digest(row) for row in current[name]} <= {digest(row) for row in after[name]})


def rollback_title(db, connector, plan, directory, publisher):
    verify_plan(plan)
    archive_path, receipt_path = paths(directory, plan)
    archive, receipt = read(archive_path), read(receipt_path)
    if (digest(archive['plan']) != digest(plan) or digest(archive['before']) != digest(plan['before'])
            or digest(archive['source']) != digest(plan['source']) or receipt.get('plan_id') != plan['id']):
        raise ValueError('Archive/receipt mismatch')
    media, tmdb_id = plan['media'], plan['tmdb_id']
    with publisher.publication_lease(db, media, tmdb_id) as check_owned:
        if digest(source_snapshot(db, connector, media, tmdb_id)) != receipt['source_hash']:
            raise RuntimeError('Source changed after repair; refusing rollback')
        current = targets(db, connector, media, tmdb_id, refresh=True)
        phase = receipt.get('phase')
        if phase == 'rolled_back':
            if digest(current) != digest(archive['before']):
                raise RuntimeError('Target changed after rollback')
            return receipt
        if phase == 'applied':
            if digest(current) != digest(receipt['after']):
                raise RuntimeError('Target changed after repair; refusing rollback')
            receipt.update(phase='rolling_back', rollback_done=[], rollback_current=current)
            durable(receipt_path, receipt)
        elif phase != 'rolling_back':
            raise RuntimeError('Apply has not completed; resume apply before rollback')
        intent = receipt.get('rollback_intent')
        if intent:
            if not allowed_interruption(current, intent):
                raise RuntimeError('Target changed during interrupted rollback')
        elif digest(current) != digest(receipt['rollback_current']):
            raise RuntimeError('Target changed between rollback steps')
        for name in (*TABLES, 'aggregate', 'history_pending'):
            if name in receipt['rollback_done']:
                continue
            check_owned()
            if digest(source_snapshot(db, connector, media, tmdb_id)) != receipt['source_hash']:
                raise RuntimeError('Source changed during rollback')
            current = targets(db, connector, media, tmdb_id, refresh=True)
            intent = receipt.get('rollback_intent')
            if intent and intent['step'] != name:
                raise RuntimeError('Rollback receipt step mismatch')
            if not intent:
                if digest(current) != digest(receipt['rollback_current']):
                    raise RuntimeError('Target changed between rollback steps')
                after = deepcopy(current)
                after[name] = archive['before'][name]
                intent = dict(step=name, before=current, after=after)
                receipt['rollback_intent'] = intent
                durable(receipt_path, receipt)
            elif not allowed_interruption(current, intent):
                raise RuntimeError('Target changed during rollback')
            restore_step(db, connector, media, tmdb_id, name, archive['before'])
            check_owned()
            if digest(source_snapshot(db, connector, media, tmdb_id)) != receipt['source_hash']:
                raise RuntimeError('Source changed during rollback')
            current = targets(db, connector, media, tmdb_id, refresh=True)
            if digest(current) != digest(intent['after']):
                raise RuntimeError('Rollback step readback mismatch')
            receipt['rollback_done'].append(name)
            receipt['rollback_current'] = current
            receipt.pop('rollback_intent', None)
            durable(receipt_path, receipt)
        receipt['phase'] = 'rolled_back'
        durable(receipt_path, receipt)
        return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('preview', 'apply', 'rollback'), nargs='?', default='preview')
    parser.add_argument('--media', choices=('movie', 'show'), required=True)
    parser.add_argument('--ids', required=True, help='Explicit comma-separated canonical TMDB IDs')
    parser.add_argument('--cap', type=int, required=True, help='Explicit bound, between 1 and 100 titles')
    parser.add_argument('--manifest', type=Path, required=True, help='Private lossless plan file (created by preview)')
    parser.add_argument('--backup-path', type=Path)
    args = parser.parse_args()
    ids = scope(args.media, [int(value) for value in args.ids.split(',')], args.cap)
    if args.action != 'preview' and args.backup_path is None:
        parser.error('--backup-path is required for apply/rollback')
    from f.tmdb_api.daily_list_storage import ListStorage
    from f.sync.copy import tmdb_streaming as publisher
    store = ListStorage(dry_run=True)
    try:
        if args.action == 'preview':
            if args.manifest.exists():
                raise ValueError('Refusing to overwrite an existing manifest')
            plans = [plan_title(store.db, store.connector, args.media, tmdb_id, publisher) for tmdb_id in ids]
            durable(args.manifest, dict(version=1, media=args.media, ids=ids, plans=plans))
            print(json_util.dumps([dict(tmdb_id=p['tmdb_id'], plan_id=p['id'], audit=p['audit'],
                                        apple_350_store_rows=p['apple_350_store_rows'], deferred_countries=p['deferred_countries']) for p in plans]))
        else:
            manifest = read(args.manifest)
            plans = manifest.get('plans', [])
            if (manifest.get('version') != 1 or manifest.get('media') != args.media
                    or manifest.get('ids') != ids or len(plans) != len(ids)
                    or sorted(plan.get('tmdb_id') for plan in plans) != ids
                    or any(plan.get('media') != args.media for plan in plans)):
                raise ValueError('CLI scope does not match manifest')
            for plan in plans:
                verify_plan(plan)
            action = apply_title if args.action == 'apply' else rollback_title
            for plan in manifest['plans']:
                result = action(store.db, store.connector, plan, args.backup_path, publisher)
                print(json_util.dumps(dict(tmdb_id=plan['tmdb_id'], plan_id=plan['id'], phase=result['phase'])))
    finally:
        store.close()


if __name__ == '__main__':
    main()
