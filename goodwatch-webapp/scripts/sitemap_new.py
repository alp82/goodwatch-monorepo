"""The "New on your services" pages for sitemap_new.xml (#489 Part C, docs/implementation/new-on-services/README.md).

The site itself says which pages have titles: /api/new-on-services/pages lists each page with its count and its latest
arrival day, from the same rule and the same data as the pages and the links between them. So a page listed here has
titles when it is generated, by the `make sitemaps` path too, and this file restates none of the rules (window, launch
day, backfill, continuity, adult titles).

The sitemap lists only the bigger pages (owner, 2026-10-25): at least MIN_TITLES titles, and at most MAX_URLS pages,
the ones with the most titles when more qualify (ties by path, so a run is stable). Every other page stays indexable;
it is only not listed. The live check can still find a page that emptied since it was read (its titles aged out at
midnight); the Windmill flow (f/seo/regenerate_sitemaps.py) leaves such a page out instead of failing the whole
publish.

An index that fails (the site answers an error when a country's read failed), names failures, or lists no page raises
ValueError: the Windmill flow then keeps the previous sitemap_new.xml instead of publishing a shorter or empty one."""
import json
import re
from datetime import date, datetime, timezone
from typing import Callable, List, Optional, Tuple
from urllib.request import Request, urlopen

BASE_URL = "https://goodwatch.app"
PAGES_INDEX = f"{BASE_URL}/api/new-on-services/pages"
MIN_TITLES = 20
MAX_URLS = 300
PAGE_PATH = re.compile(r"^/new/[a-z]{2}(/[a-z0-9]+(-[a-z0-9]+)*)?$")
# Building every country's counts takes a few seconds when the site's cache is cold.
TIMEOUT_SECONDS = 120


def fetch_index(url: str = PAGES_INDEX) -> bytes:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "goodwatch-sitemaps"})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return response.read()


def select_new_pages(fetch: Optional[Callable[[str], bytes]] = None) -> List[Tuple[str, Optional[date]]]:
    """(URL, lastmod) pairs, sorted: the pages with at least MIN_TITLES titles, at most MAX_URLS of them. lastmod is
    the day of the page's latest arrival."""
    raw = (fetch or fetch_index)(PAGES_INDEX)
    try:
        index = json.loads(raw)
        pages = index["pages"]
    except (ValueError, KeyError, TypeError):
        raise ValueError(f"{PAGES_INDEX} did not answer with the pages index") from None
    # The site answers an error for an incomplete index (a country's read failed); an index that names failures or
    # lists no page at all is refused the same way, so the caller keeps its last sitemap_new.xml.
    if index.get("failed") or not isinstance(pages, list) or not pages:
        raise ValueError(f"{PAGES_INDEX} answered an incomplete or empty pages index")
    picked = []
    for page in pages:
        path, titles, latest = page.get("path"), page.get("titles"), page.get("latest")
        if not isinstance(path, str) or not PAGE_PATH.match(path):
            continue
        if not isinstance(titles, int) or isinstance(titles, bool) or titles < MIN_TITLES:
            continue
        day = datetime.fromtimestamp(latest / 1000, timezone.utc).date() if isinstance(latest, (int, float)) else None
        picked.append((titles, path, day))
    # The most titles first, ties by path; then the kept pages in the sitemap's own order.
    picked.sort(key=lambda page: (-page[0], page[1]))
    return sorted((f"{BASE_URL}{path}", day) for _, path, day in picked[:MAX_URLS])
