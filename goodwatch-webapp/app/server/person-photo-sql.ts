// The actor's primary TVDB photo is preferred. TMDB keeps ownership of profile_path
// and remains the fallback when TVDB has no usable primary actor photo.
export const PERSON_PHOTO_COLUMN =
	"COALESCE(NULLIF(tvdb_profile_url, ''), profile_path) AS profile_path"
