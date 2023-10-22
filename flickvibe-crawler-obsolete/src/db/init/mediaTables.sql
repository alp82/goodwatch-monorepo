-- media types (movie, tv, etc.)
CREATE TABLE IF NOT EXISTS media_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- daily media
CREATE TABLE IF NOT EXISTS daily_media (
    tmdb_id INTEGER NOT NULL,
    media_type_id INTEGER NOT NULL REFERENCES media_types (id),
    last_updated DATE,
    original_title VARCHAR(255) NOT NULL,
    popularity NUMERIC NOT NULL,
    video BOOLEAN DEFAULT FALSE,
    adult BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (tmdb_id, media_type_id)
);

-- people
CREATE TABLE IF NOT EXISTS people (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,
    also_known_as VARCHAR(255)[],
    biography TEXT,
    popularity NUMERIC,
    gender VARCHAR(255),
    place_of_birth VARCHAR(255),
    birthday DATE,
    deathday DATE,
    known_for_department VARCHAR(255),
    profile_path VARCHAR(255),
    homepage TEXT,
    adult BOOLEAN NOT NULL DEFAULT FALSE,

    imdb_id VARCHAR(255),
    freebase_mid VARCHAR(255),
    freebase_id VARCHAR(255),
    tvrage_id VARCHAR(255),
    wikidata_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    tiktok_id VARCHAR(255),
    twitter_id VARCHAR(255),
    youtube_id VARCHAR(255)
);

-- media
CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    media_type_id INTEGER NOT NULL REFERENCES media_types (id),

    title VARCHAR(255) NOT NULL,
    synopsis TEXT NOT NULL,
    tagline VARCHAR(255) NOT NULL,
    release_date DATE,
    release_year INTEGER,
    popularity NUMERIC NOT NULL,
    status VARCHAR(255),

    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),

    titles_dashed VARCHAR(255)[],
    titles_underscored VARCHAR(255)[],
    titles_pascal_cased VARCHAR(255)[],
    original_title VARCHAR(255),
    original_language_code CHAR(2),
    spoken_language_codes CHAR(2)[],
    production_country_codes CHAR(2)[],
    homepage TEXT,
    adult BOOLEAN NOT NULL,

    imdb_id VARCHAR(255),
    UNIQUE (tmdb_id, media_type_id)
);

-- movies
CREATE TABLE IF NOT EXISTS movies (
    runtime INTEGER,
    budget BIGINT NOT NULL,
    revenue BIGINT NOT NULL,

    wikidata_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    twitter_id VARCHAR(255),
    UNIQUE (tmdb_id, media_type_id)
) INHERITS (media);

-- tv shows
CREATE TABLE IF NOT EXISTS tv (
    number_of_seasons INTEGER NOT NULL,
    number_of_episodes INTEGER NOT NULL,
    episode_runtime INTEGER[] NOT NULL,
    in_production BOOLEAN NOT NULL,
    tv_type VARCHAR(255) NOT NULL,

    last_air_date DATE,
    origin_country_code CHAR(2)[],
    language_codes CHAR(2)[],

    freebase_mid VARCHAR(255),
    freebase_id VARCHAR(255),
    tvdb_id VARCHAR(255),
    tvrage_id VARCHAR(255),
    wikidata_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    twitter_id VARCHAR(255),
    UNIQUE (tmdb_id, media_type_id)
) INHERITS (media);

-- data sources
CREATE TABLE IF NOT EXISTS data_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- import data sources
CREATE TABLE IF NOT EXISTS data_sources_for_import (
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    data_status VARCHAR(50) NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_successful_attempt_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (data_source_id)
);

-- media data sources
CREATE TABLE IF NOT EXISTS data_sources_for_media (
    tmdb_id INTEGER NOT NULL,
    media_type_id INTEGER NOT NULL REFERENCES media_types (id),
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    data_status VARCHAR(50) NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_successful_attempt_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (tmdb_id, media_type_id, data_source_id)
);

-- movie collections
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    overview TEXT,
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS media_collections (
    media_id INTEGER NOT NULL,
    collection_id INTEGER REFERENCES collections (id),
    PRIMARY KEY (media_id, collection_id)
);

-- tv seasons
CREATE TABLE IF NOT EXISTS media_seasons (
    media_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    synopsis TEXT,
    air_date DATE,
    season_number INTEGER NOT NULL,
    episode_count INTEGER NOT NULL,
    poster_path VARCHAR(255),
    PRIMARY KEY (media_id, name, season_number)
);

-- media ratings
CREATE TABLE IF NOT EXISTS media_ratings (
    media_id INTEGER NOT NULL,
    rating_provider VARCHAR(50) NOT NULL,
    url VARCHAR(255) NOT NULL,
    critic_score DECIMAL(5,2),
    critic_score_original DECIMAL(5,2),
    critic_rating_count INTEGER,
    user_score DECIMAL(5,2),
    user_score_original DECIMAL(5,2),
    user_rating_count INTEGER,
    PRIMARY KEY (media_id, rating_provider)
);

-- season ratings
CREATE TABLE IF NOT EXISTS media_season_ratings (
    media_id INTEGER NOT NULL,
    rating_provider VARCHAR(50) NOT NULL,
    season_number INTEGER NOT NULL,
    url VARCHAR(255) NOT NULL,
    critic_score DECIMAL(5,2),
    critic_score_original DECIMAL(5,2),
    critic_rating_count INTEGER,
    user_score DECIMAL(5,2),
    user_score_original DECIMAL(5,2),
    user_rating_count INTEGER,
    PRIMARY KEY (media_id, rating_provider, season_number)
);

-- streaming providers
CREATE TABLE IF NOT EXISTS streaming_providers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  logo_path VARCHAR(255) NOT NULL,
  display_priority INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_streaming_providers (
    media_id INTEGER NOT NULL,
    streaming_provider_id INTEGER NOT NULL REFERENCES streaming_providers (id),
    streaming_type VARCHAR(50),
    country_code CHAR(2) NOT NULL,
    PRIMARY KEY (media_id, streaming_provider_id, streaming_type, country_code)
);

-- media tags
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    tags_provider VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    UNIQUE (tags_provider, name)
);

CREATE TABLE IF NOT EXISTS media_tags (
    media_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL REFERENCES tags (id),
    url VARCHAR(255) NOT NULL,
    content TEXT,
    PRIMARY KEY (media_id, tag_id)
);

-- media genres
CREATE TABLE IF NOT EXISTS genres (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS media_genres (
    media_id INTEGER NOT NULL,
    genre_id INTEGER NOT NULL REFERENCES genres (id),
    PRIMARY KEY (media_id, genre_id)
);

-- media alternative titles
CREATE TABLE IF NOT EXISTS media_alternative_titles (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(255),
    language_code CHAR(2),
    UNIQUE (media_id, title, type, language_code)
);

-- media people
CREATE TABLE IF NOT EXISTS media_cast (
    media_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    character_name TEXT,
    episode_count INTEGER,
    display_priority INTEGER NOT NULL,
    PRIMARY KEY (media_id, person_id)
);

CREATE TABLE IF NOT EXISTS media_crew (
    media_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    job VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    episode_count INTEGER,
    display_priority INTEGER NOT NULL,
    PRIMARY KEY (media_id, person_id)
);

-- media networks
CREATE TABLE IF NOT EXISTS networks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    origin_country_code CHAR(2) NOT NULL,
    logo_path VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS media_networks (
    media_id INTEGER NOT NULL,
    network_id INTEGER REFERENCES networks (id),
    PRIMARY KEY (media_id, network_id)
);

-- media production companies
CREATE TABLE IF NOT EXISTS production_companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    origin_country_code CHAR(2) NOT NULL,
    logo_path VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS media_production_companies (
    media_id INTEGER NOT NULL,
    production_company_id INTEGER REFERENCES production_companies (id),
    PRIMARY KEY (media_id, production_company_id)
);

-- media images
CREATE TABLE IF NOT EXISTS media_images (
    media_id INTEGER NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    image_type VARCHAR(50) NOT NULL,
    aspect_ratio NUMERIC(5,3) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    vote_average NUMERIC(5,2) NOT NULL,
    vote_count INTEGER NOT NULL,
    language_code CHAR(2),
    PRIMARY KEY (media_id, image_path)
);

-- people images
-- CREATE TABLE IF NOT EXISTS people_images (
--     person_id INTEGER NOT NULL,
--     image_path VARCHAR(255) PRIMARY KEY,
--     image_type VARCHAR(50) NOT NULL,
--     aspect_ratio NUMERIC(5,3) NOT NULL,
--     width INTEGER NOT NULL,
--     height INTEGER NOT NULL,
--     vote_average NUMERIC(5,2) NOT NULL,
--     vote_count INTEGER NOT NULL,
--     language_code CHAR(2),
--     PRIMARY KEY (person_id, image_path)
-- );

-- media videos
CREATE TABLE IF NOT EXISTS media_videos (
    media_id INTEGER NOT NULL,
    video_site_key VARCHAR(255) NOT NULL,
    video_site VARCHAR(50) NOT NULL,
    video_type VARCHAR(50) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    language_code VARCHAR(2) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL,
    official BOOLEAN NOT NULL,
    published_at TIMESTAMP NOT NULL,
    PRIMARY KEY (media_id, video_site_key, video_site)
);

-- media relations
CREATE TABLE IF NOT EXISTS media_relations (
    media_id INTEGER NOT NULL,
    related_media_id INTEGER NOT NULL,
    relation_type VARCHAR(50) NOT NULL,
    PRIMARY KEY (media_id, related_media_id, relation_type)
);

-- media releases and certifications
CREATE TABLE IF NOT EXISTS media_certifications (
    media_id INTEGER NOT NULL,
    certification VARCHAR(50),
    country_code CHAR(2) NOT NULL,
    language_code CHAR(2),
    release_type VARCHAR(50),
    release_date DATE,
    note TEXT,
    UNIQUE (media_id, certification, country_code, language_code, release_type)
);

-- media translations
CREATE TABLE IF NOT EXISTS media_translations (
    media_id INTEGER NOT NULL,
    country_code CHAR(2) NOT NULL,
    language_code CHAR(2) NOT NULL,
    title VARCHAR(255),
    tagline VARCHAR(255),
    synopsis TEXT,
    homepage TEXT,
    runtime INTEGER,
    PRIMARY KEY (media_id, country_code, language_code)
);

-- people translations
CREATE TABLE IF NOT EXISTS people_translations (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL,
    language_code CHAR(2) NOT NULL,
    language_name TEXT NOT NULL,
    language_name_english TEXT NOT NULL,
    biography TEXT,
    UNIQUE (person_id, country_code, language_code)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_daily_media_tmdb_id ON daily_media (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_daily_media_media_type_id ON daily_media (media_type_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_for_media_tmdb_id_media_type_id ON data_sources_for_media (tmdb_id, media_type_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_for_media_data_source_id ON data_sources_for_media (data_source_id);
CREATE INDEX IF NOT EXISTS idx_people_id ON people (id);
CREATE INDEX IF NOT EXISTS idx_people_tmdb_id ON people (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_id ON media (id);
CREATE INDEX IF NOT EXISTS idx_media_tmdb_id ON media (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_alternative_titles_media_id ON media_alternative_titles (media_id);
CREATE INDEX IF NOT EXISTS idx_media_genres_media_id ON media_genres (media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON media_tags (media_id);
CREATE INDEX IF NOT EXISTS idx_media_collections_media_id ON media_collections (media_id);
CREATE INDEX IF NOT EXISTS idx_media_seasons_media_id ON media_seasons (media_id);
CREATE INDEX IF NOT EXISTS idx_media_ratings_media_id ON media_ratings (media_id);
CREATE INDEX IF NOT EXISTS idx_media_season_ratings_media_id ON media_season_ratings (media_id);
CREATE INDEX IF NOT EXISTS idx_media_streaming_providers_media_id ON media_streaming_providers (media_id);
CREATE INDEX IF NOT EXISTS idx_media_production_companies_media_id ON media_production_companies (media_id);
CREATE INDEX IF NOT EXISTS idx_media_networks_media_id ON media_networks (media_id);
CREATE INDEX IF NOT EXISTS idx_media_cast_media_id ON media_cast (media_id);
CREATE INDEX IF NOT EXISTS idx_media_crew_media_id ON media_crew (media_id);
CREATE INDEX IF NOT EXISTS idx_media_images_media_id ON media_images (media_id);
CREATE INDEX IF NOT EXISTS idx_media_videos_media_id ON media_videos (media_id);
CREATE INDEX IF NOT EXISTS idx_media_relations_media_id ON media_relations (media_id);
CREATE INDEX IF NOT EXISTS idx_media_certifications_media_id ON media_certifications (media_id);
CREATE INDEX IF NOT EXISTS idx_media_translations_media_id ON media_translations (media_id);

-- initial data
INSERT INTO media_types (id, name)
VALUES
    (1, 'movie'),
    (2, 'tv')
ON CONFLICT (name) DO NOTHING;

INSERT INTO data_sources (id, name)
VALUES
    (1, 'tmdb_daily'),
    (2, 'tmdb_details'),
    (3, 'tv_tropes_tags'),
    (4, 'imdb_ratings'),
    (5, 'metacritic_ratings'),
    (6, 'rotten_tomatoes_ratings')
ON CONFLICT (name) DO NOTHING;
