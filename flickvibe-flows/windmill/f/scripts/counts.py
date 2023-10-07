import wmill

from f.db.mongodb import init_mongodb
from f.imdb_web.models import ImdbMovieRating, ImdbTvRating
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails


def count_tmdb_details():
    count_movies = TmdbMovieDetails.objects(title__ne=None).count()
    count_tv = TmdbTvDetails.objects(title__ne=None).count()

    return {
        "movie": count_movies,
        "tv": count_tv,
    }


def count_imdb_ratings():
    count_movies = ImdbMovieRating.objects(user_score_original__ne=None).count()
    count_tv = ImdbTvRating.objects(user_score_original__ne=None).count()

    return {
        "movie": count_movies,
        "tv": count_tv,
    }


def main():
    init_mongodb()
    return {
        "tmdb_details": count_tmdb_details(),
        "imdb_ratings": count_imdb_ratings(),
    }