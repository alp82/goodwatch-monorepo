import requests
import wmill

from f.db.arango import ArangoConnector
from f.main_db.config.graph import COLLECTIONS
from f.main_db.models.arango import Language
from f.main_db.models.tmdb import TMDBLanguageItem, TMDBLanguagesResponse

TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


def fetch_languages() -> TMDBLanguagesResponse:
    url = (
        "https://api.themoviedb.org/3/configuration/languages"
        f"?api_key={TMDB_API_KEY}"
    )
    response = requests.get(url).json()
    return TMDBLanguagesResponse(response)


def process_languages(languages: list[TMDBLanguageItem]):
    print(f"Processing {type} languages...")

    languages_docs: list[Language] = []
    for language in languages:
        document = Language(
            _key=language.iso_639_1,
            language_code=language.iso_639_1,
            english_name=language.english_name,
            native_name=language.name,
        )
        languages_docs.append(document)
    
    print(f"Prepared {len(languages_docs)} {type} language documents.")
    return languages_docs



def main():
    print("Fetching languages...")
    tmdb_languages = fetch_languages()
    languages: list[Language] = process_languages(tmdb_languages.root)

    connector = ArangoConnector()
    languages_collection = connector.db.collection(COLLECTIONS["languages"])
    upsert_result = connector.upsert_many(
        collection=languages_collection,
        documents=languages,
    )

    connector.close()
    return upsert_result

    
