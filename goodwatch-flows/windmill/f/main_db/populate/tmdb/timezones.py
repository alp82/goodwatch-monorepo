import requests
import wmill

from f.db.arango import ArangoConnector
from f.main_db.config.graph import COLLECTIONS
from f.main_db.models.arango import Timezone
from f.main_db.models.tmdb import TMDBTimezoneItem, TMDBTimezonesResponse

TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


def fetch_timezones() -> TMDBTimezonesResponse:
    url = (
        "https://api.themoviedb.org/3/configuration/timezones"
        f"?api_key={TMDB_API_KEY}"
    )
    response = requests.get(url).json()
    return TMDBTimezonesResponse(response)


def process_timezones(timezones: list[TMDBTimezoneItem]):
    print(f"Processing {type} timezones...")

    timezones_docs: list[Timezone] = []
    for timezone in timezones:
        document = Timezone(
            _key=timezone.iso_3166_1,
            country_code=timezone.iso_3166_1,
            zones=timezone.zones,
        )
        timezones_docs.append(document)
    
    print(f"Prepared {len(timezones_docs)} {type} timezone documents.")
    return timezones_docs



def main():
    print("Fetching timezones...")
    tmdb_timezones = fetch_timezones()
    
    timezones: list[Timezone] = process_timezones(tmdb_timezones.root)

    connector = ArangoConnector()
    timezones_collection = connector.db.collection(COLLECTIONS["timezones"])
    upsert_result = connector.upsert_many(
        collection=timezones_collection,
        documents=timezones,
    )

    connector.close()
    return upsert_result

    
