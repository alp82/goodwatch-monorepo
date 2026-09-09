from datetime import datetime
from typing import Literal

import requests
import wmill

from f.db.postgres import init_postgres, generate_upsert_query

TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


MediaType = Literal['movie'] | Literal['tv']

def fetch_watch_providers(media_type: MediaType) -> dict:
    url = (
        f"https://api.themoviedb.org/3/watch/providers/{media_type}"
        f"?api_key={TMDB_API_KEY}"
    )
    return requests.get(url).json()


def save_results(pg_cursor, results: dict, media_type: MediaType):
    providers = []
    for result in results:
        providers.append((result["provider_id"], result["provider_name"], result["logo_path"], datetime.now()))
        
    provider_query = """
    INSERT INTO streaming_provider (id, name, logo_path, updated_at)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, logo_path = EXCLUDED.logo_path, updated_at = EXCLUDED.updated_at;
    """
    pg_cursor.executemany(provider_query, providers)

    for result in results:
        provider_rank_query = """
        INSERT INTO streaming_provider_rank (streaming_provider_id, media_type, country, rank, updated_at)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (streaming_provider_id, media_type, country) DO UPDATE
        SET rank = EXCLUDED.rank, updated_at = EXCLUDED.updated_at;
        """
        provider_ranks = [
            (result["provider_id"], media_type, country, rank, datetime.now())
            for country, rank in result['display_priorities'].items()
        ]
        pg_cursor.executemany(provider_rank_query, provider_ranks)

        print(f"Saved {media_type} provider {result['provider_name']} with {len(result['display_priorities'])} countries")


def save_all_providers(movie_watch_providers: dict, tv_watch_providers: dict):
    pg = init_postgres()
    pg_cursor = pg.cursor()
    
    pg_cursor.execute("BEGIN")

    save_results(
        pg_cursor,
        movie_watch_providers["results"],
        "movie"
    )
    save_results(
        pg_cursor,
        tv_watch_providers["results"],
        "tv"
    )

    pg.commit()
    pg_cursor.close()
    pg.close()


def main():
    movie_watch_providers = fetch_watch_providers("movie")
    tv_watch_providers = fetch_watch_providers("tv")

    save_all_providers(
        movie_watch_providers=movie_watch_providers,
        tv_watch_providers=tv_watch_providers,
    )

    return {
        "movie": movie_watch_providers,
        "tv": tv_watch_providers,
    }
