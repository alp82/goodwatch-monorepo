import requests
import wmill

from f.db.arango import ArangoConnector
from f.main_db.config.graph import COLLECTIONS
from f.main_db.models.arango import Country
from f.main_db.models.tmdb import TMDBCountryItem, TMDBCountriesResponse

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
            _key=country.iso_3166_1,
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

    connector = ArangoConnector()
    countries_collection = connector.db.collection(COLLECTIONS["countries"])
    upsert_result = connector.upsert_many(
        collection=countries_collection,
        documents=countries,
    )

    connector.close()
    return upsert_result

    
