"""Writes the sitemap files. How and when to run it: docs/sitemap.md.
  uv run create_sitemaps.py [--output-dir <directory>]"""
from datetime import date
from typing import Literal, List, Optional
from xml.sax.saxutils import escape
import argparse
import glob
import os
from crate import client
from dotenv import load_dotenv

from sitemap_blog import blog_urls, read_blog_posts
from sitemap_crate import connect_args
from sitemap_lastmod import SitemapHistory, title_lastmod
from sitemap_query import detail_query
from sitemap_selection import select_titles, state_comment
from sitemap_people import select_people
from sitemap_profiles import PROFILES_IN_SITEMAP, select_profiles
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


# The published blog posts, with the dates that sitemap_static.xml gives their URLs.
BLOG_POSTS = os.path.join(SCRIPT_DIR, "../app/content/blog/posts.json")
BASE_URL = "https://goodwatch.app"

# The Browse pages (moods, genres, decades, countries, tropes, streaming, and the two-part blends with a full page) are
# listed by the webapp itself, from the title snapshot it has loaded: /sitemaps/sitemap_browse.xml
# (app/server/browse/sitemap.server.ts). It's never a file here, so a file can't shadow it.
BROWSE_SITEMAP = "sitemap_browse.xml"

# Only canonical public pages. Search is noindex; Taste may redirect guests to
# the quiz. The Top lists list only their first page; later pages are linked from it. The awards hub stands for
# the awards pages: a body's ceremonies are published by a density check, so they are linked from it, not listed. Auth, quiz, /living-room (301), and TV-state URLs are left out.
STATIC_ROUTES = [
    "/", "/movies", "/movies/top", "/shows", "/shows/top", "/people", "/awards", "/discover",
    "/map", "/hot", "/how-it-works",
    "/about", "/stats", "/disclaimer", "/privacy", "/support", "/use-with-ai",
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
    kept = [(loc, day) for loc, day in profiles if loc not in skip] if PROFILES_IN_SITEMAP else []
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
        (BROWSE_SITEMAP, None),
        ("sitemap_movie_detail_0.xml", file_lastmods["movie"]),
        ("sitemap_show_detail_0.xml", file_lastmods["show"]),
        ("sitemap_people.xml", file_lastmods["people"]),
    ]
    # Also guard callers with stale profile results (including the weekly Windmill wrapper).
    if PROFILES_IN_SITEMAP and file_lastmods.get("profiles"):
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
        "people": people_result["lastmod"],
        "profiles": profiles_result["lastmod"],
        "new": new_result["lastmod"],
    })
    print(f"Master Sitemap Index Result: {master_result}")

    crate_cursor.close()
    crate_connection.close()
