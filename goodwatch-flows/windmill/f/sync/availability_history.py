"""Availability stays, written under the streaming publisher's title leases."""
from datetime import datetime
from pydantic import BaseModel
from f.tmdb_api.provider_evidence import snapshot_id, utc_ms, validated_results

DAY = 86_400_000
OFFER_TYPES = ('flatrate', 'free', 'ads')
KEY = ('media_tmdb_id', 'media_type', 'country_code', 'streaming_service_id', 'streaming_type')
PRIMARY_KEY = [*KEY, 'observed_at']


class Stay(BaseModel):
    media_tmdb_id: int
    media_type: str
    country_code: str
    streaming_service_id: int
    streaming_type: str
    observed_at: int
    appeared_on: int
    appeared_after: int | None = None
    appeared_source: str = 'title'
    appeared_precision: str = 'unknown'
    last_seen_on: int | None = None
    dropped_on: int | None = None
    dropped_precision: str | None = None


# Explicit TMDB network/studio -> provider identities from #678's research.
# Broad production houses (Disney, Warner, etc.) do not establish an original.
NETWORK_SERVICES = {213: (8, 1796), 2739: (337,), 2552: (350,), 1024: (9, 2100),
                    3186: (1899, 384), 453: (15,), 4330: (2303, 2616, 531), 3353: (386, 387)}
STUDIO_SERVICES = {178464: (8, 1796), 198834: (8, 1796), 185004: (8, 1796),
                   210099: (9, 2100), 194232: (350,), 158691: (1899, 384)}


def utc_day(value):
    if isinstance(value, (int, float)):
        return int(value) // DAY * DAY
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    if isinstance(value, datetime):
        return utc_ms(value) // DAY * DAY
    return None


def premiere_day(details, media_type, service_id, observed_day):
    mapping = NETWORK_SERVICES if media_type == 'show' else STUDIO_SERVICES
    entities = details.get('networks' if media_type == 'show' else 'production_companies') or []
    if not any(service_id in mapping.get(entity.get('id'), ()) for entity in entities):
        return None
    if media_type == 'show':
        result = utc_day(details.get('first_air_date'))
    else:
        dates = [utc_day(release.get('release_date'))
                 for country in (details.get('release_dates') or {}).get('results', [])
                 for release in country.get('release_dates', []) if release.get('type') == 4]
        result = min((date for date in dates if date is not None), default=None)
    return result if result is not None and result <= observed_day else None


def publish_history(connector, media_type, titles, check_owned, pending_store=None):
    """Write transitions before offers, under their leases; retries repair both.

    No history SQL for unchanged offers. last_seen_on is the positive read known
    at a transition (updated on close from the retained provider proof), not a
    heartbeat. Precision columns are the reader contract.
    """
    if not titles:
        return []
    pending = {row['_id'] for row in pending_store.find(
        {'_id': {'$in': [f'{media_type}:{title[0]}' for title in titles]}})} if pending_store is not None else set()
    transitions = []
    for tmdb_id, details, rows, verified, existing, removed in titles:
        old_keys = {tuple(row[k] for k in KEY) for row in existing}
        added = {key: row for key, row in rows.items() if key not in old_keys and key[-1] in OFFER_TYPES}
        removed = [key for key in removed if key[-1] in OFFER_TYPES]
        if added or removed or f'{media_type}:{tmdb_id}' in pending:
            transitions.append((tmdb_id, details, added, verified, removed, rows))
    if not transitions:
        return []
    identities = [f'{media_type}:{title[0]}' for title in transitions]
    check_owned()
    if pending_store is not None:
        new_markers = [{'_id': identity} for identity in identities if identity not in pending]
        if new_markers:
            # One durable bulk marker before either table changes. Existing title
            # leases serialize this insert; _id supplies the unique lookup index.
            pending_store.insert_many(new_markers)
    check_owned()
    connector.run('REFRESH TABLE availability_history')
    previous = connector.select(
        'SELECT * FROM availability_history WHERE media_tmdb_id = ANY(?) AND media_type = ?',
        ([title[0] for title in transitions], media_type))
    latest = {}
    for row in previous:
        key = tuple(row[k] for k in KEY)
        latest[key] = max(latest.get(key, 0), row['observed_at'])
    opened = {tuple(row[k] for k in KEY): row for row in previous if row['dropped_on'] is None}
    writes = []
    for tmdb_id, details, added, verified, removed, desired in transitions:
        if f'{media_type}:{tmdb_id}' in pending:
            # The source may change between failure and retry. Reconcile every
            # open stay of the interrupted title, even if its offer diff is empty.
            added.update({key: row for key, row in desired.items() if key[-1] in OFFER_TYPES and key not in opened})
            removed = sorted(set(removed) | {key for key in opened if key[:2] == (tmdb_id, media_type) and key not in desired})
        proof = details.get('watch_providers_check') or {}
        payload = details.get('watch_providers') or {}
        results = validated_results(payload)
        valid = (not details.get('watch_providers_error') and results is not None
                 and proof.get('payload_hash') == snapshot_id(payload)
                 and isinstance(proof.get('checked_at'), int))
        api_at = proof['checked_at'] if valid else utc_ms(details.get('updated_at'))
        prior = proof.get('previous_day') or {}
        prior_at = prior.get('checked_at')
        prior_offers = set(prior.get('offers') or [])
        api_offers = {f"{country}:{offer['provider_id']}:{kind}"
                      for country, data in (results or {}).items()
                      for kind in OFFER_TYPES for offer in data.get(kind, [])}

        def observation(key, row=None):
            identity = f'{key[2]}:{key[3]}:{key[4]}'
            times = []
            if (identity in api_offers if row else results is not None and (not results or key[2] in results)):
                times.append(api_at)
            provider = verified.get(key[2])
            if provider and (row is None or any(row.get(field) is not None for field in ('stream_url', 'price_dollar', 'quality'))):
                times.append(utc_ms(provider.get('updated_at')))
            at = max((value for value in times if isinstance(value, int)), default=None)
            yesterday = (at is not None and valid and proof.get('cache_bypassed') and prior.get('cache_bypassed')
                         and isinstance(prior_at, int) and prior_at // DAY == at // DAY - 1
                         and api_at // DAY == at // DAY)
            return identity, at, yesterday

        for key, row in added.items():
            if key in opened:
                continue  # History committed but the offer write failed: replay the offer only.
            identity, at, yesterday = observation(key, row)
            if at is None:
                raise ValueError(f'No source observation time for new offer {key}')
            if latest.get(key, -1) >= at:
                raise ValueError(f'Stale source cannot reopen completed stay {key}')
            today = at // DAY * DAY
            exact = yesterday and identity in api_offers and identity not in prior_offers
            premiere = premiere_day(details, media_type, key[3], today) if key not in latest else None
            appeared_after = (prior_at // DAY * DAY if valid and prior.get('cache_bypassed') and
                              isinstance(prior_at, int) and prior_at < at and identity not in prior_offers else None)
            writes.append(Stay(**{k: row[k] for k in KEY}, observed_at=at,
                               appeared_on=premiere if premiere is not None else today, last_seen_on=today,
                               appeared_source='premiere' if premiere is not None else 'title',
                               appeared_after=None if premiere is not None else appeared_after,
                               appeared_precision='exact' if exact or premiere is not None else 'unknown'))
        for key in removed:
            old = opened.get(key)
            if not old:
                continue  # A retried close, or a legacy offer not in the initial backfill.
            identity, at, yesterday = observation(key)
            if at is None:
                raise ValueError(f'No source observation time for removed offer {key}')
            if at < old['observed_at']:
                raise ValueError(f'Stale source cannot close newer stay {key}')
            today = at // DAY * DAY
            exact = yesterday and identity not in api_offers and identity in prior_offers
            last_seen = old.get('last_seen_on')
            if valid and prior.get('cache_bypassed') and isinstance(prior_at, int) and prior_at < at and identity in prior_offers:
                last_seen = max(last_seen or 0, prior_at // DAY * DAY)
            writes.append(Stay(**(old | {'dropped_on': today,
                                        'dropped_precision': 'exact' if exact else 'unknown',
                                        'last_seen_on': last_seen})))
    if writes:
        check_owned()
        connector.upsert_many(table='availability_history', records=writes,
                              conflict_columns=PRIMARY_KEY, silent=True, replace_nulls=True)
    return identities


def acknowledge_history(pending_store, identities, check_owned):
    if identities:
        check_owned()
        pending_store.delete_many({'_id': {'$in': identities}})


def main():
    pass
