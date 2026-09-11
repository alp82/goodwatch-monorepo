"""Provider identity is recovered from validated clickout context, never casing."""

import base64
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_web.provider_identity import provider_name_from_url


def clickout_url(name: str, vendor_id: int = 84, extra: list | None = None) -> str:
    contexts = [
        {
            "schema": "iglu:com.justwatch/clickout_context/jsonschema/1-3-2",
            "data": {"provider": name, "providerId": vendor_id},
        }
    ]
    envelope = {
        "schema": "iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0",
        "data": contexts + (extra or []),
    }
    encoded = (
        base64.urlsafe_b64encode(json.dumps(envelope).encode()).decode().rstrip("=")
    )
    return "https://click.justwatch.com/a?cx=" + encoded


class ProviderIdentityTests(unittest.TestCase):
    def test_duplicate_json_keys_cannot_override_provider_identity(self) -> None:
        raw = '{"schema":"iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0","data":[{"schema":"iglu:com.justwatch/clickout_context/jsonschema/1-3-2","data":{"provider":"Other","provider":"Example","providerId":84}}]}'
        url = (
            "https://click.justwatch.com/a?cx="
            + base64.urlsafe_b64encode(raw.encode()).decode()
        )
        with self.assertRaises(ValueError):
            provider_name_from_url(url)

    def test_absent_metadata_allows_legacy_exact_name_fallback(self) -> None:
        for url in [
            None,
            "https://provider.example/watch",
            "https://click.justwatch.com/a?r=watch",
        ]:
            self.assertIsNone(provider_name_from_url(url))
        self.assertIsNone(
            provider_name_from_url(
                "https://click.justwatch.com.evil.example/a?cx=invalid"
            )
        )

    def test_malformed_ambiguous_and_missing_provider_contexts_fail(self) -> None:
        second = {
            "schema": "iglu:com.justwatch/clickout_context/jsonschema/1-3-2",
            "data": {"provider": "Other", "providerId": 9},
        }
        missing_id = {
            "schema": "iglu:com.justwatch/clickout_context/jsonschema/1-3-2",
            "data": {"provider": "Example"},
        }
        urls = [
            clickout_url("Example") + "&cx=other",
            "https://click.justwatch.com/a?cx=bad!",
            clickout_url("Example", 0),
            clickout_url("", 84),
            clickout_url("Example", True),
            clickout_url("Example", extra=[second]),
            clickout_url("Example", extra=[missing_id]),
            clickout_url("Example").replace("https:", "http:"),
            clickout_url("Example").replace("/a?", "/other?"),
            "https://click.justwatch.com/a?cx=" + "a" * 20000,
        ]
        for url in urls:
            with self.subTest(url_length=len(url)):
                with self.assertRaises(ValueError):
                    provider_name_from_url(url)

    def test_returns_full_name_without_confusing_vendor_id_with_tmdb_id(self) -> None:
        self.assertEqual(
            provider_name_from_url(clickout_url("HBO Max on U-Next", 2284)),
            "HBO Max on U-Next",
        )
        self.assertEqual(
            provider_name_from_url(clickout_url("Disney Plus", 2706)), "Disney Plus"
        )


if __name__ == "__main__":
    unittest.main()
