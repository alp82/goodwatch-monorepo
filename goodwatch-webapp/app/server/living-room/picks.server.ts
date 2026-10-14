import { rankStep } from "~/domain/taste-match"
import type { Taste } from "~/server/taste/index.server"

/** The pool cannot be read yet: the title snapshot is still loading. The route answers 503 with Retry-After. */
export class LivingRoomUnavailable extends Error {}

/**
 * What the living room orders a title by under For you: its percentile in the person's range, in the 50 even steps
 * these orders have always gone by, so titles within a step go by popularity. 0 without a taste match.
 */
export function rankOf(taste: Taste, key: number): number {
	const percentile = taste.percentile([key])[0]
	return percentile === null ? 0 : rankStep(percentile)
}
