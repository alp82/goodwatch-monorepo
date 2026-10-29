// Discover panel data: result-backed pictures and lists, starter titles, and the member's taste groups.
// Cards are hydrated per viewer; only filter results and starter selection can be shared.
import {
	filterStateToParams,
	type FilterState,
	type SortKey,
} from "~/domain/filter-state"
import { GUEST_MIXES, type MoodMix } from "~/domain/mood-mixes"
import { MOOD_KEYS } from "~/domain/moods"
import { groupsByTaste } from "~/domain/side-rows"
import { picksOf, type Word } from "~/domain/taste-picker"
import { STYLE_KEYS, THEME_KEYS, maskOfKeys } from "~/domain/themes-styles"
import { availabilityLoadedAt } from "~/server/availability-index.server"
import {
	discoverFilterCache,
	discoverFilterKey,
} from "~/server/discover-filter-cache.server"
import {
	discoverFilterDefaults,
	resolveTasteGroups,
} from "~/server/discover-results.server"
import { loadTaste } from "~/server/taste/index.server"
import { inlineTaste } from "~/server/taste/inline.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import {
	SnapshotNotLoaded,
	filterTitles,
} from "~/server/title-filter/index.server"
import {
	type TitleSnapshot,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { TitleKey } from "~/utils/title-key"
import { featuredPeople, peopleInResults } from "./discover-people.server"
import { starterTitleKeys } from "./discover-starter-titles"
import { carriedColorWords } from "./taste-picker-counts"

interface PanelInput {
	state: FilterState
	sort: SortKey
	ranked?: TitleKey[]
	forYou?: boolean
	side?: string | null
}

export interface PanelMix extends MoodMix {
	count: number
	topTitle: TitleCard | null
}

export interface PanelTasteGroup {
	key: string
	name: string
	/** Place by size (1 is largest), for the group's hue. */
	number: number
	/** The words that color this group in Watch next's taste picker. */
	wordDots: Word[]
	lovedPosters: TitleCard[]
}

/** Largest taste groups first; incomplete and repeated pairs give way to guest mixes. */
export function readyMixes(
	groups: readonly { carries: readonly string[] }[],
): MoodMix[] {
	const own = groups.flatMap((group): MoodMix[] => {
		const words = carriedColorWords(group.carries)
		if (words.length !== 2 || words[0].kind !== "mood") return []
		const tags: [string, string] = [words[0].id, words[1].id]
		return [{ id: tags.join("+"), tags }]
	})
	const unique = new Map<string, MoodMix>()
	for (const mix of [...own, ...GUEST_MIXES])
		if (!unique.has(mix.id)) unique.set(mix.id, mix)
	return [...unique.values()].slice(0, 8)
}

async function mixes(ctx: ViewerContext, input: PanelInput) {
	const snapshot = getTitleSnapshot()
	if (!snapshot) throw new SnapshotNotLoaded()
	const savedTaste = await loadTaste(ctx.viewer)
	const taste = inlineTaste(savedTaste, input.state, snapshot) ?? savedTaste
	const groups =
		ctx.viewer.kind === "member"
			? await import("~/server/watch-next-taste-picker.server")
					.then((m) => m.tasteGroupsFor(ctx, savedTaste, snapshot))
					.catch((error: unknown) => {
						console.warn("Discover panel: taste groups unavailable", error)
						return null
					})
			: null
	const { tasteFilter } = resolveTasteGroups(
		input.state.tasteGroups?.length ? groups : null,
		input.state.tasteGroups,
	)
	const definitions = readyMixes(groups?.groups ?? [])
	// One filter pass keeps all non-tag choices, including genres. The eight pair intersections are cheap mask reads.
	const state = { ...input.state, moods: [], themes: [], styles: [] }
	const key = discoverFilterKey({
		viewer: ctx,
		taste,
		state,
		sort: input.sort,
		snapshotVersion: snapshot.version,
		availabilityLoadedAt: availabilityLoadedAt(ctx.country),
		year: new Date().getUTCFullYear(),
	})
	const result = await discoverFilterCache.run(key, () =>
		filterTitles({
			universe: "catalog",
			state,
			sort: input.sort,
			taste: savedTaste,
			forYou: null,
			viewer: ctx,
			tasteGroups: tasteFilter,
		}),
	)
	const counted = definitions.map((mix) => ({
		...mix,
		count: 0,
		top: null as number | null,
	}))
	const required = definitions.map((mix) => {
		const picks = picksOf(mix.tags)
		return {
			moods: maskOfKeys(MOOD_KEYS, picks.moods),
			themes: maskOfKeys(THEME_KEYS, picks.themes),
			styles: maskOfKeys(STYLE_KEYS, picks.styles),
		}
	})
	const { moods, themes, styles } = snapshot.columns
	for (const key of result.keys) {
		const row = snapshot.rowOf(key)
		if (row < 0) continue
		const moodBits = moods[row]
		const themeBits = themes[row]
		const styleBits = styles[row]
		for (let i = 0; i < counted.length; i++) {
			const need = required[i]
			if (
				(moodBits & need.moods) !== need.moods ||
				(themeBits & need.themes) !== need.themes ||
				(styleBits & need.styles) !== need.styles
			)
				continue
			counted[i].count++
			counted[i].top ??= key
		}
	}
	const cards = await getTitleCards(
		[...new Set(counted.flatMap((mix) => mix.top ?? []))],
		ctx,
		taste,
		input.state.ageLimit === undefined ? null : result.ladder,
	)
	const byKey = new Map(cards.map((card) => [card.key, card]))
	return {
		part: "mixes" as const,
		mixes: counted.map(
			({ top, ...mix }): PanelMix => ({
				...mix,
				topTitle: top === null ? null : (byKey.get(top) ?? null),
			}),
		),
	}
}

async function titles(ctx: ViewerContext, _input: PanelInput) {
	const snapshot = getTitleSnapshot()
	if (!snapshot) throw new SnapshotNotLoaded()
	const keys = [...starterTitleKeys(snapshot)]
	// Only selection is shared. Seen, services, language and taste on cards belong to this request.
	const cards = await getTitleCards(keys, ctx, await loadTaste(ctx.viewer))
	return { part: "titles" as const, keys, cards }
}

async function people(ctx: ViewerContext, input: PanelInput) {
	const searching = input.ranked !== undefined
	const filtered =
		filterStateToParams(input.state, discoverFilterDefaults(ctx)).size > 0 ||
		Boolean(input.side)
	const unavailable = (error: unknown) => {
		console.warn("Discover panel: people unavailable", error)
		return {
			mode:
				!searching && !filtered ? ("featured" as const) : ("results" as const),
			actors: [],
			crew: [],
			unavailable: true as const,
		}
	}
	if (!searching && !filtered)
		return {
			part: "people" as const,
			...(await featuredPeople().catch(unavailable)),
		}
	const { keys } = await panelTitles(ctx, input)
	return {
		part: "people" as const,
		...(await peopleInResults(keys).catch(unavailable)),
	}
}

/** Filter and preserve the same complete list order for result-backed panel parts. */
async function panelTitles(ctx: ViewerContext, input: PanelInput) {
	const searching = input.ranked !== undefined
	const snapshot = getTitleSnapshot()
	if (!snapshot) throw new SnapshotNotLoaded()
	const savedTaste = await loadTaste(ctx.viewer)
	const taste = inlineTaste(savedTaste, input.state, snapshot) ?? savedTaste
	const groups =
		ctx.viewer.kind === "member" && input.state.tasteGroups?.length
			? await import("~/server/watch-next-taste-picker.server").then((m) =>
					m.tasteGroupsFor(ctx, savedTaste, snapshot),
				)
			: null
	const { tasteFilter } = resolveTasteGroups(groups, input.state.tasteGroups)
	const forYou = input.forYou ?? ctx.forYou
	const key = searching
		? null
		: discoverFilterKey({
				viewer: ctx,
				taste,
				state: input.state,
				sort: input.sort,
				snapshotVersion: snapshot.version,
				availabilityLoadedAt: availabilityLoadedAt(ctx.country),
				year: new Date().getUTCFullYear(),
			})
	const result = await discoverFilterCache.run(key, () =>
		filterTitles({
			universe: input.ranked ?? "catalog",
			includeNotInterested: searching,
			state: input.state,
			sort: input.sort,
			taste: savedTaste,
			forYou: forYou ? (searching ? "search" : "browse") : null,
			viewer: ctx,
			tasteGroups: tasteFilter,
		}),
	)
	let keys = result.keys
	if (
		input.side &&
		!input.state.loved?.length &&
		!input.state.disliked?.length &&
		groupsByTaste({ searching, forYou, sort: result.sortUsed })
	) {
		const engine = await import("~/server/discover-sides.server")
		const member = await engine.memberSides(ctx, taste, snapshot)
		const group = member ? engine.requestedGroup(member, input.side) : undefined
		if (member && group !== undefined)
			keys = keys.filter((key) => engine.sideOf(member, key) === group)
	}
	return { keys, taste, result, snapshot }
}

/** First title in list order for each Released choice; a show's first air year comes from facts. */
export function releasedTopKeys(
	keys: readonly TitleKey[],
	snapshot: Pick<TitleSnapshot, "columns" | "rowOf">,
	year = new Date().getUTCFullYear(),
) {
	const definitions = [
		...Array.from({ length: Math.floor((year - 1920) / 10) + 1 }, (_, i) => ({
			id: `decade:${1920 + i * 10}`,
			from: 1920 + i * 10,
			to: 1929 + i * 10,
		})),
		{ id: "thisYear", from: year, to: year },
		{ id: "last2Years", from: year - 2, to: Infinity },
		{ id: "last3Years", from: year - 3, to: Infinity },
		{ id: "recent", from: year - 2, to: Infinity },
		{ id: "last5Years", from: year - 5, to: Infinity },
		{ id: "after2000", from: 2000, to: Infinity },
		{ id: "after1950", from: 1950, to: Infinity },
	]
	const top = definitions.map((definition) => ({
		...definition,
		key: null as TitleKey | null,
	}))
	let remaining = top.length
	const facts = snapshot.columns.facts
	if (facts)
		for (const key of keys) {
			const row = snapshot.rowOf(key)
			const released = row < 0 ? 0 : facts.releaseYears[row]
			if (!released) continue
			for (const option of top)
				if (
					option.key === null &&
					released >= option.from &&
					released <= option.to
				) {
					option.key = key
					remaining--
				}
			if (remaining === 0) break
		}
	return top
}

async function released(ctx: ViewerContext, input: PanelInput) {
	const { keys, taste, result, snapshot } = await panelTitles(ctx, {
		...input,
		state: { ...input.state, years: undefined, released: "any" },
	})
	const top = releasedTopKeys(keys, snapshot)
	const cards = await getTitleCards(
		[...new Set(top.flatMap((option) => option.key ?? []))],
		ctx,
		taste,
		input.state.ageLimit === undefined ? null : result.ladder,
	)
	const byKey = new Map(cards.map((card) => [card.key, card]))
	return {
		part: "released" as const,
		available: snapshot.columns.facts !== null,
		options: top.map(({ id, key }) => ({
			id,
			topTitle: key === null ? null : (byKey.get(key) ?? null),
		})),
	}
}

async function taste(ctx: ViewerContext, _input: PanelInput) {
	const empty = { part: "taste" as const, groups: [] as PanelTasteGroup[] }
	if (ctx.viewer.kind !== "member") return empty
	const snapshot = getTitleSnapshot()
	if (!snapshot) throw new SnapshotNotLoaded()
	try {
		const savedTaste = await loadTaste(ctx.viewer)
		const { memberSides } = await import("~/server/discover-sides.server")
		const member = await memberSides(ctx, savedTaste, snapshot)
		if (!member || member.sides.length < 2) return empty
		// Watch next reuses the same cached memberSides, including its stable anchors and word descriptions.
		const { tasteGroupsFor } = await import(
			"~/server/watch-next-taste-picker.server"
		)
		const groups = await tasteGroupsFor(ctx, savedTaste, snapshot)
		if (!groups || groups.groups.length < 2) return empty
		const cards = await getTitleCards(
			[
				...new Set(
					member.sides.flatMap((side) => side.here.map((title) => title.key)),
				),
			],
			ctx,
			savedTaste,
		)
		const byKey = new Map(cards.map((card) => [card.key, card]))
		return {
			part: "taste" as const,
			groups: groups.groups.map(
				(group, i): PanelTasteGroup => ({
					key: group.key,
					name: group.name,
					number: i + 1,
					wordDots: carriedColorWords(group.carries),
					lovedPosters: member.sides[i].here.flatMap(
						(title) => byKey.get(title.key) ?? [],
					),
				}),
			),
		}
	} catch (error) {
		console.warn("Discover panel: taste groups unavailable", error)
		return empty
	}
}

export const PANEL_PARTS = { mixes, titles, people, released, taste }
export type PanelPart = keyof typeof PANEL_PARTS
export function isPanelPart(part: string | null): part is PanelPart {
	return (
		part !== null && Object.prototype.hasOwnProperty.call(PANEL_PARTS, part)
	)
}
export function getDiscoverPanel(
	ctx: ViewerContext,
	part: PanelPart,
	input: PanelInput,
) {
	return PANEL_PARTS[part](ctx, input)
}
export type DiscoverPanel = Awaited<ReturnType<typeof getDiscoverPanel>>
