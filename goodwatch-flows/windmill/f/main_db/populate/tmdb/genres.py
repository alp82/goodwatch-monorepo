import requests
import wmill

from f.main_db.config.graph import COLLECTIONS
from f.main_db.models.arango import MediaType, Genre
from f.main_db.models.tmdb import TMDBMediaType, TMDBGenre, TMDBGenreResponse
from f.db.arango import ArangoConnector

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
        genre_key = str(genre_id)
        name = genre.name
        document = Genre(
            _key=genre_key,
            tmdb_id=genre_id,
            name=name,
            media_type=media_type,
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

    connector = ArangoConnector()
    genres_collection = connector.db.collection(COLLECTIONS["genres"])
    upsert_result = connector.upsert_many(
        collection=genres_collection,
        documents=genres,
    )

    connector.close()
    return upsert_result

    
