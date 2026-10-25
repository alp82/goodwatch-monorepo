import type { Correction } from "./corrections.ts"
export interface CorrectionEntity {
	kind: "movie" | "show" | "person"
	id: number
	country?: string
}
type Row = Record<string, any>
/** Copy serving values only. Imported rows and cached source objects remain intact. */
export function applyCorrectionRows<T>(
	entity: CorrectionEntity,
	rows: T,
	corrections: Correction[],
): T {
	const live = corrections
		.filter((c) => c.status === "live")
		.sort((a, b) => a.updated_at - b.updated_at)
	const copy = structuredClone(rows)
	function walk(value: any, season?: number, context?: string): any {
		if (Array.isArray(value))
			return value
				.map((v) => walk(v, season, context))
				.filter((v) => v !== undefined)
		if (!value || typeof value !== "object") return value
		const r: Row = value,
			s =
				r.canonicalSeason ??
				r.season_number ??
				r.season ??
				(context === "seasons" ? r.number : season)
		for (const c of live) {
			const t = c.target ?? {},
				own = c.entity_kind === entity.kind && c.tmdb_id === entity.id
			const titleCredit =
				entity.kind === "person" &&
				c.entity_kind !== "person" &&
				t.personId === entity.id &&
				r.tmdb_id === c.tmdb_id &&
				r.media_type === c.entity_kind
			const personCredit =
				c.entity_kind === "person" &&
				(own
					? r.tmdb_id === t.creditTmdbId &&
						r.media_type === (t.creditMediaType === "tv" ? "show" : "movie")
					: c.tmdb_id === (r.id ?? r.person_tmdb_id) &&
						t.creditTmdbId === entity.id &&
						(t.creditMediaType === "tv" ? "show" : "movie") === entity.kind)
			if (c.field === "release_date" || c.field === "first_air_date") {
				if (own && c.field in r) {
					r[c.field] = c.value
					if ("release_year" in r)
						r.release_year = Number(String(c.value).slice(0, 4))
				}
			} else if (c.field === "name" || c.field === "air_date") {
				const n = r.canonicalNumber ?? r.episode_number ?? r.number
				if (own && s === t.seasonNumber && n === t.episodeNumber) {
					if (c.field === "name") {
						r.name = c.value
						if ("nameLanguage" in r) r.nameLanguage = "en"
						if (r.textPresentation)
							r.textPresentation.name = {
								language: "en",
								source: "canonical",
								fallback: true,
							}
						if ("title" in r) r.title = c.value
					} else if ("airDate" in r)
						r.airDate =
							typeof r.airDate === "string" || r.textPresentation
								? c.value
								: Date.parse(String(c.value))
					else
						r.air_date =
							typeof r.air_date === "number" || r.air_date === null
								? Date.parse(String(c.value))
								: c.value
				}
			} else if (c.field === "character" || c.field === "role") {
				const cast =
					own &&
					c.field === "character" &&
					(r.id ?? r.person_tmdb_id) === t.personId
				if (cast || personCredit || titleCredit) {
					if (c.op === "remove") return undefined
					if (Array.isArray(r.characters)) {
						// A role lands on the side the old value came from. Cast members carry no jobs.
						if (
							c.field === "character" ||
							r.characters.includes(c.old_value) ||
							!Array.isArray(r.jobs) ||
							!r.jobs.length
						)
							r.characters = [c.value]
						else r.jobs = [c.value]
					} else if ("job" in r && c.field === "role") r.job = c.value
					else r.character = c.value
				}
			} else if (c.field === "offer" && own && "streaming_service_id" in r) {
				const country = r.country_code ?? entity.country
				if (
					r.streaming_service_id === t.providerId &&
					r.streaming_type === t.offerType &&
					country === t.country &&
					c.op === "remove"
				)
					return undefined
			}
		}
		// A removed cast member also leaves the count: raw rows (cast_rows, cast_total), the details document
		// (cast, cast_total), and a cast page (cast, total).
		const castKey = Array.isArray(r.cast_rows)
			? "cast_rows"
			: Array.isArray(r.cast)
				? "cast"
				: null
		const totalKey =
			typeof r.cast_total === "number"
				? "cast_total"
				: castKey === "cast" && typeof r.total === "number"
					? "total"
					: null
		const castBefore = castKey ? r[castKey].length : 0
		for (const key of Object.keys(r)) r[key] = walk(r[key], s, key)
		if (castKey && totalKey && castBefore)
			r[totalKey] -= castBefore - r[castKey].length
		// Both country membership and the selected country's offers use the same identity.
		for (const c of live) {
			if (
				c.entity_kind !== entity.kind ||
				c.tmdb_id !== entity.id ||
				c.field !== "offer" ||
				c.op !== "add"
			)
				continue
			const t = c.target ?? {},
				offer = {
					streaming_service_id: t.providerId,
					streaming_type: t.offerType,
				}
			if (
				"streaming_services" in r &&
				c.provider_name &&
				(r.streaming_services == null || Array.isArray(r.streaming_services))
			) {
				r.streaming_services ??= []
				if (!r.streaming_services.some((x: Row) => x.tmdb_id === t.providerId))
					r.streaming_services.push({
						tmdb_id: t.providerId,
						name: c.provider_name,
						logo: c.provider_logo ?? null,
						order_default: null,
					})
			}
			// The trimmed details summarize countries as an object; only the raw country rows take an addition.
			if (
				"streaming_countries" in r &&
				(r.streaming_countries == null || Array.isArray(r.streaming_countries))
			) {
				r.streaming_countries ??= []
				if (
					!r.streaming_countries.some(
						(x: Row) =>
							x.country_code === t.country &&
							x.streaming_service_id === t.providerId &&
							x.streaming_type === t.offerType,
					)
				)
					r.streaming_countries.push({ ...offer, country_code: t.country })
			}
			if (
				"streaming_availabilities" in r &&
				entity.country === t.country &&
				(r.streaming_availabilities == null ||
					Array.isArray(r.streaming_availabilities))
			) {
				r.streaming_availabilities ??= []
				if (
					!r.streaming_availabilities.some(
						(x: Row) =>
							x.streaming_service_id === t.providerId &&
							x.streaming_type === t.offerType,
					)
				)
					// The member's link is evidence for staff, never the page's watch link: with stream_url null
					// the UI links to the provider's where-to-watch page.
					r.streaming_availabilities.push({
						...offer,
						stream_url: null,
						tmdb_link: null,
						price_dollar: null,
						quality: null,
					})
			}
		}
		return r
	}
	return walk(copy)
}
