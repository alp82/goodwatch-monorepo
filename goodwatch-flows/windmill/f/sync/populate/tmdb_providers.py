import requests
import wmill

from f.sync.models.crate_models import MediaType, StreamingService
from f.sync.models.tmdb_models import TMDBMediaType, TMDBProvider, TMDBProvidersResponse
from f.db.cratedb import CrateConnector

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
        document = StreamingService(
            tmdb_id=provider_id,
            media_type=media_type,
            name=provider.provider_name,
            logo_path=provider.logo_path,
            order_default=provider.display_priority,
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

    connector = CrateConnector()
    upsert_affected_rows = connector.upsert_many(
        table="streaming_service",
        records=streaming_services,
        conflict_columns=["tmdb_id", "media_type"],
    )
    connector.disconnect()

    return {
        "affected_rows": upsert_affected_rows,
    }   
