// PROTOTYPE - throwaway (prototype/explore-r6, round 7 rework; slot "hub", variant "miniatures"). Every family's index
// page in miniature: what each mini needs to preview a place without leaving the hub. Round 7: a place's preview says
// what it is with its fingerprint words and its defining tropes; every country with a page is on the map; Best cycles
// through several best-of lists; the night you're having joins as its own miniature.
import { type Ingredient, ing } from "../../../../kit/address"
import { MIN_PAGE } from "../../../../kit/data.server"
import type { BestRow, CardData, KindOf, PlaceRef, ShowTitle } from "../../../../kit/types"
import { WORLD_SHAPES } from "../../../../kit/world-map/shapes"
import { cardData, slim } from "../../cards.server"
import type { SlotLoader } from "../../contract"
import { OCCASIONS, QUESTIONS, setOf } from "./occasions.server"
import { homeLede, topBest } from "./shared.server"
import { type TropeTag, definingTropes, tropesReady } from "./tropes.server"

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
	lists: BestOf[]
	occasions: MiniOccasion[]
}

const PREVIEW = 4

export const load: SlotLoader<MiniData> = async ({ kit }) => {
	const tropes = await tropesReady()
	const withTropes = <T extends CardData>(cards: T[]): (T & { tropes: TropeTag[] })[] =>
		cards.map((c) => ({
			...c,
			tropes: tropes ? definingTropes(kit, ing(c.place.family, c.place.slug), 2) : [],
		}))

	// Moods first: the first screen's titles are theirs.
	const moodCards = withTropes(await cardData(kit, "mood", { titles: PREVIEW, traits: 3 }))
	const axis = (m: Ingredient, key: string) => kit.dials(m).find((d) => d.key === key)?.at ?? 0.5
	const moods = moodCards.map((c) => ({
		...c,
		tone: axis(c.place, "tone"),
		pace: axis(c.place, "pace"),
	}))
	const decades = withTropes(await cardData(kit, "decade", { titles: PREVIEW, traits: 3 }))
	// Every country with a full page, not a top handful: Africa and South America belong on the map.
	const countries = withTropes(await cardData(kit, "country", { titles: PREVIEW, traits: 3 }))
	const genreCards = withTropes(
		await cardData(kit, "genre", { titles: PREVIEW, traits: 3, kinds: false }),
	)
	const counts = genreCards.map((g) => kit.count([g.place]))
	const most = Math.max(1, ...counts)
	const genres: MiniGenre[] = []
	for (const [i, g] of genreCards.entries()) {
		const kinds = await kit.kinds([g.place], 3)
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
	const services = kit.streamingReady
		? (await cardData(kit, "service", { n: 8, titles: 3, traits: 0 })).map((s) => ({
				...s,
				count: kit.count([s.place]),
			}))
		: []

	// Best: the published list first, then best-of questions that have a page today. One title leads one list.
	const live = (parts: Ingredient[]) =>
		parts.every((p) => kit.has(p.family, p.slug)) && kit.count(parts) >= MIN_PAGE
	const lists: BestOf[] = [
		{
			id: "all",
			short: "All time",
			q: "The best of all time",
			key: "all time",
			parts: [],
			rows: await topBest(kit, 5),
		},
	]
	const asked = QUESTIONS[setOf(kit.kind)].filter((q) => live(q.parts))
	const answers = await Promise.all(asked.map((q) => kit.best({ parts: q.parts, limit: 5 })))
	// One title leads one list, so two lists in a row never open on the same film.
	const leads = new Set(lists.map((l) => l.rows[0]?.title.card.key))
	asked.forEach((q, n) => {
		const rows = answers[n].rows
		if (lists.length >= 24 || rows.length < 5 || leads.has(rows[0].title.card.key)) return
		leads.add(rows[0].title.card.key)
		lists.push({ id: q.parts.map((p) => p.slug).join("+"), ...q, rows })
	})

	const occasions: MiniOccasion[] = []
	for (const o of OCCASIONS[setOf(kit.kind)]) {
		if (occasions.length >= 6 || !live(o.parts) || kit.count(o.parts) < MIN_PAGE * 2) continue
		occasions.push({
			name: o.name,
			line: o.line,
			parts: o.parts.map((p) => kit.ref(p)),
			titles: (await kit.showcase(o.parts, 3)).map(slim),
		})
	}

	const codes = new Set(WORLD_SHAPES.map((s) => s.code).filter(Boolean))
	return {
		lede: homeLede(kit),
		moods,
		moodStart: moods.find((m) => m.place.slug === "cozy")?.place.slug ?? moods[0]?.place.slug ?? "",
		decades,
		countries,
		mapped: countries.flatMap((c) =>
			c.place.code && codes.has(c.place.code) ? [c.place.code] : [],
		),
		genres,
		services,
		streamingReady: kit.streamingReady,
		lists,
		occasions,
	}
}
