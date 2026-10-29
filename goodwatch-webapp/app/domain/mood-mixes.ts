import type { FilterState } from "./filter-state"
import { picksOf } from "./taste-picker"

export interface MoodMix {
	id: string
	/** Taste-picker word ids: a mood and a theme or style. */
	tags: [string, string]
}

export const GUEST_MIXES: readonly MoodMix[] = [
	["m:feelgood", "s:animated"],
	["m:funny", "t:crime"],
	["m:scary", "s:slow"],
	["m:romance", "t:history"],
	["m:action", "t:future"],
	["m:heavy", "t:true"],
	["m:mind", "s:stylized"],
	["m:funny", "t:family"],
].map(([mood, other]) => ({ id: `${mood}+${other}`, tags: [mood, other] }))

/** Applying a mix replaces Feel, About and Style; every other filter stays. */
export function stateForMix(state: FilterState, mix: MoodMix): FilterState {
	const { moods, themes, styles } = picksOf(mix.tags)
	return {
		...state,
		moods,
		themes,
		styles,
		allOf: [
			...new Set([
				...(state.allOf ?? []),
				"moods",
				"themes",
				"styles",
			] as const),
		],
	}
}
