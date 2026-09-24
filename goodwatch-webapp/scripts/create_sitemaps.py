from datetime import date, datetime, timezone
from typing import Literal, List, Optional
from xml.sax.saxutils import escape
import glob
import os
import re
from crate import client
from dotenv import load_dotenv

from utils import title_to_dashed

load_dotenv()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SITEMAP_DIR = os.path.join(SCRIPT_DIR, "../public/sitemaps/")
CATEGORY_DIR = os.path.join(SCRIPT_DIR, "../app/ui/explore/category/")
BASE_URL = "https://goodwatch.app"

# A small site gets little crawl budget, so the sitemap lists only the titles
# most likely to be searched. Raise these once Google indexes most of them.
TITLE_LIMIT = {
    "movie": 700,
    "show": 300,
}
FILTER_CONDITION = ("goodwatch_overall_score_voting_count > 5000 "
                    "AND goodwatch_overall_score_normalized_percent > 30 "
                    "AND release_year IS NOT NULL "
                    "AND poster_path IS NOT NULL")

# Must match mainHierarchy in app/ui/explore/main-nav.ts
MAIN_CATEGORIES = [
    "moods",
    "streaming",
    "genres"
]

# Only pages with search value. Auth and quiz pages are left out on purpose.
STATIC_ROUTES = [
    "/", "/movies", "/shows", "/discover", "/how-it-works", "/about", "/disclaimer", "/privacy"
]


def url_entry(loc: str, lastmod: Optional[date] = None) -> str:
    entry = f"  <url>\n    <loc>{escape(loc)}</loc>\n"
    if lastmod:
        entry += f"    <lastmod>{lastmod.isoformat()}</lastmod>\n"
    return entry + "  </url>\n"


def write_urlset(filename: str, entries: List[str]):
    with open(os.path.join(SITEMAP_DIR, filename), "w", encoding="utf-8") as sitemap_file:
        sitemap_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        sitemap_file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        sitemap_file.writelines(entries)
        sitemap_file.write('</urlset>\n')


def write_sitemap_index(filename: str, sitemaps: List[tuple]):
    """sitemaps: (filename, lastmod or None) pairs."""
    with open(os.path.join(SITEMAP_DIR, filename), "w", encoding="utf-8") as index_file:
        index_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        index_file.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for sitemap, lastmod in sitemaps:
            index_file.write("  <sitemap>\n")
            index_file.write(f"    <loc>{BASE_URL}/sitemaps/{sitemap}</loc>\n")
            if lastmod:
                index_file.write(f"    <lastmod>{lastmod.isoformat()}</lastmod>\n")
            index_file.write("  </sitemap>\n")
        index_file.write('</sitemapindex>\n')


def strip_comments(source: str) -> str:
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.DOTALL)
    return "\n".join(line for line in source.splitlines() if not line.lstrip().startswith("//"))


def extract_subcategories_from_typescript(media_type: str, category: str) -> List[str]:
    """
    Extract subcategory paths from the TypeScript category file.

    Args:
       media_type: Either "movies" or "shows"
       category: The category name (e.g., "moods", "streaming")

    Returns:
       List of subcategory paths that match the media type
    """
    parts = category.split('-')
    camel_case = parts[0] + ''.join(p.capitalize() for p in parts[1:])
    with open(os.path.join(CATEGORY_DIR, f"{camel_case}.ts"), encoding="utf-8") as ts_file:
        lines = [line for line in strip_comments(ts_file.read()).splitlines()
                 if re.search(r'type:|(?<!_)path:', line)]

    paths = []
    for i, line in enumerate(lines):
        type_match = re.search(r'type:\s*"([^"]+)"', line)
        if not type_match:
            continue
        type_value = type_match.group(1)

        # The path belongs to this type if it follows before the next type
        for next_line in lines[i + 1:i + 10]:
            if re.search(r'type:\s*"', next_line):
                break
            path_match = re.search(r'(?<!_)path:\s*"([^"]+)"', next_line)
            if path_match:
                if type_value in ("all", media_type):
                    paths.append(path_match.group(1))
                break

    if not paths:
        raise ValueError(f"No subcategories found for {category} ({media_type}), check the parser")
    return paths


def create_category_sitemaps():
    """Create sitemaps for category pages."""
    sitemap_filename = "sitemap_categories.xml"
    entries = []

    for media_type in ["movies", "shows"]:
        for category in MAIN_CATEGORIES:
            entries.append(url_entry(f"{BASE_URL}/{media_type}/{category}"))
            for subcategory in extract_subcategories_from_typescript(media_type, category):
                entries.append(url_entry(f"{BASE_URL}/{media_type}/{category}/{subcategory}"))

    write_urlset(sitemap_filename, entries)
    return {
        "category_url_count": len(entries),
        "sitemap_filename": sitemap_filename
    }


def latest_date(*timestamps) -> Optional[date]:
    """CrateDB returns timestamps as epoch milliseconds."""
    values = [t for t in timestamps if t is not None]
    if not values:
        return None
    return datetime.fromtimestamp(max(values) / 1000, tz=timezone.utc).date()


def create_detail_sitemaps(crate_cursor, table_name: Literal["movie", "show"]):
    """Create sitemaps for the most popular movie and show detail pages."""
    # lastmod reflects changes to what the page shows: TMDB details and the fingerprint.
    crate_cursor.execute(
        f"SELECT tmdb_id, title, original_title, tmdb_details_updated_at, dna_updated_at "
        f"FROM {table_name} "
        f"WHERE {FILTER_CONDITION} "
        f"ORDER BY popularity DESC, tmdb_id ASC "
        f"LIMIT {TITLE_LIMIT[table_name]}"
    )
    rows = crate_cursor.fetchall()

    entries = []
    lastmods = []
    for tmdb_id, title, original_title, details_updated_at, dna_updated_at in rows:
        # Same slug as the canonical URL in app/routes/{movie,show}.$key.tsx
        slug = title_to_dashed(title or original_title or "")
        lastmod = latest_date(details_updated_at, dna_updated_at)
        entries.append(url_entry(f"{BASE_URL}/{table_name}/{tmdb_id}-{slug}", lastmod))
        if lastmod:
            lastmods.append(lastmod)

    # Filenames stay stable because Search Console has them submitted
    sitemap_filename = f"sitemap_{table_name}_detail_0.xml"
    write_urlset(sitemap_filename, entries)
    index_lastmod = max(lastmods) if lastmods else None
    write_sitemap_index(f"sitemap_index_{table_name}_detail.xml", [(sitemap_filename, index_lastmod)])

    return {
        "total_url_count": len(entries),
        "lastmod": index_lastmod,
    }


def create_landing_sitemaps():
    """Create sitemaps for main landing pages."""
    entries = [url_entry(f"{BASE_URL}{route}") for route in STATIC_ROUTES]
    write_urlset("sitemap_static.xml", entries)
    return {
        "static_url_count": len(entries),
    }


def create_master_sitemap_index(detail_lastmods: dict):
    """Create a master sitemap index that links to all other sitemap files."""
    sitemap_files = [
        ("sitemap_static.xml", None),
        ("sitemap_categories.xml", None),
        ("sitemap_index_movie_detail.xml", detail_lastmods["movie"]),
        ("sitemap_index_show_detail.xml", detail_lastmods["show"]),
    ]
    write_sitemap_index("sitemap.xml", sitemap_files)
    return {
        "master_index_created": True,
        "sitemap_count": len(sitemap_files)
    }


def remove_old_sitemaps():
    """Remove generated files so that sitemaps from earlier, larger runs don't linger."""
    for path in glob.glob(os.path.join(SITEMAP_DIR, "sitemap*.xml")):
        os.remove(path)


def init_crate():
    """Initialize CrateDB connection."""
    print("Initializing CrateDB...")
    hosts = os.getenv("CRATE_HOSTS", "").split(",")
    port = os.getenv("CRATE_PORT", "4200")
    user = os.getenv("CRATE_USER", "")
    password = os.getenv("CRATE_PASS", "")

    if not hosts or not hosts[0]:
        raise ValueError("CRATE_HOSTS environment variable is not set")

    connection_string = f"http://{user}:{password}@{hosts[0]}:{port}"
    connection = client.connect(connection_string)
    print("Successfully initialized CrateDB")
    return connection


if __name__ == "__main__":
    crate_connection = init_crate()
    crate_cursor = crate_connection.cursor()

    os.makedirs(SITEMAP_DIR, exist_ok=True)
    remove_old_sitemaps()

    # Generate sitemaps for movie detail pages
    movies_result = create_detail_sitemaps(crate_cursor, table_name="movie")
    print(f"Movies Detail Sitemap Result: {movies_result}")

    # Generate sitemaps for show detail pages
    show_result = create_detail_sitemaps(crate_cursor, table_name="show")
    print(f"Show Detail Sitemap Result: {show_result}")

    # Generate sitemap for categories and subcategories
    category_result = create_category_sitemaps()
    print(f"Category Sitemap Result: {category_result}")

    # Generate sitemap for static navigation
    static_result = create_landing_sitemaps()
    print(f"Static Sitemap Result: {static_result}")

    # Create master sitemap index
    master_result = create_master_sitemap_index({
        "movie": movies_result["lastmod"],
        "show": show_result["lastmod"],
    })
    print(f"Master Sitemap Index Result: {master_result}")

    crate_cursor.close()
    crate_connection.close()
