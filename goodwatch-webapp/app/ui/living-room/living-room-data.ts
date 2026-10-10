// What the living room shows, and how the page turns it into the TV flow's `TvContext`. Pure and shared by the
// server and the browser.
//
// The page holds one `LivingRoomData` (titles with their moods, the Wishlist, the services catalog, and the
// this-or-that pairs) plus the person's in-page choices (`LivingRoomChoices`: services, answers). Tonight's picks
// for a night are derived here, so D-pad moves never need the loader.
import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type { DoorKey, Night, TvContext } from "./tv-flow"

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

/** PROTOTYPE (#352): a title the start page links to in its server HTML. */
export type StartLink = Pick<TitleCard, "media_type" | "tmdb_id" | "title"> & {
	/** Only for the `tv` variant, which shows posters. */
	poster_path?: string | null
	/** Only for the scroll variants, which show it as quiet metadata. */
	release_year?: number | null
}

export type LivingRoomData = {
	member: boolean
	/** PROTOTYPE (#352): the same titles for every guest; absent without `?links=`. */
	startLinks?: StartLink[]
	/** Candidates for "Something new" and for guests, best first. */
	suggestions: LivingRoomTitle[]
	/** The member's Wishlist, best match first. Empty for guests. */
	wishlist: LivingRoomTitle[]
	/** The streaming services offered on the services screen, by display name. */
	catalog: CardService[]
	/** The member's saved services (display names). Guests start with none. */
	savedServices: string[]
	pairs: TvPair[]
	/** A member's home with REC_TRACKING (#385): three doors in place of the two tiles. Absent otherwise. */
	doors?: HomeDoors
}

/**
 * Home's doors: Continue, Start a show, A movie. A door with nothing behind it is null, and Something new then
 * takes a tile; A movie is always there.
 */
export type HomeDoors = {
	continue: {
		title: string
		backdrop_path: string | null
		/** The Next episode, "S2 E3"; null when the show has no episode list yet. */
		episode: string | null
		episodeName: string | null
		/** "Watched yesterday", "2 new since you saw it". */
		fact: string
		/** Other shows the member can continue. */
		more: number
	} | null
	start: { count: number; title: string; posters: (string | null)[] } | null
	movie: {
		count: number
		/** The first movie of My movies; null without a Want to See movie. */
		title: string | null
		runtime: number | null
		/** The member's service that carries it. */
		service: string | null
		posters: (string | null)[]
	}
}

/** The doors that have something behind them, in their order on the TV. */
export const doorKeys = (doors: HomeDoors | undefined): DoorKey[] =>
	doors
		? (["continue", "start", "movie"] as const).filter(
				(key) => key === "movie" || doors[key] !== null,
			)
		: []

/** What the person chose on this visit: services (guests) and this-or-that answers. */
export type LivingRoomChoices = {
	services: string[]
	answers: ("a" | "b" | "skip")[]
}

export const NO_CHOICES: LivingRoomChoices = { services: [], answers: [] }

/** Reads a guest's stored choices, so a reload keeps their services and answers. Anything malformed is dropped. */
export function parseChoices(raw: string | null): LivingRoomChoices {
	try {
		const value = JSON.parse(raw ?? "null")
		const services = Array.isArray(value?.services) ? value.services : []
		const answers = Array.isArray(value?.answers) ? value.answers : []
		return {
			services: services.filter((s: unknown) => typeof s === "string"),
			answers: answers.filter(
				(a: unknown) => a === "a" || a === "b" || a === "skip",
			),
		}
	} catch {
		return NO_CHOICES
	}
}

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
 * A list narrowed to a night: the mood and the services. A single service narrows strictly; the person's own
 * services narrow only when something is left.
 */
function narrow(
	list: LivingRoomTitle[],
	night: Night,
	data: LivingRoomData,
	choices: LivingRoomChoices,
): LivingRoomTitle[] {
	let out = list
	if (night.mood) {
		const mood = night.mood as MoodKey
		out = out.filter((t) => t.moods.includes(mood))
	}
	if (night.service) {
		const only = night.service
		return out.filter((t) => streamsOn(t, [only]))
	}
	const mine = myServices(data, choices)
	const onMine = mine.length ? out.filter((t) => streamsOn(t, mine)) : out
	return onMine.length ? onMine : out
}

/** Where a night's picks come from. `auto` is the Wishlist when it has titles for this night, else new titles. */
export function sourceFor(
	night: Night,
	data: LivingRoomData,
	choices: LivingRoomChoices,
): "wishlist" | "new" {
	if (night.source !== "auto") return night.source
	return data.member && narrow(data.wishlist, night, data, choices).length
		? "wishlist"
		: "new"
}

/** Titles for a night, best first, from its source (see `sourceFor`). */
export function titlesFor(
	night: Night,
	data: LivingRoomData,
	choices: LivingRoomChoices,
): LivingRoomTitle[] {
	const source = sourceFor(night, data, choices)
	const list = narrow(
		source === "wishlist" ? data.wishlist : data.suggestions,
		night,
		data,
		choices,
	)
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
		source: night ? sourceFor(night, data, choices) : "new",
		serviceNames: data.catalog.map((s) => s.name),
		moodKeys: MOOD_KEYS,
		hasServices: myServices(data, choices).length > 0,
		answered: choices.answers.filter((a) => a !== "skip").length,
		pairsLeft: Math.max(0, data.pairs.length - choices.answers.length),
		doors: doorKeys(data.doors),
		// The taste quiz fills these in the browser (`LivingRoom`), from the person's scores and picks.
		quizProgress: 0,
		quizPicks: [],
	}
}
