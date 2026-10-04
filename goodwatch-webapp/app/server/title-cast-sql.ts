// Both statements restrict person through person_ids before joining the small sets.
// Credits often share a billing order. The person id and the character break those ties, so that the
// same people and the same character order come back on every run.
export const castRowsCTEs = `cast_rows AS (
 SELECT p.tmdb_id AS id, p.name AS name, pa.character AS character, p.profile_path AS profile_path, pa.order_default AS order_default
 FROM appeared_in_data pa JOIN people_data p ON pa.person_tmdb_id = p.tmdb_id
),
cast_people AS (
 SELECT id, min(order_default) AS ord FROM cast_rows WHERE profile_path IS NOT NULL AND profile_path != '' GROUP BY id
)`

export const selectedCastRows = (
	idsCTE: "top_cast" | "page_cast",
) => `ARRAY(SELECT {id = id, name = name, character = character, profile_path = profile_path, order_default = order_default}
 FROM cast_rows WHERE id = ANY((SELECT coalesce(ids, []) FROM ${idsCTE})) ORDER BY order_default ASC, id ASC, character ASC)`
