import requests
import wmill

from f.main_db.config.graph import COLLECTIONS
from f.main_db.models.arango import MediaType, StreamingService
from f.main_db.models.tmdb import TMDBMediaType, TMDBProvider, TMDBProvidersResponse
from f.db.arango import ArangoConnector

TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


def fetch_providers(type: TMDBMediaType) -> TMDBProvidersResponse:
    url = (
        f"https://api.themoviedb.org/3/watch/providers/{type}"
        f"?api_key={TMDB_API_KEY}"
    )
    response = requests.get(url).json()
    return TMDBProvidersResponse(**response)


def process_providers(media_type: MediaType, providers: list[TMDBProvider]):
    print(f"Processing {media_type} providers...")

    providers_to_add: list[StreamingService] = []
    for provider in providers:
        provider_id = provider.provider_id
        provider_key = str(provider_id)
        document = StreamingService(
            _key=provider_key,
            tmdb_id=provider_id,
            name=provider.provider_name,
            logo_path=provider.logo_path,
            order=provider.display_priority,
            order_by_country=provider.display_priorities,
        )
        providers_to_add.append(document)

    print(f"Prepared {len(providers_to_add)} {media_type} provider documents.")
    return providers_to_add



def main():
    print("Fetching providers for movies and shows...")
    providers_movie = fetch_providers("movie")
    providers_show = fetch_providers("tv")
    
    streaming_services: list[StreamingService] = (
        process_providers("movie", providers_movie.results) +
        process_providers("show", providers_show.results)
    )

    connector = ArangoConnector()
    streaming_services_collection = connector.db.collection(COLLECTIONS["streaming_services"])
    upsert_result = connector.upsert_many(
        collection=streaming_services_collection,
        documents=streaming_services,
    )

    connector.close()
    return upsert_result

    
