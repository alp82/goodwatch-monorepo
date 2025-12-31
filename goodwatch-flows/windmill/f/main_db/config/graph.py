# The dimensions of your vectors depend on the model used to create them.
# Replace these placeholders with your actual vector dimensions.
TEXT_VECTOR_DIMENSIONS = 768
FINGERPRINT_VECTOR_DIMENSIONS = 74

FINGERPRINT_SCORE_FIELDS = [
    "fingerprint_scores.adrenaline", "fingerprint_scores.tension", "fingerprint_scores.scare", 
    "fingerprint_scores.violence", "fingerprint_scores.romance", "fingerprint_scores.eroticism", 
    "fingerprint_scores.wholesome", "fingerprint_scores.wonder", "fingerprint_scores.pathos", 
    "fingerprint_scores.melancholy", "fingerprint_scores.uncanny", "fingerprint_scores.catharsis", 
    "fingerprint_scores.nostalgia", "fingerprint_scores.situational_comedy", "fingerprint_scores.wit_wordplay", 
    "fingerprint_scores.physical_comedy", "fingerprint_scores.cringe_humor", "fingerprint_scores.absurdist_humor", 
    "fingerprint_scores.satire_parody", "fingerprint_scores.dark_humor", "fingerprint_scores.fantasy", 
    "fingerprint_scores.futuristic", "fingerprint_scores.historical", "fingerprint_scores.contemporary_realism", 
    "fingerprint_scores.crime", "fingerprint_scores.mystery", "fingerprint_scores.warfare", 
    "fingerprint_scores.political", "fingerprint_scores.sports", "fingerprint_scores.biographical", 
    "fingerprint_scores.coming_of_age", "fingerprint_scores.family_dynamics", "fingerprint_scores.psychological", 
    "fingerprint_scores.showbiz", "fingerprint_scores.gaming", "fingerprint_scores.pop_culture", 
    "fingerprint_scores.social_commentary", "fingerprint_scores.class_and_capitalism", 
    "fingerprint_scores.technology_and_humanity", "fingerprint_scores.spiritual", "fingerprint_scores.narrative_structure", 
    "fingerprint_scores.dialogue_quality", "fingerprint_scores.character_depth", "fingerprint_scores.slow_burn", 
    "fingerprint_scores.fast_pace", "fingerprint_scores.intrigue", "fingerprint_scores.complexity", 
    "fingerprint_scores.rewatchability", "fingerprint_scores.hopefulness", "fingerprint_scores.bleakness", 
    "fingerprint_scores.ambiguity", "fingerprint_scores.novelty", "fingerprint_scores.homage_and_reference", 
    "fingerprint_scores.non_linear_narrative", "fingerprint_scores.meta_narrative", "fingerprint_scores.surrealism", 
    "fingerprint_scores.eccentricity", "fingerprint_scores.philosophical", "fingerprint_scores.educational", 
    "fingerprint_scores.direction", "fingerprint_scores.acting", "fingerprint_scores.cinematography", 
    "fingerprint_scores.editing", "fingerprint_scores.music_composition", "fingerprint_scores.world_immersion", 
    "fingerprint_scores.spectacle", "fingerprint_scores.visual_stylization", "fingerprint_scores.pastiche", 
    "fingerprint_scores.psychedelic", "fingerprint_scores.grotesque", "fingerprint_scores.camp_and_irony", 
    "fingerprint_scores.dialogue_centrality", "fingerprint_scores.music_centrality", "fingerprint_scores.sound_centrality"
]

VIEWING_FLAG_FIELDS = [
    # Suitability flags
    "suitability_solo_watch", "suitability_date_night", "suitability_group_party",
    "suitability_family", "suitability_partner", "suitability_friends",
    "suitability_kids", "suitability_teens", "suitability_adults",
    "suitability_intergenerational", "suitability_public_viewing_safe",
    # Context flags
    "context_is_thought_provoking", "context_is_pure_escapism", "context_is_background_friendly",
    "context_is_comfort_watch", "context_is_binge_friendly", "context_is_drop_in_friendly"
]

VIEW_GLOBAL_SEARCH_PARAMS = {
    'links': {
        'movies': {
            'fields': {
                'title': {'analyzers': ['text_en']},
                'original_title': {'analyzers': ['text_en']},
                'tagline': {'analyzers': ['text_en']},
                'synopsis': {'analyzers': ['text_en']},
                'essence_text': {'analyzers': ['text_en']}
            }
        },
        'shows': {
            'fields': {
                'title': {'analyzers': ['text_en']},
                'original_title': {'analyzers': ['text_en']},
                'tagline': {'analyzers': ['text_en']},
                'synopsis': {'analyzers': ['text_en']},
                'essence_text': {'analyzers': ['text_en']}
            }
        },
        'movie_series': {
            'fields': {'name': {'analyzers': ['text_en']}}
        },
        'seasons': {
            'fields': {
                'name': {'analyzers': ['text_en']},
                'overview': {'analyzers': ['text_en']}
            }
        },
        'persons': {
            'fields': {
                'name': {'analyzers': ['text_en']},
                'original_name': {'analyzers': ['text_en']}
            }
        },
        'alternative_titles': {
            'fields': {'title': {'analyzers': ['text_en']}}
        },
        'essence_tags': {
            'fields': {'name': {'analyzers': ['text_en']}}
        },
        'trope_for': {
            'fields': {'html': {'analyzers': ['text_en']}}
        },
    }
}

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
    'tropes': 'tropes',
    'essence_tags': 'essence_tags',
    'content_advisories': 'content_advisories',

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

    # internal
    'copy_metadata': 'copy_metadata',
}

INDEX_DEFINITIONS = {
    'movies': [
        # === Essential & Identifier Indexes ===
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_movies_tmdb_id'},
        {'type': 'persistent', 'fields': ['imdb_id'], 'unique': False, 'sparse': True, 'name': 'idx_movies_imdb_id'},
        
        # === Common Filter & Sort Indexes ===
        {'type': 'persistent', 'fields': ['popularity'], 'unique': False, 'name': 'idx_movies_popularity'},
        {'type': 'persistent', 'fields': ['release_year'], 'unique': False, 'name': 'idx_movies_release_year'},
        {'type': 'persistent', 'fields': ['status'], 'unique': False, 'name': 'idx_movies_status'},
        {'type': 'persistent', 'fields': ['goodwatch_overall_score_normalized_percent'], 'unique': False, 'name': 'idx_movies_goodwatch_score'},
        {'type': 'persistent', 'fields': ['dna_updated_at'], 'unique': False, 'name': 'idx_movies_dna_updated_at'},

        # === Array Indexes (for lookups within lists) ===
        {'type': 'persistent', 'fields': ['production_country_codes[*]'], 'unique': False, 'name': 'idx_movies_prod_countries'},
        {'type': 'persistent', 'fields': ['streaming_country_codes[*]'], 'unique': False, 'name': 'idx_movies_streaming_countries'},
        {'type': 'persistent', 'fields': ['streaming_service_ids[*]'], 'unique': False, 'name': 'idx_movies_streaming_services'},
        {'type': 'persistent', 'fields': ['streaming_availabilities[*]'], 'unique': False, 'name': 'idx_movies_streaming_availabilities'},

        # === Compound Index for ALL DNA Scores ===
        {'type': 'persistent', 'fields': FINGERPRINT_SCORE_FIELDS, 'unique': False, 'name': 'idx_movies_fingerprint_scores'},
        
        # === Boolean Flag Indexes (for faceted filtering) ===
        {'type': 'persistent', 'fields': VIEWING_FLAG_FIELDS, 'unique': False, 'name': 'idx_movies_viewing_flags'},
        
        # === Vector Indexes (for similarity search) ===
        #{'type': 'vector', 'fields': ['vector_essence_text'], 'params': { 'metric': 'cosine', 'dimension': TEXT_VECTOR_DIMENSIONS, 'nLists': 100 }, 'name': 'idx_movies_vector_essence_text'},
        #{'type': 'vector', 'fields': ['vector_fingerprint'], 'params': { 'metric': 'cosine', 'dimension': FINGERPRINT_VECTOR_DIMENSIONS, 'nLists': 100 }, 'name': 'idx_movies_vector_fingerprint'},
    ],
    'shows': [
        # === Essential & Identifier Indexes ===
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_shows_tmdb_id'},
        {'type': 'persistent', 'fields': ['imdb_id'], 'unique': False, 'sparse': True, 'name': 'idx_shows_imdb_id'},

        # === Common Filter & Sort Indexes ===
        {'type': 'persistent', 'fields': ['popularity'], 'unique': False, 'name': 'idx_shows_popularity'},
        {'type': 'persistent', 'fields': ['release_year'], 'unique': False, 'name': 'idx_shows_release_year'},
        {'type': 'persistent', 'fields': ['status'], 'unique': False, 'name': 'idx_shows_status'},
        {'type': 'persistent', 'fields': ['goodwatch_overall_score_normalized_percent'], 'unique': False, 'name': 'idx_shows_goodwatch_score'},
        {'type': 'persistent', 'fields': ['dna_updated_at'], 'unique': False, 'name': 'idx_shows_dna_updated_at'},

        # === Array Indexes (for lookups within lists) ===
        {'type': 'persistent', 'fields': ['production_country_codes[*]'], 'unique': False, 'name': 'idx_shows_prod_countries'},
        {'type': 'persistent', 'fields': ['streaming_country_codes[*]'], 'unique': False, 'name': 'idx_shows_streaming_countries'},
        {'type': 'persistent', 'fields': ['streaming_service_ids[*]'], 'unique': False, 'name': 'idx_shows_streaming_services'},
        {'type': 'persistent', 'fields': ['streaming_availabilities[*]'], 'unique': False, 'name': 'idx_shows_streaming_availabilities'},

        # === Compound Index for ALL DNA Scores ===
        {'type': 'persistent', 'fields': FINGERPRINT_SCORE_FIELDS, 'unique': False, 'name': 'idx_shows_fingerprint_scores'},

        # === Boolean Flag Indexes (for faceted filtering) ===
        {'type': 'persistent', 'fields': VIEWING_FLAG_FIELDS, 'unique': False, 'name': 'idx_shows_viewing_flags'},

        # === Vector Indexes (for similarity search) ===
        #{'type': 'vector', 'fields': ['vector_essence_text'], 'params': { 'metric': 'cosine', 'dimension': TEXT_VECTOR_DIMENSIONS, 'nLists': 100 }, 'name': 'idx_shows_vector_essence_text'},
        #{'type': 'vector', 'fields': ['vector_fingerprint'], 'params': { 'metric': 'cosine', 'dimension': FINGERPRINT_VECTOR_DIMENSIONS, 'nLists': 100 }, 'name': 'idx_shows_vector_fingerprint'},
    ],
    'seasons': [
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_season_tmdb_id'},
        {'type': 'persistent', 'fields': ['show_key', 'season_number'], 'unique': True, 'name': 'idx_season_show_season_num'},
    ],
    'age_certifications': [
        {'type': 'persistent', 'fields': ['country_code', 'media_type', 'order'], 'unique': False, 'name': 'idx_ac_country_media_order'},
    ],
    'countries': [
        {'type': 'persistent', 'fields': ['country_code'], 'unique': True, 'name': 'idx_country_code'},
    ],
    'languages': [
        {'type': 'persistent', 'fields': ['language_code'], 'unique': True, 'name': 'idx_language_code'},
    ],
    'persons': [
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_person_tmdb_id'},
        {'type': 'persistent', 'fields': ['name'], 'unique': False, 'name': 'idx_person_name'},
        {'type': 'persistent', 'fields': ['popularity'], 'unique': False, 'sparse': True, 'name': 'idx_person_popularity'},
        {'type': 'persistent', 'fields': ['known_for_department'], 'unique': False, 'sparse': True, 'name': 'idx_person_known_for'},
    ],
    'production_companies': [
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_pc_tmdb_id'},
    ],
    'genres': [
        {'type': 'persistent', 'fields': ['tmdb_id', 'media_type'], 'unique': True, 'name': 'idx_genre_tmdb_id_media_type'},
        {'type': 'persistent', 'fields': ['name'], 'unique': False, 'name': 'idx_genre_name'},
    ],
    'tropes': [
        {'type': 'persistent', 'fields': ['name'], 'unique': True, 'name': 'idx_trope_name'},
    ],
    'streaming_services': [
        {'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True, 'name': 'idx_streaming_services_tmdb_id'},
        {'type': 'persistent', 'fields': ['name'], 'unique': False, 'name': 'idx_streaming_services_name'},
    ],
    'streaming_availabilities': [
        {'type': 'persistent', 'fields': ['country_code', 'streaming_type'], 'unique': False, 'name': 'idx_sa_country_type'},
        {'type': 'persistent', 'fields': ['country_code', 'streaming_service_id'], 'unique': False, 'name': 'idx_sa_country_service'},
    ],
    'scores': [
        {'type': 'persistent', 'fields': ['source', 'score_type', 'percent', 'rating_count'], 'unique': False, 'name': 'idx_scores_source_type_percent_rating'},
        {'type': 'persistent', 'fields': ['refreshed_at'], 'unique': False, 'sparse': True, 'name': 'idx_scores_refreshed_at'},
    ],
    'copy_metadata': [
        {'type': 'persistent', 'fields': ['collection', 'finished_at'], 'unique': False, 'name': 'idx_copy_metadata_collection_finished_at'},
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
    'trope_for': {
        'name': 'trope_for',
        'from': ['movies', 'shows'],
        'to': ['tropes'],
    },
    'essence_tag_for': {
        'name': 'essence_tag_for',
        'from': ['movies', 'shows'],
        'to': ['essence_tags'],
    },
    'content_advisory_for': {
        'name': 'content_advisory_for',
        'from': ['movies', 'shows'],
        'to': ['content_advisories'],
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
