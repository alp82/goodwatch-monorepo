// What the filter bar shows beyond the filter state: the viewer's services with their logos, the country's services
// for the sheet, and the names of chosen titles and people, plus title and people matches for the sheet's search.
// All of it comes from existing endpoints.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import type { CastResults } from "~/server/cast.server"
import type { SimilarMedia } from "~/server/similar-media.server"
import { useUserSettings } from "~/routes/api.user-settings.get"
import {
	type StreamingProvider,
	useStreamingProviders,
} from "~/routes/api.streaming-providers"
import { useUser } from "~/utils/auth"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"

export type { StreamingProvider }

export const PROVIDER_LOGO = "https://image.tmdb.org/t/p/w92"

const ids = (value: string | null | undefined) =>
	(value ?? "")
		.split(",")
		.map(Number)
		.filter((id) => Number.isSafeInteger(id) && id > 0)

/**
 * The viewer's services and country: a member's saved settings, or what a guest chose in the Living room (kept in
 * the browser). `providers` has the logos, in the country's order.
 */
export function useMyServices(): {
	ids: number[]
	country: string | undefined
	providers: StreamingProvider[]
	countryProviders: StreamingProvider[]
} {
	const { user, loading } = useUser()
	const settings = useUserSettings()
	const [guest, setGuest] = useState<{ ids: number[]; country?: string }>({
		ids: [],
	})
	useEffect(() => {
		if (loading || user) return
		try {
			setGuest({
				ids: ids(localStorage.getItem("withStreamingProviders")),
				country: localStorage.getItem("country") ?? undefined,
			})
		} catch {}
	}, [user, loading])

	const mineKey = user
		? (settings.data?.streaming_providers_default ?? "")
		: guest.ids.join(",")
	const mine = useMemo(() => ids(mineKey), [mineKey])
	const country = user ? settings.data?.country_default : guest.country
	const list = useStreamingProviders({
		country,
		include: mine.map(String),
		enabled: Boolean(country),
	})
	const countryProviders = list.data ?? []
	const providers = useMemo(
		() => countryProviders.filter((p) => mine.includes(p.id)),
		[countryProviders, mine],
	)
	return { ids: mine, country, providers, countryProviders }
}

export interface NamedTitle {
	key: TitleKey
	title: string
	year: string
	poster: string | null
}

export interface NamedPerson {
	id: number
	name: string
	profile: string | null
	department: string
}

const toTitle = (m: SimilarMedia): NamedTitle => ({
	key: titleKey(m.media_type, m.tmdb_id),
	title: m.title,
	year: m.release_year,
	poster: m.poster_path || null,
})

/** The chosen Similar to titles by name, and titles matching `text` (two letters or more). */
export function useTitleNames(chosen: TitleKey[], text: string) {
	const term = text.trim().length >= 2 ? text.trim() : ""
	const withSimilar = chosen.map((key) => {
		const { mediaType, tmdbId } = parseTitleKey(key)
		return { tmdbId: String(tmdbId), mediaType, categories: [] }
	})
	const withSimilarJson = JSON.stringify(withSimilar)
	const query = useQuery<{ movies: SimilarMedia[]; shows: SimilarMedia[] }>({
		queryKey: ["filter-bar-titles", term, withSimilarJson],
		queryFn: async () =>
			(
				await fetch(
					`/api/similar-media?${new URLSearchParams({ searchTerm: term, withSimilarJson })}`,
				)
			).json(),
		enabled: Boolean(term) || chosen.length > 0,
		placeholderData: (previous) => previous,
	})
	return useMemo(() => {
		const all = [...(query.data?.movies ?? []), ...(query.data?.shows ?? [])]
			.sort((a, b) => b.popularity - a.popularity)
			.map(toTitle)
		const byKey = new Map(all.map((t) => [t.key, t]))
		return {
			byKey,
			matches: term
				? all.filter((t) => !chosen.includes(t.key)).slice(0, 8)
				: [],
		}
	}, [query.data, term, chosen])
}

/** The chosen people by name, and people matching `text` (two letters or more). */
export function usePeopleNames(chosen: number[], text: string) {
	const term = text.trim().length >= 2 ? text.trim() : ""
	const withCast = chosen.join(",")
	const query = useQuery<CastResults>({
		queryKey: ["filter-bar-people", term, withCast],
		queryFn: async () =>
			(
				await fetch(
					`/api/cast?${new URLSearchParams({ text: term, withCast, withoutCast: "" })}`,
				)
			).json(),
		enabled: Boolean(term) || chosen.length > 0,
		placeholderData: (previous) => previous,
	})
	return useMemo(() => {
		const all: NamedPerson[] = (query.data?.castMembers ?? []).map((p) => ({
			id: p.tmdb_id,
			name: p.name,
			profile: p.profile_path || null,
			department: p.known_for_department,
		}))
		const byId = new Map(all.map((p) => [p.id, p]))
		return {
			byId,
			matches: term
				? all.filter((p) => !chosen.includes(p.id)).slice(0, 8)
				: [],
		}
	}, [query.data, term, chosen])
}
