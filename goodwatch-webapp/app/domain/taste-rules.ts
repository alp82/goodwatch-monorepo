// When a person's taste is ready, when the rating flow marks a milestone after that, and when a guest's ratings wait
// for sign-up. Shared by the server's taste formula (server/taste/formula.server.ts), the browser's rating flow
// (ui/rating-flow/flow.ts, which the living room TV runs too) and guest progress (utils/guest-progress.ts), so they
// never disagree.

/** Taste match shows from this many liked titles (owner, #193). Want to See doesn't count. */
export const MIN_LIKED = 5
/** Ratings of this and more are liked; below are disliked. */
export const LIKED_FROM = 6
/** A guest scores this many titles; more wait for sign-up (their ratings come with them). Members have no limit. */
export const GUEST_RATING_LIMIT = 20
/**
 * The rated counts where the rating flow marks a milestone ("Your picks changed", the picks update), once the taste is
 * ready (owner, October 28, 2026). The last one is the guest limit.
 */
export const MILESTONE_STEPS: readonly number[] = [
	5,
	10,
	15,
	GUEST_RATING_LIMIT,
]
/** After the last step, a member's milestones land every this many ratings: 30, 40, … */
export const MILESTONE_EVERY = 10

/** A score that counts as liked. */
export const isLikedScore = (score: number | null | undefined): boolean =>
	score != null && score >= LIKED_FROM

/**
 * The rated count of the next milestone after `after` ratings: the next step, then for members every MILESTONE_EVERY
 * on from the last step. Null for a guest past the last step: their next rating waits for sign-up.
 */
export function nextMilestoneAt(after: number, member: boolean): number | null {
	for (const step of MILESTONE_STEPS) if (step > after) return step
	if (!member) return null
	const last = MILESTONE_STEPS[MILESTONE_STEPS.length - 1]
	return (
		last + (Math.floor((after - last) / MILESTONE_EVERY) + 1) * MILESTONE_EVERY
	)
}

/** Whether more ratings wait for sign-up: a guest at the limit. Members never. */
export const isRatingLocked = (rated: number, member: boolean): boolean =>
	!member && rated >= GUEST_RATING_LIMIT
