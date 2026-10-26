# requirements:
# beautifulsoup4==4.15.0
# httpx==0.28.1
# h2==4.3.0
# mongoengine==0.29.3
# pymongo==4.18.1
# pydantic==2.13.5
# requests==2.34.2
# wmill==1.815.0
"""At most one explicitly requested Niger root canary in a UTC calendar month."""
from datetime import datetime
import httpx
from mongoengine import get_db
from pymongo.errors import DuplicateKeyError
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.tmdb_crawl_providers.fetch import fetch_one


def main(dry_run: bool = True) -> dict:
    init_mongodb()
    try:
        db = get_db()
        for media in ('movie', 'tv'):
            row = db[f'tmdb_{media}_providers'].find_one(
                {'country_code':'NE', 'tmdb_deleted':{'$ne':True}}, sort=[('updated_at',1),('_id',1)])
            if row is not None:
                entry={'id':str(row['_id']),'type':media,'tier':'unsupported_probe'}
                if dry_run:
                    return {**entry,'outcome':'selected_shadow'}
                try:
                    db.tmdb_streaming_upstream.insert_one({'_id':'NE_canary:'+datetime.utcnow().strftime('%Y-%m')})
                except DuplicateKeyError:
                    return {'outcome':'monthly_budget'}
                with httpx.Client(http2=True) as client:
                    return fetch_one(db, entry, client=client, publication_enabled=False)
        return {'outcome':'no_candidate'}
    finally:
        close_mongodb()
