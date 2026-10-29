// What the You tab reads from and writes to the filter state, and the counts it shows: taste group picks (up to three,
// any of), the taste match step (Any to 90%+, or Outside your usual), and the three lists (Not seen yet, Seen before,
// On your wishlist). Pure, no React.
import type { FilterOptionCounts, FilterState } from "~/domain/filter-state"
import { MAX_PICKS } from "~/domain/taste-picker"

/** A taste match row: a minimum match, or Outside your usual. */
export type MatchStep = FilterState["minMatch"] | "outside"

/** The match rows, top to bottom: 90%+ down to Any, then Outside your usual. */
export const MATCH_ROWS: readonly MatchStep[] = [90, 80, 70, 60, 0, "outside"]

export const matchLabel = (step: MatchStep): string =>
	step === "outside" ? "Outside your usual" : step ? `${step}%+` : "Any"

/** The step the state is on. */
export const matchStepOf = (state: FilterState): MatchStep =>
	state.outsideUsual ? "outside" : state.minMatch

export const matchPatch = (step: MatchStep): Partial<FilterState> =>
	step === "outside"
		? { minMatch: 0, outsideUsual: true }
		: { minMatch: step, outsideUsual: undefined }

/** Rows from the pick up are tinted: 80%+ lights 80 and 90. Any and Outside your usual light only themselves. */
export const matchLit = (step: MatchStep, value: MatchStep): boolean =>
	typeof step === "number" &&
	typeof value === "number" &&
	value !== 0 &&
	step >= value

/** A row's count from `optionCounts.minMatch`; null while it hasn't come. */
export const matchCount = (
	counts: FilterOptionCounts | null | undefined,
	step: MatchStep,
): number | null => counts?.minMatch?.[String(step)] ?? null

// ---------------------------------------------------------------------------------------------------------------
// Taste groups

/** What a row needs of a taste group. */
export interface GroupRef {
	key: string
	/** Place by size, 1 for the largest. */
	number: number
}

/** The references in the state that name this group: its stable key, or an older link's size order ("2"). */
const refsOf = (group: GroupRef) => [group.key, String(group.number)]

export const groupOn = (state: FilterState, group: GroupRef): boolean =>
	(state.tasteGroups ?? []).some((ref) => refsOf(group).includes(ref))

/** How many of the member's groups are picked (references that name no group of theirs don't count). */
export const groupPicks = (
	state: FilterState,
	groups: readonly GroupRef[],
): number => groups.filter((group) => groupOn(state, group)).length

/** Whether every pick is taken, so the rows not picked dim. */
export const groupsFull = (
	state: FilterState,
	groups: readonly GroupRef[],
): boolean => groupPicks(state, groups) >= MAX_PICKS

/** Picks or unpicks a group by its stable key; a fourth pick is refused. */
export function toggleGroup(
	state: FilterState,
	group: GroupRef,
	groups: readonly GroupRef[],
): Partial<FilterState> | null {
	const refs = [
		...new Set(
			(state.tasteGroups ?? []).flatMap((ref) => {
				const current = groups.find((candidate) =>
					refsOf(candidate).includes(ref),
				)
				return current ? [current.key] : []
			}),
		),
	]
	if (groupOn(state, group)) {
		const rest = refs.filter((ref) => ref !== group.key)
		return { tasteGroups: rest.length ? rest : undefined }
	}
	if (groupsFull(state, groups)) return null
	return { tasteGroups: [...refs, group.key] }
}

/** A group's count from `optionCounts.tasteGroups`; `none` for the titles in no group. */
export const groupCount = (
	counts: FilterOptionCounts | null | undefined,
	key: string,
): number | null => counts?.tasteGroups?.[key] ?? null

// ---------------------------------------------------------------------------------------------------------------
// Your lists

export type ListId = "notSeenYet" | "seenBefore" | "onWishlist"

/** The lists, in order. Not seen yet and Seen before exclude each other (useFilterState resolves it). */
export const LISTS: readonly { id: ListId; label: string }[] = [
	{ id: "notSeenYet", label: "Not seen yet" },
	{ id: "seenBefore", label: "Seen before" },
	{ id: "onWishlist", label: "On your wishlist" },
]

export const listOn = (state: FilterState, id: ListId): boolean =>
	Boolean(state[id])

export const listPatch = (id: ListId, on: boolean): Partial<FilterState> =>
	id === "notSeenYet" ? { notSeenYet: on } : { [id]: on || undefined }

/**
 * What a list's switch hides from this list, on or off: everything without it minus what it keeps. Null while the
 * counts haven't come.
 */
export function listHides(
	counts: FilterOptionCounts | null | undefined,
	id: ListId,
): number | null {
	const block = id === "onWishlist" ? counts?.wishlist : counts?.notSeenYet
	const kept = block?.[id === "seenBefore" ? "seen" : "on"]
	const all = block?.off
	if (kept === undefined || all === undefined) return null
	return Math.max(0, all - kept)
}

/** A bar's length, 0 to 1, against the biggest count of its block. */
export const shareOf = (count: number | null, top: number): number =>
	count === null || top <= 0 ? 0 : Math.min(1, count / top)
