COLLECTIONS = {
    # base data
    'countries': 'countries',
    'languages': 'languages',
    'timezones': 'timezones',
    'production_companies': 'production_companies',
    'networks': 'networks',
    'streaming_services': 'streaming_services',

    # movies and shows
    'movies': 'movies',
    'shows': 'shows',
    'movie_series': 'movie_series',
    'seasons': 'seasons',

    # localization and releases
    'alternative_titles': 'alternative_titles',
    'translations': 'translations',
    'release_events': 'release_events',
    'age_certifications': 'age_certifications',

    # scores & streaming
    'scores': 'scores',
    'streaming_availabilities': 'streaming_availabilities',

    # metadata
    'images': 'images',
    'videos': 'videos',
    'genres': 'genres',
    'keywords': 'keywords',
    'tropes': 'tropes',
    'dna': 'dna',
    'dna_legacy': 'dna_legacy',

    # people
    'persons': 'persons',
    'jobs': 'jobs',
    'departments': 'departments',

    # user data
    'users': 'users',
    'user_favorites': 'user_favorites',
    'user_scores': 'user_scores',
    'user_want_list': 'user_want_list',
    'user_seen_history': 'user_seen_history',
}

INDEX_DEFINITIONS = {
    'movies': [
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_movies_tmdb_id'},
        {'type': 'persistent', 'fields': ['title'], 'unique': False, 'name': 'idx_movies_title'},
        {'type': 'persistent', 'fields': ['popularity'], 'unique': False, 'name': 'idx_movies_popularity'},
    ],
    'shows': [
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_shows_tmdb_id'},
        {'type': 'persistent', 'fields': ['title'], 'unique': False, 'name': 'idx_shows_title'},
        {'type': 'persistent', 'fields': ['popularity'], 'unique': False, 'name': 'idx_shows_popularity'},
    ],
    'dna_legacy': [
        {'type': 'persistent', 'fields': ['category', 'label'], 'unique': False, 'name': 'idx_dna_category_label'},
    ],
    'streaming_availabilities': [
        {'type': 'persistent', 'fields': ['streaming_type'], 'unique': False, 'name': 'idx_sa_type'},
        {'type': 'persistent', 'fields': ['country_code'], 'unique': False, 'name': 'idx_sa_country'},
        {'type': 'persistent', 'fields': ['country_code', 'streaming_service_id'], 'unique': False, 'name': 'idx_sa_country_service'},
        {'type': 'persistent', 'fields': ['startTimestamp'], 'unique': False, 'name': 'idx_sa_startTimestamp'},
        {'type': 'persistent', 'fields': ['endTimestamp'], 'unique': False, 'name': 'idx_sa_endTimestamp'},
        {'type': 'persistent', 'fields': ['country_code', 'startTimestamp', 'endTimestamp'], 'unique': False, 'name': 'idx_sa_country_start_end'},
    ],
    'scores': [
        {'type': 'persistent', 'fields': ['source', 'score_type', 'percent', 'rating_count'], 'unique': False, 'name': 'idx_scores_source_type_percent_rating'},
    ],
}

EDGES = {
    # base data
    'job_is_part_of_department': {
        'name': 'job_is_part_of_department',
        'from': ['departments'],
        'to': ['jobs'],
    },

    # movies and shows
    'movie_belongs_to_series': {
        'name': 'movie_belongs_to_series',
        'from': ['movies'],
        'to': ['movie_series'],
    },
    'show_has_season': {
        'name': 'show_has_season',
        'from': ['shows'],
        'to': ['seasons'],
    },

    # localization and releases
    'language_is_spoken_in': {
        'name': 'language_is_spoken_in',
        'from': ['movies', 'shows'],
        'to': ['languages'],
    },
    'alternative_title_for': {
        'name': 'alternative_title_for',
        'from': ['movies', 'shows'],
        'to': ['alternative_titles'],
    },
    'translation_for': {
        'name': 'translation_for',
        'from': ['movies', 'shows'],
        'to': ['translations'],
    },
    'age_certification_appropriate_for': {
        'name': 'age_certification_appropriate_for',
        'from': ['movies', 'shows'],
        'to': ['age_certifications'],
    },
    'release_event_for': {
        'name': 'release_event_for',
        'from': ['movies', 'shows'],
        'to': ['release_events'],
    },

    # production
    'production_company_produced': {
        'name': 'production_company_produced',
        'from': ['movies', 'shows'],
        'to': ['production_companies'],
    },
    'network_released': {
        'name': 'network_released',
        'from': ['shows'],
        'to': ['networks'],
    },
    'originates_from_country': {
        'name': 'originates_from_country',
        'from': ['movies', 'shows', 'networks', 'production_companies'],
        'to': ['countries'],
    },

    # scores & streaming
    'streaming_availability_in_country': {
        'name': 'streaming_availability_in_country',
        'from': ['movies', 'shows'],
        'to': ['countries'],
    },
    'streaming_service_is_available_for': {
        'name': 'streaming_service_is_available_for',
        'from': ['movies', 'shows'],
        'to': ['streaming_services'],
    },
    'streaming_availability_for': {
        'name': 'streaming_availability_for',
        'from': ['movies', 'shows'],
        'to': ['streaming_availabilities'],
    },
    'scored': {
        'name': 'scored',
        'from': ['movies', 'shows'],
        'to': ['scores'],
    },

    # metadata
    'image_for': {
        'name': 'image_for',
        'from': ['movies', 'shows'],
        'to': ['images'],
    },
    'video_for': {
        'name': 'video_for',
        'from': ['movies', 'shows'],
        'to': ['videos'],
    },
    'genre_for': {
        'name': 'genre_for',
        'from': ['movies', 'shows'],
        'to': ['genres'],
    },
    'keyword_for': {
        'name': 'keyword_for',
        'from': ['movies', 'shows'],
        'to': ['keywords'],
    },
    'trope_for': {
        'name': 'trope_for',
        'from': ['movies', 'shows'],
        'to': ['tropes'],
    },
    'dna_for': {
        'name': 'dna_for',
        'from': ['movies', 'shows'],
        'to': ['dna'],
    },
    'dna_legacy_for': {
        'name': 'dna_legacy_for',
        'from': ['movies', 'shows'],
        'to': ['dna_legacy'],
    },

    # people
    'person_appeared_in': {
        'name': 'person_appeared_in',
        'from': ['persons'],
        'to': ['movies', 'shows'],
    },
    'person_worked_on': {
        'name': 'person_worked_on',
        'from': ['persons'],
        'to': ['movies', 'shows'],
    },

    # relations
    'tmdb_recommends': {
        'name': 'tmdb_recommends',
        'from': ['movies', 'shows'],
        'to': ['movies', 'shows'],
    },
    'tmdb_similar_to': {
        'name': 'tmdb_similar_to',
        'from': ['movies', 'shows'],
        'to': ['movies', 'shows'],
    },

    # user data
    'user_favorited': {
        'name': 'user_favorited',
        'from': ['movies', 'shows'],
        'to': ['users'],
    },
    'user_scored': {
        'name': 'user_scored',
        'from': ['movies', 'shows'],
        'to': ['user_scores'],
    },
    'user_wants_to_see': {
        'name': 'user_wants_to_see',
        'from': ['movies', 'shows'],
        'to': ['user_want_list'],
    },
    'user_has_seen': {
        'name': 'user_has_seen',
        'from': ['movies', 'shows'],
        'to': ['user_seen_history'],
    },
}


def main():
    pass
