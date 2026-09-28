// What the Watch next page says: sort names and lines, the hero's eyebrow, the value a sort read for a title, tier
// names, and counts. Pure, so the words stay in one place.
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import type {
	WatchNextSort,
	WatchNextTierKey,
	WatchNextTierSize,
} from "~/domain/watch-next"
import type { WatchNextTitle } from "~/server/watch-next.server"

export const SORT_OPTIONS: {
	key: WatchNextSort
	label: string
	line: string
}[] = [
	{
		key: "match",
		label: "Best match",
		line: "Closest to your taste, from your scores and the title analysis.",
	},
	{
		key: "waiting",
		label: "Waiting longest",
		line: "The titles that have been on your Wishlist the longest.",
	},
	{
		key: "added",
		label: "Last added",
		line: "The titles you added most recently.",
	},
	{
		key: "newest",
		label: "Newest release",
		line: "Latest films, and shows with the newest episodes.",
	},
	{
		key: "score",
		label: "Top rated",
		line: "Highest GoodWatch score first.",
	},
	{
		key: "popular",
		label: "Popular now",
		line: "What most people are watching right now, from TMDB.",
	},
]

export const SORT_LABEL = Object.fromEntries(
	SORT_OPTIONS.map((option) => [option.key, option.label]),
) as Record<WatchNextSort, string>

/** The sort's name on the phone slab's narrow button. */
export const SORT_SHORT: Record<WatchNextSort, string> = {
	...SORT_LABEL,
	newest: "Newest",
	popular: "Popular",
}

/** The phone slab's moods button: "Any mood", "Funny", "Funny +2". */
export function moodsShort(moods: readonly MoodKey[]): string {
	if (!moods.length) return "Any mood"
	const first = MOOD_BY_KEY[moods[0]].name
	return moods.length === 1 ? first : `${first} +${moods.length - 1}`
}

/** "Funny", "Funny or Scary", "Funny, Scary or Heavy". */
export function moodWords(moods: readonly MoodKey[]): string {
	const names = moods.map((mood) => MOOD_BY_KEY[mood].name)
	if (names.length < 2) return names[0] ?? ""
	return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`
}

/** The line above the hero's title: what the pick is under this sort and these moods. */
export function heroLabel(
	sort: WatchNextSort,
	moods: readonly MoodKey[],
	note: "closestToMoods" | "nothingOnServices" | null,
): string {
	if (note === "closestToMoods") return "Closest to your moods"
	if (note === "nothingOnServices") return "Nothing on your services; closest"
	const m = moodWords(moods)
	switch (sort) {
		case "match":
			return m ? `Best match for ${m} tonight` : "Best match for you tonight"
		case "waiting":
			return m ? `Waiting longest in ${m}` : "Waiting longest on your Wishlist"
		case "added":
			return m ? `Last added in ${m}` : "Last added to your Wishlist"
		case "newest":
			return m ? `Newest release in ${m}` : "Newest release on your Wishlist"
		case "score":
			return m ? `Top rated in ${m}` : "Top rated on your Wishlist"
		case "popular":
			return m
				? `Most popular in ${m} right now`
				: "Most popular on your Wishlist right now"
	}
}

const DAY_MS = 86_400_000

/** "today", "3 days ago", "5 months ago", "2 years ago". */
export function ageLabel(iso: string, now = Date.now()): string {
	const days = Math.max(0, Math.round((now - Date.parse(iso)) / DAY_MS))
	if (days < 1) return "today"
	if (days < 2) return "yesterday"
	if (days < 30) return `${days} days ago`
	if (days < 365) {
		const months = Math.max(1, Math.round(days / 30))
		return months === 1 ? "a month ago" : `${months} months ago`
	}
	const years = Math.floor(days / 365)
	return years === 1 ? "over a year ago" : `${years} years ago`
}

const dayLabel = (day: string) =>
	new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	})

/** The value the sort read for a title, in words; null when it would say nothing useful. */
export function sortFact(
	sort: WatchNextSort,
	title: WatchNextTitle,
	showMatch: boolean,
): string | null {
	switch (sort) {
		case "match":
			return showMatch && title.match ? `${title.match}% taste match` : null
		case "waiting":
		case "added":
			return `Added ${ageLabel(title.addedAt)}`
		case "newest":
			if (!title.releaseDate) return null
			return title.media_type === "show"
				? `Latest episode ${dayLabel(title.releaseDate)}`
				: `Released ${dayLabel(title.releaseDate)}`
		case "score":
			return title.goodwatch_overall_score_normalized_percent
				? `GoodWatch score ${Math.round(title.goodwatch_overall_score_normalized_percent)}`
				: null
		case "popular":
			return null
	}
}

/** "2h 12m", "95 min", "23 min episodes"; "Series" or "Film" without a runtime. */
export function runtimeLabel(title: {
	media_type: "movie" | "show"
	runtime: number | null
}): string {
	const { runtime } = title
	if (!runtime) return title.media_type === "show" ? "Series" : "Film"
	if (title.media_type === "show") return `${runtime} min episodes`
	if (runtime < 60) return `${runtime} min`
	return `${Math.floor(runtime / 60)}h ${runtime % 60}m`
}

export const TIER_LABEL: Record<WatchNextTierKey, string> = {
	upNext: "Up next",
	soon: "Soon",
	later: "Later",
	someday: "Someday",
	otherMoods: "Other moods",
	elsewhere: "Elsewhere",
	close: "Close",
	notTonight: "Not tonight",
}

export const TIER_NOTE: Partial<Record<WatchNextTierKey, string>> = {
	otherMoods: "In another mood.",
	elsewhere: "Not on your services.",
	close:
		"In one of these but not on your services, or on them but in another mood.",
	notTonight: "Another mood and not on your services.",
}

export const tierHeadingClass: Record<WatchNextTierSize, string> = {
	xl: "text-3xl md:text-4xl text-amber-300",
	lg: "text-2xl md:text-3xl text-white",
	md: "text-xl md:text-2xl text-gray-200",
	sm: "text-lg md:text-xl text-gray-400",
}

export const titleCount = (n: number) => `${n} ${n === 1 ? "title" : "titles"}`
