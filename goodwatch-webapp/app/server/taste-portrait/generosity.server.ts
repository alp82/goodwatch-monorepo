// How generous a person is against the GoodWatch score, per kind: You vs everyone (everyone.server.ts) and the
// fingerprint's per-attribute "vs everyone" (fingerprint.server.ts) both allow for it, so the two numbers agree.
// GoodWatch scores shows about 9 points higher than movies, so one offset across both would read shows as colder.

/** A title counts against everyone only with a GoodWatch score from at least this many votes. */
export const EVERYONE_VOTES = 1000

export interface ScoredAgainstEveryone {
	kind: "movie" | "show"
	/** The person's score, 1 to 10. */
	score: number
	/** The GoodWatch score, 0 to 100. */
	everyone: number
}

/** Whether a title's GoodWatch score is solid enough to compare the person's score with. */
export const countsAgainstEveryone = <
	F extends { score: number | null; votes: number },
>(
	facts: F,
): facts is F & { score: number } =>
	facts.score !== null && facts.score > 0 && facts.votes >= EVERYONE_VOTES

/**
 * The person's generosity per kind: their score times ten minus the GoodWatch score, averaged over their movies and over
 * their shows apart. A kind without titles has no offset.
 */
export function kindOffsets(titles: readonly ScoredAgainstEveryone[]) {
	const of = (kind: ScoredAgainstEveryone["kind"]) => {
		const gaps = titles
			.filter((t) => t.kind === kind)
			.map((t) => t.score * 10 - t.everyone)
		return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
	}
	return { movie: of("movie"), show: of("show") }
}
