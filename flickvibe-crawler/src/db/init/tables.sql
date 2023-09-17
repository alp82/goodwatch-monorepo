-- enums
DO $$ BEGIN
  CREATE TYPE MEDIA_TYPE AS ENUM ('movie', 'tv');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE IMPORT_SOURCE AS ENUM ('tmdb_daily');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE DATA_SOURCE AS ENUM (
    'tmdb_details',
    'imdb_ratings',
    'metacritic_ratings',
    'rotten_tomatoes_ratings',
    'tv_tropes_tags'
  );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE SOURCE_STATUS AS ENUM (
    'running',
    'success',
    'failed',
    'ignore'
  );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- process for import and data sources
CREATE TABLE IF NOT EXISTS process_import_source (
    import_source IMPORT_SOURCE PRIMARY KEY,
    last_status SOURCE_STATUS NOT NULL,
    last_updated_successfully TIMESTAMP WITH TIME ZONE,
    last_updated_with_error TIMESTAMP WITH TIME ZONE,
    last_errors TEXT[]
);

CREATE TABLE IF NOT EXISTS process_data_source (
    data_source DATA_SOURCE NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type MEDIA_TYPE NOT NULL,
    last_status SOURCE_STATUS NOT NULL,
    last_updated_successfully TIMESTAMP WITH TIME ZONE,
    last_updated_with_error TIMESTAMP WITH TIME ZONE,
    last_errors TEXT[],
    PRIMARY KEY (data_source, tmdb_id, media_type)
);

-- daily media
CREATE TABLE IF NOT EXISTS daily_media (
    tmdb_id INTEGER NOT NULL,
    media_type MEDIA_TYPE NOT NULL,
    last_updated DATE,
    original_title VARCHAR(255) NOT NULL,
    popularity NUMERIC NOT NULL,
    video BOOLEAN DEFAULT FALSE,
    adult BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (tmdb_id, media_type)
);



-- data source: tmdb details
CREATE TABLE IF NOT EXISTS tmdb_movie (
    tmdb_id INTEGER PRIMARY KEY,
    last_status SOURCE_STATUS NOT NULL,
    last_updated_successfully TIMESTAMP WITH TIME ZONE,
    last_updated_with_error TIMESTAMP WITH TIME ZONE,
    last_errors TEXT[],

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

    genres VARCHAR(255)[],
    alternative_titles JSONB,
    "cast" JSONB,
    crew JSONB,
    certifications JSONB,
    streaming_providers JSONB,
    images JSONB,
    videos JSONB,
    production_companies JSONB,
    translations JSONB,
    relations JSONB,

    runtime INTEGER,
    budget BIGINT NOT NULL,
    revenue BIGINT NOT NULL,
    wikidata_id VARCHAR(255),
    facebook_id VARCHAR(255),
    instagram_id VARCHAR(255),
    twitter_id VARCHAR(255),

    collection JSONB
);

CREATE TABLE IF NOT EXISTS tmdb_tv (
    tmdb_id INTEGER PRIMARY KEY,
    last_status SOURCE_STATUS NOT NULL,
    last_updated_successfully TIMESTAMP WITH TIME ZONE,
    last_updated_with_error TIMESTAMP WITH TIME ZONE,
    last_errors TEXT[],

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

    genres VARCHAR(255)[],
    alternative_titles JSONB,
    "cast" JSONB,
    crew JSONB,
    certifications JSONB,
    streaming_providers JSONB,
    images JSONB,
    videos JSONB,
    production_companies JSONB,
    translations JSONB,
    relations JSONB,

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

    networks JSONB,
    seasons JSONB
);