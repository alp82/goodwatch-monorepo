// Discover panel data: ready mood mixes counted over the filtered catalog, plus shared starter-title keys.
// Cards are hydrated per viewer; only filter results and starter selection can be shared.
import type { FilterState, SortKey } from "~/domain/filter-state"
import { GUEST_MIXES, type MoodMix } from "~/domain/mood-mixes"
import { MOOD_KEYS } from "~/domain/moods"
import { picksOf } from "~/domain/taste-picker"
import { STYLE_KEYS, THEME_KEYS, maskOfKeys } from "~/domain/themes-styles"
import { availabilityLoadedAt } from "~/server/availability-index.server"
import {
	discoverFilterCache,
	discoverFilterKey,
} from "~/server/discover-filter-cache.server"
import { loadTaste } from "~/server/taste/index.server"
import { inlineTaste } from "~/server/taste/inline.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import {
	SnapshotNotLoaded,
	filterTitles,
} from "~/server/title-filter/index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import { starterTitleKeys } from "./discover-starter-titles"
import { carriedColorWords } from "./taste-picker-counts"

interface PanelInput {
	state: FilterState
	sort: SortKey
}

export interface PanelMix extends MoodMix {
	count: number
	topTitle: TitleCard | null
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

export const PANEL_PARTS = { mixes, titles }
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
