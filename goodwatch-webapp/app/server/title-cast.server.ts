import { cached } from "~/utils/cache"
import {
	CAST_PAGE_SIZE,
	type TitleCastParams,
	isTitleCastOffset,
	nextCastOffset,
} from "~/utils/title-cast"
import { canonicalTitleId } from "~/utils/title-identity"
import { castRowsCTEs, selectedCastRows } from "./title-cast-sql"
import { type CastRow, toCastMembers } from "./title-details-shape"

export async function getTitleCastPage(params: TitleCastParams) {
	if (
		(params.mediaType !== "movie" && params.mediaType !== "show") ||
		!/^\d+$/.test(params.tmdbId) ||
		!Number.isSafeInteger(Number(params.tmdbId)) ||
		!isTitleCastOffset(params.offset)
	)
		throw new Response("Invalid cast parameters", { status: 400 })
	return cached({
		name: "title-cast-v1",
		params: {
			mediaType: params.mediaType,
			tmdbId: String(canonicalTitleId(params.mediaType, Number(params.tmdbId))),
			offset: params.offset,
		},
		target: fetchCastPage,
		ttlMinutes: 24 * 60,
	})
}
async function fetchCastPage({ mediaType, tmdbId, offset }: TitleCastParams) {
	const { query } = await import("~/utils/crate")
	const rows = (await query(`WITH
 appeared_in_data AS (
  SELECT person_tmdb_id, character, order_default FROM person_appeared_in
  WHERE media_tmdb_id = ${tmdbId} AND media_type = '${mediaType}'
 ),
 person_ids AS (SELECT array_agg(person_tmdb_id) AS ids FROM appeared_in_data),
 people_data AS (SELECT tmdb_id, name, profile_path FROM person WHERE tmdb_id = ANY((SELECT ids FROM person_ids))),
 ${castRowsCTEs},
 page_cast AS (SELECT array_agg(id) AS ids FROM (SELECT id FROM cast_people ORDER BY ord ASC, id ASC LIMIT ${CAST_PAGE_SIZE} OFFSET ${offset}) AS t)
 SELECT {cast_total = (SELECT count(*) FROM cast_people), cast_rows = ${selectedCastRows("page_cast")}} AS page
 `)) as { page: { cast_total: number; cast_rows: CastRow[] | null } }[]
	const total = rows[0]?.page.cast_total ?? 0
	return {
		cast: toCastMembers(rows[0]?.page.cast_rows),
		total,
		offset,
		nextOffset: nextCastOffset(offset, total),
	}
}
