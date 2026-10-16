// What the Watch next page says: sort names and lines, the hero's eyebrow, the value a sort read for a title, tier
// names, and counts. Pure, so the words stay in one place.
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { timeLabel } from "~/domain/my-movies"
import {
	type ChoiceKind,
	MAX_PICKS,
	WORD_BY_ID,
	WORD_KINDS,
	groupNumber,
	kindOf,
} from "~/domain/taste-picker"

// My movies' rules, for the page's parts: they read them from here, so that the module stays in this chunk.
export {
	TIME_CHOICES,
	misfitWords,
	timeLabel,
	timeOf,
} from "~/domain/my-movies"
import type {
	WatchNextSort,
	WatchNextTierKey,
	WatchNextTierSize,
} from "~/domain/watch-next"
import type { WatchNext, WatchNextTitle } from "~/server/watch-next.server"
import { TITLE_SIDES_COPY } from "~/ui/details/hero/title-sides-copy"
import {
	DISCOVER_SORTS,
	RATE_MORE,
	type SortOption,
} from "~/ui/filter-bar/labels"

export { RATE_MORE }

/**
 * "Close to your taste": the title page's words (#680). The tier of that name says it in its heading; a close title
 * shown outside it (the hero, the Then column, when nothing on the list is in the group picked) says it on its own.
 */
export const CLOSE_TO_TASTE = TITLE_SIDES_COPY.close

// The sorts Discover has too say what Discover says.
export const SORT_OPTIONS: SortOption<WatchNextSort>[] = [
	{ ...DISCOVER_SORTS.match, key: "match" },
	{
		key: "waiting",
		label: "Waiting longest",
		hint: "Longest on your Wishlist",
	},
	{ key: "added", label: "Last added", hint: "Added most recently" },
	{ ...DISCOVER_SORTS.newest, key: "newest" },
	{ ...DISCOVER_SORTS.top, key: "top" },
	{ ...DISCOVER_SORTS.popular, key: "popular" },
]

/**
 * The sorts for the viewer: Best match needs taste, so without it the option shows but can't be picked, and says why
 * while the person has too few liked titles (a guest gets the sign-up prompt under the list instead).
 */
export const sortOptionsFor = (
	bestMatch: WatchNext["bestMatch"],
): SortOption<WatchNextSort>[] =>
	bestMatch.available
		? SORT_OPTIONS
		: SORT_OPTIONS.map((option) =>
				option.key === "match"
					? {
							...option,
							disabled: true,
							...(bestMatch.prompt === "rateMore" ? { hint: RATE_MORE } : {}),
						}
					: option,
			)

export const SORT_LABEL = Object.fromEntries(
	SORT_OPTIONS.map((option) => [option.key, option.label]),
) as Record<WatchNextSort, string>

/** The sort inside a sentence: "The rest of your Wishlist, by newest release." */
export const SORT_WORDS: Record<WatchNextSort, string> = {
	match: "best match",
	waiting: "waiting longest",
	added: "last added",
	newest: "newest release",
	top: "top rated",
	popular: "popularity",
}

/** The phone slab's moods button: "Any mood", "Funny", "Funny +2". */
export function moodsShort(moods: readonly MoodKey[]): string {
	if (!moods.length) return "Any mood"
	const first = MOOD_BY_KEY[moods[0]].name
	return moods.length === 1 ? first : `${first} +${moods.length - 1}`
}

/** A pick's name: a taste group's ("Dark, psychological thrillers") or a word's ("Slow burn"). */
export function pickName(picker: WatchNext["picker"], id: string): string {
	const number = groupNumber(id)
	if (number !== null) return picker.groups.find((g) => g.id === id)?.name ?? ""
	return WORD_BY_ID[id]?.name ?? ""
}

/** The phone slab's button with the taste picker: "Any mood", "Slow burn", "Dark, psychological thrillers +1". */
export function picksShort(picker: WatchNext["picker"]): string {
	if (!picker.picks.length) return "Any mood"
	const first = pickName(picker, picker.picks[0])
	return picker.picks.length === 1
		? first
		: `${first} +${picker.picks.length - 1}`
}

/**
 * The picks in a sentence: names of one kind joined with "or", kinds with "and" ("Funny or Scary", "Dark,
 * psychological thrillers and Slow burn"). With moods only, the same as moodWords.
 */
export function picksWords(picker: WatchNext["picker"]): {
	words: string
	beyondMoods: boolean
} {
	const kinds = ["taste", ...WORD_KINDS] as const
	const words = kinds
		.map((kind) => {
			const names = picker.picks
				.filter((id) => kindOf(id) === kind)
				.map((id) => pickName(picker, id))
			if (names.length < 2) return names[0] ?? ""
			return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`
		})
		.filter(Boolean)
		.join(" and ")
	return {
		words,
		beyondMoods: picker.picks.some((id) => kindOf(id) !== "mood"),
	}
}

/** The dropdown's line after its title: what another pick would do, by kind. */
export function pickHint(picker: WatchNext["picker"]): string {
	if (!picker.picks.length)
		return picker.groups.length
			? "Mix moods, themes, styles, and your taste."
			: "Mix moods, themes, and styles."
	if (picker.picks.length >= MAX_PICKS) return "Remove one to pick another."
	const one: Record<ChoiceKind, string> = {
		taste: "taste group",
		mood: "mood",
		theme: "theme",
		style: "style",
	}
	const kinds: ChoiceKind[] = [
		...(picker.groups.length ? (["taste"] as const) : []),
		...WORD_KINDS,
	]
	const picked = kinds.filter((k) => picker.picks.some((p) => kindOf(p) === k))
	const others = kinds.filter((k) => !picked.includes(k))
	const list = (names: string[]) =>
		names.length > 1
			? `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} or ${names[names.length - 1]}`
			: names[0]
	const adds = `Another ${list(picked.map((k) => one[k]))} adds titles`
	return others.length
		? `${adds}; a ${list(others.map((k) => one[k]))} narrows them.`
		: `${adds}.`
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
	note: WatchNext["heroNote"],
	/** The taste picker's picks in words (picksWords), in place of the moods'. */
	picks?: { words: string; beyondMoods: boolean },
): string {
	if (note === "closestToMoods")
		return picks?.beyondMoods
			? "Closest to your picks"
			: "Closest to your moods"
	if (note) return "Nothing on your services; closest"
	const m = picks ? picks.words : moodWords(moods)
	switch (sort) {
		case "match":
			return m ? `Best match for ${m} tonight` : "Best match for you tonight"
		case "waiting":
			return m ? `Waiting longest in ${m}` : "Waiting longest on your Wishlist"
		case "added":
			return m ? `Last added in ${m}` : "Last added to your Wishlist"
		case "newest":
			return m ? `Newest release in ${m}` : "Newest release on your Wishlist"
		case "top":
			return m ? `Top rated in ${m}` : "Top rated on your Wishlist"
		case "popular":
			return m
				? `Most popular in ${m} right now`
				: "Most popular on your Wishlist right now"
	}
}

/**
 * The same line on My movies (#385): it names tonight's movie, so the page doesn't claim Tonight's pick when the
 * pick is an episode, says "your movies" for "your Wishlist", and adds the time chosen under "How long?".
 */
export function movieHeroLabel(
	sort: WatchNextSort,
	moods: readonly MoodKey[],
	note: WatchNext["heroNote"],
	time: number | null,
	picks?: { words: string; beyondMoods: boolean },
): string {
	const limit = time === null ? "" : timeLabel(time).toLowerCase()
	if (note === "nothingInTime")
		return `Tonight's movie · Nothing ${limit}; the closest`
	const line = heroLabel(sort, moods, note, picks).replace(
		/ (on|to) your Wishlist/,
		" of your movies",
	)
	return `Tonight's movie · ${line}${limit && !note ? `, ${limit}` : ""}`
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
): string | null {
	switch (sort) {
		case "match":
			return title.match ? `${title.match}% taste match` : null
		case "waiting":
		case "added":
			return `Added ${ageLabel(title.addedAt)}`
		case "newest":
			if (!title.releaseDate) return null
			return title.media_type === "show"
				? `Latest episode ${dayLabel(title.releaseDate)}`
				: `Released ${dayLabel(title.releaseDate)}`
		case "top":
			return title.goodwatch_overall_score_normalized_percent
				? `GoodWatch score ${Math.round(title.goodwatch_overall_score_normalized_percent)}`
				: null
		case "popular":
			return null
	}
}

/** "2h 12m", "95 min", "23 min episodes"; "Series" or "Film" without a runtime ("Movie" on My movies). */
export function runtimeLabel(
	title: {
		media_type: "movie" | "show"
		runtime: number | null
	},
	movie = "Film",
): string {
	const { runtime } = title
	if (!runtime) return title.media_type === "show" ? "Series" : movie
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
	otherPicks: "Almost",
	closeToTaste: TITLE_SIDES_COPY.close,
	elsewhere: "Elsewhere",
	close: "Close",
	notTonight: "Not tonight",
	notTonightsFit: "Not tonight's fit",
}

export const TIER_NOTE: Partial<Record<WatchNextTierKey, string>> = {
	notTonightsFit: "Each says why.",
	closeToTaste: "Near the taste you picked, but not in it.",
	otherMoods: "In another mood.",
	elsewhere: "Not on your services.",
	close:
		"In one of these but not on your services, or on them but in another mood.",
	notTonight: "Another mood and not on your services.",
}

/** A tier's note, in words of picks when the picks go beyond moods (the taste picker, #677). */
export function tierNote(
	key: WatchNextTierKey,
	beyondMoods: boolean,
): string | undefined {
	if (!beyondMoods) return TIER_NOTE[key]
	switch (key) {
		case "otherPicks":
			return "Missing something you picked."
		case "close":
			return "One short: missing something you picked, or not on your services."
		case "notTonight":
			return "Further from what you picked and your services."
		default:
			return TIER_NOTE[key]
	}
}

export const tierHeadingClass: Record<WatchNextTierSize, string> = {
	xl: "text-3xl md:text-4xl text-amber-300",
	lg: "text-2xl md:text-3xl text-white",
	md: "text-xl md:text-2xl text-gray-200",
	sm: "text-lg md:text-xl text-gray-400",
}

const GRID: Record<WatchNextTierSize, string> = {
	xl: "grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4",
	lg: "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3",
	md: "grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2",
	sm: "grid grid-cols-6 gap-1 md:flex md:flex-wrap md:gap-1.5",
}

// A closed group is only `hidden`: any `md:flex` kept beside it would win at desktop width.
export const tierGridClass = (size: WatchNextTierSize, open: boolean) =>
	open ? GRID[size] : "hidden"

export const titleCount = (n: number) => `${n} ${n === 1 ? "title" : "titles"}`
