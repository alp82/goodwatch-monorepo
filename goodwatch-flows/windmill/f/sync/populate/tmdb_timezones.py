import requests
import wmill

from f.sync.models.crate_models import Timezone
from f.sync.models.tmdb_models import TMDBTimezoneItem, TMDBTimezonesResponse
from f.db.cratedb import CrateConnector

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

    connector = CrateConnector()
    upsert_affected_rows = connector.upsert_many(
        table="timezone",
        records=timezones,
        conflict_columns=["country_code"],
    )
    connector.disconnect()

    return {
        "affected_rows": upsert_affected_rows,
    }
