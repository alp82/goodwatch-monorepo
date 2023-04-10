-- media types (movie, tv, etc.)
CREATE TABLE media_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- daily media
CREATE TABLE daily_media (
    tmdb_id INTEGER PRIMARY KEY,
    media_type_id INTEGER NOT NULL REFERENCES media_types (id),
    original_title VARCHAR(255) NOT NULL,
    popularity NUMERIC NOT NULL,
    video BOOLEAN DEFAULT FALSE,
    adult BOOLEAN DEFAULT FALSE
);

-- people
CREATE TABLE people (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    also_known_as VARCHAR(255)[] NOT NULL,
    biography TEXT NOT NULL,
    popularity NUMERIC NOT NULL,
    
    gender INTEGER NOT NULL,
    place_of_birth VARCHAR(255),
    birthday DATE,
    deathday DATE,
    known_for_department VARCHAR(255),
    
    profile_path VARCHAR(255),
    homepage VARCHAR(255),
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
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    media_type_id INTEGER NOT NULL REFERENCES media_types (id),
    
    title VARCHAR(255) NOT NULL,
    synopsis TEXT NOT NULL,
    tagline VARCHAR(255) NOT NULL,
    release_date DATE NOT NULL,
    release_year INTEGER NOT NULL,
    popularity NUMERIC NOT NULL,
    
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),
    
    status VARCHAR(255),
    original_title VARCHAR(255),
    original_language_code CHAR(2),
    homepage VARCHAR(255),
    adult BOOLEAN NOT NULL,
    
    tmdb_id INTEGER NOT NULL,
    imdb_id VARCHAR(255)
);

-- movies
CREATE TABLE movies (
    runtime INTEGER,
    budget INTEGER NOT NULL,
    revenue INTEGER NOT NULL,
    
    wikidata_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    twitter_id VARCHAR(255)
) INHERITS (media);

-- tv shows
CREATE TABLE tv (
    number_of_seasons INTEGER NOT NULL,
    number_of_episodes INTEGER NOT NULL,
    episode_runtime INTEGER[] NOT NULL,
    in_production BOOLEAN NOT NULL,
    tv_type VARCHAR(255) NOT NULL,
    
    last_air_date DATE,
    origin_country_code CHAR(2),
    created_by INTEGER NOT NULL REFERENCES people (id),
    
    freebase_mid VARCHAR(255),
    freebase_id VARCHAR(255),
    tvdb_id VARCHAR(255),
    tvrage_id VARCHAR(255),
    wikidata_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    twitter_id VARCHAR(255)
) INHERITS (media);

-- data sources
CREATE TABLE IF NOT EXISTS data_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- interval data sources
CREATE TABLE data_sources_interval (
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    data_status VARCHAR(50) NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_attempted_at TIMESTAMP WITH TIME ZONE,
    last_successful_attempt_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (data_source_id)
);

-- media data sources
CREATE TABLE media_data_sources (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    data_status VARCHAR(50) NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_attempted_at TIMESTAMP WITH TIME ZONE,
    last_successful_attempt_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (media_id, data_source_id)
);

-- movie collections
CREATE TABLE collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    overview TEXT,
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255)
);

CREATE TABLE media_collections (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    collection_id INTEGER REFERENCES collections (id),
    PRIMARY KEY (media_id, collection_id)
);

-- tv seasons
CREATE TABLE media_seasons (
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
CREATE TABLE media_ratings (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    score DECIMAL(5,2) NOT NULL,
    original_score DECIMAL(5,2) NOT NULL,
    vote_count INTEGER,
    PRIMARY KEY (media_id, data_source_id)
);

-- season ratings
CREATE TABLE media_season_ratings (
    media_season_id INTEGER NOT NULL REFERENCES media_seasons (id) ON DELETE CASCADE,
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    score DECIMAL(5,2) NOT NULL,
    original_score DECIMAL(5,2) NOT NULL,
    vote_count INTEGER,
    PRIMARY KEY (media_season_id, data_source_id)
);

-- streaming providers
CREATE TABLE streaming_providers (
  id SERIAL PRIMARY KEY,
  logo_path VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_priority INTEGER NOT NULL
);

CREATE TABLE streaming_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  display_priority INTEGER NOT NULL
);

CREATE TABLE media_streaming_providers (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    streaming_provider_id INTEGER NOT NULL REFERENCES streaming_providers (id),
    streaming_type_id INTEGER NOT NULL REFERENCES streaming_types (id),
    country_code CHAR(2) NOT NULL,
    PRIMARY KEY (media_id, streaming_provider_id, streaming_type_id, country_code)
);

-- media tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    data_source_id INTEGER NOT NULL REFERENCES data_sources (id),
    name VARCHAR(255) NOT NULL,
    description TEXT
    UNIQUE (data_source_id, name)
);

CREATE TABLE media_tags (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags (id),
    PRIMARY KEY (media_id, tag_id)
);

-- media genres
CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE media_genres (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres (id),
    PRIMARY KEY (media_id, genre_id),
);

-- media alternative titles
CREATE TABLE media_alternative_titles (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(255),
    language_code CHAR(2)
);

-- media people
CREATE TABLE media_cast (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    character_name VARCHAR(255) NOT NULL,
    display_priority INTEGER NOT NULL,
    PRIMARY KEY (media_id, person_id)
);

CREATE TABLE media_crew (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    department VARCHAR(255) NOT NULL,
    job VARCHAR(255) NOT NULL,
    display_priority INTEGER NOT NULL,
    PRIMARY KEY (media_id, person_id)
);

-- media networks
CREATE TABLE networks (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    origin_country_code CHAR(2) NOT NULL,
    logo_path VARCHAR(255)
);

CREATE TABLE media_networks (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    network_id INTEGER REFERENCES networks (id),
    PRIMARY KEY (media_id, network_id)
);

-- media production companies
CREATE TABLE production_companies (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    origin_country_code CHAR(2) NOT NULL,
    logo_path VARCHAR(255)
);

CREATE TABLE media_production_companies (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    production_company_id INTEGER REFERENCES production_companies (id),
    PRIMARY KEY (media_id, production_company_id)
);

-- media production countries
CREATE TABLE production_countries (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country_code CHAR(2) NOT NULL,
);

CREATE TABLE media_production_countries (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    production_country_id INTEGER REFERENCES production_countries (id),
    PRIMARY KEY (media_id, production_country_id)
);

-- media spoken languages
CREATE TABLE spoken_languages (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    english_name VARCHAR(255) NOT NULL,
    language_code CHAR(2) NOT NULL
);

CREATE TABLE media_spoken_languages (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    spoken_language_id INTEGER REFERENCES spoken_languages (id),
    PRIMARY KEY (media_id, spoken_language_id)
);

-- media images
CREATE TABLE image_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE images (
    image_path VARCHAR(255) PRIMARY KEY,
    image_type_id INTEGER NOT NULL REFERENCES image_types (id),
    aspect_ratio NUMERIC(5,3) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    vote_average NUMERIC(5,2) NOT NULL,
    vote_count INTEGER NOT NULL,
    language_code CHAR(2)
);

CREATE TABLE media_images (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    image_path INTEGER REFERENCES images (image_path) ON DELETE CASCADE,
    PRIMARY KEY (media_id, image_id)
);

-- people images
CREATE TABLE people_images (
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    image_path INTEGER REFERENCES images (image_path) ON DELETE CASCADE,
    PRIMARY KEY (person_id, image_id)
);

CREATE TABLE media_people_images (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    image_path INTEGER REFERENCES images (image_path) ON DELETE CASCADE,
    PRIMARY KEY (media_id, person_id, image_id)
);

-- media videos
CREATE TABLE video_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE video_sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE media_videos (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
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
CREATE TABLE relation_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE media_relations (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    related_media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    relation_type_id INTEGER NOT NULL REFERENCES relation_type (id),
    PRIMARY KEY (media_id, related_media_id, relation_type_id)
);

-- media releases and certifications
CREATE TABLE release_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE media_releases_and_certifications (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    release_type_id INTEGER NOT NULL REFERENCES release_type (id),
    certification VARCHAR(50) NOT NULL,
    country_code CHAR(2) NOT NULL,
    release_date DATE NOT NULL,
    note TEXT
);

-- media translations
CREATE TABLE media_translations (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL,
    language_code CHAR(2) NOT NULL,
    language_name TEXT NOT NULL,
    language_name_english TEXT NOT NULL,
    title VARCHAR(255),
    tagline VARCHAR(255),
    synopsis TEXT,
    homepage VARCHAR(255),
    runtime INTEGER,
    UNIQUE (media_id, country_code, language_code)
);
  
-- people translations
CREATE TABLE people_translations (
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
CREATE UNIQUE INDEX media_types_name_idx ON media_types (name);
CREATE UNIQUE INDEX streaming_providers_name_idx ON streaming_providers (name);
CREATE UNIQUE INDEX streaming_types_name_idx ON streaming_types (name);
CREATE INDEX daily_media_filter_idx ON daily_media(media_type_id, tmdb_id);
CREATE INDEX people_text_idx ON people USING gin(to_tsvector('english', name || ' ' || array_to_string(also_known_as, ' ')));
CREATE INDEX media_filter_idx ON media(media_type_id, release_year);
CREATE INDEX movies_filter_idx ON movies(budget, revenue);
CREATE INDEX tv_filter_idx ON tv(in_production, tv_type);
CREATE INDEX media_data_sources_media_id_idx ON media_data_sources(media_id);
CREATE INDEX media_collections_media_id_idx ON media_collections(media_id);
CREATE INDEX media_seasons_media_id_idx ON media_seasons(media_id);
CREATE INDEX media_ratings_media_id_idx ON media_ratings(media_id);
CREATE INDEX media_season_ratings_media_season_id_idx ON media_season_ratings(media_season_id);
CREATE INDEX media_streaming_providers_media_id_idx ON media_streaming_providers(media_id);

-- initial data
INSERT INTO media_types (name)
VALUES
    ('movie'),
    ('tv'),
ON CONFLICT (name) DO NOTHING;

INSERT INTO data_sources (name)
VALUES
    ('tmdb_daily'),
    ('tmdb_details'),
ON CONFLICT (name) DO NOTHING;
