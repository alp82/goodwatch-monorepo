-- Generated from f/sync/models/crate_schemas.py; owner applies after review.
CREATE TABLE availability_history (
  media_tmdb_id INTEGER,
  media_type TEXT CHECK (media_type IN ('movie','show')),
  country_code TEXT,
  streaming_service_id INTEGER,
  streaming_type TEXT CHECK (streaming_type IN ('flatrate','free','ads')),
  observed_at TIMESTAMP WITH TIME ZONE,
  appeared_on TIMESTAMP WITH TIME ZONE NOT NULL,
  appeared_after TIMESTAMP WITH TIME ZONE,
  appeared_source TEXT NOT NULL CHECK (appeared_source IN ('title','premiere','backfill','list')),
  appeared_precision TEXT NOT NULL CHECK (appeared_precision IN ('exact','unknown')),
  last_seen_on TIMESTAMP WITH TIME ZONE,
  dropped_on TIMESTAMP WITH TIME ZONE,
  dropped_precision TEXT CHECK (dropped_precision IN ('exact','unknown')),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  PRIMARY KEY (media_tmdb_id, media_type, country_code, streaming_service_id, streaming_type, observed_at)
) CLUSTERED BY (media_tmdb_id) INTO 12 SHARDS;
