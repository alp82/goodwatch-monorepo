import requests
import wmill

from f.sync.models.crate_models import MediaType, Genre
from f.sync.models.tmdb_models import TMDBMediaType, TMDBGenre, TMDBGenreResponse
from f.db.cratedb import CrateConnector

TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


def fetch_genres(type: TMDBMediaType) -> TMDBGenreResponse:
    url = (
        f"https://api.themoviedb.org/3/genre/{type}/list"
        f"?api_key={TMDB_API_KEY}"
    )
    response = requests.get(url).json()
    return TMDBGenreResponse(**response)


def process_genres(media_type: MediaType, genres: list[TMDBGenre]):
    print(f"Processing {media_type} genres...")

    genres_to_add: list[Genre] = []
    for genre in genres:
        genre_id = genre.id
        name = genre.name
        document = Genre(
            tmdb_id=genre_id,
            media_type=media_type,
            name=name,
        )
        genres_to_add.append(document)

    print(f"Prepared {len(genres_to_add)} {media_type} genre documents.")
    return genres_to_add



def main():
    print("Fetching genres for movies and shows...")
    genres_movie = fetch_genres("movie")
    genres_show = fetch_genres("tv")
    
    genres: list[Genre] = (
        process_genres("movie", genres_movie.genres) +
        process_genres("show", genres_show.genres)
    )

    connector = CrateConnector()
    upsert_affected_rows = connector.upsert_many(
        table="genre",
        records=genres,
        conflict_columns=["tmdb_id", "media_type"],
    )
    connector.disconnect()

    return {
        "affected_rows": upsert_affected_rows,
    }

    
