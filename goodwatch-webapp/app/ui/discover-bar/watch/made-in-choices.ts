// What the Made in sub-tab writes to the filter state and the counts it shows. Pure, no React.
//
// A title fits when any picked country made it, co-productions included. Film industries and regions are country sets
// (film-industries.ts): a set reads on when every one of its countries is picked. Rest of the world is its own choice
// (`restOfWorld`): every country but the big eight.
import { INDUSTRIES, POPULAR, REGIONS } from "~/domain/film-industries"
import type { FilterState } from "~/domain/filter-state"

type MadeInState = Pick<FilterState, "productionCountries" | "restOfWorld">
type MadeInPatch = Pick<FilterState, "productionCountries">

const write = (codes: readonly string[]): MadeInPatch => ({
	productionCountries: codes.length ? [...new Set(codes)] : undefined,
})

export const picked = (state: MadeInState): string[] =>
	state.productionCountries ?? []

/** Whether nothing narrows where titles were made. */
export const anyCountry = (state: MadeInState) =>
	!picked(state).length && !state.restOfWorld

export const anyCountryPatch = (): MadeInState => ({
	productionCountries: undefined,
	restOfWorld: undefined,
})

export function toggleCountryPatch(
	state: MadeInState,
	code: string,
): MadeInPatch {
	const codes = picked(state)
	return write(
		codes.includes(code)
			? codes.filter((other) => other !== code)
			: [...codes, code],
	)
}

/** Whether every country of a set is picked. */
export const setOn = (state: MadeInState, codes: readonly string[]) =>
	codes.length > 0 && codes.every((code) => picked(state).includes(code))

/** How many countries of a set are picked. */
export const setPicked = (state: MadeInState, codes: readonly string[]) =>
	codes.filter((code) => picked(state).includes(code)).length

/** A set: every country off when it is on, else every one of them on, the other picks kept. */
export function toggleSetPatch(
	state: MadeInState,
	codes: readonly string[],
): MadeInPatch {
	const current = picked(state)
	return write(
		setOn(state, codes)
			? current.filter((code) => !codes.includes(code))
			: [...current, ...codes],
	)
}

export const toggleRestOfWorldPatch = (
	state: MadeInState,
): Pick<FilterState, "restOfWorld"> => ({
	restOfWorld: state.restOfWorld ? undefined : true,
})

/** Picked countries outside Popular lead Popular, while they are few. */
export const MAX_EXTRA = 8

/** The Popular column: the picked countries Popular doesn't list (up to MAX_EXTRA), then Popular. */
export function popularCountries(state: MadeInState): {
	codes: string[]
	more: number
} {
	const extra = picked(state).filter((code) => !POPULAR.includes(code))
	return extra.length <= MAX_EXTRA
		? { codes: [...extra, ...POPULAR], more: 0 }
		: { codes: POPULAR, more: extra.length }
}

/** The countries "Find a country" searches: every country with titles in the list, the curated ones, the picked ones. */
export const findableCodes = (
	state: MadeInState,
	counts: Record<string, number> | null | undefined,
): string[] => [
	...Object.keys(counts ?? {}).filter((key) => /^[A-Z]{2}$/.test(key)),
	...POPULAR,
	...REGIONS.flatMap((region) => region.codes),
	...INDUSTRIES.flatMap((industry) => industry.codes),
	...picked(state),
]

/** A count from `optionCounts.productionCountries`: a country code, `set:<id>` or `world`. Null without counts. */
export const originCount = (
	counts: Record<string, number> | null | undefined,
	key: string,
): number | null => (counts ? (counts[key] ?? 0) : null)
