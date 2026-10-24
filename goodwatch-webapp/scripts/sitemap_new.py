"""The "New on your services" pages for sitemap_new.xml (#489 Part C, docs/implementation/new-on-services/README.md).

A page lists the titles first seen on a service in a country within its window: today and the 13 days before (UTC),
never before the launch of Newly available. An empty page answers noindex, so only pages with titles are listed:
/new/<country>/<service> for each brand with titles in the country, and /new/<country> when one of them has.

The count here is the page's candidates: titles with a live open stay (not a backfill) first seen in the window. The
page then applies the continuity rules (a title already on the brand's other tier is not new), which can leave some
out. MIN_TITLES keeps a margin, so that a listed page still has titles when the live check reads it; the Windmill flow
(f/seo/regenerate_sitemaps.py) leaves out a /new page that fails the check instead of failing the whole publish.

The brands come from app/domain/new-on-services-brands.json, the list the pages use."""
import json
import os
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Tuple

BASE_URL = "https://goodwatch.app"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BRANDS_FILE = os.path.join(SCRIPT_DIR, "../app/domain/new-on-services-brands.json")
# LAUNCH in app/server/availability-first-seen.server.ts: the first day an arrival counts.
LAUNCH = date(2026, 10, 12)
# WINDOW_DAYS in app/domain/new-on-services.ts (LANDED_DAYS of Newly available).
WINDOW_DAYS = 14
MIN_TITLES = 3
# LANDED_DAY in app/server/availability-first-seen.server.ts.
LANDED_DAY = "CASE WHEN appeared_precision = 'exact' THEN appeared_on ELSE date_trunc('day', observed_at) END"


def read_brands(path: str = BRANDS_FILE) -> List[dict]:
    with open(path, encoding="utf-8") as brands_file:
        brands = json.load(brands_file)
    for brand in brands:
        if not brand.get("slug") or not brand.get("ids") or not all(isinstance(i, int) for i in brand["ids"]):
            raise ValueError(f"Bad brand in {path}: {brand}")
    return brands


def window_start(today: date) -> date:
    return max(LAUNCH, today - timedelta(days=WINDOW_DAYS - 1))


def epoch_ms(day: date) -> int:
    return int(datetime(day.year, day.month, day.day, tzinfo=timezone.utc).timestamp() * 1000)


def counts_query(brands: List[dict]) -> str:
    case = " ".join(f"WHEN streaming_service_id IN ({', '.join(str(i) for i in b['ids'])}) THEN '{b['slug']}'"
                    for b in brands)
    ids = ", ".join(str(i) for b in brands for i in b["ids"])
    return (
        f"SELECT country_code, brand, count(*), max(landed) FROM ("
        f"SELECT country_code, CASE {case} END AS brand, media_type, media_tmdb_id, max({LANDED_DAY}) AS landed "
        f"FROM doc.availability_history "
        f"WHERE streaming_type IN ('flatrate', 'free', 'ads') AND streaming_service_id IN ({ids}) "
        f"AND dropped_on IS NULL AND appeared_source <> 'backfill' AND ({LANDED_DAY}) >= ? "
        f"GROUP BY 1, 2, 3, 4) arrivals GROUP BY 1, 2 LIMIT 100000"
    )


def select_new_pages(cursor, today: Optional[date] = None,
                     brands: Optional[List[dict]] = None) -> List[Tuple[str, Optional[date]]]:
    """(URL, lastmod) pairs, sorted. lastmod is the day of the page's latest arrival."""
    today = today or datetime.now(timezone.utc).date()
    brands = brands if brands is not None else read_brands()
    slugs = {b["slug"] for b in brands}
    # The pages answer 404 for a country the site doesn't know (app/server/countries.server.ts).
    cursor.execute("SELECT country_code FROM doc.country")
    known = {row[0] for row in cursor.fetchall()}
    cursor.execute(counts_query(brands), [epoch_ms(window_start(today))])
    pages = {}
    for country, slug, titles, latest in cursor.fetchall():
        if country not in known or slug not in slugs or titles < MIN_TITLES:
            continue
        day = datetime.fromtimestamp(latest / 1000, timezone.utc).date() if isinstance(latest, (int, float)) else None
        code = country.lower()
        pages[f"{BASE_URL}/new/{code}/{slug}"] = day
        country_url = f"{BASE_URL}/new/{code}"
        previous = pages.get(country_url)
        pages[country_url] = max(d for d in (previous, day) if d) if (previous or day) else None
    return sorted(pages.items())
