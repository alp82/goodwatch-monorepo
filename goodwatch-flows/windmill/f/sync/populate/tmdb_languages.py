import requests
import wmill

from f.sync.models.crate_models import Language
from f.sync.models.tmdb_models import TMDBLanguageItem, TMDBLanguagesResponse
from f.db.cratedb import CrateConnector

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

    connector = CrateConnector()
    upsert_affected_rows = connector.upsert_many(
        table="language",
        records=languages,
        conflict_columns=["language_code"],
    )
    connector.disconnect()

    return {
        "affected_rows": upsert_affected_rows,
    }
