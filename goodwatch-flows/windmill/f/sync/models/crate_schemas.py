# Every CrateDB table, for the pipelines and for the webapp. f/sync/init/cratedb creates the tables that are missing
# and adds the columns that are missing; it never changes or drops a column.
#
# Per table:
#   columns      name -> type and constraints, as in CREATE TABLE
#   primary_key  column names
#   shards       number of shards
#   clustered_by optional routing column
#   timestamps   False for a table that lists its own created_at/updated_at, or has none. Otherwise both are added
#                as TIMESTAMP.
#   replicas     optional number_of_replicas for a new table, such as "0-1". Without it, the cluster default.
#   rows         optional rows the table must hold, inserted on every run unless their key already exists.
SCHEMAS = {
    "crawl_priority": {
        "columns": {
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "tmdb_id": "INTEGER",
            "demand": "BIGINT DEFAULT 0",
            "acknowledged_demand": "BIGINT DEFAULT 0",
            "claimed_demand": "BIGINT DEFAULT 0",
            "alias_demand_transfers": "OBJECT(DYNAMIC)",
            "last_success_at": "TIMESTAMP",
            "lease_token": "TEXT",
            "lease_expires_at": "TIMESTAMP",
        },
        "primary_key": ["media_type", "tmdb_id"],
        "shards": 3,
    },
    # ============================
    # ===== Core Lookups =====
    # ============================
    "age_certification": {
        "columns": {
            "certification_code": "TEXT",
            "country_code": "TEXT",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "meaning": "TEXT",
            "order_default": "INTEGER",
        },
        "primary_key": ["certification_code", "country_code", "media_type"],
        "shards": 2,
    },
    "country": {
        "columns": {
            "country_code": "TEXT",
            "english_name": "TEXT",
        },
        "primary_key": ["country_code"],
        "shards": 2,
    },
    "job": {
        "columns": {
            "job_title": "TEXT INDEX USING FULLTEXT",
            "department_name": "TEXT INDEX USING FULLTEXT",
        },
        "primary_key": ["job_title", "department_name"],
        "shards": 2,
    },
    "language": {
        "columns": {
            "language_code": "TEXT",
            "english_name": "TEXT",
            "native_name": "TEXT",
        },
        "primary_key": ["language_code"],
        "shards": 2,
    },
    "timezone": {
        "columns": {
            "country_code": "TEXT",
            "zones": "ARRAY(TEXT)",
        },
        "primary_key": ["country_code"],
        "shards": 2,
    },
    "genre": {
        "columns": {
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "name": "TEXT INDEX USING FULLTEXT",
        },
        "primary_key": ["tmdb_id", "media_type"],
        "shards": 2,
    },
    "streaming_service": {
        "columns": {
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "name": "TEXT INDEX USING FULLTEXT",
            "logo_path": "TEXT",
            "order_default": "INTEGER",
            "order_by_country": "OBJECT(DYNAMIC)",
        },
        "primary_key": ["tmdb_id", "media_type"],
        "shards": 2,
    },
    # ============================
    # ===== Movies and Shows =====
    # ============================
    "movie": {
        "columns": {
            "tmdb_id": "INTEGER",
            "title": "TEXT INDEX USING FULLTEXT",
            "original_title": "TEXT INDEX USING FULLTEXT",
            "tagline": "TEXT INDEX USING FULLTEXT",
            "synopsis": "TEXT INDEX USING FULLTEXT",
            "popularity": "DOUBLE",
            "status": "TEXT",
            "adult": "BOOLEAN",
            "poster_path": "TEXT",
            "backdrop_path": "TEXT",
            "release_year": "INTEGER",
            "release_date": "TIMESTAMP",
            "movie_series_id": "INTEGER",
            "runtime": "INTEGER",
            "budget": "BIGINT",
            "revenue": "BIGINT",
            "age_certifications": "ARRAY(TEXT)",
            "genres": "ARRAY(TEXT)",
            "keywords": "ARRAY(TEXT)",
            "tropes": "ARRAY(TEXT)",
            "homepage": "TEXT",
            "imdb_id": "TEXT",
            "wikidata_id": "TEXT",
            "facebook_id": "TEXT",
            "instagram_id": "TEXT",
            "twitter_id": "TEXT",
            "production_company_ids": "ARRAY(INTEGER)",
            "production_country_codes": "ARRAY(TEXT)",
            "origin_country_codes": "ARRAY(TEXT)",
            "original_language_code": "TEXT",
            "spoken_language_codes": "ARRAY(TEXT)",
            "is_anime": "BOOLEAN",
            "production_method": "TEXT",
            "animation_style": "TEXT",
            "tmdb_url": "TEXT",
            "tmdb_user_score_original": "DOUBLE",
            "tmdb_user_score_normalized_percent": "DOUBLE",
            "tmdb_user_score_rating_count": "INTEGER",
            "imdb_url": "TEXT",
            "imdb_user_score_original": "DOUBLE",
            "imdb_user_score_normalized_percent": "DOUBLE",
            "imdb_user_score_rating_count": "INTEGER",
            "metacritic_url": "TEXT",
            "metacritic_user_score_original": "DOUBLE",
            "metacritic_user_score_normalized_percent": "DOUBLE",
            "metacritic_user_score_rating_count": "INTEGER",
            "metacritic_meta_score_original": "DOUBLE",
            "metacritic_meta_score_normalized_percent": "DOUBLE",
            "metacritic_meta_score_review_count": "INTEGER",
            "rotten_tomatoes_url": "TEXT",
            "rotten_tomatoes_audience_score_original": "DOUBLE",
            "rotten_tomatoes_audience_score_normalized_percent": "DOUBLE",
            "rotten_tomatoes_audience_score_rating_count": "INTEGER",
            "rotten_tomatoes_tomato_score_original": "DOUBLE",
            "rotten_tomatoes_tomato_score_normalized_percent": "DOUBLE",
            "rotten_tomatoes_tomato_score_review_count": "INTEGER",
            "goodwatch_user_score_normalized_percent": "DOUBLE",
            "goodwatch_user_score_rating_count": "INTEGER",
            "goodwatch_official_score_normalized_percent": "DOUBLE",
            "goodwatch_official_score_review_count": "INTEGER",
            "goodwatch_overall_score_normalized_percent": "DOUBLE",
            "goodwatch_overall_score_voting_count": "INTEGER",
            "streaming_country_codes": "ARRAY(TEXT)",
            "streaming_service_ids": "ARRAY(INTEGER)",
            "streaming_availabilities": "ARRAY(TEXT)",
            "tmdb_recommendation_ids": "ARRAY(INTEGER)",
            "tmdb_similar_ids": "ARRAY(INTEGER)",
            "essence_text": "TEXT INDEX USING FULLTEXT",
            "essence_tags": "ARRAY(TEXT)",
            "fingerprint_scores": "OBJECT(DYNAMIC)",
            "fingerprint_highlight_keys": "ARRAY(TEXT)",
            "content_advisories": "ARRAY(TEXT)",
            "suitability_solo_watch": "BOOLEAN",
            "suitability_date_night": "BOOLEAN",
            "suitability_group_party": "BOOLEAN",
            "suitability_family": "BOOLEAN",
            "suitability_partner": "BOOLEAN",
            "suitability_friends": "BOOLEAN",
            "suitability_kids": "BOOLEAN",
            "suitability_teens": "BOOLEAN",
            "suitability_adults": "BOOLEAN",
            "suitability_intergenerational": "BOOLEAN",
            "suitability_public_viewing_safe": "BOOLEAN",
            "context_is_thought_provoking": "BOOLEAN",
            "context_is_pure_escapism": "BOOLEAN",
            "context_is_background_friendly": "BOOLEAN",
            "context_is_comfort_watch": "BOOLEAN",
            "context_is_binge_friendly": "BOOLEAN",
            "context_is_drop_in_friendly": "BOOLEAN",
            "tmdb_details_created_at": "TIMESTAMP",
            "tmdb_details_updated_at": "TIMESTAMP",
            "tmdb_providers_created_at": "TIMESTAMP",
            "tmdb_providers_updated_at": "TIMESTAMP",
            "imdb_ratings_created_at": "TIMESTAMP",
            "imdb_ratings_updated_at": "TIMESTAMP",
            "metacritic_ratings_created_at": "TIMESTAMP",
            "metacritic_ratings_updated_at": "TIMESTAMP",
            "rotten_tomatoes_ratings_created_at": "TIMESTAMP",
            "rotten_tomatoes_ratings_updated_at": "TIMESTAMP",
            "tvtropes_tags_created_at": "TIMESTAMP",
            "tvtropes_tags_updated_at": "TIMESTAMP",
            "dna_created_at": "TIMESTAMP",
            "dna_updated_at": "TIMESTAMP",
        },
        "primary_key": ["tmdb_id"],
        "shards": 12,
    },
    "show": {
        "columns": {
            "tmdb_id": "INTEGER",
            "title": "TEXT INDEX USING FULLTEXT",
            "original_title": "TEXT INDEX USING FULLTEXT",
            "tagline": "TEXT INDEX USING FULLTEXT",
            "synopsis": "TEXT INDEX USING FULLTEXT",
            "popularity": "DOUBLE",
            "status": "TEXT",
            "adult": "BOOLEAN",
            "poster_path": "TEXT",
            "backdrop_path": "TEXT",
            "release_year": "INTEGER",
            "first_air_date": "TIMESTAMP",
            "last_air_date": "TIMESTAMP",
            "number_of_seasons": "INTEGER",
            "number_of_episodes": "INTEGER",
            "episode_runtime": "ARRAY(INTEGER)",
            "in_production": "BOOLEAN",
            "budget": "BIGINT",
            "revenue": "BIGINT",
            "age_certifications": "ARRAY(TEXT)",
            "genres": "ARRAY(TEXT)",
            "keywords": "ARRAY(TEXT)",
            "tropes": "ARRAY(TEXT)",
            "homepage": "TEXT",
            "imdb_id": "TEXT",
            "wikidata_id": "TEXT",
            "facebook_id": "TEXT",
            "instagram_id": "TEXT",
            "twitter_id": "TEXT",
            "production_company_ids": "ARRAY(INTEGER)",
            "network_ids": "ARRAY(INTEGER)",
            "production_country_codes": "ARRAY(TEXT)",
            "origin_country_codes": "ARRAY(TEXT)",
            "original_language_code": "TEXT",
            "spoken_language_codes": "ARRAY(TEXT)",
            "is_anime": "BOOLEAN",
            "production_method": "TEXT",
            "animation_style": "TEXT",
            "tmdb_url": "TEXT",
            "tmdb_user_score_original": "DOUBLE",
            "tmdb_user_score_normalized_percent": "DOUBLE",
            "tmdb_user_score_rating_count": "INTEGER",
            "imdb_url": "TEXT",
            "imdb_user_score_original": "DOUBLE",
            "imdb_user_score_normalized_percent": "DOUBLE",
            "imdb_user_score_rating_count": "INTEGER",
            "metacritic_url": "TEXT",
            "metacritic_user_score_original": "DOUBLE",
            "metacritic_user_score_normalized_percent": "DOUBLE",
            "metacritic_user_score_rating_count": "INTEGER",
            "metacritic_meta_score_original": "DOUBLE",
            "metacritic_meta_score_normalized_percent": "DOUBLE",
            "metacritic_meta_score_review_count": "INTEGER",
            "rotten_tomatoes_url": "TEXT",
            "rotten_tomatoes_audience_score_original": "DOUBLE",
            "rotten_tomatoes_audience_score_normalized_percent": "DOUBLE",
            "rotten_tomatoes_audience_score_rating_count": "INTEGER",
            "rotten_tomatoes_tomato_score_original": "DOUBLE",
            "rotten_tomatoes_tomato_score_normalized_percent": "DOUBLE",
            "rotten_tomatoes_tomato_score_review_count": "INTEGER",
            "goodwatch_user_score_normalized_percent": "DOUBLE",
            "goodwatch_user_score_rating_count": "INTEGER",
            "goodwatch_official_score_normalized_percent": "DOUBLE",
            "goodwatch_official_score_review_count": "INTEGER",
            "goodwatch_overall_score_normalized_percent": "DOUBLE",
            "goodwatch_overall_score_voting_count": "INTEGER",
            "streaming_country_codes": "ARRAY(TEXT)",
            "streaming_service_ids": "ARRAY(INTEGER)",
            "streaming_availabilities": "ARRAY(TEXT)",
            "tmdb_recommendation_ids": "ARRAY(INTEGER)",
            "tmdb_similar_ids": "ARRAY(INTEGER)",
            "essence_text": "TEXT INDEX USING FULLTEXT",
            "essence_tags": "ARRAY(TEXT)",
            "fingerprint_scores": "OBJECT(DYNAMIC)",
            "fingerprint_highlight_keys": "ARRAY(TEXT)",
            "content_advisories": "ARRAY(TEXT)",
            "suitability_solo_watch": "BOOLEAN",
            "suitability_date_night": "BOOLEAN",
            "suitability_group_party": "BOOLEAN",
            "suitability_family": "BOOLEAN",
            "suitability_partner": "BOOLEAN",
            "suitability_friends": "BOOLEAN",
            "suitability_kids": "BOOLEAN",
            "suitability_teens": "BOOLEAN",
            "suitability_adults": "BOOLEAN",
            "suitability_intergenerational": "BOOLEAN",
            "suitability_public_viewing_safe": "BOOLEAN",
            "context_is_thought_provoking": "BOOLEAN",
            "context_is_pure_escapism": "BOOLEAN",
            "context_is_background_friendly": "BOOLEAN",
            "context_is_comfort_watch": "BOOLEAN",
            "context_is_binge_friendly": "BOOLEAN",
            "context_is_drop_in_friendly": "BOOLEAN",
            "tmdb_details_created_at": "TIMESTAMP",
            "tmdb_details_updated_at": "TIMESTAMP",
            "tmdb_providers_created_at": "TIMESTAMP",
            "tmdb_providers_updated_at": "TIMESTAMP",
            "imdb_ratings_created_at": "TIMESTAMP",
            "imdb_ratings_updated_at": "TIMESTAMP",
            "metacritic_ratings_created_at": "TIMESTAMP",
            "metacritic_ratings_updated_at": "TIMESTAMP",
            "rotten_tomatoes_ratings_created_at": "TIMESTAMP",
            "rotten_tomatoes_ratings_updated_at": "TIMESTAMP",
            "tvtropes_tags_created_at": "TIMESTAMP",
            "tvtropes_tags_updated_at": "TIMESTAMP",
            "dna_created_at": "TIMESTAMP",
            "dna_updated_at": "TIMESTAMP",
            # Last time the show's episodes were fetched from TMDB and copied to `episode`.
            # Set for a show without episodes too; NULL means not crawled yet.
            "episodes_updated_at": "TIMESTAMP",
        },
        "primary_key": ["tmdb_id"],
        "shards": 12,
    },
    "movie_series": {
        "columns": {
            "tmdb_id": "INTEGER",
            "name": "TEXT INDEX USING FULLTEXT",
            "poster_path": "TEXT",
            "backdrop_path": "TEXT",
        },
        "primary_key": ["tmdb_id"],
        "shards": 3,
    },
    "season": {
        "columns": {
            "tmdb_id": "INTEGER",
            "show_id": "INTEGER",
            "name": "TEXT INDEX USING FULLTEXT",
            "season_number": "INTEGER",
            "air_date": "TIMESTAMP",
            "episode_count": "INTEGER",
            "overview": "TEXT INDEX USING FULLTEXT",
            "poster_path": "TEXT",
            "vote_average": "DOUBLE",
        },
        "primary_key": ["tmdb_id"],
        "shards": 12,
    },
    # The episodes of every show in TMDB's numbering (Episode list), one row per TMDB episode
    # (f/sync/copy/tmdb_episodes, docs/episode-catalog.md). Season 0 holds the specials. One
    # show's list is one routed read. The key is the episode id, not season and number, because
    # a watch stores the id: a renumbered episode stays the same row.
    "episode": {
        "columns": {
            "show_id": "INTEGER",
            "tmdb_id": "INTEGER",  # TMDB episode id
            "season_tmdb_id": "INTEGER",  # season.tmdb_id
            "season_number": "INTEGER",  # 0 = special
            "episode_number": "INTEGER",
            "name": "TEXT",
            "air_date": "TIMESTAMP",  # midnight UTC of TMDB's date, NULL when unknown
            "runtime": "INTEGER",
            "still_path": "TEXT",
            "episode_type": "TEXT",  # standard, mid_season, finale
            "tmdb_user_score_original": "DOUBLE",
            "tmdb_user_score_rating_count": "INTEGER",
            # NULL until an import or backfill resolves them; the copy never writes them.
            "imdb_id": "TEXT",
            "tvdb_id": "INTEGER",
            # Set when TMDB no longer lists the episode. The row is deleted 180 days later.
            "removed_at": "TIMESTAMP",
        },
        "primary_key": ["show_id", "tmdb_id"],
        "clustered_by": "show_id",
        "shards": 6,
    },
    # IMDb episode ratings in IMDb's numbering (f/imdb_datasets/ingest), one row per TMDB show
    # and IMDb episode. A special has a NULL season_number. One show's grid is one routed read.
    "imdb_episode": {
        "columns": {
            "show_id": "INTEGER",
            "imdb_episode_id": "TEXT",
            "imdb_show_id": "TEXT",
            "season_number": "INTEGER",
            "episode_number": "INTEGER",
            "name": "TEXT",
            "imdb_user_score_original": "DOUBLE",
            "imdb_user_score_rating_count": "INTEGER",
        },
        "primary_key": ["show_id", "imdb_episode_id"],
        "clustered_by": "show_id",
        "shards": 6,
    },
    # IMDb season scores in IMDb's numbering: the vote-weighted mean of the season's rated
    # episodes, without specials. Seasons without a rated episode have no row.
    "imdb_season": {
        "columns": {
            "show_id": "INTEGER",
            "season_number": "INTEGER",
            "imdb_show_id": "TEXT",
            "imdb_user_score_original": "DOUBLE",
            "imdb_user_score_rating_count": "BIGINT",
            "imdb_rated_episode_count": "INTEGER",
            "max_episode_number": "INTEGER",
        },
        "primary_key": ["show_id", "season_number"],
        "clustered_by": "show_id",
        "shards": 6,
    },
    # Rotten Tomatoes and Metacritic season scores (f/critic_sites/crawl, #152), one row per
    # TMDB show and season in the site's numbering. A season the site lists without a critic
    # score has a row with NULL scores. Column names follow the show table's.
    "rotten_tomatoes_season": {
        "columns": {
            "show_id": "INTEGER",
            "season_number": "INTEGER",
            "rotten_tomatoes_url": "TEXT",
            "rotten_tomatoes_tomato_score_original": "DOUBLE",
            "rotten_tomatoes_tomato_score_review_count": "INTEGER",
            "rotten_tomatoes_audience_score_original": "DOUBLE",
            "rotten_tomatoes_audience_score_rating_count": "INTEGER",
        },
        "primary_key": ["show_id", "season_number"],
        "clustered_by": "show_id",
        "shards": 6,
    },
    "metacritic_season": {
        "columns": {
            "show_id": "INTEGER",
            "season_number": "INTEGER",
            "metacritic_url": "TEXT",
            "metacritic_meta_score_original": "DOUBLE",
            "metacritic_meta_score_review_count": "INTEGER",
            "metacritic_user_score_original": "DOUBLE",
            "metacritic_user_score_rating_count": "INTEGER",
        },
        "primary_key": ["show_id", "season_number"],
        "clustered_by": "show_id",
        "shards": 6,
    },
    # ============================
    # ===== Related Metadata =====
    # ============================
    "media_image": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "image_type": "TEXT",
            "url_path": "TEXT",
            "language_code": "TEXT",
            "aspect_ratio": "DOUBLE",
            "width": "INTEGER",
            "height": "INTEGER",
            "tmdb_vote_average": "DOUBLE",
            "tmdb_vote_count": "INTEGER",
        },
        "primary_key": [
            "media_tmdb_id",
            "media_type",
            "image_type",
            "url_path",
            "language_code",
        ],
        "shards": 12,
    },
    "media_video": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "tmdb_id": "TEXT",
            "video_type": "TEXT",
            "site": "TEXT",
            "site_key": "TEXT",
            "language_code": "TEXT",
            "country_code": "TEXT",
            "name": "TEXT",
            "size": "INTEGER",
            "official": "BOOLEAN",
            "published_at": "TIMESTAMP",
        },
        "primary_key": ["media_tmdb_id", "media_type", "tmdb_id"],
        "shards": 12,
    },
    "trope": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "name": "TEXT INDEX USING FULLTEXT",
            "url": "TEXT",
            "content": "TEXT INDEX USING FULLTEXT",
        },
        "primary_key": ["media_tmdb_id", "media_type", "name"],
        "shards": 3,
    },
    "alternative_title": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "country_code": "TEXT",
            "title": "TEXT INDEX USING FULLTEXT",
        },
        "primary_key": ["media_tmdb_id", "media_type", "country_code"],
        "shards": 6,
    },
    "translation": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "language_code": "TEXT",
            "country_code": "TEXT",
            "name": "TEXT",
            "english_name": "TEXT",
            "title": "TEXT INDEX USING FULLTEXT",
            "overview": "TEXT INDEX USING FULLTEXT",
            "tagline": "TEXT",
            "homepage": "TEXT",
            "runtime": "INTEGER",
        },
        "primary_key": ["media_tmdb_id", "media_type", "language_code", "country_code"],
        "shards": 6,
    },
    "release_event": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "country_code": "TEXT",
            "release_type": "INTEGER",
            "release_date": "TIMESTAMP",
            "certification": "TEXT",
            "note": "TEXT",
            "descriptors": "ARRAY(TEXT)",
        },
        "primary_key": [
            "media_tmdb_id",
            "media_type",
            "country_code",
            "release_date",
            "release_type",
            "certification",
        ],
        "shards": 6,
    },
    "production_company": {
        "columns": {
            "tmdb_id": "INTEGER",
            "name": "TEXT INDEX USING FULLTEXT",
            "logo_path": "TEXT",
            "origin_country": "TEXT",
        },
        "primary_key": ["tmdb_id"],
        "shards": 2,
    },
    "network": {
        "columns": {
            "tmdb_id": "INTEGER",
            "name": "TEXT INDEX USING FULLTEXT",
            "logo_path": "TEXT",
            "origin_country": "TEXT",
        },
        "primary_key": ["tmdb_id"],
        "shards": 2,
    },
    "person": {
        "columns": {
            "tmdb_id": "INTEGER",
            "name": "TEXT INDEX USING FULLTEXT",
            "original_name": "TEXT",
            "profile_path": "TEXT",
            "popularity": "DOUBLE",
            "adult": "BOOLEAN",
            "gender": "INTEGER",
            "known_for_department": "TEXT",
        },
        "primary_key": ["tmdb_id"],
        "shards": 6,
    },
    "person_appeared_in": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "person_tmdb_id": "INTEGER",
            "credit_id": "TEXT",
            "character": "TEXT",
            "order_default": "INTEGER",
            "episode_count_character": "INTEGER",
            "episode_count_total": "INTEGER",
        },
        "primary_key": ["media_tmdb_id", "media_type", "person_tmdb_id", "credit_id"],
        "shards": 6,
    },
    "person_worked_on": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "person_tmdb_id": "INTEGER",
            "credit_id": "TEXT",
            "job": "TEXT",
            "department": "TEXT",
            "episode_count_job": "INTEGER",
            "episode_count_total": "INTEGER",
        },
        "primary_key": ["media_tmdb_id", "media_type", "person_tmdb_id", "credit_id"],
        "shards": 6,
    },
    "streaming_evidence": {
        "columns": {"media_tmdb_id": "INTEGER", "media_type": "TEXT", "country_code": "TEXT", "payload": "TEXT INDEX OFF STORAGE WITH (columnstore = false)"},
        "primary_key": ["media_tmdb_id", "media_type", "country_code"],
        "shards": 6,
    },
    "streaming_availability": {
        "columns": {
            "media_tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "country_code": "TEXT",
            "streaming_type": "TEXT",
            "streaming_service_id": "INTEGER",
            "display_priority": "INTEGER",
            "tmdb_link": "TEXT",
            "stream_url": "TEXT",
            "price_dollar": "DOUBLE",
            "quality": "TEXT",
        },
        "primary_key": [
            "media_tmdb_id",
            "media_type",
            "country_code",
            "streaming_service_id",
            "streaming_type",
        ],
        "shards": 12,
    },
    # ============================
    # ===== User Data ============
    # ============================
    # init/cratedb adds created_at and updated_at to every table; the user tables declare them
    # because the webapp reads them (the Wishlist sorts by created_at, the time a title was added).
    "user_setting": {
        "columns": {
            "user_id": "TEXT",
            "key": "TEXT",
            "value": "TEXT",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        },
        "primary_key": ["user_id", "key"],
        "shards": 3,
    },
    "user_skipped": {
        "columns": {
            "user_id": "TEXT",
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "shards": 3,
    },
    "user_not_interested": {
        "columns": {
            "user_id": "TEXT",
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "shards": 3,
    },
    "user_wishlist": {
        "columns": {
            "user_id": "TEXT",
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "shards": 6,
    },
    "user_score": {
        "columns": {
            "user_id": "TEXT",
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "score": "INTEGER",
            "review": "TEXT",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "shards": 6,
    },
    "user_favorite": {
        "columns": {
            "user_id": "TEXT",
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "shards": 3,
    },
    "user_watch_history": {
        "columns": {
            "user_id": "TEXT",
            "tmdb_id": "INTEGER",
            "media_type": "TEXT CHECK (media_type IN ('movie','show'))",
            # multi watch
            "watched_at_list": "ARRAY(TIMESTAMP)",
            # “current watch” state for this title
            "progress_percent": "DOUBLE",
            "progress_seconds": "INTEGER",
            "season_number": "INTEGER",
            "episode_number": "INTEGER",
            "ingest_source": "TEXT",
            # convenience denorms
            "first_watched_at": "TIMESTAMP",
            "last_watched_at": "TIMESTAMP",
            "watch_count": "INTEGER",
            "created_at": "TIMESTAMP",
            "updated_at": "TIMESTAMP",
        },
        "primary_key": ["user_id", "tmdb_id", "media_type"],
        "shards": 6,
    },
    # ============================
    # ===== Search embeddings (f/search/embed_titles) =====
    # ============================
    # The vocabulary of the terms_bm25f_v1 sparse vectors. A term keeps its id forever.
    "search_terms": {
        "columns": {
            "term": "TEXT",
            "id": "INTEGER",
        },
        "primary_key": ["term"],
        "shards": 4,
    },
    # Each Qdrant point's embedding input hash, to skip titles whose text didn't change.
    "search_embedding_inputs": {
        "columns": {
            "point_id": "BIGINT",
            "input_hash": "TEXT",
            "embedded_at": "TIMESTAMP",
        },
        "primary_key": ["point_id"],
        "shards": 4,
    },
    # Checkpoints and the next term id, as JSON.
    "search_embedding_state": {
        "columns": {
            "name": "TEXT",
            "value": "TEXT",
        },
        "primary_key": ["name"],
        "shards": 1,
    },
    # ============================
    # ===== Search indexes (f/search/build_indexes) =====
    # ============================
    # One row per build with its file list (manifest, JSON), plus the row build_id = 'current'
    # that holds the manifest of the build the webapp loads. The files are in the blob table
    # search_index_files.
    "search_index_builds": {
        "columns": {
            "build_id": "TEXT",
            "status": "TEXT",
            "manifest": "TEXT INDEX OFF STORAGE WITH (columnstore = false)",
            "started_at": "TIMESTAMP",
            "finished_at": "TIMESTAMP",
        },
        "primary_key": ["build_id"],
        "shards": 1,
    },
    # ============================
    # ===== Webapp: combined search (goodwatch-webapp/app/server/combined-search) =====
    # ============================
    # The paid query model's kill switch. One row, id 'paid'.
    "search_control": {
        "columns": {
            "id": "TEXT",
            "halted": "BOOLEAN NOT NULL",
        },
        "primary_key": ["id"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
        "rows": [{"id": "paid", "halted": False}],
    },
    "search_interpretations": {
        "columns": {
            "cache_key": "TEXT",
            "attempt_id": "TEXT NOT NULL",
            "status": "TEXT NOT NULL",
            "contract": "TEXT NOT NULL",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "ciphertext": "TEXT INDEX OFF",
        },
        "primary_key": ["cache_key"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    # Append-only estimates and adjustments. SUM(amount_nano) is accounted spend.
    # Settlements stay in the original estimate's UTC budget window.
    "search_spending": {
        "columns": {
            "id": "TEXT",
            "attempt_id": "TEXT NOT NULL",
            "cache_key": "TEXT NOT NULL",
            "event": "TEXT NOT NULL",
            "budget_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "amount_nano": "BIGINT NOT NULL",
            "price_version": "TEXT",
            "evidence": "TEXT INDEX OFF",
        },
        "primary_key": ["id"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    "search_history": {
        "columns": {
            "id": "TEXT",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "account_id": "TEXT",
            "ciphertext": "TEXT INDEX OFF",
            "elapsed_ms": "INTEGER NOT NULL",
            "charged_nano": "BIGINT NOT NULL",
            "outcome": "TEXT NOT NULL",
            "reason": "TEXT",
            # Why today's ranking served a search while SEARCH_RANKING_MODE=on (the new ranking serves otherwise).
            # Values: lesser known, basic search, index not loaded, encoder not ready, encoder queue full, timeout,
            # error. NULL when the new ranking served, and for every search in modes off and shadow.
            "ranker_fallback": "TEXT",
            # The ranking that produced the served list.
            "ranker_version": "TEXT",
            # Milliseconds per stage of the served search, for example {"reading": 612.4, "ranking": 180.2,
            # "display": 21.5}. IGNORED: the keys can change without a schema change, and they aren't indexed.
            "stage_ms": "OBJECT(IGNORED)",
        },
        "primary_key": ["id"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    # One row per search that shadow mode saw (SEARCH_RANKING_MODE=shadow). history_id joins search_history.id.
    # The query text isn't stored here. Everything derived from it (the encoded texts, reference names, profile
    # terms) is in ciphertext, sealed with SEARCH_STORAGE_KEY like search_history.ciphertext.
    "search_shadow": {
        "columns": {
            "id": "TEXT",
            "history_id": "TEXT",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            # ranked, skipped or failed; reason says why a search was skipped or failed.
            "outcome": "TEXT NOT NULL",
            "reason": "TEXT",
            "served_ranker_version": "TEXT",
            "ranker_version": "TEXT",
            "build_id": "TEXT",
            # general, non_english or reference
            "route": "TEXT",
            "lesser_known": "BOOLEAN",
            # Keys (movie:<tmdb id>, show:<tmdb id>, person:<tmdb id>) of the served list's first 50 rows, in order.
            "served_keys": "ARRAY(TEXT)",
            # The new ranking's list (at most 50), in order, with its blended scores.
            "ranked_keys": "ARRAY(TEXT)",
            "ranked_scores": "ARRAY(DOUBLE)",
            "pool_size": "INTEGER",
            # Milliseconds per stage of the new ranking, plus display (its display fields) and waited (queue
            # before it ran).
            "stage_ms": "OBJECT(IGNORED)",
            # Each Qdrant request: {name, queries, serverMs, wallMs}.
            "rounds": "ARRAY(OBJECT(IGNORED))",
            "ciphertext": "TEXT INDEX OFF",
        },
        "primary_key": ["id"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    # ============================
    # ===== Webapp: share lists and public profiles (docs/implementation/share-lists/README.md) =====
    # ============================
    # Deletes are soft: rows get deleted_at (and released_at for renamed handles), and every read filters them out.
    # A person's ranking of exactly five titles. items is in rank order.
    "user_list": {
        "columns": {
            "id": "TEXT",
            "user_id": "TEXT NOT NULL",
            "title": "TEXT NOT NULL",
            "prompt_id": "TEXT",
            "design": "TEXT NOT NULL",
            "theme": "TEXT NOT NULL",
            "signature": "TEXT",
            "items": "ARRAY(OBJECT(STRICT) AS (media_type TEXT, tmdb_id BIGINT))",
            "visibility": "TEXT NOT NULL",
            "remixed_from": "TEXT",
            "content_hash": "TEXT NOT NULL",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "deleted_at": "TIMESTAMP WITH TIME ZONE",
        },
        "primary_key": ["id"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    "user_profile": {
        "columns": {
            "user_id": "TEXT",
            "handle": "TEXT NOT NULL",
            "display_name": "TEXT",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "deleted_at": "TIMESTAMP WITH TIME ZONE",
        },
        "primary_key": ["user_id"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    # Crate has no unique index on non-key columns, so handles are claimed here: the handle is the key, and an
    # insert with ON CONFLICT DO NOTHING lets exactly one person claim it. A handle renamed away from (released_at)
    # or of a deleted account (deleted_at) is on hold for 90 days before anyone else can claim it.
    "user_handle": {
        "columns": {
            "handle": "TEXT",
            "user_id": "TEXT NOT NULL",
            "claimed_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "released_at": "TIMESTAMP WITH TIME ZONE",
            "deleted_at": "TIMESTAMP WITH TIME ZONE",
        },
        "primary_key": ["handle"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    # ============================
    # ===== Webapp: IMDb ratings import (goodwatch-webapp/app/server/imdb-import) =====
    # ============================
    # One row per uploaded file. status: preview (nothing written to user_score yet), running, done, failed, undone.
    # counts is the preview's outcome counts as JSON text. added, updated, kept and failed count what the apply
    # wrote. updated_at is the apply's heartbeat: a running import whose heartbeat is old has stalled and can be
    # resumed. confirmed_at is written to user_score.created_at/updated_at by this import, which is how the apply
    # recognises its own writes after an interruption.
    "user_import": {
        "columns": {
            "id": "TEXT",
            "user_id": "TEXT NOT NULL",
            "source": "TEXT NOT NULL",
            "status": "TEXT NOT NULL",
            "file_name": "TEXT",
            "conflict_choice": "TEXT",
            "counts": "TEXT NOT NULL",
            "processed": "INTEGER NOT NULL",
            "total": "INTEGER NOT NULL",
            "added": "INTEGER NOT NULL",
            "updated": "INTEGER NOT NULL",
            "kept": "INTEGER NOT NULL",
            "failed": "INTEGER NOT NULL",
            "without_fingerprint": "INTEGER",
            "error": "TEXT",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "confirmed_at": "TIMESTAMP WITH TIME ZONE",
            "finished_at": "TIMESTAMP WITH TIME ZONE",
        },
        "primary_key": ["id"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
    # One row per data row of the file, in file order. The source observation (IMDb ID, rating, date rated) is kept
    # apart from the effective GoodWatch rating in user_score.
    # outcome: new, update, unchanged, conflict, unmatched, unsupported, invalid.
    # current_score is the member's GoodWatch rating when the preview was made.
    # apply_state: NULL (nothing written), added, updated, kept (the GoodWatch rating stayed), failed (retry), undone.
    # prior_score and applied_score are set when the import writes the rating: what undo restores, and what it must
    # still find in user_score to do so. A later import reads applied_score to tell its own ratings from the member's.
    "user_import_item": {
        "columns": {
            "import_id": "TEXT NOT NULL",
            "row_index": "INTEGER NOT NULL",
            "user_id": "TEXT NOT NULL",
            "imdb_id": "TEXT",
            "title": "TEXT",
            "year": "INTEGER",
            "title_type": "TEXT",
            "raw_rating": "TEXT",
            "imdb_score": "INTEGER",
            "date_rated": "TEXT",
            "outcome": "TEXT NOT NULL",
            "reason": "TEXT",
            "tmdb_id": "BIGINT",
            "media_type": "TEXT",
            "current_score": "INTEGER",
            "apply_state": "TEXT",
            "prior_score": "INTEGER",
            "applied_score": "INTEGER",
            "applied_at": "TIMESTAMP WITH TIME ZONE",
        },
        "primary_key": ["import_id", "row_index"],
        "shards": 1,
        "timestamps": False,
        "replicas": "0-1",
    },
}

# Blob tables: files stored under the SHA-1 of their content, read over HTTP at
# /_blobs/<table>/<sha1>.
BLOB_TABLES = {
    # The search index files, one gzipped JSON file per index (f/search/build_indexes).
    "search_index_files": {"shards": 3},
}


def main():
    pass
