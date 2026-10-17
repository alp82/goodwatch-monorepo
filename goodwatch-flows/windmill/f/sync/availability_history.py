"""Availability stays, written under the streaming publisher's title leases."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import NamedTuple
from pydantic import BaseModel
from f.tmdb_api.provider_evidence import (
    DAY, HISTORY_OFFER_TYPES as OFFER_TYPES, snapshot_id, utc_day, utc_ms, validated_results,
)

PREMIERE_WINDOW_DAYS = 7


class OfferKey(NamedTuple):
    media_tmdb_id: int
    media_type: str
    country_code: str
    streaming_service_id: int
    streaming_type: str

    @property
    def proof_identity(self):
        return f'{self.country_code}:{self.streaming_service_id}:{self.streaming_type}'


KEY = OfferKey._fields
PRIMARY_KEY = [*KEY, 'observed_at']


def availability_key(row):
    return OfferKey(*(row[column] for column in KEY))


@dataclass
class HistoryTitle:
    tmdb_id: int
    details: dict
    rows: dict
    verified: dict
    existing: list
    removed: list
    list_read: 'ListRead | None' = None


@dataclass
class ListRead:
    """Evidence confined to one complete discover list and verified title change."""
    country_code: str
    service_id: int
    checked_at: int
    previous_at: int | None = None
    previous_offers: tuple = ()
    previous_present: bool = False
    previous_complete: bool = False
    previous_cache_bypassed: bool = False


@dataclass
class Transition:
    title: HistoryTitle
    added: dict
    removed: list


@dataclass
class HistoryPublication:
    pending: list = field(default_factory=list)
    errors: dict = field(default_factory=dict)


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
NETWORK_SERVICES = {213: (8, 1796), 2739: (337,), 2552: (350,), 1024: (9, 119, 2100),
                    3186: (1899, 384), 453: (15,), 4330: (2303, 2616, 531), 3353: (386, 387)}
STUDIO_SERVICES = {178464: (8, 1796), 198834: (8, 1796), 185004: (8, 1796),
                   210099: (9, 119, 2100), 194232: (350,), 158691: (1899, 384)}


def premiere_day(details, media_type, service_id, observed_day, country_code=None):
    mapping = NETWORK_SERVICES if media_type == 'show' else STUDIO_SERVICES
    entities = details.get('networks' if media_type == 'show' else 'production_companies') or []
    if not any(service_id in mapping.get(entity.get('id'), ()) for entity in entities):
        return None
    if media_type == 'show':
        result = utc_day(details.get('first_air_date'))
    else:
        dates, local_dates = [], []
        for country in (details.get('release_dates') or {}).get('results', []):
            for release in country.get('release_dates', []):
                date = utc_day(release.get('release_date'))
                if release.get('type') == 4 and date is not None:
                    dates.append(date)
                    if country.get('iso_3166_1') == country_code:
                        local_dates.append(date)
        result = min(local_dates or dates, default=None)
    return result if result is not None and observed_day - PREMIERE_WINDOW_DAYS * DAY <= result <= observed_day else None


@dataclass
class Observation:
    api_at: int | None
    results: dict | None
    api_offers: set
    prior_at: int | None
    prior_offers: set
    fresh_prior: bool
    fresh_current: bool
    verified: dict
    copy_at: int
    list_read: ListRead | None = None

    @classmethod
    def from_title(cls, title, copy_at):
        details = title.details
        proof = details.get('watch_providers_check') or {}
        payload = details.get('watch_providers') or {}
        results = validated_results(payload)
        valid = (not details.get('watch_providers_error') and results is not None
                 and proof.get('payload_hash') == snapshot_id(payload)
                 and isinstance(proof.get('checked_at'), int))
        api_at = proof['checked_at'] if valid else utc_ms(details.get('updated_at'))
        prior = proof.get('previous_day') or {}
        prior_at = prior.get('checked_at')
        fresh_prior = bool(valid and prior.get('cache_bypassed') is True
                           and isinstance(prior_at, int) and isinstance(prior.get('offers'), list)
                           and prior_at < api_at)
        offers = {f"{country}:{offer['provider_id']}:{kind}"
                  for country, data in (results or {}).items()
                  for kind in OFFER_TYPES for offer in data.get(kind, [])}
        fresh_current = bool(valid and proof.get('cache_bypassed') is True)
        scoped = title.list_read
        if scoped is not None and fresh_current and utc_day(scoped.checked_at) == utc_day(api_at):
            prior_at = scoped.previous_at
            fresh_prior = (scoped.previous_complete and scoped.previous_cache_bypassed
                           and isinstance(prior_at, int) and prior_at < api_at)
            prior_offers = {f'{scoped.country_code}:{scoped.service_id}:{kind}' for kind in scoped.previous_offers}
        else:
            scoped = None
            prior_offers = set(prior.get('offers') or [])
        return cls(api_at, results, offers, prior_at, prior_offers,
                   fresh_prior, fresh_current, title.verified, copy_at, scoped)

    def api_supports(self, key, row=None):
        if self.list_read is not None:
            if (key.country_code, key.streaming_service_id) != (self.list_read.country_code, self.list_read.service_id):
                return False
            if row is None:
                return True  # Complete list omission AND the fresh title check, including absent countries.
        if row is not None:
            return key.proof_identity in self.api_offers
        return key.country_code in (self.results or {})

    def source_time(self, key, row=None):
        if self.api_at is not None and self.api_supports(key, row):
            return self.api_at
        provider = self.verified.get(key.country_code) or {}
        return utc_ms(provider.get('updated_at'))

    def read(self, key, row=None):
        """Use the supporting source's day; scrape/copy fallbacks cannot establish exact days."""
        at = self.source_time(key, row)
        if at is None:
            at = self.copy_at
        consecutive = (self.fresh_current and self.fresh_prior and self.api_supports(key, row)
                       and utc_day(self.prior_at) == utc_day(at) - DAY)
        if self.list_read is not None:
            # A union list proves service membership, not changes between eligible
            # offer types while the title remains on that service.
            prefix = f'{key.country_code}:{key.streaming_service_id}:'
            consecutive = consecutive and (not self.list_read.previous_present if row is not None
                else not any(offer.startswith(prefix) for offer in self.api_offers))
        return at, consecutive


def select_transitions(titles, pending, media_type):
    transitions = []
    for title in titles:
        old_keys = {availability_key(row) for row in title.existing}
        added = {}
        for row in title.rows.values():
            key = availability_key(row)
            if key.streaming_type in OFFER_TYPES and key not in old_keys:
                added[key] = row
        removed_keys = (OfferKey(*key) for key in title.removed)
        removed = [key for key in removed_keys if key.streaming_type in OFFER_TYPES]
        if added or removed or f'{media_type}:{title.tmdb_id}' in pending:
            transitions.append(Transition(title, added, removed))
    return transitions


def prepare_markers(pending_store, identities, pending, check_owned):
    check_owned()
    if pending_store is not None:
        new_markers = [{'_id': identity} for identity in identities if identity not in pending]
        if new_markers:
            pending_store.insert_many(new_markers)


def title_writes(transition, previous, media_type, pending, copy_at):
    title, added, removed = transition.title, transition.added, transition.removed
    latest, opened, closed = {}, {}, {}
    for row in previous:
        key = availability_key(row)
        latest[key] = max(latest.get(key, 0), row['observed_at'])
        if row['dropped_on'] is None:
            opened[key] = row
        elif key not in closed or row['observed_at'] > closed[key]['observed_at']:
            closed[key] = row
    observation = Observation.from_title(title, copy_at)
    if f'{media_type}:{title.tmdb_id}' in pending:
        desired = {availability_key(row): row for row in title.rows.values()}
        # Only inferred repairs are stale-filtered. The live publisher's own
        # transitions can legitimately use scrape/copy times newer than its API.
        stale = {key for key, at in latest.items()
                 if observation.api_at is None or at > observation.api_at}
        # A retained offer cannot prove a return after any closed stay.
        added.update({key: row for key, row in desired.items()
                      if key.streaming_type in OFFER_TYPES and key not in opened and key not in stale
                      and (key not in closed or observation.api_supports(key, row)
                           or observation.verified.get(key.country_code))})
        removed = sorted(set(removed) | ((opened.keys() - desired.keys()) - stale))
    writes = []
    for key, row in added.items():
        at, consecutive = observation.read(key, row)
        exact = consecutive and key.proof_identity not in observation.prior_offers
        if key in opened:
            old = opened[key]
            if (title.list_read and exact and old['appeared_precision'] == 'unknown'
                    and old['appeared_on'] == utc_day(at)):
                writes.append(Stay(**(old | {'appeared_precision': 'exact', 'appeared_source': 'title',
                                            'appeared_after': utc_day(observation.prior_at)})))
            continue  # History committed before a failed offer write.
        prior_stay = closed.get(key)
        if (prior_stay and prior_stay['dropped_precision'] == 'exact'
                and (not observation.api_supports(key, row) or observation.api_at is None
                     or utc_day(observation.api_at) <= prior_stay['dropped_on'])):
            continue  # A stale title publisher cannot undo a later confirmed absence.
        collision = latest.get(key, -1) >= at
        if collision:
            at = latest[key] + 1
        today = utc_day(at)
        exact = exact and not collision
        premiere = None
        if (key not in latest and observation.source_time(key, row) is not None
                and not (title.list_read and title.list_read.previous_at is None)):
            premiere = premiere_day(title.details, media_type, key.streaming_service_id, today, key.country_code)
        appeared_after = (utc_day(observation.prior_at) if observation.fresh_prior
                          and key.proof_identity not in observation.prior_offers else None)
        writes.append(Stay(**key._asdict(), observed_at=at,
                           appeared_on=premiere if premiere is not None else today, last_seen_on=today,
                           appeared_source='premiere' if premiere is not None else 'title',
                           appeared_after=None if premiere is not None else appeared_after,
                           appeared_precision='exact' if exact or premiere is not None else 'unknown'))
    for key in removed:
        at, consecutive = observation.read(key)
        old = opened.get(key)
        if not old and title.list_read:
            candidate = closed.get(key)
            if candidate and candidate['dropped_on'] == utc_day(at) and candidate['dropped_precision'] == 'unknown':
                old = candidate
        if not old:
            continue
        today = utc_day(at)
        dropped_on = max(today, utc_day(old['observed_at']))
        exact = (consecutive and dropped_on == today and key.proof_identity in observation.prior_offers
                 and key.proof_identity not in observation.api_offers)
        last_seen = old.get('last_seen_on')
        if observation.fresh_prior and key.proof_identity in observation.prior_offers:
            last_seen = max(last_seen or 0, utc_day(observation.prior_at))
        writes.append(Stay(**(old | {'dropped_on': dropped_on,
                                    'dropped_precision': 'exact' if exact else 'unknown',
                                    'last_seen_on': last_seen})))
    return writes


def record_error(result, store, media_type, tmdb_id, error):
    message = f'{type(error).__name__}: {error}'
    result.errors[tmdb_id] = message
    if store is not None:
        store.update_one({'_id': f'{media_type}:{tmdb_id}'},
                         {'$set': {'error': message, 'failed_at': datetime.utcnow()}}, upsert=True)


def write_transitions(connector, writes_by_title, check_owned, result, store, media_type):
    """Keep the fast bulk path; isolate a bad title only after a bulk failure."""
    records = [row for rows in writes_by_title.values() for row in rows]
    if not records:
        return
    check_owned()
    try:
        connector.upsert_many(table='availability_history', records=records,
                              conflict_columns=PRIMARY_KEY, silent=True, replace_nulls=True)
        return
    except Exception:
        # Crate bulk errors can follow partial commits. Same primary keys make
        # these retries idempotent. Lease/marker failures remain infrastructure errors.
        pass
    for tmdb_id, rows in writes_by_title.items():
        if not rows:
            continue
        check_owned()
        try:
            connector.upsert_many(table='availability_history', records=rows,
                                  conflict_columns=PRIMARY_KEY, silent=True, replace_nulls=True)
        except Exception as error:
            record_error(result, store, media_type, tmdb_id, error)


def read_history(connector, media_type, titles):
    """List readers need only their scope; publishers reconcile the whole title."""
    sql = 'SELECT * FROM availability_history WHERE media_tmdb_id = ANY(?) AND media_type = ?'
    params = ([title.tmdb_id for title in titles], media_type)
    scopes = {(title.list_read.country_code, title.list_read.service_id) for title in titles if title.list_read}
    if len(scopes) == 1 and all(title.list_read for title in titles):
        sql += ' AND country_code = ? AND streaming_service_id = ?'
        params += next(iter(scopes))
    return connector.select(sql, params)


def publish_history(connector, media_type, titles, check_owned, pending_store=None, known_pending=None):
    """Prepare markers, plan stays, then bulk write before offers. Failed titles stay pending.

    The scheduled caller preloads pending IDs once per run, avoiding an extra
    Mongo lookup for every unchanged batch. Targeted callers read under the lease.
    No history SQL for unchanged offers; last_seen_on is transition evidence.
    """
    result = HistoryPublication()
    if not titles:
        return result
    pending = known_pending
    if pending is None:
        pending = {row['_id'] for row in pending_store.find(
            {'_id': {'$in': [f'{media_type}:{title.tmdb_id}' for title in titles]}})} if pending_store is not None else set()
    transitions = select_transitions(titles, pending, media_type)
    if not transitions:
        return result
    identities = [f'{media_type}:{transition.title.tmdb_id}' for transition in transitions]
    if known_pending is not None and pending_store is not None:
        # Another publisher may have failed after run selection. Re-read only
        # transitioning titles under their leases; unchanged batches do no lookup.
        pending = {row['_id'] for row in pending_store.find({'_id': {'$in': identities}})}
    prepare_markers(pending_store, identities, pending, check_owned)
    check_owned()
    connector.run('REFRESH TABLE availability_history')
    previous = read_history(connector, media_type, [transition.title for transition in transitions])
    previous_by_title = {}
    for row in previous:
        previous_by_title.setdefault(row['media_tmdb_id'], []).append(row)
    writes_by_title = {}
    copy_at = utc_ms(datetime.utcnow())
    for transition in transitions:
        tmdb_id = transition.title.tmdb_id
        try:
            writes_by_title[tmdb_id] = title_writes(transition, previous_by_title.get(tmdb_id, []), media_type, pending, copy_at)
        except (ValueError, TypeError, KeyError, AttributeError) as error:
            record_error(result, pending_store, media_type, tmdb_id, error)
    write_transitions(connector, writes_by_title, check_owned, result, pending_store, media_type)
    result.pending = [identity for identity in identities if int(identity.split(':')[1]) not in result.errors]
    return result


def acknowledge_history(pending_store, identities, check_owned):
    if identities:
        check_owned()
        pending_store.delete_many({'_id': {'$in': identities}})


def main():
    pass
