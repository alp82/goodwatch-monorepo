import { titlePath } from "../utils/helpers.ts"
import { titleKey } from "../utils/title-key.ts"

/** GET /api/channels: the 404 page's TV channels (ui/tv-egg/NotFoundTv.tsx). */
export interface ChannelsResponse {
	guesses: Channel[]
	popular: Channel[]
	netflix: Channel[]
	prime: Channel[]
}

export interface Channel {
	key: number
	mediaType: "movie" | "show"
	title: string
	year: number | null
	url: string
	backdrop: string
	score: number | null
}

/** Bounded, decoded pathname only; malformed percent escapes are harmless. */
export function channelPath(path: string): string {
	const capped = path.slice(0, 300).split(/[?#]/)[0]
	try {
		return decodeURIComponent(capped).toLowerCase()
	} catch {
		return capped.toLowerCase()
	}
}

export function pathWords(path: string): string[] {
	return channelPath(path)
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.split(/[^\p{L}]+/u)
		.filter((word) => word && !/^(movies?|shows?|tv|the)$/.test(word))
}

/** Typed TMDB ids are unambiguous; bare years and unrelated numeric path segments aren't title ids. */
export function pathTitleKeys(path: string): number[] {
	const value = channelPath(path)
	const keys = [...value.matchAll(/(?:^|[^\d])([12]\d{12})(?!\d)/g)].map((m) =>
		Number(m[1]),
	)
	for (const match of value.matchAll(
		/(?:^|\/)(movie|movies|show|shows|tv|tv-shows)[/-](\d+)(?=[/\-]|$)/g,
	)) {
		const id = Number(match[2])
		if (Number.isSafeInteger(id) && id > 0 && id < 1e12)
			keys.push(titleKey(match[1].startsWith("movie") ? "movie" : "show", id))
	}
	return [...new Set(keys)]
}

// A whole name may differ by one character. Short names require an exact match.
function oneTypo(a: string, b: string): boolean {
	if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1)
		return false
	let i = 0
	let j = 0
	let edits = 0
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			i++
			j++
			continue
		}
		if (++edits > 1) return false
		if (a.length >= b.length) i++
		if (b.length >= a.length) j++
	}
	return edits + (a.length - i) + (b.length - j) <= 1
}

export interface ChannelName {
	key: number
	name: string
	popularity: number
}

/** Whole-name matching avoids guessing sequels or a long title from one common word. */
export function guessKeys(
	path: string,
	names: readonly ChannelName[],
	eligible: (key: number) => boolean,
): number[] {
	const direct = pathTitleKeys(path).filter(eligible)
	const wanted = pathWords(path).join(" ")
	if (wanted.length < 3) return direct.slice(0, 3)
	const ranked = names
		.flatMap(({ key, name, popularity }) => {
			const exact = name === wanted
			return (exact || oneTypo(wanted, name)) && eligible(key)
				? [{ key, exact, popularity }]
				: []
		})
		.sort(
			(a, b) =>
				Number(b.exact) - Number(a.exact) ||
				b.popularity - a.popularity ||
				a.key - b.key,
		)
	return [...new Set([...direct, ...ranked.map(({ key }) => key)])].slice(0, 3)
}

export function serviceKeys(
	keys: readonly number[],
	onService: (key: number) => boolean | null,
	limit = 12,
): number[] {
	const found: number[] = []
	for (const key of keys) {
		const on = onService(key)
		if (on === null) return []
		if (on) found.push(key)
		if (found.length === limit) break
	}
	return found
}

export function toChannel(display: {
	key: number
	media_type: "movie" | "show"
	tmdb_id: number
	title: string
	release_year: number | null
	backdrop_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
}): Channel | null {
	if (!display.backdrop_path) return null
	return {
		key: display.key,
		mediaType: display.media_type,
		title: display.title,
		year: display.release_year,
		url: titlePath(display.media_type, display.tmdb_id, display.title),
		backdrop: display.backdrop_path,
		score: display.goodwatch_overall_score_normalized_percent,
	}
}
