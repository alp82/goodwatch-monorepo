import requests
import wmill

from f.sync.models.crate_models import Country
from f.sync.models.tmdb_models import TMDBCountryItem, TMDBCountriesResponse
from f.db.cratedb import CrateConnector

TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


def fetch_countries() -> TMDBCountriesResponse:
    url = (
        "https://api.themoviedb.org/3/configuration/countries"
        f"?api_key={TMDB_API_KEY}"
        "&language=en-US"
    )
    response = requests.get(url).json()
    return TMDBCountriesResponse(response)


def process_countries(countries: list[TMDBCountryItem]):
    print(f"Processing countries...")

    countries_docs: list[Country] = []
    for country in countries:
        document = Country(
            country_code=country.iso_3166_1,
            english_name=country.english_name,
        )
        countries_docs.append(document)
    
    print(f"Prepared {len(countries_docs)} country documents.")
    return countries_docs



def main():
    print("Fetching countries...")
    tmdb_countries = fetch_countries()
    countries: list[Country] = process_countries(tmdb_countries.root)

    connector = CrateConnector()
    upsert_affected_rows = connector.upsert_many(
        table="country",
        records=countries,
        conflict_columns=["country_code"],
    )
    connector.disconnect()

    return {
        "affected_rows": upsert_affected_rows,
    }
   
