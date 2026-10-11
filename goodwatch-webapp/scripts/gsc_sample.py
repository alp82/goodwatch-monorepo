# /// script
# dependencies = ["google-auth", "requests", "python-dotenv"]
# ///
"""Weekly record of Google's view of a fixed sample of goodwatch.app URLs.

Each run appends to three files in docs/research/discovery-search/:
    index-record.csv           one row per sample URL from the URL Inspection API
    index-record-traffic.csv   impressions and clicks per URL shape, last 7 complete days
    index-record-sitemaps.csv  one row per submitted sitemap

Needs GSC_KEY_FILE like gsc.py. Run by hand once a week:
    uv run gsc_sample.py            (or: make index-record)
    uv run gsc_sample.py --force    (append a second run for the same date)

See docs/research/discovery-search/index-record.md.
"""
import csv
import datetime
import os
import sys
import time
import urllib.parse

RECORD_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "research", "discovery-search")
)
SAMPLE_FILE = os.path.join(RECORD_DIR, "index-sample.csv")
INDEX_FILE = os.path.join(RECORD_DIR, "index-record.csv")
TRAFFIC_FILE = os.path.join(RECORD_DIR, "index-record-traffic.csv")
SITEMAPS_FILE = os.path.join(RECORD_DIR, "index-record-sitemaps.csv")

SAMPLE_SIZE = 50
INSPECTION_FIELDS = [
    "verdict",
    "coverageState",
    "indexingState",
    "pageFetchState",
    "robotsTxtState",
    "lastCrawlTime",
    "googleCanonical",
    "userCanonical",
]
INDEX_COLUMNS = ["run_date", "kind", "url", *INSPECTION_FIELDS]
SHAPES = ["start", "title_movie", "title_show", "person", "category_hub", "other"]
TRAFFIC_COLUMNS = ["run_date", "startDate", "endDate", "shape", "pages", "impressions", "clicks"]
SITEMAP_COLUMNS = ["run_date", "path", "lastSubmitted", "lastDownloaded", "isPending", "errors", "warnings"]

# Search Analytics data arrives two to three days late.
TRAFFIC_LAG_DAYS = 3
TRAFFIC_WINDOW_DAYS = 7
QUERY_ROW_LIMIT = 25000
SLEEP_BETWEEN_INSPECTIONS = 0.5
RETRY_WAIT = 10

CANONICAL_HOST = "goodwatch.app"
HUB_PATHS = {"/movies", "/shows", "/discover", "/explorer"}


def url_shape(url):
    """The URL shape a page counts under in the traffic record."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.netloc != CANONICAL_HOST:
        return "other"
    path = parts.path.rstrip("/") or "/"
    if path == "/":
        return "start"
    if path.startswith("/movie/"):
        return "title_movie"
    if path.startswith("/show/"):
        return "title_show"
    if path.startswith("/person/"):
        return "person"
    if path in HUB_PATHS or path.startswith(("/movies/", "/shows/")):
        return "category_hub"
    return "other"


def traffic_window(run_date):
    """Start and end date of the last 7 days that Search Analytics has complete."""
    end = run_date - datetime.timedelta(days=TRAFFIC_LAG_DAYS)
    start = end - datetime.timedelta(days=TRAFFIC_WINDOW_DAYS - 1)
    return start, end


def index_row(run_date, kind, url, inspection):
    result = inspection.get("inspectionResult", {}).get("indexStatusResult", {})
    return {"run_date": run_date.isoformat(), "kind": kind, "url": url} | {
        field: result.get(field, "") for field in INSPECTION_FIELDS
    }


def traffic_rows(run_date, start, end, page_rows):
    totals = {shape: {"pages": 0, "impressions": 0, "clicks": 0} for shape in SHAPES}
    for row in page_rows:
        total = totals[url_shape(row["keys"][0])]
        total["pages"] += 1
        total["impressions"] += row.get("impressions", 0)
        total["clicks"] += row.get("clicks", 0)
    return [
        {"run_date": run_date.isoformat(), "startDate": start.isoformat(), "endDate": end.isoformat(), "shape": shape}
        | totals[shape]
        for shape in SHAPES
    ]


def sitemap_rows(run_date, sitemaps):
    return [
        {
            "run_date": run_date.isoformat(),
            "path": sitemap.get("path", ""),
            "lastSubmitted": sitemap.get("lastSubmitted", ""),
            "lastDownloaded": sitemap.get("lastDownloaded", ""),
            "isPending": sitemap.get("isPending", ""),
            "errors": sitemap.get("errors", ""),
            "warnings": sitemap.get("warnings", ""),
        }
        for sitemap in sitemaps.get("sitemap", [])
    ]


def read_sample(path=SAMPLE_FILE):
    with open(path, newline="") as file:
        sample = [(row["kind"], row["url"]) for row in csv.DictReader(file)]
    if len(sample) != SAMPLE_SIZE or len({url for _, url in sample}) != SAMPLE_SIZE:
        raise SystemExit(f"{path} must list exactly {SAMPLE_SIZE} different URLs, found {len(sample)} rows")
    return sample


def recorded_dates(path):
    if not os.path.exists(path):
        return set()
    with open(path, newline="") as file:
        return {row["run_date"] for row in csv.DictReader(file)}


def already_recorded(run_date, paths):
    """The files that already hold a run for this date."""
    return [path for path in paths if run_date.isoformat() in recorded_dates(path)]


def append_rows(path, columns, rows):
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    with open(path, "a", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns, lineterminator="\n")
        if is_new:
            writer.writeheader()
        writer.writerows(rows)


def with_one_retry(call, wait=RETRY_WAIT, sleep=time.sleep):
    """Run call, and once more after a wait when the API answers 429 or 5xx."""
    try:
        return call()
    except Exception as error:
        status = getattr(getattr(error, "response", None), "status_code", None)
        if status is None or not (status == 429 or 500 <= status < 600):
            raise
        sleep(wait)
        return call()


def fetch_page_rows(gsc, site, start, end):
    rows = []
    while True:
        body = {
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dimensions": ["page"],
            "rowLimit": QUERY_ROW_LIMIT,
            "startRow": len(rows),
        }
        batch = with_one_retry(
            lambda: gsc.request("POST", f"{gsc.BASE}/sites/{site}/searchAnalytics/query", body)
        ).get("rows", [])
        rows += batch
        if len(batch) < QUERY_ROW_LIMIT:
            return rows


def main():
    import gsc

    args = sys.argv[1:]
    if set(args) - {"--force"}:
        raise SystemExit(__doc__)
    run_date = datetime.date.today()
    files = [INDEX_FILE, TRAFFIC_FILE, SITEMAPS_FILE]
    recorded = already_recorded(run_date, files)
    if recorded and "--force" not in args:
        names = ", ".join(os.path.basename(path) for path in recorded)
        raise SystemExit(f"{run_date} is already recorded in {names}. Pass --force to append a second run.")

    sample = read_sample()
    site = urllib.parse.quote(gsc.SITE, safe="")

    sitemaps = with_one_retry(lambda: gsc.request("GET", f"{gsc.BASE}/sites/{site}/sitemaps"))
    start, end = traffic_window(run_date)
    page_rows = fetch_page_rows(gsc, site, start, end)

    index_rows = []
    for number, (kind, url) in enumerate(sample, 1):
        body = {"inspectionUrl": url, "siteUrl": gsc.SITE}
        inspection = with_one_retry(lambda: gsc.request("POST", gsc.INSPECT, body))
        row = index_row(run_date, kind, url, inspection)
        index_rows.append(row)
        print(f"{number:2}/{len(sample)} {row['coverageState']:40} {url}", file=sys.stderr)
        time.sleep(SLEEP_BETWEEN_INSPECTIONS)

    # Everything is fetched before the first write, so a failed run leaves no partial record.
    append_rows(INDEX_FILE, INDEX_COLUMNS, index_rows)
    append_rows(TRAFFIC_FILE, TRAFFIC_COLUMNS, traffic_rows(run_date, start, end, page_rows))
    append_rows(SITEMAPS_FILE, SITEMAP_COLUMNS, sitemap_rows(run_date, sitemaps))
    print(
        f"Recorded {run_date}: {len(index_rows)} URLs, traffic {start} to {end}, "
        f"{len(sitemaps.get('sitemap', []))} sitemaps"
    )


if __name__ == "__main__":
    main()
