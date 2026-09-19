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


def capture_provider_check(details, tmdb_id, now):
    """Absent countries remain unknown. Bind proof to the exact stored payload."""
    if type(details.get("id")) is not int or details["id"] != tmdb_id:
        raise ValueError("TMDB response identity does not match requested media")
    payload = details.get("watch/providers")
    results = validated_results(payload)
    if results is None:
        return None
    return {"checked_at": utc_ms(now), "payload_hash": snapshot_id(payload), "countries": sorted(results)}


def main():
    pass
