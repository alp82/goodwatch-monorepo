CREATE TABLE IF NOT EXISTS movies (
    tmdb_id INTEGER PRIMARY KEY,

    -- title and description
    original_title VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    tagline TEXT,
    synopsis TEXT,
    alternative_titles JSONB,

    -- status and flags
    popularity NUMERIC NOT NULL,
    status VARCHAR(255),
    adult BOOLEAN NOT NULL,

    -- production & releases
    release_date DATE,
    release_year INTEGER,
    runtime INTEGER,
    budget BIGINT,
    revenue BIGINT,
    production_company_ids INTEGER[],
    certifications JSONB,

    -- cast and crew
    "cast" JSONB,
    crew JSONB,

    -- images and videos
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),
    images JSONB,
    videos JSONB,

    -- languages
    original_language_code CHAR(2),
    spoken_language_codes CHAR(2)[],
    production_country_codes CHAR(2)[],
    streaming_country_codes CHAR(2)[],
    translations JSONB,

    -- tags
    genres VARCHAR(255)[],
    keywords VARCHAR(255)[],
    trope_names VARCHAR(255)[],
    tropes JSONB,

    -- streaming
    streaming_providers JSONB,

    -- ratings
    tmdb_url TEXT,
    tmdb_user_score_original FLOAT,
    tmdb_user_score_normalized_percent FLOAT,
    tmdb_user_score_rating_count FLOAT,
    imdb_url TEXT,
    imdb_user_score_original FLOAT,
    imdb_user_score_normalized_percent FLOAT,
    imdb_user_score_rating_count FLOAT,
    metacritic_url TEXT,
    metacritic_user_score_original FLOAT,
    metacritic_user_score_normalized_percent FLOAT,
    metacritic_user_score_rating_count FLOAT,
    metacritic_meta_score_original FLOAT,
    metacritic_meta_score_normalized_percent FLOAT,
    metacritic_meta_score_review_count FLOAT,
    rotten_tomatoes_url TEXT,
    rotten_tomatoes_audience_score_original FLOAT,
    rotten_tomatoes_audience_score_normalized_percent FLOAT,
    rotten_tomatoes_audience_score_rating_count FLOAT,
    rotten_tomatoes_tomato_score_original FLOAT,
    rotten_tomatoes_tomato_score_normalized_percent FLOAT,
    rotten_tomatoes_tomato_score_review_count FLOAT,
    aggregated_user_score_normalized_percent FLOAT,
    aggregated_user_score_rating_count FLOAT,
    aggregated_official_score_normalized_percent FLOAT,
    aggregated_official_score_review_count FLOAT,
    aggregated_overall_score_normalized_percent FLOAT,
    aggregated_overall_score_voting_count FLOAT,

    -- updated_at
    tmdb_details_updated_at DATE,
    tmdb_providers_updated_at DATE,
    imdb_ratings_updated_at DATE,
    metacritic_ratings_updated_at DATE,
    rotten_tomatoes_ratings_updated_at DATE,
    tvtropes_tags_updated_at DATE,

    -- relations
    collection JSONB,
    tmdb_recommendation_ids INTEGER[],
    tmdb_similar_ids INTEGER[],

    -- social media
    homepage TEXT,
    wikidata_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    twitter_id VARCHAR(255),

    -- metadata
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);