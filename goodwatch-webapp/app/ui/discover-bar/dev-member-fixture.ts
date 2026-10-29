// Development only, for /dev/discover-bar?fixture=member: a member's taste groups and taste counts, so the You tab's
// member state can be looked at while the harness reads the live site as a guest. The shapes follow
// /api/discover/panel?part=taste and the results' `counts=taste` blocks; the numbers are plausible shares of the list,
// not computed, so the grid and the total don't follow the picks. Only the harness route imports it.
import type { FilterState } from "~/domain/filter-state"
import { WORD_BY_ID } from "~/domain/taste-picker"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import type { TasteGroup } from "./you/useTasteGroups"

const poster = (key: string, title: string, poster_path: string) =>
	({ key, title, poster_path }) as unknown as TasteGroup["lovedPosters"][number]

const GROUPS: { group: TasteGroup; share: number }[] = [
	{
		share: 0.07,
		group: {
			key: "show-95396",
			name: "Eerie, cerebral sci-fi",
			number: 1,
			wordDots: [WORD_BY_ID["m:mind"], WORD_BY_ID["t:future"]],
			lovedPosters: [
				poster("show-95396", "Severance", "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg"),
				poster("movie-329865", "Arrival", "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg"),
				poster("show-70523", "Dark", "/wiiyc3m6HKaQhFBYeuM7ySCNQsG.jpg"),
			],
		},
	},
	{
		share: 0.06,
		group: {
			key: "show-136315",
			name: "Sharp, tense family drama",
			number: 2,
			wordDots: [WORD_BY_ID["t:family"], WORD_BY_ID["m:tense"]],
			lovedPosters: [
				poster("show-136315", "The Bear", "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg"),
				poster("show-76331", "Succession", "/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg"),
				poster("movie-496243", "Parasite", "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg"),
			],
		},
	},
	{
		share: 0.04,
		group: {
			key: "movie-129",
			name: "Gentle, magical animation",
			number: 3,
			wordDots: [WORD_BY_ID["m:magical"], WORD_BY_ID["s:animated"]],
			lovedPosters: [
				poster(
					"movie-129",
					"Spirited Away",
					"/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
				),
				poster(
					"movie-4935",
					"Howl's Moving Castle",
					"/13kOl2v0nD2OLbVSHnHk8GUFEhO.jpg",
				),
			],
		},
	},
	{
		share: 0.03,
		group: {
			key: "movie-666277",
			name: "Quiet, tender romance",
			number: 4,
			wordDots: [WORD_BY_ID["m:romance"], WORD_BY_ID["s:slow"]],
			lovedPosters: [
				poster(
					"movie-666277",
					"Past Lives",
					"/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
				),
			],
		},
	},
]

export const FIXTURE_TASTE_GROUPS: TasteGroup[] = GROUPS.map((g) => g.group)

const MATCH_SHARES = {
	0: 1,
	60: 0.68,
	70: 0.46,
	80: 0.21,
	90: 0.06,
	outside: 0.18,
}

/** The guest's counts with a member's taste blocks in place. */
export function withMemberCounts<T extends FilterBarCounts>(
	counts: T,
	state: FilterState,
): T {
	const total = counts.optionCounts.minMatch?.["0"] ?? counts.total
	const share = (n: number) => Math.round(total * n)
	const groups = Object.fromEntries(
		GROUPS.map(({ group, share: s }) => [group.key, Math.max(1, share(s))]),
	)
	const inGroups = Object.values(groups).reduce((a, b) => a + b, 0)
	const names = Object.fromEntries(
		(state.tasteGroups ?? []).flatMap((ref) => {
			const group = FIXTURE_TASTE_GROUPS.find(
				(g) => g.key === ref || String(g.number) === ref,
			)
			return group ? [[ref, group.name]] : []
		}),
	)
	return {
		...counts,
		tasteGroups: {
			groups: FIXTURE_TASTE_GROUPS.map(({ key, name }) => ({ key, name })),
			names,
		},
		optionCounts: {
			...counts.optionCounts,
			tasteGroups: { ...groups, none: Math.max(0, total - inGroups) },
			minMatch: Object.fromEntries(
				Object.entries(MATCH_SHARES).map(([step, s]) => [step, share(s)]),
			),
			notSeenYet: { on: share(0.985), off: total, seen: share(0.015) },
			wishlist: { on: Math.min(38, total), off: total },
		},
	}
}
