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
