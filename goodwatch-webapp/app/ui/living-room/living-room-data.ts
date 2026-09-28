// What the living room shows, and how the page turns it into the TV flow's `TvContext`. Pure and shared by the
// server and the browser.
//
// The page holds one `LivingRoomData` (titles with their moods, the Wishlist, the services catalog, and the
// this-or-that pairs) plus the person's in-page choices (`LivingRoomChoices`: services, answers). Tonight's picks
// for a night are derived here, so D-pad moves never need the loader.
import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import { type Night, type TvContext, resolvedSource } from "./tv-flow"

export type LivingRoomTitle = TitleCard & { moods: MoodKey[] }

/** One "Which one, tonight?" question: two contrasting titles, each with a short label. */
export type TvPair = {
	a: number
	b: number
	aLabel: string
	bLabel: string
	/** The moods each side stands for, so an answer can steer the picks. */
	aMoods: MoodKey[]
	bMoods: MoodKey[]
}

export type LivingRoomData = {
	member: boolean
	/** Candidates for "Something new" and for guests, best first. */
	suggestions: LivingRoomTitle[]
	/** The member's Wishlist, best match first. Empty for guests. */
	wishlist: LivingRoomTitle[]
	/** The streaming services offered on the services screen, by display name. */
	catalog: CardService[]
	/** The member's saved services (display names). Guests start with none. */
	savedServices: string[]
	pairs: TvPair[]
}

/** What the person chose on this visit: services (guests) and this-or-that answers. */
export type LivingRoomChoices = {
	services: string[]
	answers: ("a" | "b" | "skip")[]
}

export const NO_CHOICES: LivingRoomChoices = { services: [], answers: [] }

/** The remote's four streaming keys, by TMDB provider id. The name is the fallback when the catalog lacks it. */
export const REMOTE_SERVICES = [
	{ key: "netflix", id: 8, name: "Netflix" },
	{ key: "prime", id: 9, name: "Amazon Prime Video" },
	{ key: "disney", id: 337, name: "Disney Plus" },
	{ key: "hulu", id: 15, name: "Hulu" },
] as const

export type RemoteServiceKey = (typeof REMOTE_SERVICES)[number]["key"]

/** The service name a streaming key stands for, as the catalog spells it. */
export function remoteServiceName(
	key: RemoteServiceKey,
	catalog: readonly CardService[],
): string {
	const entry = REMOTE_SERVICES.find((s) => s.key === key)
	if (!entry) return key
	return catalog.find((s) => s.id === entry.id)?.name ?? entry.name
}

export function myServices(
	data: LivingRoomData,
	choices: LivingRoomChoices,
): string[] {
	return data.member ? data.savedServices : choices.services
}

export function titleOf(
	data: LivingRoomData,
	key: string | number,
): LivingRoomTitle | null {
	const k = Number(key)
	return (
		data.wishlist.find((t) => t.key === k) ??
		data.suggestions.find((t) => t.key === k) ??
		null
	)
}

const streamsOn = (t: TitleCard, names: readonly string[]) =>
	!!t.services?.some((s) => names.includes(s.name))

/** The moods the person leaned toward in this-or-that answers. */
export function answeredMoods(
	data: LivingRoomData,
	choices: LivingRoomChoices,
): Set<MoodKey> {
	const moods = new Set<MoodKey>()
	choices.answers.forEach((side, i) => {
		const pair = data.pairs[i]
		if (!pair || side === "skip") return
		for (const m of side === "a" ? pair.aMoods : pair.bMoods) moods.add(m)
	})
	return moods
}

/**
 * Titles for a night, best first: the source (Wishlist or new), the mood, and the services. A single service
 * narrows strictly; the person's own services narrow only when something is left.
 */
export function titlesFor(
	night: Night,
	data: LivingRoomData,
	choices: LivingRoomChoices,
): LivingRoomTitle[] {
	const source = resolvedSource(night, {
		member: data.member,
		wishlistKeys: data.wishlist.map((t) => String(t.key)),
	})
	let list = source === "wishlist" ? data.wishlist : data.suggestions
	if (night.mood) {
		const mood = night.mood as MoodKey
		list = list.filter((t) => t.moods.includes(mood))
	}
	if (night.service) {
		const only = night.service
		list = list.filter((t) => streamsOn(t, [only]))
	} else {
		const mine = myServices(data, choices)
		const onMine = mine.length ? list.filter((t) => streamsOn(t, mine)) : list
		if (onMine.length) list = onMine
	}
	const leaning = answeredMoods(data, choices)
	if (!leaning.size || source === "wishlist") return list
	const leans = (t: LivingRoomTitle) => t.moods.some((m) => leaning.has(m))
	return [...list.filter(leans), ...list.filter((t) => !leans(t))]
}

/** How many Wishlist titles fit each mood on the member's services (the member home's counts). */
export function moodCounts(
	data: LivingRoomData,
	choices: LivingRoomChoices,
): Record<MoodKey, number> {
	const counts = Object.fromEntries(MOOD_KEYS.map((m) => [m, 0])) as Record<
		MoodKey,
		number
	>
	const mine = myServices(data, choices)
	for (const t of data.wishlist) {
		if (mine.length && !streamsOn(t, mine)) continue
		for (const m of t.moods) counts[m]++
	}
	return counts
}

/** The `TvContext` the TV flow needs, for the night on screen. */
export function tvContextOf(
	data: LivingRoomData,
	choices: LivingRoomChoices,
	night: Night | null,
): TvContext {
	const picks = night ? titlesFor(night, data, choices) : []
	return {
		member: data.member,
		pickKeys: picks.slice(0, 3).map((t) => String(t.key)),
		wishlistKeys: data.wishlist.map((t) => String(t.key)),
		serviceNames: data.catalog.map((s) => s.name),
		moodKeys: MOOD_KEYS,
		hasServices: myServices(data, choices).length > 0,
		answered: choices.answers.filter((a) => a !== "skip").length,
		pairsLeft: Math.max(0, data.pairs.length - choices.answers.length),
		// The taste quiz fills these in the browser (`LivingRoom`), from the person's scores and picks.
		quizProgress: 0,
		quizPicks: [],
	}
}
