// Every family's index
// page in miniature: what each mini needs to preview a place without leaving the hub. a place's preview says
// what it is with its fingerprint words and its defining tropes; every country with a page is on the map; Best cycles
// through several best-of lists; the night you're having joins as its own miniature.
import { type Ingredient, ing } from "~/domain/browse/address"
import { MIN_PAGE } from "~/server/browse/places.server"
import type { BestRow, CardData, KindOf, PlaceRef, ShowTitle } from "~/domain/browse/types"
import { WORLD_SHAPES } from "~/ui/browse/world-map/shapes"
import { cardData, slim } from "~/server/browse/cards.server"
import { cachedPage } from "~/server/browse/page-cache.server"
import type { Places } from "~/server/browse/places.server"
import type { BrowseLoader } from "~/ui/browse/view"
import { OCCASIONS, QUESTIONS, setOf } from "~/server/browse/hub/occasions.server"
import { homeLede, topBest } from "~/server/browse/hub/shared.server"
import { type TropeTag, definingTropes, tropesReady } from "~/server/browse/hub/tropes.server"

export type { TropeTag }

/** A place in a miniature: its card plus the tropes that define it. */
export type MiniPlace = CardData & { tropes: TropeTag[] }

export interface MiniMood extends MiniPlace {
	/** 0-1, lighter to darker. */
	tone: number
	/** 0-1, calmer to more intense. */
	pace: number
}

export interface MiniGenre extends MiniPlace {
	/** 0-1 against the biggest genre. */
	size: number
	count: number
	/** Its biggest kinds, each with a few posters. */
	kindsOf: Pick<KindOf, "id" | "name" | "share" | "titles" | "traits">[]
}

export interface MiniService extends CardData {
	count: number
}

/** One best-of list the Best miniature cycles through. */
export interface BestOf {
	id: string
	short: string
	q: string
	/** The word in `q` the progress line underlines. */
	key: string
	parts: Ingredient[]
	rows: BestRow[]
}

export interface MiniOccasion {
	name: string
	line: string
	parts: PlaceRef[]
	titles: ShowTitle[]
}

export interface MiniData {
	lede: string | null
	moods: MiniMood[]
	/** The mood the lattice opens on: the one most people start from. */
	moodStart: string
	decades: MiniPlace[]
	/** Every country with a page, biggest first. */
	countries: MiniPlace[]
	/** Codes the map knows, so a country without an outline is left off the map but kept in the rail. */
	mapped: string[]
	genres: MiniGenre[]
	services: MiniService[]
	streamingReady: boolean
	/** Whether the previews could show their defining tropes (members loaded). */
	tropesReady: boolean
	lists: BestOf[]
	occasions: MiniOccasion[]
}

const PREVIEW = 4

/** The hub: built once per data version and viewer setting, and shared across the fleet (page-cache.server). */
export const loadHubPage: BrowseLoader<MiniData> = async ({ atlas }) => {
	return cachedPage(atlas, {
		name: "hub",
		key: atlas.kind,
		build: async () => buildHub(atlas, await tropesReady()),
		// Without trope members the previews have no tropes; without availability the streaming tile is empty.
		complete: (data) => data.streamingReady && data.tropesReady,
		shared: true,
	})
}

export async function buildHub(atlas: Places, tropes: boolean): Promise<MiniData> {
	const withTropes = async <T extends CardData>(
		cards: T[],
	): Promise<(T & { tropes: TropeTag[] })[]> => {
		const out: (T & { tropes: TropeTag[] })[] = []
		for (const c of cards)
			out.push({
				...c,
				tropes: tropes ? await definingTropes(atlas, ing(c.place.family, c.place.slug), 2) : [],
			})
		return out
	}

	// Moods first: the first screen's titles are theirs.
	const moodCards = await withTropes(await cardData(atlas, "mood", { titles: PREVIEW, traits: 3 }))
	const axis = (m: Ingredient, key: string) => atlas.dials(m).find((d) => d.key === key)?.at ?? 0.5
	const moods = moodCards.map((c) => ({
		...c,
		tone: axis(c.place, "tone"),
		pace: axis(c.place, "pace"),
	}))
	const decades = await withTropes(await cardData(atlas, "decade", { titles: PREVIEW, traits: 3 }))
	// Every country with a full page, not a top handful: Africa and South America belong on the map.
	const countries = await withTropes(
		await cardData(atlas, "country", { titles: PREVIEW, traits: 3 }),
	)
	const genreCards = await withTropes(
		await cardData(atlas, "genre", { titles: PREVIEW, traits: 3, kinds: false }),
	)
	const counts = genreCards.map((g) => atlas.count([g.place]))
	const most = Math.max(1, ...counts)
	const genres: MiniGenre[] = []
	const genreKinds = await atlas.kindsByPlace(
		genreCards.map((g) => [g.place]),
		3,
	)
	for (const [i, g] of genreCards.entries()) {
		const kinds = genreKinds[i]
		genres.push({
			...g,
			size: counts[i] / most,
			count: counts[i],
			kindsOf: kinds.slice(0, 4).map((k) => ({
				id: k.id,
				name: k.name,
				share: k.share,
				traits: k.traits.slice(0, 2),
				titles: k.titles.slice(0, 3).map(slim),
			})),
		})
	}
	const services = atlas.streamingReady
		? (await cardData(atlas, "service", { n: 8, titles: 3, traits: 0 })).map((s) => ({
				...s,
				count: atlas.count([s.place]),
			}))
		: []

	// Best: the published list first, then best-of questions that have a page today. One title leads one list.
	const live = (parts: Ingredient[]) =>
		parts.every((p) => atlas.has(p.family, p.slug)) && atlas.count(parts) >= MIN_PAGE
	const lists: BestOf[] = [
		{
			id: "all",
			short: "All time",
			q: "Top of all time",
			key: "all time",
			parts: [],
			rows: await topBest(atlas, 5),
		},
	]
	const asked = QUESTIONS[setOf(atlas.kind)].filter((q) => live(q.parts))
	const answers = await Promise.all(asked.map((q) => atlas.best({ parts: q.parts, limit: 5 })))
	// One title leads one list, so two lists in a row never open on the same film.
	const leads = new Set(lists.map((l) => l.rows[0]?.title.card.key))
	asked.forEach((q, n) => {
		const rows = answers[n].rows
		if (lists.length >= 24 || rows.length < 5 || leads.has(rows[0].title.card.key)) return
		leads.add(rows[0].title.card.key)
		lists.push({ id: q.parts.map((p) => p.slug).join("+"), ...q, rows })
	})

	const occasions: MiniOccasion[] = []
	for (const o of OCCASIONS[setOf(atlas.kind)]) {
		if (occasions.length >= 6 || !live(o.parts) || atlas.count(o.parts) < MIN_PAGE * 2) continue
		occasions.push({
			name: o.name,
			line: o.line,
			parts: o.parts.map((p) => atlas.ref(p)),
			titles: (await atlas.showcase(o.parts, 3)).map(slim),
		})
	}

	const codes = new Set(WORLD_SHAPES.map((s) => s.code).filter(Boolean))
	return {
		lede: homeLede(atlas),
		moods,
		moodStart: moods.find((m) => m.place.slug === "cozy")?.place.slug ?? moods[0]?.place.slug ?? "",
		decades,
		countries,
		mapped: countries.flatMap((c) =>
			c.place.code && codes.has(c.place.code) ? [c.place.code] : [],
		),
		genres,
		services,
		streamingReady: atlas.streamingReady,
		tropesReady: tropes,
		lists,
		occasions,
	}
}
