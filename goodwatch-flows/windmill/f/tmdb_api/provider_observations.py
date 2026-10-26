"""Ordered provider evidence on existing details/country records.

A provider observation never acknowledges metadata work. Omitted countries remain
unknown; only explicit, validated country results can establish an empty check.
"""
from copy import deepcopy
from datetime import datetime, timezone

from f.tmdb_api.provider_evidence import (
    OFFER_TYPES, capture_provider_check, snapshot_id, utc_ms, validated_results,
)


def collections(db, media_type):
    if media_type not in ('movie', 'show', 'tv'):
        raise ValueError('Expected movie or show')
    prefix = 'tmdb_movie' if media_type == 'movie' else 'tmdb_tv'
    return db[prefix + '_details'], db[prefix + '_providers']


def normalize_payload(payload):
    """Use the existing embedded representation, excluding endpoint-only ID."""
    if validated_results(payload) is None:
        return None
    from f.tmdb_api.models import WatchProviders
    payload = deepcopy(payload)
    def clean(value):
        if isinstance(value, dict):
            return {key: clean(item) for key, item in value.items()}
        if isinstance(value, list):
            return [clean(item) for item in value]
        return None if value == '' else value
    return WatchProviders(results=clean(payload['results'])).to_mongo().to_dict()


def membership(payload):
    return {country: {kind: sorted({offer['provider_id'] for offer in data.get(kind, [])})
                      for kind in OFFER_TYPES}
            for country, data in payload['results'].items()}


def observation(document):
    payload, proof = document.get('watch_providers'), document.get('watch_providers_check') or {}
    at = proof.get('checked_at')
    if (document.get('tmdb_deleted') is True or validated_results(payload) is None
            or type(at) is not int or at <= 0 or proof.get('payload_hash') != snapshot_id(payload)
            or proof.get('countries') != sorted(payload['results'])):
        return None
    return dict(payload=payload, proof=proof, checked_at=at,
                revision=f"{at}:{snapshot_id(membership(payload))}")


def read_observation(db, media_type, tmdb_id, *, shadow=False):
    details, _ = collections(db, media_type)
    document = details.find_one({'tmdb_id': tmdb_id})
    if not document:
        return None
    if shadow and document.get('watch_providers_shadow'):
        return observation(document | document['watch_providers_shadow'])
    return observation(document)


def propagate_pending(db, media_type, tmdb_id):
    """Replay bounded country projections after a crash, without requeuing a revision."""
    details, countries = collections(db, media_type)
    source = details.find_one({'tmdb_id': tmdb_id}) or {}
    current = observation(source)
    if current:
        at = datetime.fromtimestamp(current['checked_at'] / 1000, timezone.utc).replace(tzinfo=None)
        countries.update_many({'tmdb_id': tmdb_id, '$or': [
            {'provider_title_observed_at': {'$lt': at}}, {'provider_title_observed_at': None},
        ]}, {'$set': {'provider_title_observed_at': at}})
        # Omission is unknown, and must not retain an older empty suppression.
        countries.update_many({'tmdb_id': tmdb_id, 'country_code': {'$nin': list(current['payload']['results'])},
                               '$or': [{'provider_observed_at': {'$lt': at}}, {'provider_observed_at': None}]},
                              {'$set': {'provider_verified_empty': False}})
        for country, offers in membership(current['payload']).items():
            countries.update_many({'tmdb_id': tmdb_id, 'country_code': country, '$or': [
                {'provider_observed_at': {'$lt': at}}, {'provider_observed_at': None},
            ]}, {'$set': {'provider_observed_at': at,
                         'tmdb_deleted': False,
                         'provider_verified_empty': current['proof'].get('cache_bypassed') is True
                         and not any(offers.values())}})
    for country, change in (source.get('watch_providers_changes') or {}).items():
        countries.update_many({'tmdb_id': tmdb_id, 'country_code': country,
            'provider_change_revision': {'$ne': change['revision']}, '$or': [
                {'provider_change_observed_at': {'$lt': change['checked_at']}},
                {'provider_change_observed_at': None},
            ]}, {'$set': {'provider_change_pending': True, 'provider_change_revision': change['revision'],
                         'provider_change_observed_at': change['checked_at']}})


def record_attempt(db, media_type, tmdb_id, checked_at, error):
    """Late failures cannot overwrite bookkeeping for a newer attempt/success."""
    details, _ = collections(db, media_type)
    at = _datetime(checked_at)
    details.update_one({'tmdb_id': tmdb_id, '$or': [
        {'watch_providers_attempted_at': {'$lte': at}}, {'watch_providers_attempted_at': None},
    ]}, {'$set': {'watch_providers_attempted_at': at, 'watch_providers_error': error}})


def _datetime(value):
    millis = utc_ms(value) if isinstance(value, datetime) else value
    if type(millis) is not int or millis <= 0:
        raise ValueError('Expected a positive observation time in milliseconds or datetime')
    return datetime.fromtimestamp(millis / 1000, timezone.utc).replace(tzinfo=None)


def save_observation(db, media_type, tmdb_id, payload, checked_at, *, cache_bypassed=True, dry_run=False, shadow=False):
    """CAS provider fields only, retrying proof/diff construction against the winner.

    First observations establish a baseline. Cached reads retain their provenance
    and cannot synthesize exact history dates. Equal timestamps never replace a
    different observation. Invalid/deleted responses cannot establish absence.
    """
    if shadow:
        return _save_shadow(db, media_type, tmdb_id, payload, checked_at, cache_bypassed=cache_bypassed, dry_run=dry_run)
    details, _ = collections(db, media_type)
    if type(tmdb_id) is not int or tmdb_id <= 0:
        raise ValueError('Expected positive TMDB identity')
    at = _datetime(checked_at)
    millis = utc_ms(at)
    if isinstance(payload, dict) and 'id' in payload and payload['id'] != tmdb_id:
        return dict(status='invalid', changed_countries=[], revision=None)
    normalized = normalize_payload(payload)
    if normalized is None:
        if not dry_run:
            record_attempt(db, media_type, tmdb_id, at, 'missing_or_invalid_provider_response')
        return dict(status='invalid', changed_countries=[], revision=None)
    for _ in range(20):
        source = details.find_one({'tmdb_id': tmdb_id})
        if not source or source.get('tmdb_deleted') is True:
            return dict(status='missing', changed_countries=[], revision=None)
        previous = observation(source)
        old_proof = source.get('watch_providers_check') or {}
        old_at = old_proof.get('checked_at')
        if type(old_at) is int and old_at >= millis:
            status = 'reused' if old_at == millis and old_proof.get('payload_hash') == snapshot_id(normalized) else 'stale'
            if not dry_run:
                if previous:
                    details.update_one({'_id': source['_id']}, {'$set': {'provider_detector_registered': True}})
                propagate_pending(db, media_type, tmdb_id)
            return dict(status=status, changed_countries=[], **(previous or {'revision': None}))
        proof = capture_provider_check({'id': tmdb_id, 'watch/providers': normalized}, tmdb_id, at,
                                       previous=old_proof, bypass_cache=cache_bypassed)
        current_membership = membership(normalized)
        revision = f'{millis}:{snapshot_id(current_membership)}'
        prior_membership = membership(previous['payload']) if previous else {}
        changed = sorted(country for country in current_membership.keys() & prior_membership.keys()
                         if current_membership[country] != prior_membership[country])
        changes = dict(source.get('watch_providers_changes') or {})
        changes.update({country: dict(revision=revision, checked_at=millis) for country in changed})
        fields = dict(provider_detector_registered=True, watch_providers=normalized, watch_providers_check=proof,
                      watch_providers_changes=changes)
        # A newer failed attempt retains its error until a subsequent attempt.
        attempted = source.get('watch_providers_attempted_at')
        if attempted is None or utc_ms(attempted) <= millis:
            fields.update(watch_providers_attempted_at=at, watch_providers_error='')
        # Even an unchanged observation advances provider freshness downstream.
        fields['watch_providers_publication_pending'] = revision
        if dry_run:
            return dict(status='saved', changed_countries=changed, revision=revision,
                        checked_at=millis, payload=normalized, proof=proof)
        selector = {'_id': source['_id'], 'tmdb_deleted': {'$ne': True},
                    'watch_providers_check': source.get('watch_providers_check'),
                    'watch_providers_attempted_at': source.get('watch_providers_attempted_at')}
        if details.update_one(selector, {'$set': fields}).matched_count == 1:
            propagate_pending(db, media_type, tmdb_id)
            return dict(status='saved', changed_countries=changed, revision=revision,
                        checked_at=millis, payload=normalized, proof=proof)
    raise RuntimeError('Concurrent provider observation updates did not settle')


def acknowledge_publication(db, media_type, tmdb_id, revision):
    details, _ = collections(db, media_type)
    return details.update_one({'tmdb_id': tmdb_id, 'watch_providers_publication_pending': revision},
                              {'$unset': {'watch_providers_publication_pending': ''}}).modified_count == 1


def publish_observations(connector, media_type, ids):
    from f.tmdb_api.list_offer_refresh import publish_offers
    return publish_offers(connector, 'show' if media_type == 'tv' else media_type, list(ids))


def main():
    pass


def _save_shadow(db, media_type, tmdb_id, payload, checked_at, *, cache_bypassed, dry_run):
    """Same evidence rules, isolated from live offers, attempts and publication."""
    details, _ = collections(db, media_type)
    at = _datetime(checked_at)
    millis = utc_ms(at)
    if type(tmdb_id) is not int or tmdb_id <= 0:
        raise ValueError('Expected positive TMDB identity')
    normalized = normalize_payload(payload)
    if normalized is None or ('id' in payload and payload['id'] != tmdb_id):
        return dict(status='invalid', changed_countries=[], revision=None)
    for _ in range(20):
        source = details.find_one({'tmdb_id': tmdb_id})
        if not source or source.get('tmdb_deleted') is True:
            return dict(status='missing', changed_countries=[], revision=None)
        shadow = source.get('watch_providers_shadow')
        previous = observation(source | shadow) if shadow else observation(source)
        if previous and previous['checked_at'] >= millis:
            identical = previous['checked_at'] == millis and previous['proof']['payload_hash'] == snapshot_id(normalized)
            if not shadow and identical:
                # Copy a reusable live baseline at its actual observation time.
                baseline = dict(watch_providers=previous['payload'], watch_providers_check=previous['proof'])
                if dry_run or details.update_one({'_id': source['_id'], 'watch_providers_shadow': shadow},
                        {'$set': {'watch_providers_shadow': baseline}}).matched_count == 1:
                    return dict(status='saved', changed_countries=[], **previous)
                continue
            return dict(status='reused' if identical else 'stale', changed_countries=[], **previous)
        proof = capture_provider_check({'id': tmdb_id, 'watch/providers': normalized}, tmdb_id, at,
                                       previous=previous['proof'] if previous else None, bypass_cache=cache_bypassed)
        current = dict(watch_providers=normalized, watch_providers_check=proof)
        result = observation(source | current)
        old_members = membership(previous['payload']) if previous else {}
        new_members = membership(normalized)
        changed = sorted(country for country in old_members.keys() & new_members.keys()
                         if old_members[country] != new_members[country])
        if dry_run or details.update_one({'_id': source['_id'], 'watch_providers_shadow': shadow},
                                         {'$set': {'watch_providers_shadow': current}}).matched_count == 1:
            return dict(status='saved', changed_countries=changed, **result)
    raise RuntimeError('Concurrent shadow observations did not settle')


def save_deleted_observation(db, media_type, tmdb_id, checked_at, *, dry_run=False):
    """Record an already API-confirmed 404/status34 without inventing an empty payload."""
    details, countries = collections(db, media_type)
    at = _datetime(checked_at)
    if dry_run:
        return dict(status='deleted', changed_countries=[], revision=None)
    source = details.find_one({'tmdb_id': tmdb_id})
    if not source:
        return dict(status='missing', changed_countries=[], revision=None)
    proof_at = (source.get('watch_providers_check') or {}).get('checked_at', 0)
    attempted = utc_ms(source.get('watch_providers_attempted_at')) or 0
    if max(proof_at, attempted) > utc_ms(at):
        return dict(status='stale', changed_countries=[], revision=None)
    saved = details.update_one({'_id': source['_id'],
        'watch_providers_check': source.get('watch_providers_check'),
        'watch_providers_attempted_at': source.get('watch_providers_attempted_at')},
        {'$set': {'tmdb_deleted': True, 'tmdb_deleted_at': at,
                  'watch_providers_attempted_at': at, 'watch_providers_error': 'tmdb_not_found'}})
    if saved.matched_count != 1:
        return dict(status='stale', changed_countries=[], revision=None)
    countries.update_many({'tmdb_id': tmdb_id, '$or': [
        {'provider_observed_at': {'$lte': at}}, {'provider_observed_at': None},
    ]}, {'$set': {'tmdb_deleted': True, 'provider_observed_at': at}})
    return dict(status='deleted', changed_countries=[], revision=None)
