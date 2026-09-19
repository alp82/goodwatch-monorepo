"""Atomic country envelopes containing independent source checks and contributions."""
import json
from f.tmdb_api.provider_evidence import OFFER_TYPES, snapshot_id, utc_ms, validated_results
from f.tmdb_web.provider_identity import provider_name_from_url


def build_evidence(tmdb_id, media_type, details, providers, rows, verified, resolver, catalog, prior_countries=()):
    api_payload = details.get("watch_providers") or {}
    api = validated_results(api_payload) or {}
    proof = details.get("watch_providers_check") or {}
    proof_valid = proof.get("payload_hash") == snapshot_id(api_payload)
    by_country = {p["country_code"]: p for p in providers if p.get("country_code")}
    countries = set(prior_countries) | set(by_country) | set(api) | {row["country_code"] for row in rows.values()}
    result = []
    for country in sorted(countries):
        if len(country) != 2 or country != country.upper():
            continue
        provider = by_country.get(country, {})
        pending = provider.get("identity_repair_pending") or provider.get("country_identity_error")
        checks = []
        for source in ("tmdb_web", "tmdb_api"):
            offers = []
            checked = utc_ms(provider.get("updated_at")) if source == "tmdb_web" else proof.get("checked_at") if proof_valid and country in proof.get("countries", []) else None
            reason = None
            if pending:
                reason = "identity_pending"
            if source == "tmdb_web":
                if provider.get("consecutive_failures"):
                    reason = reason or "failed"
                elif not provider.get("updated_at"):
                    reason = reason or "missing"
                elif verified.get(country) is not provider:
                    reason = reason or "mapping_incomplete"
                elif not isinstance(provider.get("streaming_links"), list):
                    reason = reason or "invalid"
                links = provider.get("streaming_links")
                for offer in links if isinstance(links, list) else []:
                    if not isinstance(offer, dict):
                        reason = reason or "invalid"
                        continue
                    try:
                        name = provider_name_from_url(offer.get("stream_url")) or offer.get("provider_name")
                        service = resolver(name, country, offer.get("stream_type"), catalog, api)
                    except (ValueError, TypeError):
                        reason = reason or "invalid"
                        continue
                    if service is None or offer.get("stream_type") not in OFFER_TYPES:
                        reason = reason or "mapping_incomplete"
                        continue
                    offers.append({"service_id": service, "offer_type": offer["stream_type"],
                                   "stream_url": offer.get("stream_url"), "price_dollar": offer.get("price_dollar"), "quality": offer.get("quality")})
            else:
                if country not in api or checked is None:
                    reason = reason or "missing"
                if details.get("watch_providers_error"):
                    reason = reason or "failed"
                ids = {row["tmdb_id"] for values in catalog.values() for row in values}
                for kind in OFFER_TYPES:
                    for offer in api.get(country, {}).get(kind, []):
                        if offer["provider_id"] not in ids:
                            reason = reason or "mapping_incomplete"
                        offers.append({"service_id": offer["provider_id"], "offer_type": kind, "tmdb_link": api[country].get("link")})
            if checked is None:
                reason = reason or "missing"
            snapshot = snapshot_id({"media_type": media_type, "media_tmdb_id": tmdb_id, "country": country,
                                    "source": source, "checked_at": checked, "offers": offers})
            attempts = [value for value in (checked, utc_ms(provider.get("failed_at")) if source == "tmdb_web" else utc_ms(details.get("watch_providers_attempted_at"))) if value is not None]
            checks.append({"source": source, "snapshot_id": snapshot, "checked_at": checked,
                           "last_attempt_at": max(attempts) if attempts else None,
                           "state": "unknown" if reason else "usable", "reason": reason,
                           "offer_types": list(OFFER_TYPES), "mapping_complete": reason not in ("mapping_incomplete", "identity_pending", "invalid", "missing"),
                           "offers": [offer | {"snapshot_id": snapshot} for offer in offers]})
        # Unattributed published legacy rows cannot establish a negative.
        legacy = any(row["country_code"] == country and not any(row.get(field) is not None for field in
                     ("tmdb_link", "display_priority", "stream_url", "price_dollar", "quality")) for row in rows.values())
        # Retained rows whose source payload is absent must also block a negative.
        retained = any(row["country_code"] == country and (
            ((row.get("tmdb_link") is not None or row.get("display_priority") is not None) and country not in api) or
            (any(row.get(f) is not None for f in ("stream_url", "price_dollar", "quality")) and not provider)
        ) for row in rows.values())
        envelope = {"version": 1, "media_tmdb_id": tmdb_id, "media_type": media_type, "country_code": country,
                    "checks": checks, "unknown_contributions": legacy or retained or any(not p.get("country_code") for p in providers)}
        result.append(dict(media_tmdb_id=tmdb_id, media_type=media_type, country_code=country,
                           payload=json.dumps(envelope, sort_keys=True, allow_nan=False)))
    return result


def quarantine_evidence(records):
    result = []
    for row in records:
        try:
            envelope = json.loads(row["payload"])
            for check in envelope["checks"]:
                check.update(state="unknown", reason="identity_quarantined", mapping_complete=False)
            envelope["unknown_contributions"] = True
        except (ValueError, KeyError, TypeError):
            envelope = {}  # Corrupt legacy evidence remains unreadable/unknown.
        result.append({key: row[key] for key in ("media_tmdb_id", "media_type", "country_code")} |
                      {"payload": json.dumps(envelope, sort_keys=True, allow_nan=False)})
    return result


def main():
    pass
