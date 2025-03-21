from datetime import datetime, timezone
from typing import Literal, Union, Dict, List
import os
import json
import subprocess
import re

from connect_db import init_postgres
from utils import slugify

BATCH_SIZE = 1000
SITEMAP_DIR = "../public/sitemaps/"
BASE_URL = {
    "movies": "https://goodwatch.app/movies/",
    "tv": "https://goodwatch.app/tv-shows/",
    "movie_detail": "https://goodwatch.app/movie/",
    "tv_detail": "https://goodwatch.app/tv/",
    "sitemaps": "https://goodwatch.app/sitemaps/",
}
FILTER_CONDITION = ("aggregated_overall_score_voting_count > 10000 "
                    "AND aggregated_overall_score_normalized_percent > 30 "
                    "AND release_year IS NOT NULL "
                    "AND poster_path IS NOT NULL")

# Navigation categories from TypeScript
MAIN_CATEGORIES = [
    "moods",
    "streaming",
    "action-combat",
    "crime-investigation",
    "romance-relationships",
    "sports-competition",
    "supernatural-monsters",
    "science-fiction-future",
    "cultural-regional",
    "historical-period",
    "genres"
]


def extract_subcategories_from_typescript(media_type: str, category: str) -> List[str]:
    """
    Extract subcategory paths from TypeScript files using regex.

    Args:
       category: The category name (e.g., "moods", "action-combat")
       media_type: Either "movies" or "tv-shows"

    Returns:
       List of subcategory paths that match the media type
    """
    try:
        # Convert kebab-case to camelCase for other categories
        parts = category.split('-')
        camel_case = parts[0] + ''.join(p.capitalize() for p in parts[1:])
        ts_file = f"../app/ui/explore/category/{camel_case}.ts"

        # Use grep to find paths in the TypeScript files
        result = subprocess.run(
            f"grep -E 'type:|path:' {ts_file}",
            shell=True,
            capture_output=True,
            text=True
        )

        # Extract paths using regex
        paths = []
        lines = result.stdout.splitlines()

        i = 0
        while i < len(lines):
            # Look for type line
            type_match = re.search(r'type:\s*"([^"]+)"', lines[i])

            if type_match:
                type_value = type_match.group(1)

                # Find the next path line
                path_line_index = -1
                for j in range(i + 1, min(i + 10, len(lines))):
                    if re.search(r'(?<!_)path:', lines[j]):
                        path_line_index = j
                        break

                if path_line_index != -1:
                    path_match = re.search(r'(?<!_)path:\s*"([^"]+)"', lines[path_line_index])
                    if path_match:
                        path_value = path_match.group(1)

                        # Only include if type is "all" or matches the media_type
                        media_type_normalized = "movies" if media_type == "movies" else "tv-shows"
                        if type_value == "all" or type_value == media_type_normalized:
                            paths.append(path_value)

            i += 1

        return paths
    except Exception as e:
        print(f"Error extracting subcategories for {category} ({media_type}): {e}")
        return []


def create_category_sitemaps():
    """Create sitemaps for category pages."""
    now = datetime.now(timezone.utc).date()
    sitemap_filename = "sitemap_categories.xml"
    sitemap_path = os.path.join(SITEMAP_DIR, sitemap_filename)

    with open(sitemap_path, "w") as sitemap_file:
        sitemap_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        sitemap_file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')

        url_count = 0

        # Add main category pages
        for media_type in ["movies", "tv-shows"]:
            for category in MAIN_CATEGORIES:
                sitemap_file.write("  <url>\n")
                sitemap_file.write(f"    <loc>https://goodwatch.app/{media_type}/{category}</loc>\n")
                sitemap_file.write(f"    <lastmod>{now}</lastmod>\n")
                sitemap_file.write(f"    <changefreq>weekly</changefreq>\n")
                sitemap_file.write("  </url>\n")
                url_count += 1

                # Add subcategory pages
                subcategories = extract_subcategories_from_typescript(media_type, category)
                for subcategory in subcategories:
                    sitemap_file.write("  <url>\n")
                    sitemap_file.write(f"    <loc>https://goodwatch.app/{media_type}/{category}/{subcategory}</loc>\n")
                    sitemap_file.write(f"    <lastmod>{now}</lastmod>\n")
                    sitemap_file.write(f"    <changefreq>weekly</changefreq>\n")
                    sitemap_file.write("  </url>\n")
                    url_count += 1

        sitemap_file.write('</urlset>\n')

    return {
        "category_url_count": url_count,
        "sitemap_filename": sitemap_filename
    }


def create_detail_sitemaps(pg, table_name: Union[Literal["movies"], Literal["tv"]]):
    """Create sitemaps for movie and TV show detail pages."""
    pg_cursor = pg.cursor()
    sitemaps = []
    batch_data = []
    now = datetime.now(timezone.utc).date()

    # Map table_name to the appropriate detail URL base
    detail_url_key = "movie_detail" if table_name == "movies" else "tv_detail"

    # Count with filter
    pg_cursor.execute(
        f"SELECT COUNT(*) FROM {table_name} WHERE {FILTER_CONDITION}"
    )
    total_count = pg_cursor.fetchone()[0]

    for offset in range(0, total_count, BATCH_SIZE):
        print(f"Fetching batch starting from {offset}")
        pg_cursor.execute(
            f"SELECT tmdb_id, title FROM {table_name} "
            f"WHERE {FILTER_CONDITION} "
            f"ORDER BY popularity ASC "
            f"LIMIT {BATCH_SIZE} OFFSET {offset}"
        )
        batch = pg_cursor.fetchall()
        batch_data.extend(batch)
        print(f"Selected {len(batch)} {table_name}")

        sitemap_filename = f"sitemap_{table_name}_detail_{offset}.xml"
        sitemap_path = os.path.join(SITEMAP_DIR, sitemap_filename)

        with open(sitemap_path, "w") as sitemap_file:
            sitemap_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            sitemap_file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
            for tmdb_id, title in batch:
                encoded_title = slugify(title) if title else ""
                sitemap_file.write("  <url>\n")
                sitemap_file.write(f"    <loc>{BASE_URL[detail_url_key]}{tmdb_id}-{encoded_title}</loc>\n")
                sitemap_file.write(f"    <lastmod>{now}</lastmod>\n")
                sitemap_file.write(f"    <changefreq>weekly</changefreq>\n")
                sitemap_file.write("  </url>\n")
            sitemap_file.write('</urlset>\n')

        sitemaps.append(sitemap_filename)
        print(f"Processed batch {offset//BATCH_SIZE + 1}")

    pg_cursor.close()

    # Create sitemap index for this table
    sitemap_index_filename = f"sitemap_index_{table_name}_detail.xml"
    sitemap_index_path = os.path.join(SITEMAP_DIR, sitemap_index_filename)
    with open(sitemap_index_path, "w") as index_file:
        index_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        index_file.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for sitemap in sitemaps:
            index_file.write("  <sitemap>\n")
            index_file.write(f"    <loc>{BASE_URL['sitemaps']}{sitemap}</loc>\n")
            index_file.write(f"    <lastmod>{now}</lastmod>\n")
            index_file.write("  </sitemap>\n")
        index_file.write('</sitemapindex>\n')

    return {
        "total_sitemap_count": len(sitemaps),
        "total_url_count": len(batch_data),
    }


def create_landing_sitemaps():
    """Create sitemaps for main landing pages."""
    now = datetime.now(timezone.utc).date()
    static_routes = [
        "/", "/movies", "/tv-shows", "/discover",
        "/sign-in", "/how-it-works", "/about", "/disclaimer", "/privacy"
    ]
    sitemap_filename = "sitemap_static.xml"
    sitemap_path = os.path.join(SITEMAP_DIR, sitemap_filename)
    with open(sitemap_path, "w") as sitemap_file:
        sitemap_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        sitemap_file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for route in static_routes:
            sitemap_file.write("  <url>\n")
            sitemap_file.write(f"    <loc>https://goodwatch.app{route}</loc>\n")
            sitemap_file.write(f"    <lastmod>{now}</lastmod>\n")
            sitemap_file.write("  </url>\n")
        sitemap_file.write('</urlset>\n')
    return {
        "static_url_count": len(static_routes),
    }


def create_master_sitemap_index():
    """Create a master sitemap index that links to all other sitemap files."""
    now = datetime.now(timezone.utc).date()
    sitemap_files = []

    # Add static sitemap
    sitemap_files.append("sitemap_static.xml")

    # Add category sitemap
    sitemap_files.append("sitemap_categories.xml")

    # Add detail page indexes
    sitemap_files.append("sitemap_index_movies_detail.xml")
    sitemap_files.append("sitemap_index_tv_detail.xml")

    # Create master index
    master_index_filename = "sitemap.xml"
    master_index_path = os.path.join(SITEMAP_DIR, master_index_filename)

    with open(master_index_path, "w") as index_file:
        index_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        index_file.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for sitemap in sitemap_files:
            index_file.write("  <sitemap>\n")
            index_file.write(f"    <loc>{BASE_URL['sitemaps']}{sitemap}</loc>\n")
            index_file.write(f"    <lastmod>{now}</lastmod>\n")
            index_file.write("  </sitemap>\n")
        index_file.write('</sitemapindex>\n')

    return {
        "master_index_created": True,
        "sitemap_count": len(sitemap_files)
    }


if __name__ == "__main__":
    pg = init_postgres()

    # Ensure the sitemap directory exists
    os.makedirs(SITEMAP_DIR, exist_ok=True)

    # Generate sitemaps for movie detail pages
    movies_result = create_detail_sitemaps(pg, table_name="movies")
    print(f"Movies Detail Sitemap Result: {movies_result}")

    # Generate sitemaps for TV detail pages
    tv_result = create_detail_sitemaps(pg, table_name="tv")
    print(f"TV Detail Sitemap Result: {tv_result}")

    # Generate sitemap for categories and subcategories
    category_result = create_category_sitemaps()
    print(f"Category Sitemap Result: {category_result}")

    # Generate sitemap for static navigation
    static_result = create_landing_sitemaps()
    print(f"Static Sitemap Result: {static_result}")

    # Create master sitemap index
    master_result = create_master_sitemap_index()
    print(f"Master Sitemap Index Result: {master_result}")

    pg.close()