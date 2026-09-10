import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

import wmill

WARMUP_URL = "https://goodwatch.app/api/internal/homepage-warmup"
EXPECTED_IDENTITIES = ["movie/27205", "show/2316", "movie/129", "show/1396"]


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(
        self, req: Request, fp: Any, code: int, msg: str,
        headers: Any, newurl: str,
    ) -> None:
        return None


def main() -> dict[str, Any]:
    secret = wmill.get_variable("f/utils/homepage_warmup_secret")
    if not isinstance(secret, str) or len(secret) < 32:
        raise RuntimeError("Homepage warmup secret is not configured")
    request = Request(
        WARMUP_URL,
        method="POST",
        headers={"Authorization": f"Bearer {secret}", "Accept": "application/json"},
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=330) as response:
            result = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Homepage warmup failed: HTTP {error.code}") from None
    except (URLError, TimeoutError, ValueError):
        raise RuntimeError("Homepage warmup request failed") from None
    if (
        not isinstance(result, dict)
        or result.get("status") != "refreshed"
        or result.get("country") != "DE"
        or result.get("language") != "en"
        or result.get("item_count") != 4
        or result.get("identities") != EXPECTED_IDENTITIES
        or result.get("write_verified") is not True
        or result.get("ttl_seconds") != 86400
        or not isinstance(result.get("computed_at"), str)
    ):
        raise RuntimeError("Homepage warmup did not confirm complete cache population")
    return result
