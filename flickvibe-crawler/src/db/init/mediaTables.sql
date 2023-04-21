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
    name VARCHAR(255) NOT NULL,
    also_known_as VARCHAR(255)[],
    biography TEXT,
    popularity NUMERIC,

    gender INTEGER,
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

    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),

    status VARCHAR(255),
    original_title VARCHAR(255),
    original_language_code CHAR(2),
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
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    overview TEXT,
    air_date DATE,
    season_number INTEGER NOT NULL,
    episode_count INTEGER NOT NULL,
    poster_path VARCHAR(255)
);

-- media ratings
CREATE TABLE IF NOT EXISTS media_ratings (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    score DECIMAL(5,2) NOT NULL,
    original_score DECIMAL(5,2) NOT NULL,
    vote_count INTEGER,
    PRIMARY KEY (media_id, data_source_id)
);

-- season ratings
CREATE TABLE IF NOT EXISTS media_season_ratings (
    media_season_id INTEGER NOT NULL REFERENCES media_seasons (id) ON DELETE CASCADE,
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    score DECIMAL(5,2) NOT NULL,
    original_score DECIMAL(5,2) NOT NULL,
    vote_count INTEGER,
    PRIMARY KEY (media_season_id, data_source_id)
);

-- streaming providers
CREATE TABLE IF NOT EXISTS streaming_providers (
  id SERIAL PRIMARY KEY,
  logo_path VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_priority INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS streaming_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  display_priority INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_streaming_providers (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    streaming_provider_id INTEGER NOT NULL REFERENCES streaming_providers (id),
    streaming_type_id INTEGER NOT NULL REFERENCES streaming_types (id),
    country_code CHAR(2) NOT NULL,
    PRIMARY KEY (media_id, streaming_provider_id, streaming_type_id, country_code)
);

-- media tags
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    UNIQUE (data_source_id, name)
);

CREATE TABLE IF NOT EXISTS media_tags (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags (id),
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
    character_name VARCHAR(255) NOT NULL,
    episode_count INTEGER,
    display_priority INTEGER NOT NULL,
    PRIMARY KEY (media_id, person_id)
);

CREATE TABLE IF NOT EXISTS media_crew (
    media_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    jobs VARCHAR(255)[] NOT NULL,
    department VARCHAR(255) NOT NULL,
    episode_count INTEGER,
    display_priority INTEGER NOT NULL,
    PRIMARY KEY (media_id, person_id)
);

-- media networks
CREATE TABLE IF NOT EXISTS networks (
    id INTEGER PRIMARY KEY,
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
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    origin_country_code CHAR(2) NOT NULL,
    logo_path VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS media_production_companies (
    media_id INTEGER NOT NULL,
    production_company_id INTEGER REFERENCES production_companies (id),
    PRIMARY KEY (media_id, production_company_id)
);

-- media production countries
CREATE TABLE IF NOT EXISTS production_countries (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    country_code CHAR(2) NOT NULL
);

CREATE TABLE IF NOT EXISTS media_production_countries (
    media_id INTEGER NOT NULL,
    production_country_id INTEGER REFERENCES production_countries (id),
    PRIMARY KEY (media_id, production_country_id)
);

-- media spoken languages
CREATE TABLE IF NOT EXISTS spoken_languages (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    english_name VARCHAR(255) NOT NULL,
    language_code CHAR(2) NOT NULL
);

CREATE TABLE IF NOT EXISTS media_spoken_languages (
    media_id INTEGER NOT NULL,
    spoken_language_id INTEGER REFERENCES spoken_languages (id),
    PRIMARY KEY (media_id, spoken_language_id)
);

-- media images
CREATE TABLE IF NOT EXISTS image_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS images (
    image_path VARCHAR(255) PRIMARY KEY,
    image_type_id INTEGER NOT NULL REFERENCES image_types (id),
    aspect_ratio NUMERIC(5,3) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    vote_average NUMERIC(5,2) NOT NULL,
    vote_count INTEGER NOT NULL,
    language_code CHAR(2)
);

CREATE TABLE IF NOT EXISTS media_images (
    media_id INTEGER NOT NULL,
    image_path VARCHAR(255) REFERENCES images (image_path) ON DELETE CASCADE,
    PRIMARY KEY (media_id, image_path)
);

-- people images
CREATE TABLE IF NOT EXISTS people_images (
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    image_path VARCHAR(255) REFERENCES images (image_path) ON DELETE CASCADE,
    PRIMARY KEY (person_id, image_path)
);

CREATE TABLE IF NOT EXISTS media_people_images (
    media_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    image_path VARCHAR(255) REFERENCES images (image_path) ON DELETE CASCADE,
    PRIMARY KEY (media_id, person_id, image_path)
);

-- media videos
CREATE TABLE IF NOT EXISTS video_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS video_sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS media_videos (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL,
    video_type_id INTEGER NOT NULL REFERENCES video_types (id),
    video_site_id INTEGER NOT NULL REFERENCES video_sites (id),
    country_code VARCHAR(2) NOT NULL,
    language_code VARCHAR(2) NOT NULL,
    name VARCHAR(255) NOT NULL,
    site_key VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL,
    official BOOLEAN NOT NULL,
    published_at TIMESTAMP NOT NULL
);

-- media relations
CREATE TABLE IF NOT EXISTS relation_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS media_relations (
    media_id INTEGER NOT NULL,
    related_media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    relation_type_id INTEGER NOT NULL REFERENCES relation_type (id),
    PRIMARY KEY (media_id, related_media_id, relation_type_id)
);

-- media releases and certifications
CREATE TABLE IF NOT EXISTS release_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS media_releases_and_certifications (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL,
    release_type_id INTEGER NOT NULL REFERENCES release_type (id),
    certification VARCHAR(50) NOT NULL,
    country_code CHAR(2) NOT NULL,
    release_date DATE NOT NULL,
    note TEXT
);

-- media translations
CREATE TABLE IF NOT EXISTS media_translations (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL,
    country_code CHAR(2) NOT NULL,
    language_code CHAR(2) NOT NULL,
    language_name TEXT NOT NULL,
    language_name_english TEXT NOT NULL,
    title VARCHAR(255),
    tagline VARCHAR(255),
    synopsis TEXT,
    homepage TEXT,
    runtime INTEGER,
    UNIQUE (media_id, country_code, language_code)
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
CREATE UNIQUE INDEX IF NOT EXISTS media_types_name_idx ON media_types (name);
CREATE UNIQUE INDEX IF NOT EXISTS streaming_providers_name_idx ON streaming_providers (name);
CREATE UNIQUE INDEX IF NOT EXISTS streaming_types_name_idx ON streaming_types (name);
CREATE INDEX IF NOT EXISTS daily_media_filter_idx ON daily_media (tmdb_id, media_type_id);
CREATE INDEX IF NOT EXISTS data_sources_for_media_media_id_idx ON data_sources_for_media (tmdb_id, media_type_id);
CREATE INDEX IF NOT EXISTS media_filter_idx ON media (media_type_id, release_year);
CREATE INDEX IF NOT EXISTS movies_filter_idx ON movies (budget, revenue);
CREATE INDEX IF NOT EXISTS tv_filter_idx ON tv (in_production, tv_type);
CREATE INDEX IF NOT EXISTS media_collections_media_id_idx ON media_collections (media_id);
CREATE INDEX IF NOT EXISTS media_seasons_media_id_idx ON media_seasons (media_id);
CREATE INDEX IF NOT EXISTS media_ratings_media_id_idx ON media_ratings (media_id);
CREATE INDEX IF NOT EXISTS media_season_ratings_media_season_id_idx ON media_season_ratings (media_season_id);
CREATE INDEX IF NOT EXISTS media_streaming_providers_media_id_idx ON media_streaming_providers (media_id);

-- initial data
INSERT INTO media_types (id, name)
VALUES
    (1, 'movie'),
    (2, 'tv')
ON CONFLICT (name) DO NOTHING;

INSERT INTO data_sources (id, name)
VALUES
    (1, 'tmdb_daily'),
    (2, 'tmdb_details')
ON CONFLICT (name) DO NOTHING;