"""Store the titles members wait for, so the details queue rechecks their offers on a short cycle.

docs/awaited-title-rechecks.md. A title is awaited when a member who has a country and
at least one saved streaming service has it as Want to See, or has the show as Watching
or On hold. Run every hour. It reads Crate and writes only the Mongo list; when the read
fails the list stays as it was and the queue keeps working from it.
"""
from datetime import datetime

from mongoengine import get_db

from f.db.cratedb import CrateConnector
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_api.awaited_titles import Title, store_list

# Each listed title costs one TMDB request per cycle. A list this long is no longer
# "small against the crawl", so the job stops and leaves the decision to the owner.
MAX_TITLES = 10000

# Members with a country and at least one saved service. One statement per member table:
# Crate 5.10 rejects a UNION of the two under these joins ("Cannot cast value `show` to type `integer`").
MEMBER_WITH_SERVICES = """
JOIN user_setting c ON c.user_id = a.user_id AND c.key = 'country_default' AND c.value <> ''
JOIN user_setting s ON s.user_id = a.user_id AND s.key = 'streaming_providers_default' AND s.value <> ''
"""
SELECT_WANT_TO_SEE = f"SELECT DISTINCT a.media_type, a.tmdb_id FROM user_wishlist a {MEMBER_WITH_SERVICES} LIMIT ?"
SELECT_SHOWS_IN_PROGRESS = (
    f"SELECT DISTINCT a.media_type, a.tmdb_id FROM user_watch_state a {MEMBER_WITH_SERVICES} "
    "WHERE a.media_type = 'show' AND a.state IN ('watching', 'on_hold') LIMIT ?"
)


def read_awaited_titles(crate) -> list[Title]:
    """Each awaited title once. Reads at most MAX_TITLES + 1 rows per table."""
    titles = set()
    for sql in (SELECT_WANT_TO_SEE, SELECT_SHOWS_IN_PROGRESS):
        titles.update((row["media_type"], int(row["tmdb_id"])) for row in crate.select(sql, (MAX_TITLES + 1,)))
    return sorted(titles)


def refresh(crate, db, now: datetime) -> dict:
    titles = read_awaited_titles(crate)
    if len(titles) > MAX_TITLES:
        raise RuntimeError(
            f"Members wait for more than {MAX_TITLES} titles; the stored list was kept. "
            "Decide on the request budget before raising MAX_TITLES."
        )
    return store_list(db, titles, now)


def main():
    crate = CrateConnector()
    try:
        init_mongodb()
        try:
            return refresh(crate, get_db(), datetime.utcnow())
        finally:
            close_mongodb()
    finally:
        crate.disconnect()
