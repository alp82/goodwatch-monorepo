"""Writes the sitemap files. How and when to run it: docs/sitemap.md.
  uv run create_sitemaps.py [--output-dir <directory>]"""
from datetime import date
from typing import Literal, List, Optional
from xml.sax.saxutils import escape
import argparse
import glob
import os
import re
from crate import client
from dotenv import load_dotenv

from sitemap_blog import blog_urls, read_blog_posts
from sitemap_crate import connect_args
from sitemap_lastmod import SitemapHistory, title_lastmod
from sitemap_query import detail_query
from sitemap_selection import select_titles, state_comment
from sitemap_people import select_people
from sitemap_profiles import select_profiles
from sitemap_new import select_new_pages
from utils import title_to_dashed

load_dotenv()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Where the files are written. --output-dir replaces it, so that a run can be checked before it is published.
SITEMAP_DIR = os.path.join(SCRIPT_DIR, "../public/sitemaps/")
PREVIOUS_SITEMAPS = None


def prepare_sitemaps(previous_dir):
    global PREVIOUS_SITEMAPS
    PREVIOUS_SITEMAPS = SitemapHistory(previous_dir)


CATEGORY_DIR = os.path.join(SCRIPT_DIR, "../app/ui/explore/category/")
# The published blog posts, with the dates that sitemap_static.xml gives their URLs.
BLOG_POSTS = os.path.join(SCRIPT_DIR, "../app/content/blog/posts.json")
BASE_URL = "https://goodwatch.app"

# Must match mainHierarchy in app/ui/explore/main-nav.ts
MAIN_CATEGORIES = [
    "moods",
    "streaming",
    "genres"
]

# Only canonical public pages. Search is noindex; Taste may redirect guests to
# the quiz. The best-of lists list only their first page; later pages are linked from it. Auth, quiz, /living-room (301), and TV-state URLs are left out.
STATIC_ROUTES = [
    "/", "/movies", "/movies/best", "/shows", "/shows/best", "/people", "/discover", "/explorer", "/how-it-works",
    "/about", "/disclaimer", "/privacy", "/support", "/use-with-ai",
    "/discord"
]


def url_entry(loc: str, lastmod: Optional[date] = None) -> str:
    entry = f"  <url>\n    <loc>{escape(loc)}</loc>\n"
    if lastmod:
        entry += f"    <lastmod>{lastmod.isoformat()}</lastmod>\n"
    return entry + "  </url>\n"


def write_urlset(filename: str, entries: List[str], selection=None):
    with open(os.path.join(SITEMAP_DIR, filename), "w", encoding="utf-8") as sitemap_file:
        sitemap_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        sitemap_file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        if selection is not None:
            sitemap_file.write(state_comment(selection))
        sitemap_file.writelines(entries)
        sitemap_file.write('</urlset>\n')
    with open(os.path.join(SITEMAP_DIR, filename), 'rb') as generated:
        return PREVIOUS_SITEMAPS.lastmod(filename, generated.read())


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

    lastmod = write_urlset(sitemap_filename, entries)
    return {
        "lastmod": lastmod,
        "category_url_count": len(entries),
        "sitemap_filename": sitemap_filename
    }


def create_detail_sitemaps(crate_cursor, table_name: Literal["movie", "show"]):
    """Create the stable core and attention title cohorts."""
    # Which titles are listed, and why: see sitemap_query.py.
    crate_cursor.execute(detail_query(table_name))
    sitemap_filename = f"sitemap_{table_name}_detail_0.xml"
    rows, selection = select_titles(crate_cursor.fetchall(), table_name,
                                    PREVIOUS_SITEMAPS.files.get(sitemap_filename))

    entries = []
    for tmdb_id, title, original_title, details_updated_at, dna_updated_at, votes, popularity in rows:
        # Same slug as the canonical URL in app/routes/movie.$movieKey.tsx and show.$showKey.tsx
        slug = title_to_dashed(title or original_title or "")
        lastmod = title_lastmod(dna_updated_at)
        entries.append(url_entry(f"{BASE_URL}/{table_name}/{tmdb_id}-{slug}", lastmod))

    # Filenames stay stable because Search Console has them submitted
    sitemap_filename = f"sitemap_{table_name}_detail_0.xml"
    index_lastmod = write_urlset(sitemap_filename, entries, selection)
    write_sitemap_index(f"sitemap_index_{table_name}_detail.xml", [(sitemap_filename, index_lastmod)])

    return {
        "total_url_count": len(entries),
        "title_ids": [r[0] for r in rows],
        "lastmod": index_lastmod,
    }


def create_landing_sitemaps():
    """Create sitemaps for main landing pages, then the blog index and its posts."""
    # Landing pages stay undated. Blog URLs carry the posts' updated dates, see docs/sitemap.md.
    entries = [url_entry(f"{BASE_URL}{route}") for route in STATIC_ROUTES]
    posts = read_blog_posts(BLOG_POSTS, PREVIOUS_SITEMAPS.today)
    entries += [url_entry(loc, lastmod) for loc, lastmod in blog_urls(BASE_URL, posts)]
    lastmod = write_urlset("sitemap_static.xml", entries)
    return {
        "static_url_count": len(entries),
        "blog_post_count": len(posts),
        "lastmod": lastmod,
    }


def create_person_sitemap(crate_cursor, title_ids):
    filename = "sitemap_people.xml"
    people = select_people(crate_cursor, title_ids, PREVIOUS_SITEMAPS.files.get(filename))
    lastmod = write_urlset(filename, [url_entry(p["url"]) for p in people])
    return {"total_url_count": len(people), "lastmod": lastmod, "people": people}


def create_profile_sitemap(crate_cursor):
    """Members' public profiles that are indexed (sitemap_profiles.py)."""
    return write_profile_sitemap(select_profiles(crate_cursor))


def write_profile_sitemap(profiles, skip=frozenset()):
    """Writes sitemap_profiles.xml from (URL, lastmod) pairs, leaving out the URLs in `skip` (profiles that failed the
    live check: a member changed their settings or scores since the list was read). An empty URL set fails the live
    check, so no profiles means no file (and no entry in the index)."""
    filename = "sitemap_profiles.xml"
    kept = [(loc, day) for loc, day in profiles if loc not in skip]
    path = os.path.join(SITEMAP_DIR, filename)
    if not kept:
        if os.path.exists(path):
            os.remove(path)
        return {"total_url_count": 0, "lastmod": None, "profiles": kept}
    lastmod = write_urlset(filename, [url_entry(loc, day) for loc, day in kept])
    return {"total_url_count": len(kept), "lastmod": lastmod, "profiles": kept}


def create_new_sitemap(fetch=None):
    """The "New on your services" pages that have titles, as the site's pages index lists them (sitemap_new.py)."""
    return write_new_sitemap(select_new_pages(fetch))


def write_new_sitemap(pages, skip=frozenset()):
    """Writes sitemap_new.xml from (URL, lastmod) pairs, leaving out the URLs in `skip` (pages that failed the live
    check: their titles aged out of the window since the list was read). No page means no file, as for profiles."""
    filename = "sitemap_new.xml"
    kept = [(loc, day) for loc, day in pages if loc not in skip]
    path = os.path.join(SITEMAP_DIR, filename)
    if not kept:
        if os.path.exists(path):
            os.remove(path)
        return {"total_url_count": 0, "lastmod": None, "pages": kept}
    lastmod = write_urlset(filename, [url_entry(loc, day) for loc, day in kept])
    return {"total_url_count": len(kept), "lastmod": lastmod, "pages": kept}


def create_master_sitemap_index(file_lastmods: dict):
    """Create a master sitemap index that links to all other sitemap files."""
    # Link to URL sets directly: Google does not support nested sitemap indexes.
    # Keep the legacy detail indexes for their existing Search Console submissions.
    sitemap_files = [
        ("sitemap_static.xml", file_lastmods["static"]),
        ("sitemap_categories.xml", file_lastmods["categories"]),
        ("sitemap_movie_detail_0.xml", file_lastmods["movie"]),
        ("sitemap_show_detail_0.xml", file_lastmods["show"]),
        ("sitemap_people.xml", file_lastmods["people"]),
    ]
    # Listed only when this run wrote it: no profiles qualify, or a caller that doesn't make them yet.
    if file_lastmods.get("profiles"):
        sitemap_files.append(("sitemap_profiles.xml", file_lastmods["profiles"]))
    if file_lastmods.get("new"):
        sitemap_files.append(("sitemap_new.xml", file_lastmods["new"]))
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
    servers, credentials = connect_args(os.environ)
    connection = client.connect(servers, **credentials)
    print("Successfully initialized CrateDB")
    return connection


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Write the sitemap files.")
    parser.add_argument("--output-dir", default=SITEMAP_DIR,
                        help="directory for the files (default: public/sitemaps); its sitemap*.xml are replaced")
    parser.add_argument("--previous-dir", default=SITEMAP_DIR,
                        help="previous sitemap files (default: public/sitemaps, even with --output-dir)")
    args = parser.parse_args()
    prepare_sitemaps(args.previous_dir)
    SITEMAP_DIR = os.path.abspath(args.output_dir)
    print(f"Writing sitemaps to {SITEMAP_DIR}")

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

    people_result = create_person_sitemap(crate_cursor, {
        "movie": movies_result["title_ids"], "show": show_result["title_ids"],
    })
    print(f"People Sitemap Result: {people_result}")

    profiles_result = create_profile_sitemap(crate_cursor)
    print(f"Profiles Sitemap Result: {profiles_result}")

    new_result = create_new_sitemap()
    print(f"New on services Sitemap Result: {new_result['total_url_count']} URLs")

    # Create master sitemap index
    master_result = create_master_sitemap_index({
        "movie": movies_result["lastmod"],
        "show": show_result["lastmod"],
        "static": static_result["lastmod"],
        "categories": category_result["lastmod"],
        "people": people_result["lastmod"],
        "profiles": profiles_result["lastmod"],
        "new": new_result["lastmod"],
    })
    print(f"Master Sitemap Index Result: {master_result}")

    crate_cursor.close()
    crate_connection.close()
