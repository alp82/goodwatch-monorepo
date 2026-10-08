// The read statements of tracking, as docs/implementation/tracking/data-model.md writes them (sections 3 and 4).
// No imports, so scripts/measure-watch-groups.mjs can load this file as it is.

/** QG. Everything the log says about each of a member's titles, one row per title and pass. One shard, no join. */
export const GROUPED_QUERY = `
SELECT tmdb_id, media_type, pass,
       count(*) AS watch_count,
       count(DISTINCT season_number * 100000 + episode_number)
           FILTER (WHERE season_number > 0) AS episodes_watched,
       max(season_number * 100000 + episode_number)
           FILTER (WHERE season_number > 0) AS furthest,
       min(watched_at) AS first_watched_at,
       max(watched_at) AS last_watched_at,
       max(CASE WHEN watched_at_precision = 'moment' THEN watched_at END) AS last_moment_at,
       max(CASE WHEN watched_at IS NOT NULL THEN watched_at
                WHEN origin <> 'import' THEN created_at END) AS last_activity_at
FROM user_watch_log
WHERE user_id = ?
GROUP BY tmdb_id, media_type, pass`

/** QS. The member's states. A Not started row only remembers a prompt, so no list reads it. */
export const STATES_QUERY = `
SELECT tmdb_id, media_type, state, pass
FROM user_watch_state
WHERE user_id = ? AND state <> 'not_started'`

/** Q1. The member's row for one title. Whole key: real-time, no refresh needed. */
export const STATE_ROW_QUERY = `
SELECT state, state_changed_at, pass, seen_press_group, seen_press_from, rate_prompt_dismissed_at, seen_question,
       _seq_no, _primary_term
FROM user_watch_state
WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`

/** Q2. Every watch of the member for one show: the ticks, the matrix, each episode's log, and every count. */
export const SHOW_LOG_QUERY = `
SELECT watch_id, episode_tmdb_id, season_number, episode_number, watched_at, watched_at_precision, origin, group_id,
       import_id, pass, created_at
FROM user_watch_log
WHERE user_id = ? AND media_type = 'show' AND tmdb_id = ?
ORDER BY season_number, episode_number, watched_at DESC NULLS LAST
LIMIT 20000`

const episodeListQuery = (columns: string) => `
SELECT tmdb_id, season_number, episode_number, name, air_date, runtime, still_path, episode_type${columns}
FROM episode
WHERE show_id = ? AND removed_at IS NULL
ORDER BY season_number, episode_number`

/** Q3. The episode list. Public, cached per show. */
export const EPISODE_LIST_QUERY = episodeListQuery(", overview")

/** Q3 for an `episode` table that has no `overview` column yet (#387): the list without descriptions. */
export const EPISODE_LIST_WITHOUT_OVERVIEW_QUERY = episodeListQuery("")

/** Q4. A movie's watch log. */
export const MOVIE_LOG_QUERY = `
SELECT watch_id, watched_at, watched_at_precision, origin, import_id, created_at
FROM user_watch_log
WHERE user_id = ? AND media_type = 'movie' AND tmdb_id = ?
ORDER BY watched_at DESC NULLS LAST, created_at DESC
LIMIT 200`
