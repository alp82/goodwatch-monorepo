"""
Constants used throughout the importer system.
"""

# Database
BATCH_SIZE = 1000
BATCH_LIMIT = 10

# Collections
VERTEX_COLLECTIONS = [
    'movies', 'shows', 'persons', 'genres', 'keywords', 'tropes',
    'movie_series', 'production_companies',
    'translations', 'images', 'videos', 'alternative_titles',
    'release_events', 'age_classifications',
    'countries', 'languages', 'streaming_services', 'streaming_offers', 'seasons', 'scores'
]

EDGE_DEFINITIONS = [
    ('has_genre', ['movies', 'shows'], ['genres']),
    ('has_keyword', ['movies', 'shows'], ['keywords']),
    ('has_trope', ['movies', 'shows'], ['tropes']),
    ('has_translation', ['movies', 'shows'], ['translations']),
    ('has_image', ['movies', 'shows'], ['images']),
    ('has_video', ['movies', 'shows'], ['videos']),
    ('has_alternative_title', ['movies', 'shows'], ['alternative_titles']),
    ('has_release_event', ['movies', 'shows'], ['release_events']),
    ('has_age_classification', ['release_events'], ['age_classifications']),
    ('belongs_to_movie_series', ['movies'], ['movie_series']),
    ('produced_by', ['movies'], ['production_companies']),
    ('appeared_in', ['persons'], ['movies', 'shows']),
    ('worked_on', ['persons'], ['movies', 'shows']),
    ('tmdb_recommends', ['movies'], ['movies']),
    ('tmdb_similar_to', ['movies'], ['movies']),
    ('originates_from_country', ['movies', 'shows'], ['countries']),
    ('has_original_language', ['movies', 'shows'], ['languages']),
    ('has_spoken_language', ['movies', 'shows'], ['languages']),
    ('release_event_for_country', ['release_events'], ['countries']),
    ('age_classification_for_country', ['age_classifications'], ['countries']),
    ('translation_in_language', ['translations'], ['languages']),
    ('alternative_title_for_country', ['alternative_titles'], ['countries']),
    ('available_in_country', ['movies', 'shows'], ['countries']),
    ('has_streaming_offer', ['movies', 'shows'], ['streaming_offers']),
    ('offer_for_streaming_service', ['streaming_offers'], ['streaming_services']),
    ('offer_in_country', ['streaming_offers'], ['countries']),
    ('has_season', ['shows'], ['seasons']),
    ('has_score', ['movies', 'shows'], ['scores']),
    ('translation_in_country', ['translations'], ['countries']),
]

# RegEx Patterns
HUMAN_KEY_PATTERN_STRING = r'[^a-z0-9_\-]'
SAFE_KEY_PATTERN_STRING = r'[^a-zA-Z0-9_\-]'

# Score sources and fields
SCORE_SPECS = [
    # source, url_field, user_original, user_percent, user_count, critics_original, critics_percent, critics_count, combined_percent, combined_count
    ('tmdb', 'tmdb_url', 'tmdb_user_score_original', 'tmdb_user_score_normalized_percent', 'tmdb_user_score_rating_count', None, None, None, None, None),
    ('imdb', 'imdb_url', 'imdb_user_score_original', 'imdb_user_score_normalized_percent', 'imdb_user_score_rating_count', None, None, None, None, None),
    ('metacritic', 'metacritic_url', 'metacritic_user_score_original', 'metacritic_user_score_normalized_percent', 'metacritic_user_score_rating_count', 'metacritic_meta_score_original', 'metacritic_meta_score_normalized_percent', 'metacritic_meta_score_review_count', None, None),
    ('rotten_tomatoes', 'rotten_tomatoes_url', 'rotten_tomatoes_audience_score_original', 'rotten_tomatoes_audience_score_normalized_percent', 'rotten_tomatoes_audience_score_rating_count', 'rotten_tomatoes_tomato_score_original', 'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_tomato_score_review_count', None, None),
    ('aggregated', None, None, 'aggregated_user_score_normalized_percent', 'aggregated_user_score_rating_count', None, 'aggregated_official_score_normalized_percent', 'aggregated_official_score_review_count', 'aggregated_overall_score_normalized_percent', 'aggregated_overall_score_voting_count'),
]

# Fields to remove from main documents after processing
REDUNDANT_FIELDS = set([
    'genres', 'keywords', 'tropes', 'cast', 'crew',
    'translations', 'images', 'videos', 'alternative_titles', 'certifications', 'collection',
    'origin_country_codes', 'original_language_code', 'spoken_language_codes',
    'streaming_providers', 'streaming_country_codes', 'seasons',
    # All score fields
    'tmdb_url', 'tmdb_user_score_original', 'tmdb_user_score_normalized_percent', 'tmdb_user_score_rating_count',
    'imdb_url', 'imdb_user_score_original', 'imdb_user_score_normalized_percent', 'imdb_user_score_rating_count',
    'metacritic_url', 'metacritic_user_score_original', 'metacritic_user_score_normalized_percent', 'metacritic_user_score_rating_count',
    'metacritic_meta_score_original', 'metacritic_meta_score_normalized_percent', 'metacritic_meta_score_review_count',
    'rotten_tomatoes_url', 'rotten_tomatoes_audience_score_original', 'rotten_tomatoes_audience_score_normalized_percent', 'rotten_tomatoes_audience_score_rating_count',
    'rotten_tomatoes_tomato_score_original', 'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_tomato_score_review_count',
    'aggregated_user_score_normalized_percent', 'aggregated_user_score_rating_count',
    'aggregated_official_score_normalized_percent', 'aggregated_official_score_review_count',
    'aggregated_overall_score_normalized_percent', 'aggregated_overall_score_voting_count',
])

# Collection names
MOVIES_COLLECTION = 'movies'
SHOWS_COLLECTION = 'shows'

# SQL Queries
MOVIES_QUERY = f'''
    SELECT
      tmdb_id,
      created_at, updated_at,
      title, original_title, alternative_titles,
      tagline, synopsis, translations,
      popularity, status, adult,
      poster_path, backdrop_path,
      images, videos,
      release_date, release_year,
      runtime, budget, revenue,
      genres, keywords, tropes, dna,
      original_language_code,
      spoken_language_codes,
      streaming_providers, streaming_country_codes,
      production_company_ids,
      certifications,
      "cast", crew,
      collection,
      tmdb_recommendation_ids,
      tmdb_similar_ids,
      tmdb_url, tmdb_user_score_original, tmdb_user_score_normalized_percent, tmdb_user_score_rating_count,
      imdb_url, imdb_user_score_original, imdb_user_score_normalized_percent, imdb_user_score_rating_count,
      metacritic_url, metacritic_user_score_original, metacritic_user_score_normalized_percent, metacritic_user_score_rating_count,
                      metacritic_meta_score_original, metacritic_meta_score_normalized_percent, metacritic_meta_score_review_count,
      rotten_tomatoes_url, rotten_tomatoes_audience_score_original, rotten_tomatoes_audience_score_normalized_percent, rotten_tomatoes_audience_score_rating_count,
                      rotten_tomatoes_tomato_score_original, rotten_tomatoes_tomato_score_normalized_percent, rotten_tomatoes_tomato_score_review_count,
      aggregated_user_score_normalized_percent, aggregated_user_score_rating_count,
      aggregated_official_score_normalized_percent, aggregated_official_score_review_count,
      aggregated_overall_score_normalized_percent, aggregated_overall_score_voting_count,
      homepage, wikidata_id, facebook_id, instagram_id, twitter_id,
      tmdb_details_updated_at, tmdb_providers_updated_at, imdb_ratings_updated_at, metacritic_ratings_updated_at, rotten_tomatoes_ratings_updated_at, tvtropes_tags_updated_at, dna_updated_at
    FROM movies
    --WHERE tmdb_id = 603
    ORDER BY popularity DESC NULLS LAST
    LIMIT {BATCH_LIMIT};
'''

SHOWS_QUERY = f'''
    SELECT
      tmdb_id,
      created_at, updated_at,
      title, original_title, alternative_titles,
      tagline, synopsis, translations,
      popularity, status, in_production, adult,
      poster_path, backdrop_path,
      images, videos,
      release_date, release_year,
      last_air_date, last_air_year,
      number_of_seasons, number_of_episodes, episode_runtime,
      genres, keywords, tropes, dna,
      origin_country_codes,
      original_language_code,
      spoken_language_codes,
      streaming_providers, streaming_country_codes,
      production_company_ids, network_ids,
      certifications,
      "cast", crew,
      seasons,
      tmdb_recommendation_ids,
      tmdb_similar_ids,
      tmdb_url, tmdb_user_score_original, tmdb_user_score_normalized_percent, tmdb_user_score_rating_count,
      imdb_url, imdb_user_score_original, imdb_user_score_normalized_percent, imdb_user_score_rating_count,
      metacritic_url, metacritic_user_score_original, metacritic_user_score_normalized_percent, metacritic_user_score_rating_count,
                      metacritic_meta_score_original, metacritic_meta_score_normalized_percent, metacritic_meta_score_review_count,
      rotten_tomatoes_url, rotten_tomatoes_audience_score_original, rotten_tomatoes_audience_score_normalized_percent, rotten_tomatoes_audience_score_rating_count,
                      rotten_tomatoes_tomato_score_original, rotten_tomatoes_tomato_score_normalized_percent, rotten_tomatoes_tomato_score_review_count,
      aggregated_user_score_normalized_percent, aggregated_user_score_rating_count,
      aggregated_official_score_normalized_percent, aggregated_official_score_review_count,
      aggregated_overall_score_normalized_percent, aggregated_overall_score_voting_count,
      homepage, wikidata_id, facebook_id, instagram_id, twitter_id,
      tmdb_details_updated_at, tmdb_providers_updated_at, imdb_ratings_updated_at, metacritic_ratings_updated_at, rotten_tomatoes_ratings_updated_at, tvtropes_tags_updated_at, dna_updated_at
    FROM tv
    --WHERE tmdb_id = 603
    ORDER BY popularity DESC NULLS LAST
    LIMIT {BATCH_LIMIT};
'''
