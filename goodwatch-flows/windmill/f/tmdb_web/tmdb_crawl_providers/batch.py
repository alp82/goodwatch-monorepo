# requirements:
# beautifulsoup4==4.15.0
# httpx==0.28.1
# h2==4.3.0
# mongoengine==0.29.3
# pymongo==4.18.1
# pydantic==2.13.5
# requests==2.34.2
# wmill==1.815.0
"""One HTTP/2 connection pool per bounded batch, on a randomly chosen worker."""
import httpx
from mongoengine import get_db
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.tmdb_crawl_providers.fetch import fetch_one


def main(entries: list[dict], publication_enabled: bool = False, shadow_selection: bool = True) -> list[dict]:
    if len(entries) > 20:
        raise ValueError("At most 20 root pages per batch")
    if shadow_selection:
        return [{**entry, "outcome": "selected_shadow"} for entry in entries]
    init_mongodb()
    try:
        with httpx.Client(http2=True) as client:
            return [fetch_one(get_db(), entry, client=client, publication_enabled=publication_enabled) for entry in entries]
    finally:
        close_mongodb()
