from mongoengine.queryset.visitor import Q
import wmill

from f.db.mongodb import init_mongodb
from f.imdb_web.models import ImdbMovieRating, ImdbTvRating
from f.metacritic_web.models import MetacriticMovieRating, MetacriticTvRating
from f.rotten_web.models import RottenTomatoesMovieRating, RottenTomatoesTvRating
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails


def count_tmdb_details():
    count_movies_total = TmdbMovieDetails.objects().count()
    count_tv_total = TmdbTvDetails.objects().count()
    count_movies = TmdbMovieDetails.objects(title__ne=None).count()
    count_tv = TmdbTvDetails.objects(title__ne=None).count()

    return {
        "total": {
            "movie": count_movies_total,
            "tv": count_tv_total,
        },
        "with_details": {
            "movie": count_movies,
            "tv": count_tv,
        },
    }


def count_imdb_ratings():
    count_movies_selected = ImdbMovieRating.objects(selected_at__ne=None).count()
    count_tv_selected = ImdbTvRating.objects(selected_at__ne=None).count()
    count_movies = ImdbMovieRating.objects(user_score_original__ne=None).count()
    count_tv = ImdbTvRating.objects(user_score_original__ne=None).count()

    return {
        "selected": {
            "movie": count_movies_selected,
            "tv": count_tv_selected,
        },
        "with_rating": {
            "movie": count_movies,
            "tv": count_tv,
        },
    }


def count_metacritic_ratings():
    count_movies_selected = MetacriticMovieRating.objects(selected_at__ne=None).count()
    count_tv_selected = MetacriticTvRating.objects(selected_at__ne=None).count()
    count_movies = MetacriticMovieRating.objects(
        Q(user_score_original__ne=None) | Q(meta_score_original__ne=None)
    ).count()
    count_tv = MetacriticTvRating.objects(
        Q(user_score_original__ne=None) | Q(meta_score_original__ne=None)
    ).count()

    return {
        "selected": {
            "movie": count_movies_selected,
            "tv": count_tv_selected,
        },
        "with_rating": {
            "movie": count_movies,
            "tv": count_tv,
        },
    }


def count_rotten_tomatoes_ratings():
    count_movies_selected = RottenTomatoesMovieRating.objects(selected_at__ne=None).count()
    count_tv_selected = RottenTomatoesTvRating.objects(selected_at__ne=None).count()
    count_movies = RottenTomatoesMovieRating.objects(
        Q(audience_score_original__ne=None) | Q(tomato_score_original__ne=None)
    ).count()
    count_tv = RottenTomatoesTvRating.objects(
        Q(audience_score_original__ne=None) | Q(tomato_score_original__ne=None)
    ).count()

    return {
        "selected": {
            "movie": count_movies_selected,
            "tv": count_tv_selected,
        },
        "with_rating": {
            "movie": count_movies,
            "tv": count_tv,
        },
    }


def main():
    init_mongodb()
    return {
        "tmdb_details": count_tmdb_details(),
        "imdb_ratings": count_imdb_ratings(),
        "metacritic_ratings": count_metacritic_ratings(),
        "rotten_ratings": count_rotten_tomatoes_ratings(),
    }
