"""Proof for provider payloads; title refresh time is never provider evidence."""
import hashlib
import json
from datetime import datetime, timezone

DAY = 86_400_000
HISTORY_OFFER_TYPES = ("flatrate", "free", "ads")

OFFER_TYPES = ("flatrate", "free", "ads", "rent", "buy")


def is_tmdb_deleted_response(response) -> bool:
    """Only TMDB's own 404 / status code 34 confirms a deleted title."""
    if response is None or response.status_code != 404:
        return False
    try:
        body = response.json()
    except ValueError:
        return False
    return isinstance(body, dict) and body.get('status_code') == 34


def utc_ms(value):
    if not isinstance(value, datetime):
        return None
    return int(value.replace(tzinfo=timezone.utc).timestamp() * 1000) if value.tzinfo is None else int(value.timestamp() * 1000)


def utc_day(value):
    if isinstance(value, (int, float)):
        return int(value) // DAY * DAY
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    millis = utc_ms(value)
    return None if millis is None else millis // DAY * DAY


def compact_proof(proof):
    return {key: proof[key] for key in ("checked_at", "cache_bypassed", "offers")}


def snapshot_id(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def validated_results(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), dict):
        return None
    for country, data in payload["results"].items():
        if not isinstance(country, str) or len(country) != 2 or not country.isascii() or not country.isalpha() or country != country.upper() or not isinstance(data, dict):
            return None
        if data.get("link") is not None and not isinstance(data["link"], str):
            return None
        for kind in OFFER_TYPES:
            offers = data.get(kind, [])
            if not isinstance(offers, list) or any(not isinstance(offer, dict) or type(offer.get("provider_id")) is not int or offer["provider_id"] <= 0 for offer in offers):
                return None
    return payload["results"]


def capture_provider_check(details, tmdb_id, now, *, previous=None, bypass_cache=False):
    """Absent countries remain unknown. Bind proof to the exact stored payload."""
    if type(details.get("id")) is not int or details["id"] != tmdb_id:
        raise ValueError("TMDB response identity does not match requested media")
    payload = details.get("watch/providers")
    results = validated_results(payload)
    if results is None:
        return None
    checked_at = utc_ms(now)
    proof = {"checked_at": checked_at, "payload_hash": snapshot_id(payload), "countries": sorted(results),
             "cache_bypassed": bypass_cache}
    if bypass_cache:
        proof["offers"] = sorted(
                 f"{country}:{offer['provider_id']}:{kind}" for country, data in results.items()
                 for kind in HISTORY_OFFER_TYPES for offer in data.get(kind, []))
    previous = previous or {}
    # Keep uncached evidence across ordinary cached queue reads. Two bounded
    # snapshots suffice: yesterday's read and (only when current is cached) the
    # latest uncached read. Neither changes the current read's freshness marker.
    candidates = [candidate for candidate in
                  (previous, previous.get("last_uncached", {}), previous.get("previous_day", {}))
                  if candidate.get("cache_bypassed") is True
                  and isinstance(candidate.get("offers"), list)
                  and isinstance(candidate.get("checked_at"), int)
                  and candidate["checked_at"] < checked_at]
    earlier_days = [candidate for candidate in candidates
                    if utc_day(candidate["checked_at"]) < utc_day(checked_at)]
    if earlier_days:
        prior = max(earlier_days, key=lambda candidate: candidate["checked_at"])
        proof["previous_day"] = compact_proof(prior)
    if not bypass_cache and candidates:
        latest = max(candidates, key=lambda candidate: candidate["checked_at"])
        proof["last_uncached"] = compact_proof(latest)
    return proof


def main():
    pass


def list_scope_checks(details):
    """A list-confirmed scope plus a newer fresh API read defeats old offers.

    This is service-scoped negative evidence, never an empty-country claim.
    A newer successful web scrape can supersede the API check normally.
    """
    scopes = details.get('watch_providers_list_scopes') or {}
    proof = details.get('watch_providers_check') or {}
    at = proof.get('checked_at')
    payload = details.get('watch_providers') or {}
    # Validate/hash the all-country payload once per reconciliation, not once
    # per offer. Large titles can have hundreds of country/service entries.
    results = validated_results(payload) if scopes else None
    fresh = (results is not None and proof.get('cache_bypassed') is True
             and isinstance(at, int) and proof.get('payload_hash') == snapshot_id(payload))
    offers = {(country, offer['provider_id'], kind) for country, data in (results or {}).items()
              for kind in HISTORY_OFFER_TYPES for offer in data.get(kind, [])} if fresh else set()

    checks = {}
    for identity, scope in scopes.items():
        if (not isinstance(scope, dict) or not isinstance(scope.get('checked_at'), int)
                or not isinstance(scope.get('kinds'), list)):
            continue
        try:
            country, service = identity.split('_')
            service_id = int(service)
        except (ValueError, TypeError):
            continue
        scope_at = scope['checked_at']
        for kind in HISTORY_OFFER_TYPES:
            if fresh and at >= scope_at:
                checks[(country, service_id, kind)] = (at, (country, service_id, kind) in offers)
            else:
                # Independent of mutable cached/failed details snapshots.
                checks[(country, service_id, kind)] = (scope_at, kind in scope['kinds'])
    return checks


def list_scope_checker(details):
    checks = list_scope_checks(details)
    def excludes(country, service_id, kind, source_at=None):
        check = checks.get((country, service_id, kind))
        return check is not None and not check[1] and (source_at is None or source_at <= check[0])
    return excludes


def list_scope_excludes(details, country, service_id, kind, source_at=None):
    return list_scope_checker(details)(country, service_id, kind, source_at)


def list_scope_conflicting_countries(details):
    """A cached/older API snapshot cannot undo a verified scoped membership."""
    checks = list_scope_checks(details)
    if not checks:
        return set()
    api = validated_results(details.get('watch_providers') or {}) or {}
    offers = {(country, offer['provider_id'], kind) for country, data in api.items()
              for kind in HISTORY_OFFER_TYPES for offer in data.get(kind, [])}
    return {country for (country, service, kind), (_, present) in checks.items()
            if present != ((country, service, kind) in offers)}
