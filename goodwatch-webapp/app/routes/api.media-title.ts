import { isbot } from "isbot"
import type { LocalizedTitleResponse } from "~/utils/media-presentation"
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import {
	overlayTitles,
	overlayMediaRow,
	type CanonicalMediaRow,
} from "~/server/media-overlay.server"
import { payloadLanguage } from "~/server/media-payload.server"
import { cached } from "~/utils/cache"
import { overlayQuery as query } from "~/server/media-overlay-query.server"
import { protectMediaResponse } from "~/server/media-read-health.server"
import { canonicalTitleId } from "~/utils/title-identity"

/** Read-only F preview: no preference writes, country offers or account data. */
export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const type = params.get("type"),
		rawId = params.get("id") ?? ""
	if ((type !== "movie" && type !== "show") || !/^[1-9]\d{0,9}$/.test(rawId))
		return json(
			{ error: "Pass type=movie|show and id=<TMDB id>" },
			{ status: 400, headers: { "Cache-Control": "no-store" } },
		)
	const canonicalContent = isbot(request.headers.get("user-agent"))
	const id = canonicalTitleId(type, Number(rawId)),
		language = canonicalContent ? "en" : payloadLanguage(request)
	const loadTitle = () =>
		cached({
			name: "localized-title-payload-v5",
			params: {
				type,
				id,
				language,
				policy: canonicalContent ? "canonical" : "localized",
			},
			ttlMinutes: 30,
			staleMinutes: 0,
			target: async () => {
				const rows = await query<CanonicalMediaRow>(
					`SELECT '${type}' AS media_type, tmdb_id, title, original_title, original_language_code, poster_path, synopsis, tagline FROM ${type} WHERE tmdb_id = ?`,
					[id],
				)
				if (!rows.length) return { title: null }
				if (canonicalContent)
					return {
						title: overlayMediaRow(rows[0], "en", {
							canonical: rows,
							translations: [],
							posters: [],
						}),
					}
				return { title: (await overlayTitles(rows, language))[0] }
			},
		})
	let result: Awaited<ReturnType<typeof loadTitle>>
	try {
		result = await loadTitle()
	} catch {
		return json(
			{ error: "Media content temporarily unavailable" },
			{ status: 503, headers: { "Cache-Control": "private, no-store" } },
		)
	}
	const { title } = result
	if (!title)
		return json(
			{ error: "Not found" },
			{ status: 404, headers: { "Cache-Control": "no-store" } },
		)
	const headers = new Headers({
		"Cache-Control": canonicalContent
			? "private, no-store"
			: "public, max-age=1800, s-maxage=1800",
	})
	protectMediaResponse(headers, result)
	return json<LocalizedTitleResponse>(
		{
			title: {
				media_type: title.media_type,
				tmdb_id: title.tmdb_id,
				canonical_title: title.canonical_title,
				title: title.title ?? "",
				poster_path: title.poster_path ?? null,
				overview: title.synopsis ?? null,
				synopsis: title.synopsis ?? null,
				tagline: title.tagline ?? null,
				presentation: title.presentation,
			},
		},
		{ headers },
	)
}
