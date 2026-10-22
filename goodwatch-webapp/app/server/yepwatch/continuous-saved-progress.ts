import type {
	EpisodeIdentity,
	MemberProgressResponse,
} from "../../../packages/yepwatch-contracts/continuous.ts"
/** Tracking's public map uses `show-123`, unlike numeric catalog/filter keys. */
export function savedShowIds(
	states: Readonly<Record<string, { state: string }>>,
): number[] {
	return Object.entries(states).flatMap(([key, value]) => {
		const match = /^show-([1-9][0-9]*)$/.exec(key)
		return match &&
			(value.state === "watching" || value.state === "seen") &&
			Number.isSafeInteger(Number(match[1]))
			? [Number(match[1])]
			: []
	})
}
/** Only exact common next episodes. No earliest-person rewind, skipped history or anonymous progress oracle. */
export function sharedSavedContinuations(
	inputs: readonly MemberProgressResponse[],
): ReadonlyMap<number, EpisodeIdentity> {
	const result = new Map<number, EpisodeIdentity>()
	if (!inputs.length) return result
	for (const own of inputs[0].shows) {
		const next = own.nextEpisode
		if (!next) continue
		if (
			inputs.every(
				(input) =>
					input.source === "goodwatch" &&
					input.shows.some(
						(show) =>
							show.showId === own.showId &&
							show.nextEpisode?.tmdbId === next.tmdbId &&
							show.nextEpisode.season === next.season &&
							show.nextEpisode.number === next.number,
					),
			)
		)
			result.set(own.showId, next)
	}
	return result
}
