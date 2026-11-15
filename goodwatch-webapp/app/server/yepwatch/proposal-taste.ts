/**
 * Ranker interface: getProfileTaste(profiles, profileId, goodwatchVector?) returns
 * { vector, quantiles, confidence, seen, hidden, unseen, revision }. Keys are snapshot point ids.
 * Call during prepared builds, never inside a synchronous rank loop. Results are cached by profile revision,
 * snapshot version and member vector. GoodWatch members pass their existing vector for the bounded blend.
 * No vector/answers/profile ids belong in a room projection or a GoodWatch write.
 */
import { tasteVectorFrom, quantileTable } from "../taste/formula.server.ts"
import { tastePool, poolCosines } from "../taste/pool.server.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import type { TasteAnswer } from "../../../packages/yepwatch-contracts/proposal.ts"
export interface Answer {
	key: number
	answer: TasteAnswer | null
	source: "taste" | "followup"
	at: number
}
export function profileTaste(
	snapshot: TitleSnapshot,
	answers: readonly Answer[],
	member?: Float32Array | null
) {
	const ratings = answers
		.filter((a) => a.answer === "loved" || a.answer === "not_for_me")
		.map((a) => ({ key: a.key, score: a.answer === "loved" ? 9 : 3, at: a.at }))
	const loved = ratings.filter((r) => r.score === 9).length
	const notForMe = ratings.length - loved
	// With no usable loved fingerprints, steer away with -N; empty/unseen-only stays neutral.
	let { vector, liked } = tasteVectorFrom(
		snapshot,
		{ ratings, wantToSee: [] },
		{ minLiked: 0 }
	)
	if (member) {
		const weight = ratings.length / (ratings.length + 20)
		const blended = Float32Array.from(
			member,
			(v, k) => v + weight * (vector?.[k] ?? 0)
		)
		const norm = Math.hypot(...blended)
		vector = norm ? blended.map((v) => v / norm) : null
	}
	return {
		vector,
		liked,
		confidence: member ? 1 : Math.min(1, (loved + 0.5 * notForMe) / 8),
		quantiles: vector
			? quantileTable(poolCosines(tastePool(snapshot), vector))
			: null,
		seen: new Set(ratings.map((r) => r.key)),
		// A negative rating marks seen; it is not a permanent hidden-title action.
		hidden: new Set<number>(),
		unseen: new Set(
			answers.filter((a) => a.answer === "unseen").map((a) => a.key)
		),
	}
}

/** Inject the runtime's profiles store; members pass their existing GoodWatch vector, others omit it. */
export function getProfileTaste(
	profiles: import("./proposal-taste-profile.ts").TasteProfiles,
	profileId: string,
	goodwatchVector?: Float32Array | null
) {
	return profiles.signal(profileId, goodwatchVector)
}
