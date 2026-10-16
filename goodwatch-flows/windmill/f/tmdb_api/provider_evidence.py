"""Proof for provider payloads; title refresh time is never provider evidence."""
import hashlib
import json
from datetime import datetime, timezone

OFFER_TYPES = ("flatrate", "free", "ads", "rent", "buy")


def utc_ms(value):
    if not isinstance(value, datetime):
        return None
    return int(value.replace(tzinfo=timezone.utc).timestamp() * 1000) if value.tzinfo is None else int(value.timestamp() * 1000)


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
             "cache_bypassed": bypass_cache, "offers": sorted(
                 f"{country}:{offer['provider_id']}:{kind}" for country, data in results.items()
                 for kind in OFFER_TYPES for offer in data.get(kind, []))}
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
                    if candidate["checked_at"] // 86400000 < checked_at // 86400000]
    if earlier_days:
        prior = max(earlier_days, key=lambda candidate: candidate["checked_at"])
        proof["previous_day"] = {key: prior[key] for key in ("checked_at", "cache_bypassed", "offers")}
    if not bypass_cache and candidates:
        latest = max(candidates, key=lambda candidate: candidate["checked_at"])
        proof["last_uncached"] = {key: latest[key] for key in ("checked_at", "cache_bypassed", "offers")}
    return proof


def main():
    pass
