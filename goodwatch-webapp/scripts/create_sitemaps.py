from datetime import datetime, timezone
from typing import Literal, Union
import os

from connect_db import init_postgres
from utils import slugify

BATCH_SIZE = 50000
SITEMAP_DIR = "../public/sitemaps/"
BASE_URL = {
    "movies": "https://goodwatch.app/movie/",
    "tv": "https://goodwatch.app/tv/",
    "sitemaps": "https://goodwatch.app/sitemaps/",
}


def create_sitemaps(pg, table_name: Union[Literal["movies"], Literal["tv"]]):
    pg_cursor = pg.cursor()

    # sitemap indexing
    sitemaps = []
    batch_data = []
    now = datetime.now(timezone.utc).date()

    # Fetch total count of movie/tv ids
    pg_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    total_count = pg_cursor.fetchone()[0]

    for offset in range(0, total_count, BATCH_SIZE):
        print(f"Fetching batch starting from {offset}")
        pg_cursor.execute(f"SELECT tmdb_id, title FROM {table_name} ORDER BY tmdb_id LIMIT {BATCH_SIZE} OFFSET {offset}")
        batch = pg_cursor.fetchall()

        batch_data.extend(batch)
        print(f"Selected {len(batch)} {table_name}")

        # Generate sitemap for this batch
        sitemap_filename = f"sitemap_{table_name}_{offset}.xml"
        sitemap_path = os.path.join(SITEMAP_DIR, sitemap_filename)

        with open(sitemap_path, "w") as sitemap_file:
            sitemap_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            sitemap_file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')

            for tmdb_id, title in batch:
                # Ensure title is URL-safe
                encoded_title = slugify(title) if title else ""
                sitemap_file.write(f"  <url>\n")
                sitemap_file.write(f"    <loc>{BASE_URL[table_name]}{tmdb_id}-{encoded_title}</loc>\n")
                sitemap_file.write(f"    <lastmod>{now}</lastmod>\n")
                # sitemap_file.write(f"    <changefreq>weekly</changefreq>\n")
                sitemap_file.write(f"  </url>\n")

            sitemap_file.write('</urlset>\n')

        # Add the file to sitemap index array
        sitemaps.append(sitemap_filename)

        print(f"Processed batch {offset//BATCH_SIZE + 1}")

    pg_cursor.close()

    # Generate a unique sitemap index file based on table_name
    sitemap_index_filename = f"sitemap_index_{table_name}.xml"
    sitemap_index_path = os.path.join(SITEMAP_DIR, sitemap_index_filename)

    with open(sitemap_index_path, "w") as index_file:
        index_file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        index_file.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')

        for sitemap in sitemaps:
            index_file.write(f"  <sitemap>\n")
            index_file.write(f"    <loc>{BASE_URL['sitemaps']}{sitemap}</loc>\n")
            index_file.write(f"    <lastmod>{now}</lastmod>\n")
            index_file.write(f"  </sitemap>\n")

        index_file.write('</sitemapindex>\n')

    return {
        "total_sitemap_count": len(sitemaps),
        "total_url_count": len(batch_data),
    }

if __name__ == "__main__":
    pg = init_postgres()

    # Generate sitemaps for movies
    movies_result = create_sitemaps(pg, table_name="movies")
    print(f"Movies Sitemap Result: {movies_result}")

    # Generate sitemaps for tv
    tv_result = create_sitemaps(pg, table_name="tv")
    print(f"TV Sitemap Result: {tv_result}")

    pg.close()
