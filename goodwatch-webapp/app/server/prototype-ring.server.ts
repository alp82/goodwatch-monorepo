// PROTOTYPE for "Prototype native-scroll carousels on title pages", fifth round. Throwaway code: not for production.
//
// Where the ring variants get their titles: the fourth round's request per direction (prototype-dive.server.ts, one
// Qdrant request for the nearest fingerprints that score further on the direction's attributes, kept for a day under
// the same cache name, because the cached value has the same shape). New here:
// - the axes come from the browser (a dial chose them) or are chosen for the form from the related titles;
// - a direction can be anchored to the title where the visitor started walking that way: its titles are then that
//   title's, filtered to the ones further than the title the visitor stands on. That request is already cached.
import {
	type Known,
	candidatesOf,
	titlesOf,
} from "~/server/prototype-dive.server"
import {
	type Axis,
	type Candidate,
	axisOf,
	keyOf,
} from "~/ui/prototype-carousels/dive-model"
import type { PxType, Scores } from "~/ui/prototype-carousels/explore-model"
import {
	RING_FORMS,
	type RingModel,
	type RingOption,
	type RingShape,
	buildRingModel,
	ownTraits,
	presetAxes,
	ringDirections,
	startAxes,
	surpriseAxis,
	unpackOption,
} from "~/ui/prototype-carousels/ring-model"

type Key = { type: PxType; id: number }

export async function ringModel(input: {
	variant: RingShape
	type: PxType
	tmdbId: number
	center?: Known
	/** The walk's axes, as the browser passes them on. Without them the form's start axes are chosen. */
	axes?: string[]
	/** The page title's own traits, as the browser passes them on. Without them they are computed. */
	traits?: string[]
	/** A choice the server makes: a preset by name, or "surprise" for the axis in a slot. */
	pick?: { preset?: string; slot?: number } | null
	/** The fingerprints of the center's related titles, asked for only when something has to be chosen. */
	neighbors: () => Promise<Scores[]>
	lock?: string | null
	from?: (Key & { via: string }) | null
	/** The title where the visitor started walking in `dir`. */
	anchor?: (Key & { dir: string }) | null
	more?: string | null
	links?: RingModel["links"]
}): Promise<RingModel | undefined> {
	const form = RING_FORMS[input.variant]
	const centerKey = { type: input.type, id: input.tmdbId }
	const anchored =
		input.anchor && keyOf(input.anchor) !== keyOf(centerKey)
			? input.anchor
			: null
	const known = await titlesOf([
		...(input.center ? [] : [centerKey]),
		...(input.from ? [input.from] : []),
		...(anchored ? [anchored] : []),
	])
	const center = input.center ?? known.get(keyOf(centerKey))
	if (!center) return undefined

	const given = (input.axes ?? [])
		.map((id) => axisOf(id))
		.filter((axis): axis is Axis => Boolean(axis))
	const needsChoice =
		given.length < form.axes || Boolean(input.pick) || !input.traits
	const neighbors = needsChoice ? await input.neighbors() : []
	const traits: RingOption[] = input.traits
		? input.traits
				.map(unpackOption)
				.filter((option): option is RingOption => Boolean(option))
		: ownTraits(center.scores, neighbors, 4)
	let axes =
		given.length >= form.axes
			? given.slice(0, form.axes)
			: startAxes(input.variant, center.scores, neighbors, traits)
	if (input.pick?.preset)
		axes = presetAxes(
			input.pick.preset,
			center.scores,
			neighbors,
			traits,
			input.pick.preset === "surprise" ? axes.map((axis) => axis.id) : [],
		)
	else if (input.pick?.slot !== undefined) {
		const slot = input.pick.slot
		// The traits dial offers only the title's own traits, so its surprise is one of them.
		const only =
			form.dial === "traits"
				? traits
						.map((trait) => axisOf(trait.id))
						.filter((axis): axis is Axis => Boolean(axis))
				: undefined
		const next = surpriseAxis(center.scores, neighbors, traits, axes, only)
		if (next) axes = axes.map((axis, i) => (i === slot ? next : axis))
	}

	const directions = ringDirections(input.variant, axes)
	const anchorTitle = anchored ? known.get(keyOf(anchored)) : undefined
	const lists = await Promise.all(
		directions.map(async (direction): Promise<Candidate[]> => {
			if (anchorTitle && anchored?.dir === direction.id) {
				const fromAnchor = (
					await candidatesOf(
						anchored.type,
						anchored.id,
						anchorTitle.scores,
						direction,
					)
				).filter((candidate) => keyOf(candidate.title) !== keyOf(centerKey))
				// When the anchor's titles run out before the direction does, the walk goes on from the center.
				if (fromAnchor.length) return fromAnchor
			}
			return candidatesOf(input.type, input.tmdbId, center.scores, direction)
		}),
	)
	// A step has no related panel at hand: its text links are the nearest titles of the directions, in turn.
	const stepLinks: RingModel["links"] = []
	if (!input.links) {
		const seen = new Set<string>()
		for (let i = 0; i < 8; i++)
			for (const list of lists) {
				const title = list[i]?.title
				if (!title || seen.has(keyOf(title))) continue
				seen.add(keyOf(title))
				stepLinks.push({
					type: title.type,
					id: title.id,
					title: title.title,
					year: title.year,
				})
			}
	}
	const from = input.from ? known.get(keyOf(input.from)) : undefined
	return buildRingModel({
		variant: input.variant,
		center: center.title,
		scores: center.scores,
		axes,
		candidates: Object.fromEntries(
			directions.map((direction, i) => [direction.id, lists[i]]),
		),
		lock: input.lock ?? null,
		from:
			from && input.from ? { title: from.title, via: input.from.via } : null,
		traits,
		links: input.links ?? stepLinks,
		more: input.more,
	})
}
