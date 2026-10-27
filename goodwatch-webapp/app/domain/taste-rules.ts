// When a person's taste is ready, and when the rating flow marks a milestone after that. Shared by the server's taste
// formula (server/taste/formula.server.ts) and the browser's rating flow (ui/rating-flow/flow.ts), so the two never
// disagree about how many liked titles a taste needs.

/** Taste match shows from this many liked titles (owner, #193). Want to See doesn't count. */
export const MIN_LIKED = 5
/** Ratings of this and more are liked; below are disliked. */
export const LIKED_FROM = 6
/** Once the taste is ready, the rating flow marks a milestone every this many ratings ("Your picks changed"). */
export const MILESTONE_EVERY = 10

/** A score that counts as liked. */
export const isLikedScore = (score: number | null | undefined): boolean =>
	score != null && score >= LIKED_FROM
