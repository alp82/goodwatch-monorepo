// What the Watch tab's Services, Scores and Age and content sub-tabs write to the filter state, and the lists they
// draw. Pure, no React; the tabs call these with the state they show.
import type { FilterState, ScoreGap, SourceKey } from "~/domain/filter-state"

// ---------------------------------------------------------------------------------------------------------------
// Services

/** Where to watch: the viewer's services, everywhere, or streaming in the country (any service, or the ones picked). */
export type ServicesMode = "mine" | "any" | "pick"

export const servicesMode = (
	state: Pick<FilterState, "onMyServices" | "anyService" | "services">,
): ServicesMode =>
	state.onMyServices
		? "mine"
		: state.anyService || state.services?.length
			? "pick"
			: "any"

type ServicesPatch = Pick<
	FilterState,
	"onMyServices" | "anyService" | "services"
>

/** The state of a mode: Streaming in starts on Any service. */
export const servicesModePatch = (mode: ServicesMode): ServicesPatch =>
	mode === "mine"
		? { onMyServices: true, anyService: undefined, services: undefined }
		: mode === "pick"
			? { onMyServices: false, anyService: true, services: undefined }
			: { onMyServices: false, anyService: undefined, services: undefined }

/**
 * A tap on a service. From My services, Everywhere or Any service it means just this one; later taps add or remove.
 * Taking the last one off goes back to Any service.
 */
export function pickServicePatch(
	state: Pick<FilterState, "onMyServices" | "anyService" | "services">,
	id: number,
): ServicesPatch {
	const fresh = servicesMode(state) !== "pick" || Boolean(state.anyService)
	const base = fresh ? [] : (state.services ?? [])
	const next = base.includes(id)
		? base.filter((other) => other !== id)
		: [...base, id]
	return next.length
		? { onMyServices: false, anyService: undefined, services: next }
		: servicesModePatch("pick")
}

/** The services a mode has on: the viewer's own for My services, the picked ones while picking, else none. */
export function servicesOn(
	state: Pick<FilterState, "onMyServices" | "anyService" | "services">,
	mine: readonly number[],
): number[] {
	const mode = servicesMode(state)
	if (mode === "mine") return [...mine]
	if (mode === "pick" && !state.anyService) return state.services ?? []
	return []
}

/** The country's services in its order, with the ones on first, then the viewer's own. */
export function servicesOrder<P extends { id: number }>(
	providers: readonly P[],
	on: readonly number[],
	mine: readonly number[],
): P[] {
	const rank = (id: number) => (on.includes(id) ? 0 : mine.includes(id) ? 1 : 2)
	return providers
		.map((provider, index) => ({ provider, index }))
		.sort(
			(a, b) => rank(a.provider.id) - rank(b.provider.id) || a.index - b.index,
		)
		.map(({ provider }) => provider)
}

/** The wall's tiles: `limit` (more while more are on) until it opens or a search runs, then up to `max`. */
export function wallTiles<P>(
	matches: readonly P[],
	{
		limit,
		on,
		open,
		searching,
		max = 120,
	}: {
		limit: number
		on: number
		open: boolean
		searching: boolean
		max?: number
	},
): { shown: P[]; rest: number } {
	const shown =
		open || searching
			? matches.slice(0, max)
			: matches.slice(0, Math.max(limit, on))
	return { shown, rest: matches.length - shown.length }
}

/** A service's name without its channel suffix ("Starz Amazon Channel" is "Starz"). */
export const serviceName = (name: string) =>
	name.replace(/ (Amazon Channel|Apple TV Channel)$/, "")

// ---------------------------------------------------------------------------------------------------------------
// Scores

/** One source's minimum; 0 takes it off. Other sources stay. */
export function sourceScorePatch(
	state: Pick<FilterState, "sourceScores">,
	key: SourceKey,
	value: number,
): Pick<FilterState, "sourceScores"> {
	const next = { ...(state.sourceScores ?? {}) }
	if (value) next[key] = value
	else delete next[key]
	return { sourceScores: Object.keys(next).length ? next : undefined }
}

/** Critics vs audiences, in words. */
export const SCORE_GAP_NAMES: Record<ScoreGap, string> = {
	agree: "Both agree",
	critics: "Critics liked it more",
	audience: "Audiences liked it more",
}

/** How many sources have a minimum. */
export const sourcesSet = (state: Pick<FilterState, "sourceScores">) =>
	Object.keys(state.sourceScores ?? {}).length

/** A step of an "and up" scale is lit when it is the pick or above it. */
export const stepLit = (step: number, value: number) =>
	value !== 0 && step >= value

// ---------------------------------------------------------------------------------------------------------------
// Rating country

/** The quick picks for the rating country, in this order. */
export const QUICK_RATING_COUNTRIES = ["US", "GB", "DE", "FR", "IN", "JP"]

/** The quick chips: a picked country that isn't among them takes the first place, so the row keeps its length. */
export function quickCountries(current: string, count: number): string[] {
	const quick = QUICK_RATING_COUNTRIES.slice(0, count)
	return quick.includes(current)
		? quick
		: [
				current,
				...QUICK_RATING_COUNTRIES.filter((code) => code !== current),
			].slice(0, count)
}

/**
 * Ratings in a country. The streaming country (else the viewer's) is the default, so picking it writes no
 * `ratingCountry`.
 */
export function ratingCountryPatch(
	state: Pick<FilterState, "streamingCountry">,
	code: string,
	viewerCountry: string | undefined,
): Pick<FilterState, "ratingCountry"> {
	const fallback = (state.streamingCountry ?? viewerCountry)?.toUpperCase()
	return { ratingCountry: code === fallback ? undefined : code }
}

export interface Country {
	code: string
	name: string
}

/** Countries whose name has the text, or whose code is the text. Every country without text. */
export function searchCountries<C extends Country>(
	list: readonly C[],
	term: string,
): C[] {
	const text = term.trim().toLowerCase()
	if (!text) return [...list]
	return list.filter(
		(country) =>
			country.name.toLowerCase().includes(text) ||
			country.code.toLowerCase() === text,
	)
}

/** The ladder steps whose labels fit under the age slider: each at least `gap` years after the last one kept. */
export function spacedAges(ages: readonly number[], gap: number): Set<number> {
	const kept = new Set<number>()
	let last = Number.NEGATIVE_INFINITY
	for (const age of ages)
		if (age - last >= gap) {
			kept.add(age)
			last = age
		}
	return kept
}
