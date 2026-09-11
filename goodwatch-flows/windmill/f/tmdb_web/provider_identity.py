"""Recover provider names from JustWatch context; its IDs are not TMDB IDs."""

import base64
import binascii
import json
import re
from typing import Any
from urllib.parse import parse_qs, urlsplit

ENVELOPE = "iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0"
CLICKOUT = "iglu:com.justwatch/clickout_context/jsonschema/"


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate context key")
        result[key] = value
    return result


def provider_name_from_url(url: str | None) -> str | None:
    """Absent metadata permits exact-name fallback; malformed metadata fails."""
    if not url:
        return None
    if len(url) > 16384:
        raise ValueError("Provider URL exceeds context size limit")
    try:
        parsed = urlsplit(url)
        if parsed.hostname != "click.justwatch.com":
            return None
        if (
            parsed.scheme != "https"
            or parsed.netloc != "click.justwatch.com"
            or parsed.path != "/a"
            or parsed.fragment
        ):
            raise ValueError("Invalid clickout URL identity")
        values = parse_qs(parsed.query, keep_blank_values=True, max_num_fields=32).get(
            "cx"
        )
        if values is None:
            return None
        if len(values) != 1 or not values[0]:
            raise ValueError("Ambiguous or empty clickout context")
        encoded = values[0]
        raw = base64.b64decode(
            encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True
        )
        envelope = json.loads(raw, object_pairs_hook=unique_object)
        if (
            not isinstance(envelope, dict)
            or envelope.get("schema") != ENVELOPE
            or not isinstance(envelope.get("data"), list)
        ):
            raise ValueError("Unrecognized clickout context envelope")
        identities = set()
        for context in envelope["data"]:
            if not isinstance(context, dict) or not isinstance(
                context.get("schema"), str
            ):
                raise ValueError("Malformed clickout context entry")
            schema = context["schema"]
            if not schema.startswith(CLICKOUT):
                continue
            if not re.fullmatch(re.escape(CLICKOUT) + r"1-\d+-\d+", schema):
                raise ValueError("Unsupported clickout context schema")
            data = context.get("data")
            if not isinstance(data, dict):
                raise ValueError("Missing clickout provider identity")
            name, vendor_id = data.get("provider"), data.get("providerId")
            if (
                not isinstance(name, str)
                or not name.strip()
                or len(name) > 256
                or type(vendor_id) is not int
                or vendor_id <= 0
            ):
                raise ValueError("Invalid clickout provider identity")
            identities.add((name, vendor_id))
        if len(identities) != 1:
            raise ValueError("Missing or conflicting clickout provider identities")
        return next(iter(identities))[0]
    except (
        ValueError,
        TypeError,
        KeyError,
        binascii.Error,
        UnicodeError,
        RecursionError,
    ):
        raise ValueError("Invalid JustWatch provider context") from None


def main() -> None:
    pass
