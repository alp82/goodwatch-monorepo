// PROTOTYPE - throwaway (prototype/explore-r5, slot "places"). Dials with the map: every country's place on the
// named directions (lighter to darker, calmer to more intense, ...), so a dial can light the countries that fit.
import { ing } from "../../../../kit/address"
import { pageCopy } from "../../../../kit/optional"
import type { DialSpec, Stop } from "../../../dials/tune"
import { AXIS_TEXT } from "../../../dials/words"
import { cardData } from "../../cards.server"
import type { SlotLoader } from "../../contract"
import type { CardData } from "../../../../kit/types"

/** The directions a country can be asked for, in the order of the dials. */
export const AXES = ["tone", "pace", "world"] as const
export type Axis = (typeof AXES)[number]

/** A country's card data and how a person names its page ("Japanese movies"). */
export interface AtlasPlace extends CardData {
	name: string
}

export interface TunedPlace extends AtlasPlace {
	/** Where the country sits on each direction, 0-1 across the countries (in the order of AXES). */
	at: number[]
}

export interface TunedData {
	lede: string | null
	countries: TunedPlace[]
	dials: DialSpec[]
}

const FIVE = [0, 0.25, 0.5, 0.75, 1]

/** What each stop means for a country (the kit's blurbs talk about one evening's titles). */
const BLURBS: Record<Axis, string[]> = {
	tone: [
		"Where the sunniest stories come from.",
		"On the bright side, with a little shade.",
		"Light and shadow in balance.",
		"Countries whose stories get heavy.",
		"Where the bleakest stories come from.",
	],
	pace: [
		"The quiet ones: long looks, slow evenings.",
		"Unhurried, with a pulse.",
		"It moves, and you can still breathe.",
		"Tight and tense. Hard to look away.",
		"Full throttle, start to finish.",
	],
	world: [
		"As real as it gets. Could be your street.",
		"Our world, more or less.",
		"One foot in reality, one somewhere else.",
		"Magic, monsters, or far futures.",
		"Somewhere else entirely.",
	],
}

export const load: SlotLoader<TunedData> = async ({ kit, url }) => {
	const cards = await cardData(kit, "country", { titles: 3 })
	const link = (id: string, value: string | undefined) => {
		const params = new URLSearchParams(url.searchParams)
		if (value === undefined) params.delete(id)
		else params.set(id, value)
		const search = params.toString()
		return `${url.pathname}${search ? `?${search}` : ""}`
	}
	const dials: DialSpec[] = AXES.map((axis, col) => {
		const text = AXIS_TEXT[axis]
		const picked = url.searchParams.get(axis)
		const stops: Stop[] = FIVE.map((at, i) => ({
			id: String(i + 1),
			name: text.stops[i],
			at,
			blurb: BLURBS[axis][i],
			to: link(axis, String(i + 1)),
		}))
		return {
			id: axis,
			kind: "axis",
			question: text.question,
			color: "#e5e7eb",
			col,
			lo: 0,
			hi: 1,
			stops,
			home: null,
			value: stops.some((s) => s.id === picked) ? picked : null,
			off: link(axis, undefined),
			low: text.low,
			high: text.high,
		}
	})
	return {
		lede: pageCopy(kit.kind, "hub", "countries")?.lede ?? null,
		countries: cards.map((c) => {
			const part = ing("country", c.place.slug)
			const found = kit.dials(part)
			return {
				...c,
				name: kit.name([part]),
				at: AXES.map((axis) => found.find((d) => d.key === axis)?.at ?? 0.5),
			}
		}),
		dials,
	}
}
