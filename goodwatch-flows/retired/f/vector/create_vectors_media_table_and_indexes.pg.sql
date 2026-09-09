-- https://www.windmill.dev/docs/getting_started/scripts_quickstart/sql#result-collection
-- result_collection=legacy

CREATE TABLE IF NOT EXISTS vectors_media (
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(5) NOT NULL,
	
	-- details vectors
    --cast_vector vector(512),
    --crew_vector vector(512),
    --tropes_vector vector(512),
	
	-- dna vectors
    --dna_vector vector(512),
    --subgenres_vector vector(512),
    --mood_vector vector(512),
    --themes_vector vector(512),
    --plot_vector vector(512),
    --cultural_impact_vector vector(512),
    --character_types_vector vector(512),
    --dialog_vector vector(512),
    --narrative_vector vector(512),
    --humor_vector vector(512),
    --pacing_vector vector(512),
    --time_vector vector(512),
    --place_vector vector(512),
    --cinematic_style_vector vector(512),
    --score_and_sound_vector vector(512),
    ----costume_and_set_vector vector(512),
    --key_props_vector vector(512),
    --target_audience_vector vector(512),
    --flag_vector vector(512),

	-- metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
	PRIMARY KEY (tmdb_id, media_type)
);

-- Create index for cast_vector
CREATE INDEX IF NOT EXISTS vectors_media_cast_vector_idx ON vectors_media USING diskann (cast_vector);

-- Create index for crew_vector
CREATE INDEX IF NOT EXISTS vectors_media_crew_vector_idx ON vectors_media USING diskann (crew_vector);

-- Create index for tropes_vector
CREATE INDEX IF NOT EXISTS vectors_media_tropes_vector_idx ON vectors_media USING diskann (tropes_vector);

-- Create index for dna_vector
CREATE INDEX IF NOT EXISTS vectors_media_dna_vector_idx ON vectors_media USING diskann (dna_vector);

-- Create index for subgenres_vector
CREATE INDEX IF NOT EXISTS vectors_media_subgenres_vector_idx ON vectors_media USING diskann (subgenres_vector);

-- Create index for mood_vector
CREATE INDEX IF NOT EXISTS vectors_media_mood_vector_idx ON vectors_media USING diskann (mood_vector);

-- Create index for themes_vector
CREATE INDEX IF NOT EXISTS vectors_media_themes_vector_idx ON vectors_media USING diskann (themes_vector);

-- Create index for plot_vector
CREATE INDEX IF NOT EXISTS vectors_media_plot_vector_idx ON vectors_media USING diskann (plot_vector);

-- Create index for cultural_impact_vector
CREATE INDEX IF NOT EXISTS vectors_media_cultural_impact_vector_idx ON vectors_media USING diskann (cultural_impact_vector);

-- Create index for character_types_vector
CREATE INDEX IF NOT EXISTS vectors_media_character_types_vector_idx ON vectors_media USING diskann (character_types_vector);

-- Create index for dialog_vector
CREATE INDEX IF NOT EXISTS vectors_media_dialog_vector_idx ON vectors_media USING diskann (dialog_vector);

-- Create index for narrative_vector
CREATE INDEX IF NOT EXISTS vectors_media_narrative_vector_idx ON vectors_media USING diskann (narrative_vector);

-- Create index for humor_vector
CREATE INDEX IF NOT EXISTS vectors_media_humor_vector_idx ON vectors_media USING diskann (humor_vector);

-- Create index for pacing_vector
CREATE INDEX IF NOT EXISTS vectors_media_pacing_vector_idx ON vectors_media USING diskann (pacing_vector);

-- Create index for time_vector
CREATE INDEX IF NOT EXISTS vectors_media_time_vector_idx ON vectors_media USING diskann (time_vector);

-- Create index for place_vector
CREATE INDEX IF NOT EXISTS vectors_media_place_vector_idx ON vectors_media USING diskann (place_vector);

-- Create index for cinematic_style_vector
CREATE INDEX IF NOT EXISTS vectors_media_cinematic_style_vector_idx ON vectors_media USING diskann (cinematic_style_vector);

-- Create index for score_and_sound_vector
CREATE INDEX IF NOT EXISTS vectors_media_score_and_sound_vector_idx ON vectors_media USING diskann (score_and_sound_vector);

-- Create index for costume_and_set_vector
CREATE INDEX IF NOT EXISTS vectors_media_costume_and_set_vector_idx ON vectors_media USING diskann (costume_and_set_vector);

-- Create index for key_props_vector
CREATE INDEX IF NOT EXISTS vectors_media_key_props_vector_idx ON vectors_media USING diskann (key_props_vector);

-- Create index for target_audience_vector
CREATE INDEX IF NOT EXISTS vectors_media_target_audience_vector_idx ON vectors_media USING diskann (target_audience_vector);

-- Create index for flag_vector
CREATE INDEX IF NOT EXISTS vectors_media_flag_vector_idx ON vectors_media USING diskann (flag_vector);
