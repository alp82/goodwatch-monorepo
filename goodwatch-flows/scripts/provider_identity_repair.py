"""Offline operator tool. Requires replica-set MongoDB and exclusive maintenance.

All source originals and published rows are archived before any source mutation.
Run --help for CLI; rollout adapters can call these functions with live clients.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timedelta
from hashlib import sha256
import os
from pathlib import Path
import sys
from uuid import uuid4

from bson import json_util
from pymongo import MongoClient, DeleteMany, ReplaceOne
from pymongo.errors import DuplicateKeyError
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.tmdb_web.country_state import country_from_url, identity_map, normalization_update, ensure_indexes

MEDIA = ('movie', 'tv')
FREEZE = {'$expr': {'$eq': [1, 0]}}
VALIDATOR = {'$jsonSchema': {'bsonType': 'object',
    'required': ['tmdb_id', 'country_code', 'country_identity_ready', 'tmdb_watch_url'],
    'properties': {
        'tmdb_id': {'bsonType': ['int', 'long'], 'minimum': 1},
        'country_code': {'bsonType': 'string', 'pattern': '^[A-Z]{2}$', 'minLength': 2, 'maxLength': 2},
        'country_identity_ready': {'enum': [True]},
        'tmdb_watch_url': {'bsonType': 'string'},
    }}}


def encoded(value):
    return json_util.dumps(value, json_options=json_util.CANONICAL_JSON_OPTIONS,
                           sort_keys=True, separators=(',', ':')).encode()


def digest(value):
    return sha256(encoded(value)).hexdigest()


def durable(path, value):
    """Atomic write, fsync file and directory; verify lossless readback."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(path.name + '.tmp-' + uuid4().hex)
    with open(temporary, 'xb') as stream:
        os.chmod(temporary, 0o600)
        stream.write(encoded(value))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)
    descriptor = os.open(path.parent, os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    if digest(json_util.loads(path.read_bytes())) != digest(value):
        raise RuntimeError('Archive readback mismatch')


def classify(documents, media):
    """Reject a whole title with ambiguous source identity; never guess a country."""
    groups = {}
    for row in documents:
        country = country_from_url(row.get('tmdb_watch_url'), row.get('tmdb_id'), media)
        stored = row.get('country_code')
        if stored and (not isinstance(stored, str) or stored.upper() != country):
            raise ValueError('Stored country conflicts with URL')
        groups.setdefault(country, []).append(row)
    return groups


def plan_title(db, media, tmdb_id):
    if media not in MEDIA:
        raise ValueError('Expected movie or tv')
    documents = list(db[f'tmdb_{media}_providers'].find({'tmdb_id': tmdb_id}).sort('_id', 1))
    groups = classify(documents, media)
    actions = []
    for country, matches in sorted(groups.items()):
        canonical = min(matches, key=lambda row: (row.get('country_identity_ready') is not True, str(row['_id'])))
        if len(matches) > 1 or canonical.get('country_identity_ready') is not True or canonical.get('country_code') != country or canonical.get('country_identity_error'):
            actions.append({'country': country, 'canonical': canonical['_id'],
                            'ids': [row['_id'] for row in matches],
                            'refresh_required': len(matches) > 1})
    body = {'version': 1, 'media': media, 'tmdb_id': tmdb_id,
            'source_hash': digest(documents), 'documents': documents, 'actions': actions}
    return {**body, 'id': digest(body)}


def begin_maintenance(db):
    """Fail closed across restarts. Deploy publication gate before this command.

    The Mongo validator rejects even an old/in-flight writer. Manual publishers
    honor the persistent maintenance gate. Drain all pre-deployment publishers
    before starting; no TTL automatically reopens the database during a crash.
    """
    if not db.client.admin.command('hello').get('setName'):
        raise RuntimeError('Repair requires replica-set transactions')
    control = db.provider_identity_maintenance.with_options(write_concern=WriteConcern('majority'))
    saved = control.find_one({'_id': 'repair'})
    if not saved or not saved.get('active'):
        original = {media: db[f'tmdb_{media}_providers'].options() for media in MEDIA}
        try:
            control.update_one({'_id': 'repair', 'active': {'$ne': True}}, {'$set': {
                'active': True, 'started_at': datetime.utcnow(), 'original_options': original}}, upsert=True)
        except DuplicateKeyError:
            pass  # Another operator already installed the same persistent gate.
    control.update_one({'_id': 'repair'}, {'$unset': {'drained_at': ''}})
    for media in MEDIA:
        db.command('collMod', f'tmdb_{media}_providers', validator=FREEZE,
                   validationLevel='strict', validationAction='error', writeConcern={'w': 'majority'})
    # The gate closes first; a publisher which already passed its final prewrite
    # check can still be in Crate. Wait for every existing publication lease.
    assert_maintenance(db)


def assert_maintenance(db):
    state = db.provider_identity_maintenance.find_one({'_id': 'repair', 'active': True})
    if not state:
        raise RuntimeError('Persistent maintenance gate is not active')
    for media in MEDIA:
        options = db[f'tmdb_{media}_providers'].options()
        if options.get('validator') != FREEZE or options.get('validationLevel') != 'strict' or options.get('validationAction') != 'error':
            raise RuntimeError('Source write freeze is incomplete')
    if state.get('drained_at'):
        return  # Reject-all validators have prevented new source claims since drain.
    now = datetime.utcnow()
    if db.streaming_publication_leases.find_one({'expires_at': {'$gt': now}}):
        raise RuntimeError('Wait for existing publication leases to drain')
    for media in MEDIA:
        collection = db[f'tmdb_{media}_providers']
        # Existing eligibility index includes the lease deadline. Hint it to
        # avoid reading millions of full offer documents just to prove drain.
        hint = {'hint': 'country_eligibility'} if 'country_eligibility' in collection.index_information() else {}
        if collection.find_one({'lease_expires_at': {'$gt': now}}, {'_id': 1}, **hint):
            raise RuntimeError('Wait for existing source leases to drain')
    db.provider_identity_maintenance.update_one({'_id': 'repair', 'active': True}, {'$set': {'drained_at': now}})


def apply_title(db, plan, output, read_published):
    """read_published(media, tmdb_id) must return ALL live Crate title rows.

    No HTTP is executed in a transaction; fresh country work runs after reopening.
    Receipt and source changes commit atomically. Archive is durable beforehand.
    """
    assert_maintenance(db)
    if digest({key: value for key, value in plan.items() if key != 'id'}) != plan['id']:
        raise ValueError('Manifest hash mismatch')
    media, tmdb_id = plan['media'], plan['tmdb_id']
    collection = db[f'tmdb_{media}_providers']
    receipts = db.provider_identity_repairs
    previous = receipts.find_one({'_id': plan['id']})
    if previous:
        if previous.get('status') != 'applied':
            raise RuntimeError('Plan was rolled back; generate a fresh plan')
        return previous
    current = list(collection.find({'tmdb_id': tmdb_id}).sort('_id', 1))
    if digest(current) != plan['source_hash']:
        raise RuntimeError('Source changed since plan; replan before applying')
    published = read_published(media, tmdb_id)
    if not isinstance(published, list):
        raise ValueError('Published snapshot must be a list, including explicit []')
    archive = {'plan': plan, 'published': published, 'archived_at': datetime.utcnow()}
    archive_path = Path(output) / (plan['id'] + '.archive.json')
    if archive_path.exists():
        archive = json_util.loads(archive_path.read_bytes())
        if archive['plan'] != plan or digest(archive['published']) != digest(published):
            raise RuntimeError('Existing archive disagrees with current inputs')
    else:
        durable(archive_path, archive)
    if digest(json_util.loads(archive_path.read_bytes())) != digest(archive):
        raise RuntimeError('Archive failed verification')
    documents = {row['_id']: row for row in current}
    now = datetime.utcnow()
    replacements = []
    for action in plan['actions']:
        row = deepcopy(documents[action['canonical']])
        row.update(country_code=action['country'], country_identity_ready=True)
        row.pop('country_identity_error', None)
        if action['refresh_required']:
            row['identity_repair_pending'] = plan['id']
            row['tmdb_watch_url'] = f'https://www.themoviedb.org/{media}/{tmdb_id}/watch?locale={action["country"]}'
            # A future failure deadline from ANY duplicate is authoritative.
            deadlines = [documents[identity].get('next_fetch_at') for identity in action['ids']
                         if documents[identity].get('consecutive_failures')]
            row['next_fetch_at'] = max([now] + [deadline for deadline in deadlines if deadline])
            row['consecutive_failures'] = max(documents[identity].get('consecutive_failures', 0) or 0 for identity in action['ids'])
            row.pop('lease_token', None)
            row.pop('lease_expires_at', None)
        else:
            _, update = normalization_update(row, action['country'])
            row.update(update['$set'])
        replacements.append((action, row))

    def transaction(session):
        latest = list(collection.find({'tmdb_id': tmdb_id}, session=session).sort('_id', 1))
        if digest(latest) != plan['source_hash']:
            raise RuntimeError('Source changed before transaction')
        operations = []
        for action, row in replacements:
            extra = [identity for identity in action['ids'] if identity != action['canonical']]
            if extra:
                operations.append(DeleteMany({'_id': {'$in': extra}}))
            operations.append(ReplaceOne({'_id': row['_id']}, row))
        if operations:
            collection.bulk_write(operations, ordered=True, session=session, bypass_document_validation=True)
        final = list(collection.find({'tmdb_id': tmdb_id}, session=session).sort('_id', 1))
        receipt = {'_id': plan['id'], 'media': media, 'tmdb_id': tmdb_id,
            'status': 'applied', 'archive_path': str(archive_path.resolve()),
            'archive_hash': digest(archive), 'after_hash': digest(final), 'applied_at': now,
            'pending_countries': [action['country'] for action in plan['actions'] if action['refresh_required']]}
        receipts.insert_one(receipt, session=session)
        return receipt
    with db.client.start_session() as session:
        session.with_transaction(transaction, read_concern=ReadConcern('snapshot'),
                                 write_concern=WriteConcern('majority'))
    return receipts.find_one({'_id': plan['id']})


def rollback_title(db, plan_id, read_published):
    """Structural rollback only, before refresh/publication changed anything.

    Reject post-refresh rollback: restoring stale published rows requires a new
    explicit migration. This function never overwrites a fresh live snapshot.
    """
    assert_maintenance(db)
    receipt = db.provider_identity_repairs.find_one({'_id': plan_id})
    if not receipt:
        raise ValueError('No repair receipt')
    archive = json_util.loads(Path(receipt['archive_path']).read_bytes())
    if digest(archive) != receipt['archive_hash']:
        raise RuntimeError('Archive hash mismatch')
    if receipt['status'] == 'rolled_back':
        return receipt
    plan = archive['plan']
    collection = db[f'tmdb_{plan["media"]}_providers']
    if digest(read_published(plan['media'], plan['tmdb_id'])) != digest(archive['published']):
        raise RuntimeError('Published rows changed; automatic rollback forbidden')
    def transaction(session):
        current = list(collection.find({'tmdb_id': plan['tmdb_id']}, session=session).sort('_id', 1))
        if digest(current) != receipt['after_hash']:
            raise RuntimeError('Repaired source changed; automatic rollback forbidden')
        # Final full unique index intentionally prevents restoration of duplicates.
        if 'country_identity' in collection.index_information():
            raise RuntimeError('Final invariant installed; rollback requires migration review')
        collection.delete_many({'tmdb_id': plan['tmdb_id']}, session=session)
        collection.insert_many(plan['documents'], session=session, bypass_document_validation=True)
        db.provider_identity_repairs.update_one({'_id': plan_id}, {'$set': {'status': 'rolled_back'}}, session=session)
    with db.client.start_session() as session:
        session.with_transaction(transaction, read_concern=ReadConcern('snapshot'), write_concern=WriteConcern('majority'))
    return db.provider_identity_repairs.find_one({'_id': plan_id})


def quarantine_title(db, media, tmdb_id, output, read_published):
    """Losslessly isolate a whole ambiguous title without assigning another ID.

    The durable unresolved marker freezes publication of this title, including
    API offers. Clearing it requires a separate authoritative identity repair.
    Originals exist both in the verified file archive and the Mongo quarantine.
    """
    assert_maintenance(db)
    if media not in MEDIA:
        raise ValueError('Expected movie or tv')
    key = f'{media}:{tmdb_id}'
    previous = db.provider_identity_unresolved.find_one({'_id': key})
    if previous:
        if previous.get('status') != 'unresolved':
            raise RuntimeError('Previously resolved quarantine requires review')
        if db[f'tmdb_{media}_providers'].find_one({'tmdb_id': tmdb_id}):
            raise RuntimeError('Quarantined title received new source records')
        return previous
    collection = db[f'tmdb_{media}_providers']
    documents = list(collection.find({'tmdb_id': tmdb_id}).sort('_id', 1))
    if not documents:
        raise ValueError('No source documents to quarantine')
    try:
        classify(documents, media)
    except (ValueError, TypeError):
        pass
    else:
        raise ValueError('Valid title must use ordinary identity repair')
    published = read_published(media, tmdb_id)
    if not isinstance(published, list):
        raise ValueError('Published snapshot must be a list')
    source_hash = digest(documents)
    archive = {'media': media, 'tmdb_id': tmdb_id, 'documents': documents,
               'published': published, 'reason': 'ambiguous_source_identity'}
    archive_path = Path(output) / f'quarantine-{media}-{tmdb_id}-{source_hash}.json'
    if archive_path.exists() and digest(json_util.loads(archive_path.read_bytes())) != digest(archive):
        raise RuntimeError('Existing quarantine archive differs')
    durable(archive_path, archive)
    receipt = {'_id': key, 'media': media, 'tmdb_id': tmdb_id,
               'status': 'unresolved', 'reason': 'ambiguous_source_identity',
               'source_document_count': len(documents),
               'source_country_count': len({row.get('country_code') for row in documents}),
               'archive_path': str(archive_path.resolve()), 'archive_hash': digest(archive),
               'quarantined_at': datetime.utcnow()}
    def transaction(session):
        current = list(collection.find({'tmdb_id': tmdb_id}, session=session).sort('_id', 1))
        if digest(current) != source_hash:
            raise RuntimeError('Quarantine source changed')
        db.provider_identity_quarantine.insert_many([
            {'_id': f'{media}:{row["_id"]}', 'media': media, 'tmdb_id': tmdb_id,
             'original': row, 'quarantine': key} for row in documents
        ], session=session)
        db.provider_identity_unresolved.insert_one(receipt, session=session)
        collection.delete_many({'tmdb_id': tmdb_id}, session=session)
    with db.client.start_session() as session:
        session.with_transaction(transaction, read_concern=ReadConcern('snapshot'),
                                 write_concern=WriteConcern('majority'))
    return db.provider_identity_unresolved.find_one({'_id': key})


def verify(db, progress=None):
    """Exact server counts; only noncanonical URLs cross the network for parsing.

    The fast path is a subset of country_from_url, never a replacement parser.
    Safe conversion prevents malformed BSON from aborting the server predicate.
    A verified unique index covering every ready record proves uniqueness once
    the independently counted unready population is zero.
    """
    report = {}
    def string(field):
        return {'$convert': {'input': '$' + field, 'to': 'string', 'onError': '', 'onNull': ''}}
    for media in MEDIA:
        collection = db[f'tmdb_{media}_providers']
        pending = {'$and': [{'$ifNull': ['$identity_repair_pending', False]},
                            {'$ne': ['$identity_repair_pending', '']}]}
        totals = list(collection.aggregate([{'$group': {
            '_id': None, 'documents': {'$sum': 1},
            'unready': {'$sum': {'$cond': [{'$eq': ['$country_identity_ready', True]}, 0, 1]}},
            'pending': {'$sum': {'$cond': [pending, 1, 0]}},
            'pending_failed': {'$sum': {'$cond': [{'$and': [pending,
                {'$ifNull': ['$consecutive_failures', 0]}]}, 1, 0]}},
        }}], allowDiskUse=True, maxTimeMS=540000))
        counts = totals[0] if totals else {'documents': 0, 'unready': 0, 'pending': 0, 'pending_failed': 0}
        counts.pop('_id', None)
        if progress:
            progress(media, {**counts, 'stage': 'server_counts_complete'})
        counts['invalid'] = 0
        # PCRE \z is strict end-of-string; $ would also match before a newline.
        # The slug cannot contain controls, query separators or fragments.
        # Keep the regex constant so MongoDB compiles it once, not per document.
        pattern = (r'^https://(?:www\.)?themoviedb\.org(?::443)?/' + media
            + r'/([0-9]+)(?:-[^\x00-\x20/?#]*)?/watch/?\?locale=([A-Z]{2})\z')
        canonical = {'$let': {'vars': {'match': {'$regexFind': {
            'input': string('tmdb_watch_url'), 'regex': pattern}}}, 'in': {'$and': [
                {'$ne': ['$$match', None]},
                {'$eq': [{'$arrayElemAt': ['$$match.captures', 0]}, string('tmdb_id')]},
                {'$eq': [{'$arrayElemAt': ['$$match.captures', 1]}, string('country_code')]},
            ]}}}
        fast_valid = {'$and': [VALIDATOR, {'$expr': canonical}]}
        candidates = collection.find({'$nor': [fast_valid]}, {'tmdb_id': 1,
            'country_code': 1, 'tmdb_watch_url': 1}).batch_size(5000).max_time_ms(540000)
        for row in candidates:
            try:
                country = country_from_url(row.get('tmdb_watch_url'), row.get('tmdb_id'), media)
                if row.get('country_code') != country:
                    raise ValueError('Country mismatch')
            except (ValueError, TypeError):
                counts['invalid'] += 1
        covering = False
        for index in collection.index_information().values():
            if (index.get('key') == [('tmdb_id', 1), ('country_code', 1)]
                    and index.get('unique') and not index.get('sparse')
                    and (not index.get('partialFilterExpression')
                         or (not counts['unready'] and index['partialFilterExpression'] == {'country_identity_ready': True}))):
                covering = True
        if covering:
            counts['duplicates'] = 0
        else:
            duplicates = list(collection.aggregate([
                {'$group': {'_id': {'tmdb_id': '$tmdb_id', 'country': '$country_code'}, 'n': {'$sum': 1}}},
                {'$match': {'n': {'$gt': 1}}}, {'$count': 'groups'},
            ], allowDiskUse=True, maxTimeMS=540000))
            counts['duplicates'] = duplicates[0]['groups'] if duplicates else 0
        counts['quarantined_unresolved_titles'] = db.provider_identity_unresolved.count_documents(
            {'media': media, 'status': 'unresolved'})
        counts['quarantined_documents'] = db.provider_identity_quarantine.count_documents({'media': media})
        report[media] = counts
        if progress:
            progress(media, {**counts, 'stage': 'full_invariant_checked'})
    return report


def finish_maintenance(db, final=False, progress=None):
    state = db.provider_identity_maintenance.find_one({'_id': 'repair'})
    if not state or not state.get('active'):
        raise RuntimeError('No active maintenance')
    # Re-establish both freezes when a previous finish crashed between collMod
    # calls. The persisted gate remains closed throughout, including manual jobs.
    if all(db[f'tmdb_{media}_providers'].options().get('validator') == FREEZE
           for media in MEDIA):
        assert_maintenance(db)
    else:
        begin_maintenance(db)
    if final:
        report = verify(db, progress)
        if any(row['invalid'] or row['unready'] or row['duplicates'] for row in report.values()):
            raise RuntimeError('Full valid unique identity invariant not yet satisfied')
        for media in MEDIA:
            collection = db[f'tmdb_{media}_providers']
            collection.create_index([('tmdb_id', 1), ('country_code', 1)], unique=True, name='country_identity')
            ensure_indexes(collection)
            # Preserve operator constraints such as retired-title exclusions
            # across subsequent maintenance windows.
            previous = state['original_options'][media].get('validator', {})
            validator = {'$and': [VALIDATOR, previous]} if previous else VALIDATOR
            db.command('collMod', collection.name, validator=validator,
                       validationLevel='strict', validationAction='error', writeConcern={'w': 'majority'})
    else:
        for media in MEDIA:
            original = state['original_options'][media]
            db.command('collMod', f'tmdb_{media}_providers', validator=original.get('validator', {}),
                       validationLevel=original.get('validationLevel', 'strict'),
                       validationAction=original.get('validationAction', 'error'), writeConcern={'w': 'majority'})
    db.provider_identity_maintenance.with_options(write_concern=WriteConcern('majority')).update_one(
        {'_id': 'repair'}, {'$set': {'active': False, 'finished_at': datetime.utcnow(), 'final': final}})
    return report if final else None


def read_crate_published(media, tmdb_id):
    """Read live rows using operator-supplied private connection settings."""
    import requests
    url = os.environ['PROVIDER_REPAIR_CRATE_SQL_URL']
    auth = None
    if os.environ.get('PROVIDER_REPAIR_CRATE_USER'):
        auth = (os.environ['PROVIDER_REPAIR_CRATE_USER'], os.environ['PROVIDER_REPAIR_CRATE_PASSWORD'])
    response = requests.post(url, json={
        'stmt': 'SELECT * FROM streaming_availability WHERE media_tmdb_id = ? AND media_type = ?',
        'args': [tmdb_id, 'movie' if media == 'movie' else 'show'],
    }, auth=auth, timeout=60)
    response.raise_for_status()
    payload = response.json()
    if 'error' in payload or 'cols' not in payload or 'rows' not in payload:
        raise RuntimeError('Crate published snapshot unavailable')
    rows = [dict(zip(payload['cols'], row)) for row in payload['rows']]
    count_response = requests.post(url, json={
        'stmt': 'SELECT COUNT(*) FROM streaming_availability WHERE media_tmdb_id = ? AND media_type = ?',
        'args': [tmdb_id, 'movie' if media == 'movie' else 'show'],
    }, auth=auth, timeout=60)
    count_response.raise_for_status()
    if count_response.json().get('rows') != [[len(rows)]]:
        raise RuntimeError('Published snapshot is incomplete or changed during read')
    return sorted(rows, key=lambda row: (row['country_code'], row['streaming_service_id'], row['streaming_type']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['plan', 'audit', 'verify', 'begin', 'finish', 'finalize', 'apply', 'rollback'])
    parser.add_argument('--media', choices=MEDIA)
    parser.add_argument('--tmdb-id', type=int)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--plan-id')
    args = parser.parse_args()
    os.umask(0o077)
    client = MongoClient(os.environ['PROVIDER_REPAIR_MONGO_URI'], appname='provider-identity-repair')
    db = client[os.environ['PROVIDER_REPAIR_MONGO_DB']]
    if args.mode == 'plan':
        if not args.media or not args.tmdb_id:
            parser.error('plan requires --media and --tmdb-id')
        result = plan_title(db, args.media, args.tmdb_id)
        durable(args.output, result)
    elif args.mode in ('audit', 'verify'):
        result = verify(db)
        durable(args.output, result)
    elif args.mode == 'apply':
        if not args.manifest:
            parser.error('apply requires --manifest')
        plan = json_util.loads(args.manifest.read_bytes())
        result = apply_title(db, plan, args.output, read_crate_published)
        print(json_util.dumps({key: result[key] for key in ('_id', 'status', 'pending_countries')}))
    elif args.mode == 'rollback':
        if not args.plan_id:
            parser.error('rollback requires --plan-id')
        rollback_title(db, args.plan_id, read_crate_published)
    elif args.mode == 'begin':
        begin_maintenance(db)
    else:
        finish_maintenance(db, final=args.mode == 'finalize')
    client.close()


if __name__ == '__main__':
    main()
